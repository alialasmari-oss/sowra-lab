/* صورة من بلدي — features/filters.js
   الفلاتر والصورة الشبحية */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, findOpt } from '../core/format.js';
import { liveLocation, readExifGPS, readExifGPS2, reverseGeo, validPos } from '../core/geo.js';
import { need } from '../core/hub.js';
import { compress, compressTo, thumbPath, thumbUrl } from '../core/media.js';
import { state, videoAllowed } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   captureVideoFrame ← features/camera.js
   checkRaceProgress ← features/visits.js
   checkRate ← features/limits.js
   fillAddCities ← features/feed.js
   loadPhotos ← features/feed.js
   logRate ← features/limits.js
   openAcc ← features/account.js
   pushNotify ← features/notify.js
*/
const captureVideoFrame = need('captureVideoFrame');
const checkRaceProgress = need('checkRaceProgress');
const checkRate = need('checkRate');
const fillAddCities = need('fillAddCities');
const loadPhotos = need('loadPhotos');
const logRate = need('logRate');
const openAcc = need('openAcc');
const pushNotify = need('pushNotify');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');
const maybeAskNotifs = need('maybeAskNotifs');

export const FILTERS=[
  {k:'none',   n:'الأصلي',        css:'none'},
  {k:'sunset', n:'غروب السودة',   css:'saturate(1.45) contrast(1.12) sepia(.18) hue-rotate(-8deg) brightness(1.04)'},
  {k:'mist',   n:'ضباب أبها',     css:'saturate(.78) contrast(.94) brightness(1.12) hue-rotate(6deg)'},
  {k:'sand',   n:'رمال الصمان',   css:'sepia(.34) saturate(1.28) contrast(1.15) brightness(1.05)'},
  {k:'night',  n:'ليل نجد',       css:'saturate(1.18) contrast(1.3) brightness(.86) hue-rotate(200deg) saturate(1.1)'},
  {k:'qatt',   n:'قط عسيري',      css:'saturate(1.85) contrast(1.22) brightness(1.03)'},
  {k:'clay',   n:'طين نجران',     css:'sepia(.42) saturate(1.35) contrast(1.1) hue-rotate(-12deg)'},
  {k:'sea',    n:'بحر جدة',       css:'saturate(1.35) hue-rotate(12deg) brightness(1.07) contrast(1.08)'},
  {k:'palm',   n:'نخيل القصيم',   css:'saturate(1.4) hue-rotate(-10deg) contrast(1.12) brightness(1.02)'},
  {k:'memory', n:'ذاكرة',         css:'sepia(.62) saturate(.85) contrast(1.06) brightness(1.05)'},
  {k:'coal',   n:'فحم',           css:'grayscale(1) contrast(1.32) brightness(1.04)'},
  {k:'clear',  n:'صحو',           css:'contrast(1.28) saturate(1.15) brightness(1.06)'}
];

