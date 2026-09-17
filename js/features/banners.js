/* صورة من بلدي — features/banners.js
   البنرات والتنبيهات */

import { currentUser, isAnon, sb } from '../core/db.js';
import { rankOf } from '../core/format.js';
import { get, need } from '../core/hub.js';
import { imgUrl, thumbUrl, vidUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, esc } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';
const _PHOTO_TAGS_ = () => get('PHOTO_TAGS');

/* ═══ عبر الحاجز ═══
   accTab ← features/account.js
   openSponsorsPage ← features/contest.js
*/
const accTab = need('accTab');
const openSponsorsPage = need('openSponsorsPage');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');
const getViewPrefs = need('getViewPrefs');
const loadSunTimes = need('loadSunTimes');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const addUserPin = need('addUserPin');
const closeSheet = need('closeSheet');
const closeUni = need('closeUni');
const detectMyRegion = need('detectMyRegion');
const loadClaims = need('loadClaims');
const loadRace = need('loadRace');
const loadVisitCounts = need('loadVisitCounts');
const openQuests = need('openQuests');
const openRace = need('openRace');
const openShooters = need('openShooters');
const openUserSearch = need('openUserSearch');
const openWaiting = need('openWaiting');
const renderMap = need('renderMap');
/* state.map → state.map */
/* state.race → state.race */
/* state.viewMode → state.viewMode */
/* ====== الفلتر الموحد ====== */
export function initHero(){
  const el=$('hero');if(!el)return;
  try{
    if(localStorage.getItem('sowra_hero_seen')){el.style.display='none';return;}
    el.style.display='block';
  }catch(e){el.style.display='block';}
}

export function closeHero(){
  $('hero').style.display='none';
  try{localStorage.setItem('sowra_hero_seen','1')}catch(e){}
}

/* ====== البنر الجانبي للراعي ====== */

