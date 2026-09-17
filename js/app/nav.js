/* صورة من بلدي — app/nav.js
   التنقل والإقلاع */

import { currentUser, ensureAuth, isAnon, sb , session} from '../core/db.js';
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
/* ═══ عبر الحاجز ═══
   initTheme ← app/theme.js
   maybeAskNotifs ← app/push.js
*/

const maybeAskNotifs = need('maybeAskNotifs');
export function go(p){
  if(p==='add' && (isAnon())){
    toast('سجّل أول عشان تنشر صورك باسمك 📸');
    p='acc';
    $('accOut').style.display='block';$('accIn').style.display='none';
  }
  if(p==='adm' && !state.isAdmin && !state.isCurator)p='feed';
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  $('page-'+p).classList.add('on');
  const wasDark=document.body.classList.contains('dark');
  document.body.className='page-'+p+(wasDark?' dark':'');
  if(p==='feed'){
    if(typeof loadPhotos==='function') loadPhotos().then(()=>{if(typeof render==='function')render();});
    else if(typeof render==='function') render();
    const adm=$('page-adm');
    if(adm&&adm.classList.contains('on')) adm.classList.remove('on');
  }
  // أغلق نافذة الصورة عند أي تنقل
  const _ov=document.getElementById('overlay');
  if(_ov&&_ov.classList.contains('show')){
    _ov.classList.remove('show');
    document.body.style.overflow='';
  }
  if(p!=='reels'&&typeof stopAllReels==='function')stopAllReels();
  if(p==='add'&&typeof initVideoUpload==='function')setTimeout(initVideoUpload,120);
  if(p==='feed'&&typeof applyViewPrefs==='function')setTimeout(applyViewPrefs,80);
  if(p==='acc'&&typeof renderAccAvatar==='function')setTimeout(renderAccAvatar,150);
  if(p==='acc'&&typeof renderAccCover==='function')setTimeout(renderAccCover,150);
  if(p==='acc'&&typeof dmUnreadCount==='function')setTimeout(dmUnreadCount,300);
  if(p!=='acc'&&typeof accPanel==='function'&&state.accOpen)accPanel('');
  $('nb-feed').classList.toggle('on',p==='feed');
  const nr=$('nb-reels');if(nr)nr.classList.toggle('on',p==='reels');
  $('nb-favs').classList.toggle('on',p==='favs');
  $('nb-msgs').classList.toggle('on',p==='msgs');
  $('nb-acc').classList.toggle('on',p==='acc');
  const fb=$('fab');if(fb)fb.style.display=(p==='add')?'none':'block';
  window.scrollTo(0,0);
}

/* ═══ الدخول للوحة الإشراف ═══
   لا تستخدم go('adm') مباشرة: لوحة الإشراف وحدة كسولة لا تُحمَّل إلا
   عبر openAdmin المنشور بالجسر (main.js). فـgo('adm') وحدها تعرض
   اللوحة بلا دوالها — تظهر الأزرار ولا يعمل أي منها. */
async function enterAdmin(){
  /* لوحة الإشراف وحدة كسولة: openAdmin المنشور من main.js يحمّلها ثم
     يفتحها. لا نستعمل go('adm') مباشرة — تعرض اللوحة بلا دوالها.
     ولا حاجة لانتظار الجسر: boot() لا تعمل إلا بعد أن ينشره main.js. */
  if(typeof window.openAdmin !== 'function'){
    console.error('[adm] الجسر غير منشور — لم تُفتح اللوحة');
    toast('تعذر تحميل لوحة الإشراف — حدّث الصفحة', true);
    return;
  }
  try{
    await window.openAdmin();
  }catch(e){
    console.error('[adm] تعذر فتح اللوحة', e);
    toast('تعذر فتح لوحة الإشراف', true);
  }
}

/* ============ البداية ============ */

/* الإقلاع الذاتي حُذف — main.js ينادي boot() المُصدَّرة بعد نشر الجسر */

/* ====== Tap overlay للجوال ====== */
document.addEventListener('click',function(e){
  const card=e.target.closest('.mcard');
  if(!card)return;
  if(window.matchMedia('(hover:hover)').matches)return;
  if(!card.classList.contains('tapped')){
    document.querySelectorAll('.mcard.tapped').forEach(c=>c.classList.remove('tapped'));
    card.classList.add('tapped');
    e.stopPropagation();
    return;
  }
},true);
/* ====== تحديث تلقائي عند العودة للتطبيق ====== */
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    if(typeof loadPhotos==='function')loadPhotos();
    if(typeof loadSponsor==='function')loadSponsor();
    if(typeof loadWeek==='function')loadWeek();
    if(typeof loadChallenge==='function')loadChallenge();
  }
});

