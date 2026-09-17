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
const openSheet = need('openSheet');
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
const setView = need('setView');
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

/* ═══ طلب الموقع عند الحاجة ═══
   أي قسم يعتمد على الموقع ووجد نفسه بلا موقع، يناديها بدل أن يستسلم.
   محميّة من التكرار: طلب واحد معلّق، ومهلة بين محاولة وأخرى، حتى لا
   تتحوّل إلى قصف للمتصفح لو نُوديت من عدة أماكن. */
let _posPending=false, _posLastTry=0;

export function ensurePos(force){
  if(_posPending)return;
  if(!navigator.geolocation)return;
  const now=Date.now();
  /* المهلة تكبح النداءات التلقائية فقط. أما force فمعناه أن المستخدم
     نفسه ضغط مفتاحاً الآن — ولا يجوز أن نردّ طلبه لأن محاولة فاشلة
     سبقته قبل ثوانٍ. هنا كمن العطل بأول إصلاح كتبته. */
  if(!force && now-_posLastTry < 10000)return;
  _posLastTry=now; _posPending=true;

  navigator.geolocation.getCurrentPosition(pos=>{
    _posPending=false;
    window.__USER_LAT=pos.coords.latitude;
    window.__USER_LNG=pos.coords.longitude;
    try{ maybePopNear(); }catch(e){}
  }, err=>{
    _posPending=false;
    console.warn('[near] تعذّر تحديد الموقع — code '+err.code+' · '+err.message);
  }, { enableHighAccuracy:false, maximumAge:60000, timeout:15000 });
}

/* ═══════════════════════════════════════════════════════
   تنبيه المرور — مربع منبثق يظهر حين تقترب من مكان صورة
   هذا هو سطح القرب الوحيد بالتطبيق. حُذف قبله البنر الأخضر
   وقسم بطاقات «الأقرب إليك» لأن ثلاثتها كانت تقول الشيء نفسه.
   نتابع الموقع دورياً، وأول ما تدخل مدى صورة لم تُنبَّه عليها
   بهذه الجلسة، يقفز المربع مرة واحدة.
   ═══════════════════════════════════════════════════════ */

const POP_KM = 2;            /* نفس مدى البنر الأخضر */
let _watchId = null;

/* الصور التي نُبِّه عليها بهذه الجلسة — حتى لا يتكرر المربع
   على نفس الصورة كلما تذبذبت قراءة الـGPS. */
function poppedIds(){
  try{ return new Set(JSON.parse(sessionStorage.getItem('near_popped')||'[]')); }
  catch(e){ return new Set(); }
}
function markPopped(id){
  const s=poppedIds(); s.add(id);
  try{ sessionStorage.setItem('near_popped',JSON.stringify([...s])); }catch(e){}
}

function nearPopEnsure(){
  if(document.getElementById('nearPop')) return;
  const css=document.createElement('style');
  css.id='nearPopCss';
  css.textContent=`
  #nearPop{position:fixed;inset:0;z-index:9998;display:none;align-items:center;justify-content:center;
    background:rgba(36,31,28,.55);backdrop-filter:blur(3px);padding:24px}
  #nearPop.show{display:flex}
  #nearPop .np-card{background:var(--card);border:2px solid var(--palm);border-radius:20px;
    overflow:hidden;max-width:340px;width:100%;box-shadow:0 10px 34px rgba(36,31,28,.3);
    font-family:'Tajawal',sans-serif;animation:npIn .2s ease-out}
  @keyframes npIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
  #nearPop .np-img{width:100%;height:160px;object-fit:cover;display:block;background:var(--card2)}
  #nearPop .np-bd{padding:16px 18px 14px;text-align:center}
  #nearPop .np-kick{font-size:12px;font-weight:700;color:var(--palm);margin-bottom:6px}
  #nearPop .np-ttl{font-family:'Reem Kufi',sans-serif;font-size:18px;color:var(--txt);margin-bottom:4px}
  #nearPop .np-sub{font-size:12.5px;color:var(--txt-dim);line-height:1.9}
  #nearPop .np-btns{display:flex;gap:8px;margin-top:16px}
  #nearPop .np-hint{font-size:11px;color:var(--txt-dim);margin-top:11px;opacity:.85}
  #nearPop .np-btn{flex:1;padding:12px;border-radius:13px;border:1px solid var(--line);
    background:var(--card2);color:var(--txt);font-family:'Tajawal';font-size:14px;font-weight:700;cursor:pointer}
  #nearPop .np-btn.main{background:var(--palm);border-color:var(--palm);color:#fff}
  `;
  document.head.appendChild(css);

  const el=document.createElement('div');
  el.id='nearPop';
  el.innerHTML='<div class="np-card"><img class="np-img" alt=""><div class="np-bd">'
             + '<div class="np-kick"></div><div class="np-ttl"></div><div class="np-sub"></div>'
             + '<div class="np-btns"></div>'
             + '<div class="np-hint">تقدر تطفي هذا التنبيه من «فلتر ← ما يظهر بالرئيسية»</div>'
             + '</div></div>';
  el.addEventListener('click', ev=>{ if(ev.target===el) closeNearPop(); });
  document.body.appendChild(el);
}

