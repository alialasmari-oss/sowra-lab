/* صورة من بلدي — features/reels.js
   أضواء الديرة */

import { currentUser, sb } from '../core/db.js';
import { rankOf } from '../core/format.js';
import { get, need } from '../core/hub.js';
import { vidUrl } from '../core/media.js';
import { state, videoAllowed } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';
const _seenViews_ = () => get('seenViews');

/* ═══ عبر الحاجز ═══
   filterCss ← features/upload.js
   initRecBtn ← features/camera.js
   recOpen ← features/camera.js
   recSupported ← features/camera.js
*/
const filterCss = need('filterCss');
const initRecBtn = need('initRecBtn');
const recOpen = need('recOpen');
const recSupported = need('recSupported');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const loadPhotos = need('loadPhotos');
const openProfile = need('openProfile');
const toggleFav = need('toggleFav');

/* state.reelsList → state.reelsList */
export async function openReels(){
  const _sp=state.banner;
  if(!_sp.video_enabled&&!_sp.reels_soon){
    toast('🎬 الأضواء غير متاحة حالياً',true);
    return;
  }
  go('reels');
  const wrap=$('reelsWrap');if(!wrap)return;

  // وضع «قريباً» — مفتاح بالترس
  const _rs=(state.banner&&('reels_soon' in state.banner))?state.banner.reels_soon:(state.banner&&state.banner.reels_soon);
  if(_rs){
    wrap.innerHTML=`<div class="reels-soon">
      <div class="rs-ic">🎬</div>
      <div class="rs-title">أضواء الديرة</div>
      <div class="rs-badge">قريباً</div>
      <div class="rs-txt">
        الصورة تريك كيف <b>يبدو</b> المكان<br>
        والمقطع يريك كيف <b>يُحَس</b>
      </div>
      <div class="rs-list">
        <div>🌬️ صوت الريح على القمم</div>
        <div>💧 خرير الماء بالأودية</div>
        <div>🚶 وقع الخطى على الدرب</div>
      </div>
      <div class="rs-foot">جهّز عدستك — نفتحها قريباً بإذن الله</div>
    </div>`;
    return;
  }

  wrap.innerHTML='<div class="reels-empty"><span class="big">⏳</span></div>';
  state.reelsList=state.photos.filter(p=>p.media_type==='video');
  if(!state.reelsList.length){
    wrap.innerHTML=`<div class="reels-empty">
      <span class="big">🎬</span>
      <div style="font-size:16px;font-weight:700">ما فيه مقاطع بعد</div>
      <div style="font-size:13px;line-height:1.9;color:rgba(255,255,255,.65)">كن أول من يوثّق صوت المكان<br>اضغط الزر الأحمر وسجّل ٣٠ ثانية</div>
    </div>`;
    return;
  }
  renderReels();
}

export function renderReels(){
  const wrap=$('reelsWrap');if(!wrap)return;
  wrap.innerHTML=state.reelsList.map(p=>{
    const fx=(p.filter_key&&p.filter_key!=='none'&&typeof filterCss==='function')?filterCss(p.filter_key):'none';
    const loc=p.abroad?(p.country||p.city):((p.village?p.village+' · ':'')+p.city);
    const fav=state.favSet.has(p.id);
    const mine=!!(currentUser()&&p.user_id===currentUser()?.id);
    const rk=rankOf(p);
    return `<div class="reel" data-id="${p.id}">
      <video src="${vidUrl(p.image_path)}" loop playsinline webkit-playsinline preload="none" muted style="filter:${fx}"></video>
      <div class="reel-shade"></div>
      <div class="reel-prog"><div class="reel-prog-fill"></div></div>
      <div class="reel-time">0:00</div>
      <button class="reel-mute" onclick="toggleReelMute(event)">🔇</button>
      <button class="reel-back" onclick="go('feed')">✕</button>
      <div class="reel-side">
        <button class="reel-avatar" onclick="reelProfile('${p.user_id}',event)" title="${esc(p.photographer)}">
          <span>${rk.ic}</span>
        </button>
        <button class="reel-act ${fav?'on':''}" onclick="reelFav(${p.id},event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          حفظ
        </button>
        <button class="reel-act" onclick="openSheet(${p.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          ${p.comments_count||0}
        </button>
        <button class="reel-act" onclick="reelShare(${p.id},event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          مشاركة
        </button>
        <button class="reel-act" onclick="openSheet(${p.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15 9 22 9.3 16.5 13.8 18.5 21 12 17 5.5 21 7.5 13.8 2 9.3 9 9"/></svg>
          ${Number(p.avg_stars).toFixed(1)}
        </button>
        ${mine?`<button class="reel-act del" onclick="reelDelete(${p.id},'${p.image_path}',event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          حذف
        </button>`:`<button class="reel-act" onclick="reelReport(${p.id},event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          إبلاغ
        </button>`}
      </div>
      <div class="reel-info">
        <div class="reel-user" onclick="reelProfile('${p.user_id}',event)">${rk.ic} ${esc(p.photographer)}</div>
        <div class="reel-title">${esc(p.title)}</div>
        <div class="reel-loc" onclick="reelToMap(${p.lat||0},${p.lng||0},event)">📍 ${esc(loc)}</div>
        ${p.music_key?`<div class="reel-music">🎵 ${esc(p.music_key)}</div>`:''}
      </div>
    </div>`;
  }).join('');
  setupReelPlayback();
}