/* تحديث دوري كل دقيقتين والتطبيق مفتوح */
setInterval(()=>{
  if(document.visibilityState==='visible'&&typeof loadPhotos==='function')loadPhotos();
},120000);

/* ====== الإشعارات ====== */
window.__VAPID_PUB='BCeGpOtX3WqUv7u0B8hoOJDdrp8PKUXG1pow2wWyM8sS7bnLJ3v8mzqczz-SmiQJgNeZXz1Z4VouYB9LAwsXe94';

export function accPanel(name){
  state.accOpen=(state.accOpen===name)?'':name;
  const map={edit:'pnEdit',stats:'pnStats',vault:'pnVault',inbox:'pnInbox',notif:'pnNotif'};
  Object.keys(map).forEach(k=>{
    const el=document.getElementById(map[k]);
    if(el)el.classList.toggle('on',k===state.accOpen);
  });
  document.querySelectorAll('.acc-tile').forEach((t,i)=>{
    const keys=['edit','stats','vault','inbox','notif'];
    t.classList.toggle('on',keys[i]===state.accOpen);
  });
  // تحميل عند الفتح
  if(state.accOpen==='vault'&&typeof renderVault==='function')renderVault();
  if(state.accOpen==='stats'&&typeof renderMyStats==='function')renderMyStats();
  if(state.accOpen==='notif'&&typeof renderNotifBox==='function')renderNotifBox();
  if(state.accOpen==='inbox'&&typeof renderInbox==='function')renderInbox();
  if(state.accOpen==='inbox'&&typeof renderBlockList==='function')setTimeout(renderBlockList,400);
  if(state.accOpen){
    setTimeout(()=>{
      const el=document.getElementById(map[state.accOpen]);
      if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});
    },60);
  }
}

/* ====== تفضيلات العرض ====== */

export function initEnBar(){
  try{
    if(localStorage.getItem('sowra_en_dismissed')==='1')return;
    const langs=(navigator.languages&&navigator.languages.length)?navigator.languages:[navigator.language||''];
    const isAr=langs.some(l=>String(l).toLowerCase().startsWith('ar'));
    if(isAr)return;
    const el=document.getElementById('enBar');
    if(el)el.classList.add('show');
  }catch(e){}
}

export function dismissEnBar(){
  try{localStorage.setItem('sowra_en_dismissed','1')}catch(e){}
  const el=document.getElementById('enBar');
  if(el)el.classList.remove('show');
}

/* ====== معالجة عودة تسجيل Google ====== */

export async function handleAuthReturn(){
  try{
    const h=window.location.hash||'';
    const q=window.location.search||'';
    const hasCode=q.includes('code=');
    const hasToken=h.includes('access_token');
    if(!hasCode&&!hasToken)return;

    // تبادل الرمز بجلسة
    if(hasCode&&sb.auth.exchangeCodeForSession){
      try{await sb.auth.exchangeCodeForSession(window.location.href)}catch(e){}
    }
    // تنظيف الرابط
    try{history.replaceState({},document.title,window.location.pathname)}catch(e){}

    const s=await sb.auth.getSession();
    if(s&&s.data&&s.data.session){
      session.user = s.data.session.user;
      await checkAdmin();
      if(typeof renderAccIn==='function')await renderAccIn();
      toast('حياك الله 🌟');
      await loadPhotos();
      /* الدخول ينتهي بالصفحة الرئيسية — لا توجيه تلقائي للوحة الإشراف.
         المشرف يفتحها بالترس متى شاء. */
    }
  }catch(e){}
}

/* ====== أقسام صفحة حسابي ====== */
state.accOpen='';

export function getViewPrefs(){
  let p={hero:true,weather:true,challenge:true,near:true};
  try{
    const s=localStorage.getItem('sowra_view');
    if(s)p=Object.assign(p,JSON.parse(s));
  }catch(e){}
  return p;
}

export function saveViewPrefs(){
  const p={
    near:!!(document.getElementById('swNear')&&document.getElementById('swNear').checked),
    hero:!!(document.getElementById('swHero')&&document.getElementById('swHero').checked),
    weather:!!(document.getElementById('swWeather')&&document.getElementById('swWeather').checked),
    challenge:!!(document.getElementById('swChallenge')&&document.getElementById('swChallenge').checked)
  };
  try{localStorage.setItem('sowra_view',JSON.stringify(p))}catch(e){}
  applyViewPrefs();
}

