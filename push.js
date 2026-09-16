/* صورة من بلدي — app/push.js
   الإشعارات */

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
export function urlB64ToUint8(b64){
  const pad='='.repeat((4-b64.length%4)%4);
  const s=(b64+pad).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(s);
  const arr=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
  return arr;
}

export function notifSupported(){
  return ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window);
}

export function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
}

export async function renderNotifBox(){
  const box=$('notifBox');if(!box)return;
  if(isAnon()){box.style.display='none';return}
  box.style.display='block';

  const card=box.querySelector('.notif-card');
  const st=$('notifState'), btn=$('notifBtn'), hint=$('notifHint');
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);

  if(!notifSupported()){
    st.textContent=isIOS?'تحتاج تثبيت التطبيق':'غير مدعومة بهذا المتصفح';
    btn.style.display='none';
    hint.style.display='block';
    hint.innerHTML=isIOS
      ? '<b>خطوات التفعيل على الأيفون:</b><br>'
        +'١. افتح sowra.app بمتصفح <b>Safari</b><br>'
        +'٢. اضغط زر المشاركة <b>⬆️</b> بالأسفل<br>'
        +'٣. اختر <b>«إضافة إلى الشاشة الرئيسية»</b><br>'
        +'٤. افتح التطبيق من الأيقونة الجديدة<br>'
        +'٥. ارجع هنا وفعّل الإشعارات<br><br>'
        +'<span style="opacity:.75">آبل تشترط تثبيت التطبيق قبل السماح بالإشعارات — لا يمكن تفعيلها من المتصفح مباشرة.</span>'
      : 'متصفحك لا يدعم الإشعارات — جرّب كروم أو سفاري حديثاً.';
    return;
  }
  if(isIOS && !isStandalone()){
    st.textContent='تحتاج تثبيت التطبيق أولاً';
    btn.style.display='none';
    hint.style.display='block';
    hint.textContent='اضغط زر المشاركة بسفاري ← «إضافة إلى الشاشة الرئيسية» ← افتح التطبيق من الأيقونة، وبعدها تقدر تفعّل الإشعارات.';
    return;
  }

  hint.style.display='none';
  btn.style.display='block';

  let sub=null;
  try{
    const reg=await navigator.serviceWorker.ready;
    sub=await reg.pushManager.getSubscription();
  }catch(e){}

  const on=!!sub && Notification.permission==='granted';
  if(card)card.classList.toggle('on',on);
  st.textContent=on?'● مفعّلة على هذا الجهاز':'غير مفعّلة';
  btn.textContent=on?'🔕 إيقاف الإشعارات':'🔔 فعّل الإشعارات';
  btn.style.background=on?'var(--card2)':'var(--sadu)';
  btn.style.color=on?'var(--txt)':'#fff';
  btn.style.border=on?'1px solid var(--line)':'none';
}

export async function toggleNotifs(){
  if(!notifSupported()){toast('جهازك ما يدعم الإشعارات',true);return}
  const btn=$('notifBtn');
  btn.disabled=true;
  try{
    const reg=await navigator.serviceWorker.ready;
    const existing=await reg.pushManager.getSubscription();

    if(existing && Notification.permission==='granted'){
      // إيقاف
      const ep=existing.endpoint;
      await existing.unsubscribe();
      await sb.from('push_subs').delete().eq('endpoint',ep);
      toast('اتوقفت الإشعارات');
      renderNotifBox();
      return;
    }

    const perm=await Notification.requestPermission();
    if(perm!=='granted'){
      toast(perm==='denied'?'رفضت الإذن — فعّله من إعدادات المتصفح':'ما تم التفعيل',true);
      renderNotifBox();
      return;
    }

    const sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlB64ToUint8(window.__VAPID_PUB)
    });
    const j=sub.toJSON();
    const {error}=await sb.from('push_subs').upsert({
      user_id:currentUser()?.id,
      endpoint:sub.endpoint,
      p256dh:j.keys.p256dh,
      auth:j.keys.auth
    },{onConflict:'endpoint'});
    if(error)throw error;

    toast('انفعّلت الإشعارات 🔔');
    reg.showNotification('صورة من بلدي 🇸🇦',{
      body:'الإشعارات مفعّلة — بنوصلك أول ما يصير جديد',
      icon:'icon-192.png',dir:'rtl',lang:'ar'
    });
    renderNotifBox();
  }catch(e){
    toast('تعذر التفعيل: '+(e.message||''),true);
  }finally{btn.disabled=false}
}

/* ====== دعوة تفعيل الإشعارات بعد أول نشر ====== */

export function askedBefore(){
  try{return localStorage.getItem('sowra_notif_asked')==='1'}catch(e){return true}
}

export function markAsked(){
  try{localStorage.setItem('sowra_notif_asked','1')}catch(e){}
}

export async function maybeAskNotifs(){
  try{
    if(askedBefore())return;
    if(isAnon())return;
    if(!notifSupported())return;
    if(Notification.permission!=='default')return;
    const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
    if(isIOS&&!isStandalone())return;
    // تحقق: هل مشترك أصلاً؟
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(sub)return;
    setTimeout(()=>{
      const el=document.getElementById('notifAsk');
      if(el)el.classList.add('show');
    },1800);
  }catch(e){}
}

export function notifAskNo(){
  markAsked();
  const el=document.getElementById('notifAsk');
  if(el)el.classList.remove('show');
  toast('تقدر تفعّلها من صفحة حسابي متى ما تبي');
}

export async function notifAskYes(){
  markAsked();
  const el=document.getElementById('notifAsk');
  if(el)el.classList.remove('show');
  if(typeof toggleNotifs==='function')await toggleNotifs();
}

/* ====== شريط اللغة للأجانب ====== */