export async function renderHomeHero(){
  const el=$('homeHero');if(!el)return;
  if(!window.__USER_LAT){el.style.display='none';return}
  state.myRegion=detectMyRegion();
  if(!state.myRegion){
    // خارج التغطية — دعوة للتوثيق
    el.style.display='block';
    el.innerHTML=`<div class="hh-place">📍 منطقتك بلا صور بعد</div>
      <div class="hh-line">ما وثّق أحدٌ ما حولك — <b>كن أول من يصوّرها</b></div>
      <button class="hh-cta" onclick="go('add')">📷 انشر أول صورة</button>`;
    return;
  }

  const d=p=>Math.hypot((p.lat-window.__USER_LAT)*111,(p.lng-window.__USER_LNG)*111*Math.cos(window.__USER_LAT*Math.PI/180));
  const mine=state.photos.filter(p=>p.region===state.myRegion&&!p.abroad);
  const near=state.photos.filter(p=>p.lat&&p.lng&&!p.abroad&&d(p)<=50);

  await loadRace();
  const idx=state.race.findIndex(r=>r.region===state.myRegion);
  const rank=idx>=0?idx+1:null;
  const gapTxt=(idx>0)?`تحتاج <b>${Math.ceil((state.race[idx-1].total-state.race[idx].total)/10)}</b> صور لتتجاوز <b>${esc(state.race[idx-1].region)}</b>`:'';

  el.style.display='block';
  el.innerHTML=`<div class="hh-place">📍 أنت في ${esc(state.myRegion)}</div>
    <div class="hh-line">${mine.length} صورة من ديرتك · ${near.length} حولك ضمن ٥٠ كم</div>
    ${rank?`<div class="hh-line" style="margin-top:4px">🏁 ترتيب منطقتك: <b>#${rank}</b>${gapTxt?' — '+gapTxt:''}</div>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="hh-cta" onclick="go('add')">📷 وثّق ديرتك</button>
      ${rank?`<span class="hh-rank" onclick="openRace()">🏆 شوف السباق</span>`:''}
    </div>`;
}

/* ====== خزنتي — الصور الخاصة ====== */

export function renderSponsorSide(){
  const el=$('sponsorSide');if(!el)return;
  const sp=state.banner;
  if(!sp||!sp.side_active){el.style.display='none';return}
  el.style.display='flex';
  el.innerHTML=(sp.image_path?`<img src="${imgUrl(sp.image_path)}" alt="${esc(sp.sponsor_name||'')}">`:'')+
    `<div class="sp-info">
      <div class="sp-name">${esc(sp.sponsor_name||'راعي المنصة')}</div>
      <div class="sp-cat">${esc(sp.sponsor_cat||'')}</div>
    </div>
    <button class="sp-side-btn" onclick="openSponsorsPage()">عروضنا ←</button>`;
}

/* صورة من بلدي — state.photos.js | نسخة المختبر م1 */
/* ============ الأوسمة ============ */

export async function loadWeatherTip(){
  const wel=$('weatherTip');
  if(!window.__USER_LAT){if(wel)wel.style.display='none';return;}
  const el=$('weatherTip');if(!el)return;
  try{
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${window.__USER_LAT}&longitude=${window.__USER_LNG}&current=temperature_2m,weather_code,cloud_cover,is_day&daily=sunset,sunrise&timezone=auto`;
    const r=await fetch(u);
    const d=await r.json();
    const c=d.current;if(!c)return;
    const code=c.weather_code, temp=Math.round(c.temperature_2m), cloud=c.cloud_cover;
    const isDay=c.is_day===1;
    const now=new Date();
    const sunset=d.daily&&d.daily.sunset?new Date(d.daily.sunset[0]):null;
    const sunrise=d.daily&&d.daily.sunrise?new Date(d.daily.sunrise[0]):null;
    const minsToSunset=sunset?Math.round((sunset-now)/60000):null;
    const minsToSunrise=sunrise?Math.round((sunrise-now)/60000):null;

    let ic,wState,adv;

    // ═══ الليل ═══
    if(!isDay){
      ic='🌙';wState='ليل';
      if(cloud<30) adv='سماء صافية — فرصة لتصوير النجوم ودرب التبانة ✨';
      else if(cloud<70) adv='غيوم متفرقة — جرّب تصوير أضواء المدينة';
      else adv='سماء غائمة — التصوير الليلي صعب الليلة';
      if(code>=45&&code<=48){ic='🌫️';wState='ضباب ليلي';adv='الضباب مع أضواء الشارع = لقطات غامضة جميلة';}
      if(minsToSunrise!==null&&minsToSunrise>0&&minsToSunrise<90){
        ic='🌄';wState='قبل الشروق';adv='الشروق بعد '+minsToSunrise+' دقيقة — استعد للساعة الذهبية';
      }
    }
    // ═══ النهار ═══
    else {
      ic='☀️';wState='صافٍ';adv='إضاءة قوية — صوّر في الظل أو انتظر الساعة الذهبية';
      if(code>=45&&code<=48){ic='🌫️';wState='ضباب';adv='الضباب فرصة ذهبية للقطات دراماتيكية — اخرج الآن!';}
      else if(code>=51&&code<=67){ic='🌧️';wState='مطر';adv='بعد المطر: انعكاسات وألوان مشبعة';}
      else if(code>=71&&code<=77){ic='🌨️';wState='ثلج';adv='مشهد نادر — وثّقه قبل ما يذوب';}
      else if(code>=95){ic='⛈️';wState='عاصفة';adv='السلامة أولاً — صوّر من مكان آمن';}
      else if(cloud>70){ic='☁️';wState='غائم';adv='إضاءة ناعمة مثالية للتفاصيل والبورتريه';}
      else if(cloud>30){ic='⛅';wState='غيوم متفرقة';adv='سماء درامية — وقت ممتاز للمناظر الواسعة';}

      if(minsToSunset!==null&&minsToSunset>0&&minsToSunset<90){
        ic='🌅';wState='قبل الغروب';adv='الساعة الذهبية — بعد '+minsToSunset+' دقيقة أجمل ضوء لليوم';
      }
      if(temp>=42){adv='الحر شديد ('+temp+'°) — صوّر بالصباح الباكر أو قبل المغرب';}
    }

    el.style.display='flex';
    el.innerHTML=`<div class="wt-ic">${ic}</div>
      <div class="wt-txt">
        <div class="wt-now">${wState} · ${temp}°</div>
        <div class="wt-adv">${adv}</div>
      </div>`;
  }catch(e){}
}
/* ====== الزيارات الميدانية ====== */

/* «📍 الأقرب إليك» — جهة واحدة تقرّر ظهوره
   كان الرسم محشوراً داخل نداء تحديد الموقع، وكان setView يخفيه عند
   فتح الخريطة ولا يعيده عند الرجوع للشبكة — فيختفي القسم من أول ضغطة
   على زر الخريطة ولا يرجع إلا بتحديث الصفحة وإذن موقع جديد.
   الآن الدالة تقرأ الموقع المحفوظ وتقرّر بنفسها: تظهر إن كان هناك ما
   يُعرض، وتخفي إن لم يكن — ويناديها كلٌّ من تحديد الموقع وsetView. */

