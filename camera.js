/* صورة من بلدي — features/camera.js
   الكاميرا والتسجيل */

import { sb } from '../core/db.js';
import { liveLocation } from '../core/geo.js';
import { get, need } from '../core/hub.js';
import { state, videoAllowed } from '../core/state.js';
import { $, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';
const _FILTERS_ = () => get('FILTERS');

/* ═══ عبر الحاجز ═══
   applyGeo ← features/upload.js
   ghostClear ← features/upload.js
   loadGhosts ← features/upload.js
   renderFilterRow ← features/upload.js
   showClearBtn ← features/upload.js
   syncPublishBtn ← features/upload.js
*/
const applyGeo = need('applyGeo');
const ghostClear = need('ghostClear');
const loadGhosts = need('loadGhosts');
const renderFilterRow = need('renderFilterRow');
const showClearBtn = need('showClearBtn');
const syncPublishBtn = need('syncPublishBtn');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');
/* ═══ عبر الحاجز (نُقل للهيدر) ═══
*/
const buildMixedStream = need('buildMixedStream');
const loadMusicList = need('loadMusicList');

const renderMusicChips = need('renderMusicChips');
const stopMixer = need('stopMixer');
const stopMusicPreview = need('stopMusicPreview');
export let recStream=null;
state.recStart=0;
state.recorder=null;
state.recChunks=[];
state.recTimer=null;
state.recFacing='environment';
state.pendingMusicName='';

export const REC_MAX=30;

export function recSupported(){
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

export function initRecBtn(){
  const b=$('recOpenBtn');if(!b)return;
  b.style.display=(videoAllowed()&&recSupported())?'flex':'none';
}

export async function recOpen(){
  if(!videoAllowed()){toast('رفع المقاطع مغلق حالياً 🎬',true);return}
  if(!recSupported()){toast('جهازك ما يدعم التسجيل الداخلي — استخدم المعرض',true);return}
  try{
    recStream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:state.recFacing,width:{ideal:1280},height:{ideal:720}},
      audio:true
    });
  }catch(e){toast('تعذر فتح الكاميرا — تأكد من الإذن',true);return}
  const pv=$('recPreview');
  pv.srcObject=recStream;
  $('recScreen').classList.add('on');
    setTimeout(function(){try{if(typeof loadGhosts==='function')loadGhosts()}catch(e){}},800);
  document.body.style.overflow='hidden';
  $('recFill').style.width='0%';
  $('recTimer').textContent='00:00';
  $('recTimer').classList.remove('live');
  $('recHint').textContent='اضغط مطولاً للتسجيل';
  state.pickedMusic=null;state.ownMusicFile=null;state.recFilter='none';
  const pv2=$('recPreview');
  if(pv2){pv2.style.filter='none';pv2.style.webkitFilter='none';}
  loadMusicList().then(renderMusicChips);
  renderRecFilters();
  initTapFocus();
  bindRecBtn();
}

export function recClose(){
  if(typeof ghostClear==="function")ghostClear();
  const _gb=document.getElementById("ghostBar");if(_gb)_gb.style.display="none";
  recStop(true);
  stopMusicPreview();stopMixer();
  state.ownMusicFile=null;
  if(recStream){recStream.getTracks().forEach(t=>t.stop());recStream=null}
  $('recScreen').classList.remove('on');
  document.body.style.overflow='';
}

export async function recFlip(){
  state.recFacing = state.recFacing==='environment' ? 'user' : 'environment';
  if(recStream)recStream.getTracks().forEach(t=>t.stop());
  try{
    recStream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:state.recFacing,width:{ideal:1280},height:{ideal:720}},audio:true
    });
    $('recPreview').srcObject=recStream;
  }catch(e){toast('تعذر تبديل الكاميرا',true)}
}