export function setupReelPlayback(){
  if(state.reelObserver)state.reelObserver.disconnect();
  const vids=document.querySelectorAll('#reelsWrap video');
  state.reelObserver=new IntersectionObserver(entries=>{
    entries.forEach(en=>{
      const v=en.target;
      if(en.isIntersecting&&en.intersectionRatio>0.6){
        v.muted=state.reelsMuted;
        v.play().catch(()=>{});
        const pid=v.closest('.reel')?.dataset.id;
        if(pid&&!_seenViews_().has(+pid)){
          _seenViews_().add(+pid);
          try{sb.rpc('bump_view',{pid:+pid}).then(()=>{},()=>{})}catch(e){}
        }
      }else{
        try{v.pause()}catch(e){}
      }
    });
  },{threshold:[0,0.6,1]});
  vids.forEach(v=>{
    state.reelObserver.observe(v);
    v.addEventListener('click',()=>{v.paused?v.play().catch(()=>{}):v.pause()});
    v.addEventListener('timeupdate',()=>{
      const reel=v.closest('.reel');if(!reel)return;
      const fill=reel.querySelector('.reel-prog-fill');
      const tm=reel.querySelector('.reel-time');
      const d=v.duration||0;
      if(d>0){
        const left=Math.max(0,d-v.currentTime);
        if(fill)fill.style.width=(v.currentTime/d*100)+'%';
        if(tm)tm.textContent='0:'+String(Math.ceil(left)).padStart(2,'0');
      }
    });
  });
  // شغّل الأول فوراً
  if(vids[0]){vids[0].muted=state.reelsMuted;vids[0].play().catch(()=>{})}
}

export function toggleReelMute(e){
  e.stopPropagation();
  state.reelsMuted=!state.reelsMuted;
  document.querySelectorAll('#reelsWrap video').forEach(v=>v.muted=state.reelsMuted);
  document.querySelectorAll('.reel-mute').forEach(b=>b.textContent=state.reelsMuted?'🔇':'🔊');
  toast(state.reelsMuted?'الصوت مكتوم':'الصوت شغّال 🔊');
}

export async function reelFav(pid,e){
  e.stopPropagation();
  await toggleFav(pid);
  const btn=e.currentTarget;
  if(btn)btn.classList.toggle('on',state.favSet.has(pid));
}

export function reelShare(pid,e){
  e.stopPropagation();
  const p=state.photos.find(x=>x.id===pid);
  if(!p)return;
  const url='https://sowra.app';
  if(navigator.share){
    navigator.share({
      title:p.title,
      text:p.title+' — من عدسات أهل الديار 📍'+(p.village||p.city),
      url:'https://sowra.app'
    }).catch(()=>{});
  }else{
    try{navigator.clipboard.writeText(url);toast('انسخ الرابط ✅')}catch(err){}
  }
}

export function reelToMap(lat,lng,e){
  e.stopPropagation();
  if(!lat||!lng){toast('ما فيه موقع مسجّل لهذا المقطع',true);return}
  window.open('https://maps.google.com/?q='+lat+','+lng,'_blank');
}

export function reelsRecord(){
  if(typeof recSupported==='function'&&recSupported()){
    if(typeof recOpen==='function')recOpen();
  }else{
    toast('جهازك ما يدعم التسجيل — استخدم صفحة النشر',true);
    go('add');
  }
}

export function stopAllReels(){
  try{
    if(state.reelObserver){state.reelObserver.disconnect();state.reelObserver=null}
    document.querySelectorAll('#reelsWrap video').forEach(v=>{try{v.pause()}catch(e){}});
  }catch(e){}
}

/* ====== إجراءات الأضواء ====== */

export function reelProfile(uid,e){
  e.stopPropagation();
  stopAllReels();
  openProfile(uid);
}

export async function reelDelete(pid,path,e){
  e.stopPropagation();
  if(!confirm('حذف المقطع نهائياً؟ لا يمكن التراجع.'))return;
  try{await sb.storage.from('videos').remove([path])}catch(err){}
  const {error}=await sb.from('photos').delete().eq('id',pid).eq('user_id',currentUser()?.id);
  if(error){toast('تعذر الحذف: '+error.message,true);return}
  toast('انحذف المقطع ✅');
  await loadPhotos();
  state.reelsList=state.photos.filter(x=>x.media_type==='video');
  if(state.reelsList.length)renderReels();
  else openReels();
}

export async function reelReport(pid,e){
  e.stopPropagation();
  if(!confirm('إبلاغ عن هذا المقطع؟'))return;
  try{
    const {error}=await sb.from('reports').insert({photo_id:pid});
    if(error)throw error;
    toast('وصل بلاغك — شكراً 🚩');
  }catch(err){toast('تعذر الإبلاغ',true)}
}

/* ====== السبق على الموقع ====== */
/* state.claimMap معرّفة بأعلى الملف */

export function initVideoUpload(){
  // تبويب الأضواء بالشريط السفلي
  try{
    const sp=state.banner;
    const off=(!sp.video_enabled&&!sp.reels_soon);
    const nb=document.getElementById('nb-reels');
    if(nb)nb.style.display=off?'none':'';
  }catch(e){}

  const row=$('videoRow');if(!row)return;
  const on=(typeof videoAllowed==='function')?videoAllowed():false;
  row.style.display=on?'flex':'none';
  if(typeof initRecBtn==='function')initRecBtn();
  // إخفاء صريح لكل عناصر الفيديو
  if(!on){
    ['recOpenBtn','fileVid','videoRow'].forEach(function(id){
      const e=document.getElementById(id);
      if(e)e.style.display='none';
    });
  }
}

/* ====== أضواء الديرة — منصة الفيديو ====== */