export function applyViewPrefs(){
  const p=getViewPrefs();
  const na=document.getElementById('nearAlert');
  if(na&&!p.near)na.style.display='none';
  const hero=document.getElementById('homeHero');
  const wt=document.getElementById('weatherTip');
  const ch=document.getElementById('challengeStrip');
  if(hero&&!p.hero)hero.style.display='none';
  if(wt)wt.style.display=p.weather?'':'none';
  if(ch&&!p.challenge)ch.style.display='none';
  if(hero&&p.hero&&typeof renderHomeHero==='function')renderHomeHero();
  if(ch&&p.challenge&&typeof loadChallenge==='function')loadChallenge();
}

export function initViewPrefs(){
  const p=getViewPrefs();
  const n=document.getElementById('swNear');
  if(n)n.checked=p.near;
  const a=document.getElementById('swHero'),b=document.getElementById('swWeather'),c=document.getElementById('swChallenge');
  if(a)a.checked=p.hero;
  if(b)b.checked=p.weather;
  if(c)c.checked=p.challenge;
  applyViewPrefs();
}

/* ═══════════════════════════════════════════
   الإقلاع — يناديها main.js بعد جهوز الوحدات
   ═══════════════════════════════════════════ */

export async function boot(){
  /* الوضع الليلي أولاً — قبل أي رسم */
  try{
    const t = localStorage.getItem('sowra_theme') || 'auto';
    if(t === 'dark') document.documentElement.setAttribute('data-preload-dark','1');
  }catch(e){}

  try{ initTheme(); }catch(e){}
  try{ await handleAuthReturn(); }catch(e){}
  try{ renderTagRow(); }catch(e){}
  try{ renderFdTags(); }catch(e){}

  const authP = ensureAuth()
    .then(async () => { await checkAdmin(); loadFavs(); })
    .catch(() => {});

  /* ═══ الدخول ينتهي بالصفحة الرئيسية دائماً ═══
     لا توجيه تلقائي للوحة الإشراف. المشرف يفتحها بالترس متى شاء،
     والترس يُظهره checkAdmin.

     الاستثناء الوحيد: رابط الطوارئ الصريح ?admin=1 — طلبٌ مقصود
     من المشرف نفسه، فنستجيب له. */
  if(location.search.indexOf('admin=1') > -1){
    try{
      await authP;
      /* الرابط الصريح يفتح اللوحة حتى لو تعذّر التحقق (خلل اتصال مثلاً).
         الصلاحيات الحقيقية محمية بقواعد RLS بالخادم. */
      if(!state.isAdmin) state.isAdmin = true;
      const g = $('admGear');
      if(g) g.style.display = 'block';
      await enterAdmin();
    }catch(e){
      console.error('[boot] تعذر فتح اللوحة برابط الطوارئ', e);
    }
  }

  try{
    /* الأماكن والقوائم بُنيت بـmain.js — نكتفي بالصور */
    await loadPhotos();
    loadWeek(); loadSponsor(); loadChallenge();
    initHero();
    showNearby();
    setTimeout(() => loadWeatherTip(), 400);
    initGoogleBtn();

    /* محاولات متتابعة حتى تجهز المفاتيح */
    let tries = 0;
    const gi = setInterval(() => {
      tries++;
      if(state.banner && Object.keys(state.banner).length || tries > 12){
        clearInterval(gi);
        initGoogleBtn();
      }
    }, 500);
  }catch(e){
    const fd = $('feed');
    if(fd) fd.innerHTML = '<div class="empty"><span class="big">⚠️</span>تعذر تحميل الصور<br>' + esc(e.message||'') + '</div>';
  }

  await authP;

  try{ initViewPrefs(); }catch(e){}
  try{ maybeAskNotifs(); }catch(e){}
  try{ initEnBar(); }catch(e){}
  /* handleAuthReturn نُقلت لأول boot — كانت تُنادى مرتين */

  installTapOverlay();
}

/* ═══ Tap overlay للجوال ═══ */

export function installTapOverlay(){
  document.addEventListener('click', function(e){
    const card = e.target.closest('.mcard');
    if(!card) return;
    if(window.matchMedia('(hover:hover)').matches) return;
    if(!card.classList.contains('tapped')){
      document.querySelectorAll('.mcard.tapped').forEach(c => c.classList.remove('tapped'));
      card.classList.add('tapped');
    }
  });
}
