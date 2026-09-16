/* صورة من بلدي — features/filterbar.js
   شريط الفلترة */

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
/* ═══ عبر الحاجز (نُقل للهيدر) ═══
*/
const render = need('render');
export function toggleFilter(){
  if(typeof closeUni==='function')closeUni();
  const d=$('filterDrawer');
  const open=d.style.display==='none';
  d.style.display=open?'block':'none';
  $('filterBtn').classList.toggle('active',open);
  if(open){
    setTimeout(()=>{d.scrollIntoView({behavior:'smooth',block:'nearest'})},60);
    if(typeof lockFdScroll==='function')lockFdScroll();
  }
}

export function fdSetCat(el,k){ 
  state.draftCat=k;
  document.querySelectorAll('.fd-chips .fd-chip[data-k]').forEach(b=>b.classList.toggle('on',b.dataset.k===k));
}

export function fdSetSort(el,s){
  state.draftSort=s;
  document.querySelectorAll('.fd-chips .fd-chip[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===s));
}

export function fdSetScope(el,sc){
  state.draftScope=sc;
  document.querySelectorAll('.fd-chip[data-sc]').forEach(b=>b.classList.toggle('on',b.dataset.sc===sc));
  // قسم المنطقة يخص المملكة وحدها
  const ps=document.getElementById('fdPlaceSec');
  if(ps)ps.style.display=(sc==='abroad')?'none':'';
}

export function applyFilter(){
  state.cat=state.draftCat;
  state.sort=state.draftSort;
  state.scope=state.draftScope;
  $('filterDrawer').style.display='none';
  $('filterBtn').classList.remove('active');
  const active=(state.cat!=='all')||(state.draftSort!=='top')||(state.draftScope!=='home')
    ||(state.tags&&state.tags.length)||state.onlyClaims;
  $('filterBadge').style.display=active?'inline':'none';
  $('abroadHint').style.display=(state.draftScope==='abroad')?'block':'none';
  // ارجع للرئيسية إن كنا بصفحة أخرى
  try{
    const cur=document.querySelector('.page.on');
    if(cur&&cur.id!=='page-feed'&&typeof go==='function')go('feed');
  }catch(e){}
  if(state.viewMode==='map'){renderMap();}else{render();}
}

export function clearFilter(){
  state.tags=[];
  state.onlyClaims=false;
  state.onlyEc=false;
  const _eb=document.getElementById('fdEcBtn');if(_eb)_eb.classList.remove('on');
  const _cb=document.getElementById("fdClaimBtn");if(_cb)_cb.classList.remove("on");
  if(typeof renderFdTags==="function")renderFdTags();
  state.draftCat='all';state.draftSort='top';state.draftScope='home';
  state.scope='home';
  document.querySelectorAll('.fd-chip[data-k]').forEach(b=>b.classList.toggle('on',b.dataset.k==='all'));
  document.querySelectorAll('.fd-chip[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s==='top'));
  document.querySelectorAll('.fd-chip[data-sc]').forEach(b=>b.classList.toggle('on',b.dataset.sc==='home'));
  const _ps=document.getElementById('fdPlaceSec');if(_ps)_ps.style.display='';
  const _fr=document.getElementById('fRegion');if(_fr)_fr.value='';
  const _fc=document.getElementById('fCity');if(_fc)_fc.value='';
  state.cat='all';state.sort='top';
  $('filterBadge').style.display='none';
  $('abroadHint').style.display='none';
  $('filterDrawer').style.display='none';
  $('filterBtn').classList.remove('active');
  try{
    const cur=document.querySelector('.page.on');
    if(cur&&cur.id!=='page-feed'&&typeof go==='function')go('feed');
  }catch(e){}
  render();
}

/* ====== الأقرب إليك ====== */


/* photos · curId · curPhoto → state (core/state.js) */

export function renderFdTags(){
  const el=$('fdTags');if(!el)return;
  el.innerHTML='';
  if(!_PHOTO_TAGS_())return;
  _PHOTO_TAGS_().forEach(t=>{
    const b=document.createElement('button');
    b.className='fd-chip'+(state.tags.includes(t.k)?' on':'');
    b.textContent=t.n;
    b.onclick=()=>{
      const i=state.tags.indexOf(t.k);
      if(i>-1)state.tags.splice(i,1);
      else state.tags.push(t.k);
      renderFdTags();
    };
    el.appendChild(b);
  });
}

/* عرض سمات الصورة بالنافذة */

export function toggleClaimFilter(btn){
  state.onlyClaims=!state.onlyClaims;
  if(btn)btn.classList.toggle('on',state.onlyClaims);
}

/* ====== إشعار تقدّم المنطقة بالسباق ====== */

export function toggleEcFilter(btn){
  state.onlyEc=!state.onlyEc;
  if(btn)btn.classList.toggle('on',state.onlyEc);
}

/* ====== بنر التحديثات — يظهر مرة واحدة ====== */

export function lockFdScroll(){
  const el=document.querySelector('.fd-scroll');
  if(!el||el.__locked)return;
  el.__locked=true;
  let y0=0;
  el.addEventListener('touchstart',function(e){
    y0=e.touches[0].clientY;
  },{passive:true});
  el.addEventListener('touchmove',function(e){
    const dy=e.touches[0].clientY-y0;
    const atTop=el.scrollTop<=0;
    const atBottom=el.scrollTop+el.clientHeight>=el.scrollHeight-1;
    // يسحب لأسفل وهو بالأعلى · أو لأعلى وهو بالأسفل
    if((atTop&&dy>0)||(atBottom&&dy<0))e.preventDefault();
  },{passive:false});
}

/* ====== أماكن تنتظر عدستك ====== */

export function fdNav(where){
  // نغلق الدرج بلا تطبيق الفلتر
  const d=$('filterDrawer');
  if(d)d.style.display='none';
  const b=$('filterBtn');
  if(b)b.classList.remove('active');

  setTimeout(function(){
    try{
      if(where==='shooters'&&typeof openShooters==='function')openShooters();
      else if(where==='race'&&typeof openRace==='function')openRace();
      else if(where==='waiting'&&typeof openWaiting==='function')openWaiting();
      else if(where==='quests'&&typeof openQuests==='function')openQuests();
      else if(where==='search'&&typeof openUserSearch==='function')openUserSearch();
      else if(where==='sponsors'&&typeof openSponsorsPage==='function')openSponsorsPage();
    }catch(e){}
  },80);
}

/* مسح الوارد كاملاً */