/* أقصى مسافة تُعدّ «قريبة». كانت ٣٠ كم، وهي ضيّقة على مساحة المملكة:
   من وسط الرياض لا تلتقط إلا داخل المدينة، فيظهر القسم ببطاقة يتيمة
   ويبدو معطّلاً. القسم يعرض الأقرب ستّاً على أي حال، والمسافة مكتوبة
   على كل بطاقة، فالسقف يمنع ظهور صورة بعيدة بوصفها «قريبة» لا أكثر.
   غيّر الرقم وحده إن أردت توسيعه أو تضييقه. */
const NEAR_KM = 250;

export function renderNearby(){
  const wrap=$('nearbyWrap'), box=$('nearbyFeed');
  if(!wrap||!box)return;
  const lat=window.__USER_LAT, lng=window.__USER_LNG;
  if(!lat||!lng){wrap.style.display='none';return}

  const distKm=(p)=>Math.hypot(((p.lat||0)-lat)*111,(((p.lng||0)-lng)*111*Math.cos(lat*Math.PI/180)));
  const near=(state.photos||[])
    .filter(p=>p.lat&&p.lng&&!p.abroad&&p.visibility!=='private'&&p.media_type!=='video'&&distKm(p)<=NEAR_KM)
    .sort((a,b)=>distKm(a)-distKm(b))
    .slice(0,6);

  if(!near.length){wrap.style.display='none';return}

  wrap.style.display='block';
  box.innerHTML=near.map(p=>{
    const d=distKm(p);
    const dt=d<1?(Math.round(d*1000)+' م'):(d<10?d.toFixed(1)+' كم':Math.round(d)+' كم');
    return `
      <div class="card" onclick="openSheet(${p.id})">
        <div class="ph"><img src="${thumbUrl(p.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'" loading="lazy" alt="${esc(p.title)}">
          <div class="loc-chip">📍 ${esc(p.village||p.city)}</div>
        </div>
        <div class="card-body">
          <div class="card-title">${esc(p.title)}</div>
          <div class="card-meta"><span>⭐ ${Number(p.avg_stars).toFixed(1)}</span><span>📍 ${dt}</span></div>
        </div>
      </div>`;
  }).join('');
}

export function showNearby(){
  if(!navigator.geolocation){return}
  navigator.geolocation.getCurrentPosition(pos=>{
    const{latitude:lat,longitude:lng}=pos.coords;
    window.__USER_LAT=lat;window.__USER_LNG=lng;
    // لو الخريطة مفتوحة — أضف دبوس موقعك الآن
    if(state.map)addUserPin(lat,lng);
    loadWeatherTip();
    if(typeof loadSunTimes==='function'&&window.__USER_LAT)loadSunTimes(window.__USER_LAT,window.__USER_LNG);
    if(typeof renderNewsBanner==='function')renderNewsBanner();
    if(typeof checkNearby==='function')setTimeout(checkNearby,600);
    if(typeof renderHomeHero==='function')renderHomeHero();
    renderNearby();
  },()=>{},{timeout:5000});
}

/* ====== البنر الترحيبي مرة وحدة ====== */