export function pickMime(){
  const opts=['video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  for(const m of opts){if(MediaRecorder.isTypeSupported(m))return m}
  return '';
}

export function buzz(ms){try{if(navigator.vibrate)navigator.vibrate(ms)}catch(e){}}

export async function recCountdown(){
  const el=$('recCount');if(!el)return;
  el.classList.add('on');
  for(let n=3;n>=1;n--){
    el.textContent=n;
    buzz(30);
    await new Promise(r=>setTimeout(r,700));
  }
  el.classList.remove('on');
  el.textContent='';
}

export async function recBegin(){
  if(!recStream||state.recorder)return;
  state.recChunks=[];
  stopMusicPreview();
  await recCountdown();
  if(!recStream)return;
  const mime=pickMime();
  let target=recStream;
  try{ target=await buildMixedStream(recStream); }catch(e){}
  try{
    state.recorder=mime?new MediaRecorder(target,{mimeType:mime,videoBitsPerSecond:2500000})
                 :new MediaRecorder(target);
  }catch(e){toast('تعذر بدء التسجيل',true);stopMixer();return}
  state.recorder.ondataavailable=e=>{if(e.data&&e.data.size)state.recChunks.push(e.data)};
  state.recorder.onstop=recFinish;
  state.recorder.start(200);
  buzz(60);
  state.recStart=Date.now();
  $('recBtn').classList.add('recording');
  const _h=document.getElementById('recHint');
  if(_h)_h.textContent='● يسجّل — اضغط الزر للإيقاف';
  $('recTimer').classList.add('live');
  $('recHint').textContent='ارفع إصبعك للإيقاف';
  state.recTimer=setInterval(()=>{
    const s=(Date.now()-state.recStart)/1000;
    const pct=Math.min(100,s/REC_MAX*100);
    $('recFill').style.width=pct+'%';
    const mm=String(Math.floor(s/60)).padStart(2,'0');
    const ss=String(Math.floor(s%60)).padStart(2,'0');
    $('recTimer').textContent=mm+':'+ss;
    if(s>=REC_MAX)recStop();
  },100);
}

export function recStop(silent){
  state.recStart=null;
  if(state.recTimer){clearInterval(state.recTimer);state.recTimer=null;if(!silent)buzz([40,40,40]);}
  stopMixer();
  $('recBtn').classList.remove('recording');
  const _h2=document.getElementById('recHint');
  if(_h2)_h2.textContent='اضغط الزر لبدء التسجيل';
  $('recTimer').classList.remove('live');
  $('recHint').textContent='اضغط مطولاً للتسجيل';
  if(state.recorder&&state.recorder.state!=='inactive'){
    if(silent)state.recorder.onstop=null;
    state.recorder.stop();
  }
  if(silent)state.recorder=null;
}

export async function recFinish(){
  const secs=(Date.now()-state.recStart)/1000;
  state.recorder=null;
  if(secs<1.2){toast('التسجيل قصير جداً — ثانية على الأقل',true);state.recChunks=[];return}
  const type=state.recChunks[0]?.type||'video/mp4';
  const ext=type.includes('mp4')?'mp4':'webm';
  const blob=new Blob(state.recChunks,{type});
  state.recChunks=[];
  if(blob.size>25*1024*1024){toast('الفيديو كبير — سجّل مدة أقصر',true);return}

  state.pendingMusicName=state.pickedMusic?state.pickedMusic.name:'';
  if(state.recFilter&&state.recFilter!=='none')state.curFilter=state.recFilter;
  state.pendingVideo=new File([blob],'rec.'+ext,{type});
  state.pendingFile=null;state.pendingBlob=null;

  recClose();
  go('add');
  $('drop').style.display='block';
  const _im2=$('preview');
  if(_im2){_im2.removeAttribute('src');_im2.style.display='none';}
  const pv=$('videoPreview');
  if(pv){pv.src=URL.createObjectURL(blob);pv.style.display='block';}
  $('dropTxt').textContent='🎬 تسجيل جاهز ('+Math.round(secs)+' ثانية)';
  $('drop').classList.add('has');
  showClearBtn();syncPublishBtn();
  state.curFilter='none';
  const _vurl=pv?pv.src:URL.createObjectURL(state.pendingVideo);
  try{ renderFilterRow(null,true,_vurl); }catch(e){}
  captureVideoFrame(state.pendingVideo).then(t=>{if(t)renderFilterRow(t,true)}).catch(()=>{});
  $('geoCard').style.display='block';$('geoCard').classList.remove('warn');
  $('geoStatus').textContent='⏳ جاري تحديد الموقع...';$('geoCoords').textContent='';
  const pos=await liveLocation();
  applyGeo(pos,'live');
  toast('انتهى التسجيل — أضف العنوان وانشر 🎬');
}

export function bindRecBtn(){
  const b=$('recBtn');
  if(!b||b._bound)return;
  b._bound=true;

  // ضغطة واحدة: تبدأ · ضغطة ثانية: توقف
  const toggle=function(e){
    e.preventDefault();
    e.stopPropagation();
    if(state.recorder){
      // حد أدنى ثانيتان قبل السماح بالإيقاف
      if(state.recStart&&(Date.now()-state.recStart)<2000){
        toast('سجّل ثانيتين على الأقل',true);
        return;
      }
      recStop();
    }else{
      state.recStart=Date.now();
      recBegin().catch(()=>{});
    }
  };

  b.addEventListener('click',toggle);
  // منع التمرير من تشغيل الزر
  b.addEventListener('touchstart',function(e){e.stopPropagation()},{passive:true});
}

/* ====== فلاتر بهوية سعودية ====== */

export function captureVideoFrame(file){
  return new Promise(res=>{
    try{
      const v=document.createElement('video');
      v.preload='metadata';v.muted=true;v.playsInline=true;
      v.onloadeddata=()=>{
        try{
          v.currentTime=Math.min(0.6,(v.duration||1)/3);
        }catch(e){res(null)}
      };
      v.onseeked=()=>{
        try{
          const cv=document.createElement('canvas');
          const s=Math.min(1,160/Math.max(v.videoWidth,v.videoHeight));
          cv.width=Math.round(v.videoWidth*s);cv.height=Math.round(v.videoHeight*s);
          cv.getContext('2d').drawImage(v,0,0,cv.width,cv.height);
          URL.revokeObjectURL(v.src);
          res(cv.toDataURL('image/jpeg',0.7));
        }catch(e){res(null)}
      };
      v.onerror=()=>res(null);
      v.src=URL.createObjectURL(file);
    }catch(e){res(null)}
  });
}

/* مصغّرة dataURL للمعاينة (أضمن على iOS من blob URL) */

export function makeThumbDataUrl(file){
  return new Promise(res=>{
    try{
      const img=new Image();
      img.onload=()=>{
        try{
          const s=Math.min(1,160/Math.max(img.width,img.height));
          const cv=document.createElement('canvas');
          cv.width=Math.max(1,Math.round(img.width*s));
          cv.height=Math.max(1,Math.round(img.height*s));
          cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
          URL.revokeObjectURL(img.src);
          res(cv.toDataURL('image/jpeg',0.72));
        }catch(e){res(null)}
      };
      img.onerror=()=>res(null);
      img.src=URL.createObjectURL(file);
    }catch(e){res(null)}
  });
}

/* ====== إلغاء المسودة ====== */

export function toggleGrid(){
  const g=$('recGrid');
  if(g)g.classList.toggle('on');
}

/* ====== قفل التركيز باللمس ====== */

export function initTapFocus(){
  const pv=$('recPreview');
  if(!pv||pv._focusBound)return;
  pv._focusBound=true;
  pv.addEventListener('click',async e=>{
    if(!recStream)return;
    const track=recStream.getVideoTracks()[0];
    if(!track)return;
    const rect=pv.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width;
    const y=(e.clientY-rect.top)/rect.height;
    // مؤشر بصري
    let ring=document.getElementById('recFocus');
    if(!ring){
      ring=document.createElement('div');
      ring.id='recFocus';ring.className='rec-focus';
      $('recScreen').appendChild(ring);
    }
    ring.style.left=(e.clientX-rect.left-38)+'px';
    ring.style.top=(e.clientY-rect.top-38)+'px';
    ring.classList.remove('on');
    void ring.offsetWidth;
    ring.classList.add('on');
    setTimeout(()=>ring.classList.remove('on'),900);
    buzz(20);
    // محاولة ضبط البؤرة إن دعمها الجهاز
    try{
      const caps=track.getCapabilities?track.getCapabilities():{};
      if(caps.focusMode&&caps.focusMode.includes('manual')&&caps.pointsOfInterest){
        await track.applyConstraints({advanced:[{pointsOfInterest:[{x,y}],focusMode:'manual'}]});
      }else if(caps.focusMode&&caps.focusMode.includes('single-shot')){
        await track.applyConstraints({advanced:[{focusMode:'single-shot'}]});
      }
    }catch(err){}
  });
}

/* ====== موسيقى من جهاز الزائر ====== */

state.recFilter='none';

export function renderRecFilters(){
  const el=$('recFilters');if(!el)return;
  el.innerHTML='';
  _FILTERS_().forEach(f=>{
    const b=document.createElement('button');
    b.className='rf-chip'+(state.recFilter===f.k?' on':'');
    b.textContent=f.n;
    const setF=function(ev){
      if(ev){ev.preventDefault();ev.stopPropagation();}
      state.recFilter=f.k;
      const pv=$('recPreview');
      if(pv){pv.style.filter=f.css;pv.style.webkitFilter=f.css;}
      renderRecFilters();
    };
    b.addEventListener('touchend',setF,{passive:false});
    b.addEventListener('click',setF);
    el.appendChild(b);
  });
}

/* ====== شبكة الأثلاث ====== */