export function closeNearPop(){
  const el=document.getElementById('nearPop');
  if(el)el.classList.remove('show');
}

export function nearPop(p, km, total){
  nearPopEnsure();
  const el=document.getElementById('nearPop');
  const n  = total||1;
  const dt = km<1 ? (Math.round(km*1000)+' متر') : (km.toFixed(1)+' كم');

  el.querySelector('.np-img').src = thumbUrl(p.image_path);
  el.querySelector('.np-img').onerror = function(){ this.onerror=null; this.src=imgUrl(p.image_path); };

  /* رسالة واحدة تذكر العدد كله — لا مربع لكل صورة */
  el.querySelector('.np-kick').textContent = n>1
    ? ('📍 أنت قرب ' + n + ' ' + (n===2?'صورتين':n<11?'صور':'صورة'))
    : '📍 أنت قرب مكان مصوَّر';
  el.querySelector('.np-ttl').textContent = p.title||'';
  el.querySelector('.np-sub').innerHTML   =
      esc(p.village||p.city||'') + ' · أقربها على بعد <b>' + dt + '</b>'
    + (km<=0.5 ? '<br>تقدر توثّق زيارتك الآن 👣' : '<br>اقترب أكثر لتوثيق الزيارة');

  const bw=el.querySelector('.np-btns');
  bw.innerHTML='';
  const open=document.createElement('button');
  open.className='np-btn main'; open.textContent = n>1 ? 'افتح الأقرب' : 'افتحها';
  open.onclick=()=>{ closeNearPop(); try{ openSheet(p.id); }catch(e){} };
  if(n>1){
    const all=document.createElement('button');
    all.className='np-btn'; all.textContent='شوفها على الخريطة';
    all.onclick=()=>{ closeNearPop(); try{ setView('map'); }catch(e){} };
    bw.appendChild(open); bw.appendChild(all);
  }else{
    const later=document.createElement('button');
    later.className='np-btn'; later.textContent='لاحقاً';
    later.onclick=()=>closeNearPop();
    bw.appendChild(open); bw.appendChild(later);
  }

  el.classList.add('show');
}

/* يفحص الموقع الحالي: هل دخلنا مكاناً مصوَّراً لم نُنبَّه عليه؟

   ملاحظة مهمة: ننبّه على «الوصول» لا على «كل صورة». لو وقفت وسط
   خمسين صورة، التنبيه مرة واحدة تذكر الخمسين — ثم نعلّمها كلها
   مقروءة. بدون هذا يقفز المربع خمسين مرة، كل عشرين ثانية واحدة. */
