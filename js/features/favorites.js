/* صورة من بلدي — features/favorites.js
   المفضلة والخزنة */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, rankOf } from '../core/format.js';
import { need } from '../core/hub.js';
import { avatarUrl, imgUrl, thumbUrl, vidUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, dbErr, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   openAcc ← features/account.js
   renderAccIn ← features/account.js
*/
const openAcc = need('openAcc');
const renderAccIn = need('renderAccIn');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');
const maybeAskNotifs = need('maybeAskNotifs');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const checkRaceProgress = need('checkRaceProgress');
const closeSheet = need('closeSheet');
const loadPhotos = need('loadPhotos');
const openSheet = need('openSheet');
const pushNotify = need('pushNotify');
const refreshOne = need('refreshOne');
const render = need('render');
const showJoinBox = need('showJoinBox');
/* ═══ عبر الحاجز ═══
   renderFollow ← features/profile.js
   renderMyStats ← features/stats.js
   renderProfFeed ← features/profile.js
   renderProfTabs ← features/profile.js
*/
const renderFollow = need('renderFollow');
const renderMyStats = need('renderMyStats');
const renderProfFeed = need('renderProfFeed');
const renderProfTabs = need('renderProfTabs');

export async function loadFavs(){
  if(!currentUser())return;
  try{
    const r=await sb.from('favorites').select('photo_id').eq('user_id',currentUser()?.id);
    state.favSet=new Set((r.data||[]).map(x=>x.photo_id));
  }catch(e){}
}
export async function toggleFav(pid){
  if(!currentUser()){toast('تعذر الحفظ — أعد تحميل الصفحة',true);return}
  if(state.favSet.has(pid)){
    state.favSet.delete(pid);
    await sb.from('favorites').delete().eq('user_id',currentUser()?.id).eq('photo_id',pid);
    toast('انشالت من مفضلتك');
  }else{
    state.favSet.add(pid);
    const {error}=await sb.from('favorites').insert({user_id:currentUser()?.id,photo_id:pid});
    if(error){state.favSet.delete(pid);toast('تعذر الحفظ: '+(error.message||''),true);return}
    toast('انحفظت بمفضلتك ❤️');
  }
  if(state.curPhoto)renderFollow(state.curPhoto);
  if($('page-favs').classList.contains('on'))renderFavs();
}
export function openFavs(){
  go('favs');
  renderFavs();
}
export function renderFavs(){
  const list=state.photos.filter(p=>state.favSet.has(p.id));
  const el=$('favFeed');
  if(!list.length){
    el.className='';
    el.innerHTML='<div class="empty"><span class="big">🤍</span>مفضلتك فاضية — افتح أي صورة واضغط «حفظ»</div>';
    return;
  }
  el.className='grid';
  el.innerHTML=list.map(p=>{
    const isV=p.media_type==='video';
    const src=isV?vidUrl(p.image_path):thumbUrl(p.image_path);
    return `<div class="mcard" onclick="openSheet(${p.id})">
      ${isV?`<video src="${src}#t=0.4" muted playsinline preload="metadata"></video>`
           :`<img src="${src}" loading="lazy" alt="${esc(p.title)}">`}
      ${state.isAdmin?`<button class="mc-promo" onclick="event.stopPropagation();openPromo(${p.id})" title="انشرها بالسوشال">📢</button>`:''}
      <div class="mc-overlay">
        <div class="mc-title">${esc(p.title)}</div>
        <div class="mc-sub">${p.abroad?'🌍 '+esc(p.country||p.city):'📍 '+esc(p.village||p.city)} · ⭐ ${Number(p.avg_stars).toFixed(1)}</div>
      </div>
    </div>`;
  }).join('');
}
export async function renderVault(){
  const wrap=$('vaultWrap'), el=$('vaultFeed');
  if(!wrap||!el)return;
  if(isAnon())return;
  try{
    const r=await sb.from('photos').select('id,title,city,village,country,abroad,image_path,media_type,created_at')
      .eq('user_id',currentUser()?.id).eq('visibility','private').order('created_at',{ascending:false});
    const list=r.data||[];
    if(!list.length){
      el.innerHTML='<div class="vault-empty">🔒 خزنتك فاضية<br><span style="font-size:12px">عند النشر اختر «خزنتي» لتحفظ صورك لنفسك أولاً</span></div>';
      return;
    }
    el.innerHTML=list.map(p=>{
      const isV=p.media_type==='video';
      const loc=p.abroad?(p.country||p.city):((p.village?p.village+' · ':'')+p.city);
      const src=isV?vidUrl(p.image_path):thumbUrl(p.image_path);
      return `<div class="vault-item">
        ${isV?`<video src="${src}#t=0.5" muted playsinline preload="metadata"></video>`
             :`<img src="${src}" loading="lazy" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'">`}
        <div class="vault-info">
          <div class="vault-title">${isV?'🎬 ':''}${esc(p.title)}</div>
          <div class="vault-loc">📍 ${esc(loc)}</div>
        </div>
        <button class="vault-pub" onclick="publishFromVault(${p.id})">📢 انشرها</button>
      </div>`;
    }).join('');
  }catch(e){}
}
export async function publishFromVault(pid){
  const _pv=state.photos.find(x=>x.id===pid);
  const _isVv=_pv&&_pv.media_type==='video';
  if(!confirm(_isVv?'نشر المقطع للجميع؟ بيظهر بالأضواء.':'نشرها للجميع؟ ستدخل الشبكة وتُحتسب لسباق ديرتك.'))return;
  const {error}=await sb.from('photos').update({visibility:'public'}).eq('id',pid).eq('user_id',currentUser()?.id);
  if(error){toast('تعذر النشر: '+error.message,true);return}
  toast(_isVv?'انتشر المقطع 🎉':'انتشرت للجميع 🎉');
  if(typeof maybeAskNotifs==='function')maybeAskNotifs();
  setTimeout(()=>{if(typeof checkRaceProgress==='function')checkRaceProgress()},2500);
  // إشعار للجميع
  try{
    const ph=state.photos.find(x=>x.id===pid);
    const nm=(await sb.from('profiles').select('display_name').eq('id',currentUser()?.id).maybeSingle()).data?.display_name||'مصوّر';
    if(ph){
      const isV=ph.media_type==='video';
      pushNotify({
        title:isV?'🎬 مقطع جديد في الأضواء':('📸 صورة جديدة من '+(ph.city||ph.region||'الديرة')),
        body:ph.title+' — عدسة '+nm,
        url:'/',
        exclude:currentUser()?.id
      });
    }
  }catch(e){}
  if(_pv)_pv.visibility='public';
  if(state.curPhoto&&state.curPhoto.id===pid)state.curPhoto.visibility='public';
  await loadPhotos();
  if(typeof renderVault==='function')renderVault();
  if(typeof renderProfTabs==="function"&&state.profUid){renderProfTabs();renderProfFeed();}
  // حدّث النافذة المفتوحة إن كانت لنفس الصورة
  if(state.curPhoto&&state.curPhoto.id===pid){
    const fresh=state.photos.find(x=>x.id===pid);
    if(fresh){state.curPhoto=fresh;openSheet(pid);}
    else if(typeof closeSheet==='function')closeSheet();
  }
  render();
  if(typeof renderMyStats==='function')renderMyStats();
}
export async function moveToVault(pid){
  const _mv=state.photos.find(x=>x.id===pid);
  const _isVm=_mv&&_mv.media_type==='video';
  if(!confirm(_isVm?'سحب المقطع لخزنتك؟ ما راح يشوفه أحد غيرك.':'سحبها لخزنتك؟ ما راح يشوفها أحد غيرك.'))return;
  const {error}=await sb.from('photos').update({visibility:'private'}).eq('id',pid).eq('user_id',currentUser()?.id);
  if(error){dbErr('سحب المفضلة',error,'تعذر السحب');return}
  toast(_isVm?'انسحب المقطع لخزنتك 🔒':'انسحبت لخزنتك 🔒');
  // نحدّث الحالة محلياً فوراً
  if(_mv)_mv.visibility='private';
  if(state.curPhoto&&state.curPhoto.id===pid)state.curPhoto.visibility='private';
  await loadPhotos();
  if(typeof renderVault==='function')renderVault();
  if(typeof renderProfTabs==="function"&&state.profUid){renderProfTabs();renderProfFeed();}
  const fresh=state.photos.find(x=>x.id===pid);
  if(state.curPhoto&&state.curPhoto.id===pid){
    if(fresh){state.curPhoto=fresh;openSheet(pid)}
    else closeSheet();
  }
  render();
}

/* ====== إرسال الإشعارات ====== */