/* state.curFilter → state.curFilter */
export function filterCss(k){
  const f=FILTERS.find(x=>x.k===k);
  return f?f.css:'none';
}
export function renderFilterRow(srcUrl,isVideo,videoBlobUrl){
  try{
    const row=document.getElementById('filterRow');
    if(!row)return;
    if(!srcUrl&&!videoBlobUrl)return;
    row.innerHTML='';
    row.style.display='flex';
    for(let i=0;i<FILTERS.length;i++){
      const f=FILTERS[i];
      const item=document.createElement('div');
      item.className='f-item'+(state.curFilter===f.k?' on':'');
      item.setAttribute('data-k',f.k);
      const thumb=document.createElement('div');
      thumb.className='f-thumb';
      thumb.style.filter=f.css;
      thumb.style.webkitFilter=f.css;
      if(srcUrl){
        thumb.style.backgroundImage='url("'+srcUrl+'")';
        thumb.style.backgroundSize='cover';
        thumb.style.backgroundPosition='center';
      }else{
        const v=document.createElement('video');
        v.src=videoBlobUrl;v.muted=true;v.playsInline=true;
        v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');
        v.preload='metadata';
        v.style.cssText='width:100%;height:100%;object-fit:cover;display:block';
        thumb.appendChild(v);
      }
      const name=document.createElement('div');
      name.className='f-name';
      name.textContent=f.n;
      item.appendChild(thumb);
      item.appendChild(name);
      item.onclick=(function(key){return function(){pickFilter(key)}})(f.k);
      row.appendChild(item);
    }
    applyFilterPreview();
  }catch(e){}
}
export function pickFilter(k){
  try{
    state.curFilter=k;
    const items=document.querySelectorAll('#filterRow .f-item');
    for(let i=0;i<items.length;i++){
      items[i].classList.toggle('on',items[i].getAttribute('data-k')===k);
    }
    applyFilterPreview();
  }catch(e){}
}
export function applyFilterPreview(){
  try{
    const css=filterCss(state.curFilter);
    const im=document.getElementById('preview'), vd=document.getElementById('videoPreview');
    if(im){im.style.filter=css;im.style.webkitFilter=css;}
    if(vd){vd.style.filter=css;vd.style.webkitFilter=css;}
  }catch(e){}
}
export function resetFilter(){
  try{
  state.curFilter='none';
  const row=$('filterRow');if(row){row.style.display='none';row.innerHTML=''}
  const im=$('preview'), vd=$('videoPreview');
  if(im){im.style.filter='none';im.style.webkitFilter='none';}
  if(vd){vd.style.filter='none';vd.style.webkitFilter='none';}
  }catch(e){}
}

/* حرق الفلتر على الصورة عند الضغط */
export function bakeFilter(ctx,w,h){
  if(state.curFilter==='none')return;
  ctx.filter=filterCss(state.curFilter);
}

/* التقاط إطار من الفيديو لمعاينة الفلاتر */
export async function loadGhosts(){
  const bar=$('ghostBar'), strip=$('ghostStrip');
  if(!bar||!strip)return;
  bar.style.display='none';
  try{
    if(!window.__USER_LAT||typeof state.photos==='undefined')return;
    const lat=window.__USER_LAT, lng=window.__USER_LNG;
    const d=p=>Math.hypot((p.lat-lat)*111000,(p.lng-lng)*111000*Math.cos(lat*Math.PI/180));

    const near=state.photos.filter(p=>
      p.lat&&p.lng&&p.media_type!=='video'&&p.visibility!=='private'&&d(p)<=200
    ).sort((a,b)=>d(a)-d(b)).slice(0,10);

    if(!near.length)return;
    bar.style.display='block';
    strip.innerHTML=near.map(p=>
      `<img class="gb-thumb" src="${thumbUrl(p.image_path)}" onclick="ghostPick(${p.id},this)" alt="">`
    ).join('');
  }catch(e){}
}
export function ghostPick(pid,el){
  const img=$('ghostImg');
  if(!img)return;
  const p=state.photos.find(x=>x.id===pid);
  if(!p)return;

  if(window.__ghostId===pid){ghostClear();return}

  window.__ghostId=pid;
  img.src=thumbUrl(p.image_path);
  img.style.display='block';
  const sl=$('ghostSlider'), off=$('ghostOff');
  if(sl)sl.style.display='flex';
  if(off)off.style.display='block';
  document.querySelectorAll('.gb-thumb').forEach(t=>t.classList.remove('on'));
  if(el)el.classList.add('on');
  toast('👻 حاذِ المشهد مع الصورة');
}
export function ghostOpacity(v){
  const img=$('ghostImg');
  if(img)img.style.opacity=(v/100);
}
export function ghostClear(){
  window.__ghostId=null;
  const img=$('ghostImg');
  if(img){img.style.display='none';img.src=''}
  const sl=$('ghostSlider'), off=$('ghostOff');
  if(sl)sl.style.display='none';
  if(off)off.style.display='none';
  document.querySelectorAll('.gb-thumb').forEach(t=>t.classList.remove('on'));
}


/* تحقق: إحداثيات صالحة فعلاً؟ */
