/* صورة من بلدي — features/music.js
   الموسيقى */

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
export let MUSIC_LIST=[];
state.pickedMusic=null;
state.musicAudio=null;
state.audioCtx=null;

export async function loadMusicList(){
  try{
    const r=await sb.from('music').select('*').eq('active',true).order('created_at');
    MUSIC_LIST=r.data||[];
  }catch(e){MUSIC_LIST=[]}
}

export function musicUrl(path){return sb.storage.from('music').getPublicUrl(path).data.publicUrl}

export function renderMusicChips(){
  const el=$('recMusic');if(!el)return;
  el.style.display='flex';
  el.innerHTML='';
  // زر رفع موسيقى من الجهاز
  const own=document.createElement('button');
  own.className='m-chip own'+(state.pickedMusic&&state.pickedMusic._local?' on':'');
  own.textContent=state.pickedMusic&&state.pickedMusic._local?('🎵 '+state.pickedMusic.name.slice(0,14)):'➕ موسيقاي';
  const openOwn=function(ev){
    if(ev){ev.preventDefault();ev.stopPropagation();}
    $('recMusicFile').click();
  };
  own.addEventListener('touchend',openOwn,{passive:false});
  own.addEventListener('click',openOwn);
  el.appendChild(own);
  const none=document.createElement('button');
  none.className='m-chip'+(state.pickedMusic?'':' on');
  none.textContent='🔇 بلا موسيقى';
  none.onclick=()=>{state.pickedMusic=null;stopMusicPreview();renderMusicChips()};
  el.appendChild(none);
  MUSIC_LIST.forEach(m=>{
    const b=document.createElement('button');
    b.className='m-chip'+(state.pickedMusic&&state.pickedMusic.id===m.id?' on':'');
    b.textContent='🎵 '+m.name;
    const pick=function(ev){
      if(ev){ev.preventDefault();ev.stopPropagation();}
      state.pickedMusic=m;previewMusic(m);renderMusicChips();
    };
    b.addEventListener('touchend',pick,{passive:false});
    b.addEventListener('click',pick);
    el.appendChild(b);
  });
}

export function previewMusic(m){
  try{
    if(!window.__actx)window.__actx=new (window.AudioContext||window.webkitAudioContext)();
    if(window.__actx.state==='suspended')window.__actx.resume();
  }catch(e){}
  const el=document.getElementById('musicPreview');
  if(!el)return;
  try{
    el.pause();
    const src=m._local?URL.createObjectURL(state.ownMusicFile):musicUrl(m.path);
    el.onerror=()=>{};
    el.src=src;
    el.volume=0.55;
    el.loop=true;
    el.load();
    const pr=el.play();
    if(pr&&pr.catch)pr.catch(()=>{});
    state.musicAudio=el;
  }catch(e){}
}

export function stopMusicPreview(){
  const el=document.getElementById('musicPreview');
  if(el){try{el.pause()}catch(e){}}
  state.musicAudio=null;
}

/* بناء مسار صوتي مدمج: ميكروفون + موسيقى */

export async function buildMixedStream(camStream){
  if(!state.pickedMusic)return camStream;
  const el=document.getElementById('musicPreview');
  if(!el||!el.src)return camStream;
  try{
    if(!window.__actx)window.__actx=new (window.AudioContext||window.webkitAudioContext)();
    state.audioCtx=window.__actx;
    if(state.audioCtx.state==='suspended'){try{await state.audioCtx.resume()}catch(e){}}

    const dest=state.audioCtx.createMediaStreamDestination();

    // صوت الكاميرا
    if(camStream.getAudioTracks().length){
      const micSrc=state.audioCtx.createMediaStreamSource(camStream);
      const micGain=state.audioCtx.createGain();
      micGain.gain.value=0.9;
      micSrc.connect(micGain).connect(dest);
    }

    // الموسيقى من عنصر الصفحة (يُنشأ المصدر مرة واحدة فقط)
    if(!el._srcNode){
      el._srcNode=state.audioCtx.createMediaElementSource(el);
      el._gain=state.audioCtx.createGain();
      el._srcNode.connect(el._gain);
      el._gain.connect(state.audioCtx.destination);
    }
    el._gain.gain.value=0.45;
    el._gain.connect(dest);

    el.currentTime=0;
    try{await el.play()}catch(e){}

    const mixed=new MediaStream();
    camStream.getVideoTracks().forEach(t=>mixed.addTrack(t));
    dest.stream.getAudioTracks().forEach(t=>mixed.addTrack(t));
    window.__mixDest=dest;
    return mixed;
  }catch(e){
    toast('تعذر دمج الموسيقى — سُجّل بالصوت الأصلي',true);
    return camStream;
  }
}

export function stopMixer(){
  try{
    const el=document.getElementById('musicPreview');
    if(el){
      try{el.pause()}catch(e){}
      if(el._gain&&window.__mixDest){try{el._gain.disconnect(window.__mixDest)}catch(e){}}
    }
    window.__mixDest=null;
  }catch(e){}
}

/* ====== فلاتر حية بشاشة التسجيل ====== */

state.ownMusicFile=null;

export function pickOwnMusic(inp){
  const f=inp.files[0];if(!f)return;
  if(f.size>8*1024*1024){toast('الملف كبير — الحد 8 ميجا',true);inp.value='';return}
  state.ownMusicFile=f;
  try{
    if(!window.__actx)window.__actx=new (window.AudioContext||window.webkitAudioContext)();
    if(window.__actx.state==='suspended')window.__actx.resume();
  }catch(e){}
  state.pickedMusic={id:'own',name:f.name.replace(/\.[^.]+$/,''),path:null,_local:true};
  previewMusic(state.pickedMusic);
  renderMusicChips();
  inp.value='';
}

/* نص زر النشر حسب النوع */