export async function checkNearby(){
  const el=$('nearAlert');if(!el)return;
  try{
    if(!window.__USER_LAT){el.style.display='none';return}
    // مخفي هذي الجلسة؟
    if(sessionStorage.getItem('near_hidden')==='1'){el.style.display='none';return}
    if(typeof getViewPrefs==='function'&&!getViewPrefs().near){el.style.display='none';return}

    const lat=window.__USER_LAT, lng=window.__USER_LNG;
    const dist=p=>Math.hypot((p.lat-lat)*111000,(p.lng-lng)*111000*Math.cos(lat*Math.PI/180));

    // صور ضمن ٢ كم، ليست لي، وما زرتها
    let near=state.photos.filter(p=>
      p.lat&&p.lng&&!p.abroad&&p.media_type!=='video'&&
      (!currentUser()||p.user_id!==currentUser()?.id)&&
      dist(p)<=2000
    );
    if(!near.length){el.style.display='none';return}

    // استبعاد ما زرته أو قيّمته
    if(currentUser()&&!isAnon()){
      try{
        const ids=near.map(p=>p.id);
        const [v,r]=await Promise.all([
          sb.from('visits').select('photo_id').eq('user_id',currentUser()?.id).in('photo_id',ids),
          sb.from('ratings').select('photo_id').eq('user_id',currentUser()?.id).in('photo_id',ids)
        ]);
        const done=new Set([...(v.data||[]),...(r.data||[])].map(x=>x.photo_id));
        near=near.filter(p=>!done.has(p.id));
      }catch(e){}
    }
    if(!near.length){el.style.display='none';return}

    near.sort((a,b)=>dist(a)-dist(b));
    const top=near.slice(0,6);
    const closest=Math.round(dist(top[0]));
    const canVisit=closest<=500;

    el.style.display='block';
    el.innerHTML=`
      <div class="na-head">
        <span style="font-size:20px">📍</span>
        <b>أنت قرب ${near.length} ${near.length===1?'صورة':near.length<11?'صور':'صورة'}</b>
        <button class="na-close" onclick="hideNearby()">✕</button>
      </div>
      <div class="na-list">
        ${top.map(p=>{
          const d=Math.round(dist(p));
          const dt=d<1000?(d+' م'):((d/1000).toFixed(1)+' كم');
          return `<div class="na-item" onclick="openSheet(${p.id})">
            <img class="na-thumb" src="${thumbUrl(p.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'" loading="lazy" alt="">
            <div class="na-name">${esc(p.village||p.city)}</div>
            <div class="na-dist">${dt}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="na-cta">${canVisit
        ? '👣 أقربها على بعد '+closest+' م — تقدر توثّق زيارتك وتقيّمها'
        : '⭐ افتحها وقيّمها — أو اقترب لتوثيق زيارتك'}</div>`;
  }catch(e){el.style.display='none'}
}

export function hideNearby(){
  try{sessionStorage.setItem('near_hidden','1')}catch(e){}
  const el=$('nearAlert');
  if(el)el.style.display='none';
}

/* ====== منع تسرب التمرير من صندوق الفلتر ====== */

export function renderNewsBanner(){
  const el=$('newsBanner');if(!el)return;
  const sp=state.banner;
  if(!sp.news_on||!sp.news_title){el.style.display='none';return}

  const nid=sp.news_id||('n'+(sp.news_title||'').length);
  let seen=false;
  try{seen=localStorage.getItem('sowra_news_'+nid)==='1'}catch(e){}
  if(seen){el.style.display='none';return}

  el.style.display='block';
  el.innerHTML=`
    <div class="nb-top">
      <span class="nb-tag">✨ جديد</span>
      <button class="nb-x" onclick="dismissNews('${esc(nid)}')">✕</button>
    </div>
    <div class="nb-title">${esc(sp.news_title)}</div>
    ${sp.news_body?`<div class="nb-body">${esc(sp.news_body)}</div>`:''}
    <button class="nb-ok" onclick="dismissNews('${esc(nid)}')">✓ فهمت</button>`;
}

export function dismissNews(nid){
  try{localStorage.setItem('sowra_news_'+nid,'1')}catch(e){}
  const el=$('newsBanner');
  if(el){
    el.style.transition='opacity .25s,transform .25s';
    el.style.opacity='0';
    el.style.transform='translateY(-10px)';
    setTimeout(()=>{el.style.display='none'},260);
  }
}

/* ====== تعديل موقع الصورة ====== */
state.edGeo=null;

export function bumpJoinCounter(){
  try{
    if(currentUser()&&!isAnon())return;
    if(localStorage.getItem('sowra_join_seen')==='1')return;

    state.opened=(state.opened||0)+1;
    let total=parseInt(localStorage.getItem('sowra_opens')||'0')||0;
    total++;
    localStorage.setItem('sowra_opens',String(total));

    // بعد ٨ صور — أو ٥ بالجلسة الواحدة
    if(total>=8||state.opened>=5)setTimeout(showJoinBox,900);
  }catch(e){}
}

export function showJoinBox(){
  if(currentUser()&&!isAnon())return;
  try{if(localStorage.getItem('sowra_join_seen')==='1')return}catch(e){}
  const el=$('joinBox');
  if(el)el.classList.add('show');
}

export function dismissJoin(){
  try{localStorage.setItem('sowra_join_seen','1')}catch(e){}
  const el=$('joinBox');
  if(el)el.classList.remove('show');
}

export function goJoin(){
  try{localStorage.setItem('sowra_join_seen','1')}catch(e){}
  const el=$('joinBox');
  if(el)el.classList.remove('show');
  if(typeof closeSheet==='function')closeSheet();
  go('acc');
  setTimeout(function(){
    try{
      const o=$('accOut'),i=$('accIn');
      if(o)o.style.display='block';
      if(i)i.style.display='none';
      if(typeof accTab==='function')accTab('up');
      const nm=$('accName');if(nm)nm.focus();
    }catch(e){}
  },260);
}
