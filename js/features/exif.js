/* صورة من بلدي — features/exif.js
   بيانات الكاميرا */

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
/* ═══ عبر الحاجز ═══
   earlySuggest ← features/inspect.js
   hideSuggestions ← features/inspect.js
   renderFilterRow ← features/filters.js
   resetFilter ← features/filters.js
   runInspection ← features/inspect.js
*/
const earlySuggest = need('earlySuggest');
const hideSuggestions = need('hideSuggestions');
const renderFilterRow = need('renderFilterRow');
const resetFilter = need('resetFilter');
const runInspection = need('runInspection');
export function renderTechCard(){
  const el=$('techCard');if(!el)return;
  const t=state.exifTech;
  if(!t){el.style.display='none';return}
  el.style.display='block';
  const bits=[];
  if(t.camera)bits.push('<span class="tc-cam">📷 '+esc(t.camera)+'</span>');
  if(t.lens)bits.push('<span class="tc-cam">🔭 '+esc(t.lens)+'</span>');
  const set=[t.focal,t.aperture,t.shutter,t.iso].filter(Boolean);
  el.innerHTML=`
    <div class="tc-head">
      <span>⚙️ بيانات التصوير</span>
      <label class="tc-sw"><input type="checkbox" id="techShow" checked><span>أظهرها مع الصورة</span></label>
    </div>
    <div class="tc-body">
      ${bits.join('')}
      ${set.length?'<div class="tc-set">'+set.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':''}
    </div>`;
}

/* ====== اختيار فيديو ====== */

export async function readExifTech(file){
  try{
    const buf=await file.slice(0,256*1024).arrayBuffer();
    const dv=new DataView(buf);
    if(dv.getUint16(0)!==0xFFD8)return null;

    let off=2, tiff=0;
    while(off<dv.byteLength-4){
      if(dv.getUint16(off)===0xFFE1){
        if(dv.getUint32(off+4)===0x45786966){tiff=off+10;break}
      }
      const len=dv.getUint16(off+2);
      if(!len)break;
      off+=2+len;
    }
    if(!tiff)return null;

    const le=dv.getUint16(tiff)===0x4949;
    const u16=(p)=>dv.getUint16(p,le);
    const u32=(p)=>dv.getUint32(p,le);

    function readTags(dirStart,wanted,out){
      const n=u16(dirStart);
      for(let i=0;i<n;i++){
        const e=dirStart+2+i*12;
        const tag=u16(e), type=u16(e+2), cnt=u32(e+4);
        if(!wanted[tag])continue;
        const key=wanted[tag];
        let valOff=e+8;
        const sizes={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
        const total=(sizes[type]||1)*cnt;
        if(total>4)valOff=tiff+u32(e+8);
        if(valOff+total>dv.byteLength)continue;

        if(type===2){
          let s='';
          for(let k=0;k<cnt-1;k++){
            const ch=dv.getUint8(valOff+k);
            if(ch)s+=String.fromCharCode(ch);
          }
          out[key]=s.trim();
        }else if(type===3){
          out[key]=u16(valOff);
        }else if(type===4){
          out[key]=u32(valOff);
        }else if(type===5){
          const a=u32(valOff), b=u32(valOff+4);
          if(b)out[key]=a/b;
        }else if(type===10){
          const a=dv.getInt32(valOff,le), b=dv.getInt32(valOff+4,le);
          if(b)out[key]=a/b;
        }
      }
    }

    const out={};
    const ifd0=tiff+u32(tiff+4);
    readTags(ifd0,{0x010F:'make',0x0110:'model',0x0132:'taken'},out);

    // IFD الفرعي (بيانات التصوير)
    const n0=u16(ifd0);
    for(let i=0;i<n0;i++){
      const e=ifd0+2+i*12;
      if(u16(e)===0x8769){
        const sub=tiff+u32(e+8);
        if(sub<dv.byteLength)readTags(sub,{
          0x829A:'shutter',0x829D:'aperture',0x8827:'iso',
          0x920A:'focal',0xA434:'lens',0x9003:'taken'
        },out);
        break;
      }
    }

    const tech={};
    if(out.make||out.model){
      let cam=(out.model||'').trim();
      const mk=(out.make||'').trim();
      if(mk&&!cam.toLowerCase().startsWith(mk.toLowerCase().split(' ')[0]))cam=mk+' '+cam;
      if(cam)tech.camera=cam.slice(0,60);
    }
    if(out.lens)tech.lens=String(out.lens).slice(0,60);
    if(out.focal)tech.focal=Math.round(out.focal)+'mm';
    if(out.aperture)tech.aperture='f/'+(Math.round(out.aperture*10)/10);
    if(out.iso)tech.iso='ISO '+out.iso;
    if(out.shutter){
      const s=out.shutter;
      tech.shutter=s>=1?(Math.round(s*10)/10)+'s':'1/'+Math.round(1/s);
    }
    return Object.keys(tech).length?tech:null;
  }catch(e){return null}
}

/* ====== كاميرا الزاوية — صورة شبحية للمحاذاة ====== */
window.__ghostId=null;
