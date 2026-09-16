/* صورة من بلدي — app/theme.js
   الوضع الليلي */

import { currentUser, ensureAuth, isAnon, sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { loadPlaces, geo } from '../data/places.js';
const renderAccAvatar = need('renderAccAvatar');

/* ═══ عبر الحاجز ═══
   fillAddCities ← features/feed.js
   initSelects ← features/feed.js
   renderFdTags ← features/feed.js
   renderTagRow ← features/upload.js
*/
const fillAddCities = need('fillAddCities');
const initSelects = need('initSelects');
const renderFdTags = need('renderFdTags');
const renderTagRow = need('renderTagRow');

/* من ميزات أخرى — عبر الحاجز */
const checkAdmin = need('checkAdmin');
const loadFavs = need('loadFavs');
const loadPhotos = need('loadPhotos');
const loadWeek = need('loadWeek');
const loadSponsor = need('loadSponsor');
const loadChallenge = need('loadChallenge');
const initHero = need('initHero');
const showNearby = need('showNearby');
const loadWeatherTip = need('loadWeatherTip');
const initGoogleBtn = need('initGoogleBtn');
const render = need('render');
const renderMap = need('renderMap');
const renderHomeHero = need('renderHomeHero');
const stopAllReels = need('stopAllReels');
const initVideoUpload = need('initVideoUpload');
const renderAccCover = need('renderAccCover');
const dmUnreadCount = need('dmUnreadCount');
const renderInbox = need('renderInbox');
const renderBlockList = need('renderBlockList');
const renderNotifBox_ = need('renderNotifBox');
const renderMyStats = need('renderMyStats');
const renderVault = need('renderVault');
const renderAccIn = need('renderAccIn');
const loadMyMsgs = need('loadMyMsgs');
const openAdminPanel = need('openAdminPanel');
export function isNightNow(){
  try{
    const s=localStorage.getItem('sowra_sun');
    if(s){
      const o=JSON.parse(s);
      const now=Date.now();
      if(o.rise&&o.set&&(now-o.at)<86400000)return now<o.rise||now>o.set;
    }
  }catch(e){}
  const h=new Date().getHours();
  return h<6||h>=18;
}

export async function loadSunTimes(lat,lng){
  try{
    const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lng
      +'&daily=sunrise,sunset&timezone=auto&forecast_days=1');
    const j=await r.json();
    const rise=new Date(j.daily.sunrise[0]).getTime();
    const set=new Date(j.daily.sunset[0]).getTime();
    localStorage.setItem('sowra_sun',JSON.stringify({rise,set,at:Date.now()}));
    if(getThemeMode()==='auto')applyTheme('auto');
  }catch(e){}
}

export function getThemeMode(){
  try{return localStorage.getItem('sowra_theme')||'auto'}catch(e){return 'auto'}
}

export function resolveTheme(mode){
  if(mode==='dark')return 'dark';
  if(mode==='light')return 'light';
  return isNightNow()?'dark':'light';
}

export function applyTheme(mode){
  try{
    if(mode==='auto'||mode==='dark'||mode==='light'){}else{mode=mode==='dark'?'dark':'light'}
    const eff=resolveTheme(mode);
    document.body.classList.toggle('dark',eff==='dark');
    const b=document.getElementById('themeBtn');
    if(b){
      b.textContent=mode==='auto'?'🔄':(mode==='dark'?'☀️':'🌙');
      b.title=mode==='auto'?'تلقائي حسب الوقت':(mode==='dark'?'الوضع النهاري':'الوضع الليلي');
    }
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',eff==='dark'?'#161310':'#F7F1E3');
    localStorage.setItem('sowra_theme',mode);
  }catch(e){}
}

export function toggleTheme(){
  const cur=getThemeMode();
  const next=cur==='auto'?'light':(cur==='light'?'dark':'auto');
  applyTheme(next);
  const names={auto:'تلقائي حسب الوقت 🔄',light:'الوضع النهاري ☀️',dark:'الوضع الليلي 🌙'};
  if(typeof toast==='function')toast(names[next]);
}

export function initTheme(){
  applyTheme(getThemeMode());
  setInterval(function(){if(getThemeMode()==='auto')applyTheme('auto')},600000);
}

/* صورة من بلدي — main.js | v1.1 */
/* ============ التنقل ============ */
