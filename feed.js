/* صورة من بلدي — features/feed.js
   الشبكة والبطاقات */

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
state.draftCat='all';
state.draftSort='top';
state.draftScope='home';
state.scope='home';

export async function loadPhotos(){
  const { data, error } = await sb.from('photos_ranked')
    .select('*')
    .order('created_at',{ascending:false});
  if(error){$('feed').innerHTML=`<div class="empty"><span class="big">⚠️</span>تعذر تحميل الصور<br>${error.message}</div>`;return}
  state.photos = data || [];
  try{await loadVisitCounts()}catch(e){}
  try{await loadClaims()}catch(e){}
  try{if(typeof state.viewMode!=='undefined'&&state.viewMode==='map'){renderMap()}else{render()}}catch(e){console.warn('render',e)}
}

/* ============ الفلاتر والعرض ============ */
/* ═══ عبر الحاجز (typeof) ═══
   filterCss ← features/filters.js
*/
const filterCss = need('filterCss');

export function initSelects(){
  const fr=$('fRegion'),ar=$('aRegion');
  fr.innerHTML='<option value="">كل المناطق</option>';
  ar.innerHTML='<option value="">اختر المنطقة</option>';
  for(const r in geo.GEO){fr.innerHTML+=`<option>${r}</option>`;ar.innerHTML+=`<option>${r}</option>`;}
}

export function fillCities(){
  const r=$('fRegion').value,c=$('fCity');
  c.innerHTML='<option value="">كل المدن</option>';
  if(r)geo.GEO[r].forEach(x=>c.innerHTML+=`<option>${x}</option>`);
}

export function fillAddCities(){
  const r=$('aRegion').value,c=$('aCity');
  c.innerHTML='<option value="">اختر المدينة</option>';
  if(r)geo.GEO[r].forEach(x=>c.innerHTML+=`<option>${x}</option>`);
  $('villList').innerHTML=(r&&geo.VILL[r]?geo.VILL[r]:[]).map(v=>`<option value="${v}">`).join('');
}

export function render(){
  if(state.viewMode==='map')return;
  const q=$('q').value.trim(), r=$('fRegion').value, c=$('fCity').value;
  const mw=$('mapWrap');if(mw)mw.style.display='none';
  $('feed').style.display='';
  const abroadView=(state.scope==='abroad');
  let list=state.photos.filter(p=>!!p.abroad===abroadView&&p.media_type!=='video');
  if(state.onlyEc)list=list.filter(p=>p.editors_choice);
  if(state.onlyClaims)list=list.filter(p=>state.claimMap[p.id]);
  if(state.tags&&state.tags.length){
    list=list.filter(p=>{
      const t=p.tags||[];
      return state.tags.every(k=>t.includes(k));
    });
  }
  if(state.cat!=='all')list=list.filter(p=>(p.category||'other')===state.cat);
  if(abroadView){
    list=list.filter(p=>!q||p.title.includes(q)||(p.country||'').includes(q));
  }else{
    list=list.filter(p=>
      (!r||p.region===r)&&(!c||p.city===c)&&
      (!q||p.title.includes(q)||(p.village||'').includes(q)||p.city.includes(q)||p.region.includes(q))
    );
  }
  // الترتيب يعمل بالنطاقين
  if(state.sort==='new'){
    list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  }else if(state.sort==='visits'){
    list.sort((a,b)=>((state.visitCounts[b.id]||0)-(state.visitCounts[a.id]||0))
      ||(b.avg_stars-a.avg_stars));
  }else{
    list.sort((a,b)=>(b.avg_stars-a.avg_stars)||(b.ratings_count-a.ratings_count)
      ||(new Date(b.created_at)-new Date(a.created_at)));
  }
  $('totalPill').textContent=`${state.photos.length} صورة · V1.2`;
  const feed=$('feed');
  if(!list.length){feed.innerHTML=`<div class="empty"><span class="big">🏜️</span>ما فيه صور بعد..<br>كن أول من يصوّر ديرته! اضغط + وشارك</div>`;return}
  // ═══ عرض تدريجي ═══
  window.__renderList=list;
  window.__renderCount=0;
  feed.innerHTML='';
  renderBatch();
}

/* بناء بطاقة واحدة */

export function buildCard(p,i){
 try{
  const medal=(state.sort==='top'&&i<3&&p.ratings_count>0)?['🥇','🥈','🥉'][i]:'';
  const isV=p.media_type==='video';
  return `<div class="mcard" onclick="openSheet(${p.id})">
    ${isV
      ? `<video src="${vidUrl(p.image_path)}#t=0.5" muted playsinline preload="metadata" style="width:100%;display:block;filter:${(p.filter_key&&p.filter_key!=='none'&&typeof filterCss==='function')?filterCss(p.filter_key):'none'}"></video>`
      : `<img src="${thumbUrl(p.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'" loading="lazy" decoding="async" alt="${esc(p.title)}">`}
    ${medal?`<div class="mc-medal">${medal}</div>`:''}
    ${state.visitCounts[p.id]?`<div class="mc-visits">👣 ${state.visitCounts[p.id]}</div>`:''}
    ${p.editors_choice?'<div class="mc-ec">🏵️ اختيار المحررين</div>':''}
    ${claimBadge(p.id)}
    ${p.visibility==='private'?'<div class="mc-lock">🔒 خاصة</div>':''}
    ${p.media_type==='video'?'<div class="mc-vid">▶</div>':''}
    <div class="mc-overlay">
      <div class="mc-title">${esc(p.title)}</div>
      <div class="mc-sub">
        <span class="mc-who" onclick="event.stopPropagation();openProfile('${p.user_id}')">${rankOf(p).ic} ${esc(p.photographer)}</span>
        <span class="mc-dot">·</span>
        <span>${p.abroad?esc(p.country||p.city):esc(p.village||p.city)}</span>
        <span class="mc-dot">·</span>
        <span>👁️ ${p.views||0}</span>
      </div>
    </div>
  </div>`;
 }catch(e){return ''}
}

/* دفعة جديدة من البطاقات */

export const RENDER_STEP=24;

export function renderBatch(){
  const feed=$('feed');if(!feed)return;
  try{
  const list=window.__renderList||[];
  const from=window.__renderCount||0;
  if(from>=list.length){removeSentinel();return}

  const to=Math.min(from+RENDER_STEP,list.length);
  const html=list.slice(from,to).map((p,j)=>buildCard(p,from+j)).join('');
  removeSentinel();
  feed.insertAdjacentHTML('beforeend',html);
  window.__renderCount=to;

  if(to<list.length)addSentinel();
  }catch(e){
    console.warn('renderBatch',e);
    feed.innerHTML='<div class="empty" style="grid-column:1/-1"><span class="big">⚠️</span>تعذر عرض الصور</div>';
  }
}

export function addSentinel(){
  const feed=$('feed');if(!feed)return;
  const s=document.createElement('div');
  s.id='feedSentinel';
  s.className='feed-sentinel';
  s.innerHTML='<div class="fs-dot"></div><div class="fs-dot"></div><div class="fs-dot"></div>';
  feed.appendChild(s);

  if(window.__feedObs)window.__feedObs.disconnect();
  window.__feedObs=new IntersectionObserver(function(ents){
    if(ents[0]&&ents[0].isIntersecting)renderBatch();
  },{rootMargin:'420px'});
  window.__feedObs.observe(s);
}

export function removeSentinel(){
  const s=document.getElementById('feedSentinel');
  if(s)s.remove();
  if(window.__feedObs){window.__feedObs.disconnect();window.__feedObs=null}
}

/* ============ نافذة الصورة ============ */