export function maybePopNear(){
  const el=document.getElementById('nearPop');
  if(el&&el.classList.contains('show'))return;          /* مربع مفتوح — لا نزاحمه */
  try{ if(typeof getViewPrefs==='function'&&getViewPrefs().near===false)return; }catch(e){}
  try{ if(sessionStorage.getItem('near_hidden')==='1')return; }catch(e){}

  const lat=window.__USER_LAT, lng=window.__USER_LNG;
  if(!lat||!lng)return;

  const me=(typeof currentUser==='function')?currentUser():null;
  const seen=poppedIds();
  const d=p=>Math.hypot(((p.lat||0)-lat)*111,(((p.lng||0)-lng)*111*Math.cos(lat*Math.PI/180)));

  const inRange=(state.photos||[])
    .filter(p=>p.lat&&p.lng&&!p.abroad&&p.media_type!=='video'
             &&p.visibility!=='private'
             &&!(me&&p.user_id===me.id)      /* لا ننبّهك على صورتك أنت */
             &&d(p)<=POP_KM)
    .sort((a,b)=>d(a)-d(b));

  const fresh=inRange.filter(p=>!seen.has(p.id));
  if(!fresh.length)return;

  /* نعلّم كل ما في المدى مقروءاً — لا الصورة التي عرضناها وحدها */
  inRange.forEach(p=>markPopped(p.id));
  nearPop(fresh[0], d(fresh[0]), fresh.length);
}

/* متابعة الموقع — تبدأ مع الإقلاع وعند تشغيل المفتاح، وتتوقف عند إطفائه.

   لماذا قراءة دورية لا watchPosition؟ جرّبت watchPosition فردّ
   code 2 (POSITION_UNAVAILABLE) على بعض البيئات بينما
   getCurrentPosition يعمل على نفس الجهاز — وهو معروف بتفاوته بين
   المتصفحات. قراءة كل NEAR_TICK ثانية أبسط، تعمل حيثما يعمل تحديد
   الموقع، وأخف على البطارية من تتبّع متصل. */

const NEAR_TICK = 20000;   /* ٢٠ ثانية بين قراءة وأخرى */

function readPosOnce(){
  if(!navigator.geolocation)return;
  navigator.geolocation.getCurrentPosition(pos=>{
    window.__USER_LAT=pos.coords.latitude;
    window.__USER_LNG=pos.coords.longitude;
    try{ maybePopNear(); }catch(e){}
  }, err=>{
    /* كان الردّ فارغاً ()=>{} فيفشل تحديد الموقع بصمت تام
       ولا يعرف أحد لماذا اختفت الأقسام. الآن يقول السبب. */
    console.warn('[near] تعذّر تحديد الموقع — code '+err.code+' · '+err.message);
    if(err.code===1)stopNearWatch();          /* رُفض الإذن — لا فائدة من الإلحاح */
  }, { enableHighAccuracy:false, maximumAge:10000, timeout:15000 });
}

export function startNearWatch(){
  if(_watchId!==null)return;
  if(!navigator.geolocation)return;
  try{ if(typeof getViewPrefs==='function'&&getViewPrefs().near===false)return; }catch(e){}
  _watchId=setInterval(readPosOnce, NEAR_TICK);
  readPosOnce();                              /* قراءة فورية بلا انتظار الدورة */
}

export function stopNearWatch(){
  if(_watchId===null)return;
  try{ clearInterval(_watchId); }catch(e){}
  _watchId=null;
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
    if(typeof renderHomeHero==='function')renderHomeHero();
    try{ maybePopNear(); }catch(e){}
  }, err=>{
    /* مهلة ٥ ثوانٍ كانت ضيّقة: أجهزة كثيرة تحدّد موقعها بالشبكة فتتجاوزها،
       فيفشل الإقلاع بصمت ويبقى التطبيق بلا موقع. الآن ١٥ ثانية، والفشل
       يُكتب، وensurePos تتولّى المحاولة التالية عند الحاجة. */
    console.warn('[near] تعذّر تحديد الموقع عند الإقلاع — code '+err.code+' · '+err.message);
  }, { enableHighAccuracy:false, maximumAge:60000, timeout:15000 });
}

/* ====== البنر الترحيبي مرة وحدة ====== */

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
