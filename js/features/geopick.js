/* صورة من بلدي — features/geopick.js
   خريطة اختيار الموقع */

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
   fillPlaceFromGeo ← features/upload.js
*/
const fillPlaceFromGeo = need('fillPlaceFromGeo');


export function openGeoPick(){
  const box=$('geoPickBox');if(!box)return;
  bindGeoPickEvents();
  box.classList.add('show');

  /* ننتظر حتى تصير للحاوية أبعاد حقيقية */
  const waitReady = (tries=0) => {
    const el = document.getElementById('gpMap');
    if(!el) return;
    const h = el.clientHeight, wd = el.clientWidth;
    if((h < 40 || wd < 40) && tries < 30){
      return setTimeout(() => waitReady(tries+1), 60);
    }
    buildMap();
  };

  function buildMap(){
    try{
      if(!state.gpMap){
        // نقطة البداية: المنطقة المختارة أو وسط المملكة
        let c=[23.8859,45.0792], z=5;
        const reg=$('aRegion')?$('aRegion').value:'';
        const RC={
          'الرياض':[24.7136,46.6753,9],'مكة المكرمة':[21.3891,39.8579,9],
          'المدينة المنورة':[24.5247,39.5692,9],'القصيم':[26.3260,43.9750,9],
          'الشرقية':[26.4207,50.0888,8],'عسير':[18.2465,42.5117,9],
          'تبوك':[28.3835,36.5662,8],'حائل':[27.5219,41.6907,9],
          'الحدود الشمالية':[30.9843,41.0231,8],'جازان':[16.8892,42.5511,9],
          'نجران':[17.4924,44.1277,9],'الباحة':[20.0129,41.4677,10],'الجوف':[29.7859,40.2000,8]
        };
        if(RC[reg]){c=[RC[reg][0],RC[reg][1]];z=RC[reg][2]}
        // لو عنده موقع حالي، نبدأ منه
        else if(window.__USER_LAT){c=[window.__USER_LAT,window.__USER_LNG];z=11}

        state.gpMap=L.map('gpMap',{zoomControl:true,attributionControl:false}).setView(c,z);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(state.gpMap);

        // دبابيس صور المنصة القريبة — تساعد على التعرّف
        try{
          if(typeof state.photos!=='undefined'){
            state.photos.filter(p=>p.lat&&p.lng&&!p.abroad).slice(0,120).forEach(p=>{
              const ic=L.divIcon({className:'',html:'<div style="width:22px;height:22px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"><img src="'+thumbUrl(p.image_path)+'" style="width:100%;height:100%;object-fit:cover"></div>',iconSize:[22,22],iconAnchor:[11,11]});
              L.marker([p.lat,p.lng],{icon:ic,interactive:false}).addTo(state.gpMap);
            });
          }
        }catch(e){}

        state.gpMap.on('moveend',gpUpdateInfo);
      }
      /* محاولات متتابعة — الحاوية قد لا تكتمل أبعادها فوراً */
      const fix = () => { try{ state.gpMap.invalidateSize(true); }catch(e){} };
      fix();
      [60, 180, 400, 800].forEach(ms => setTimeout(fix, ms));
      gpUpdateInfo();
    }catch(e){
      console.error('[openGeoPick]', e);
      const gi=$('gpInfo');
      if(gi)gi.textContent='تعذر تحميل الخريطة: '+((e&&e.message)||'');
    }
  }

  setTimeout(() => waitReady(), 60);

  /* عند تغيّر حجم النافذة أو دوران الجوال */
  if(!window.__gpResizeBound){
    window.__gpResizeBound = true;
    window.addEventListener('resize', () => {
      if(state.gpMap && $('geoPickBox')?.classList.contains('show')){
        setTimeout(() => { try{ state.gpMap.invalidateSize(true); }catch(e){} }, 120);
      }
    });
  }
}
export function closeGeoPick(){
  const box=$('geoPickBox');
  if(box)box.classList.remove('show');
  state.geoPickMode=null;
}
export function gpUpdateInfo(){
  try{
    const c=state.gpMap.getCenter();
    $('gpInfo').innerHTML='📍 '+c.lat.toFixed(5)+' , '+c.lng.toFixed(5)
      +'<br><span style="font-size:11px">حرّك الخريطة حتى يقع الدبوس على مكان التصوير</span>';
  }catch(e){}
}
export async function gpSearchPlace(){
  const q=($('gpSearch').value||'').trim();
  if(!q)return;
  $('gpInfo').textContent='⏳ نبحث...';
  try{
    const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=sa&q='+encodeURIComponent(q),
      {headers:{'Accept-Language':'ar'}});
    const j=await r.json();
    if(j&&j[0]){
      state.gpMap.setView([parseFloat(j[0].lat),parseFloat(j[0].lon)],13);
      gpUpdateInfo();
    }else{
      $('gpInfo').textContent='ما لقينا المكان — جرّب اسماً آخر أو حرّك الخريطة يدوياً';
    }
  }catch(e){
    $('gpInfo').textContent='تعذر البحث — حرّك الخريطة يدوياً';
  }
}
export function confirmGeoPick(){
  try{
    if(!state.gpMap){
      toast('الخريطة ما جهزت بعد — انتظر لحظة',true);
      return;
    }
    const c=state.gpMap.getCenter();
    if(!c || !isFinite(c.lat) || !isFinite(c.lng)){
      toast('تعذر قراءة الموقع من الخريطة',true);
      return;
    }
    // وضع تعديل صورة منشورة
    if(state.geoPickMode==='edit'){
      state.edGeo={lat:c.lat,lng:c.lng};
      const main=$('edGeoMain'), sub=$('edGeoSub'), card=$('edGeoCard');
      if(card)card.classList.remove('warn');
      if(main)main.textContent='📍 موقع جديد';
      if(sub)sub.textContent=c.lat.toFixed(5)+', '+c.lng.toFixed(5);
      state.geoPickMode=null;
      closeGeoPick();
      toast('انضبط الموقع — اضغط «حفظ» لتثبيته');
      return;
    }
    state.pendingGeo={lat:c.lat,lng:c.lng};
    window.__geoManual=true;
    const card=$('geoCard');
    if(card){
      card.classList.remove('warn');
      $('geoStatus').innerHTML='🗺️ حدّدت الموقع يدوياً على الخريطة';
      $('geoCoords').textContent=c.lat.toFixed(5)+', '+c.lng.toFixed(5);
    }
    const mb=$('geoManualBox');
    if(mb)mb.style.display='none';
    closeGeoPick();
    toast('انحفظ الموقع 📍');
    try{ fillPlaceFromGeo(c.lat,c.lng); }catch(e){ console.warn('fillPlaceFromGeo', e); }
  }catch(e){
    console.error('[confirmGeoPick]', e);
    toast('تعذر الحفظ: '+((e&&e.message)||''),true);
  }
}

/* ====== اقتراح مبكر عند اختيار الصورة ====== */

/* ═══ مستمعات مباشرة — لا تعتمد على الجسر ═══
   تُربط مرة واحدة عند أول فتح، فتعمل حتى لو تعطّل onclick */
export function bindGeoPickEvents(){
  if(window.__gpBound) return;
  window.__gpBound = true;

  document.addEventListener('click', (e) => {
    const box = document.getElementById('geoPickBox');
    if(!box || !box.classList.contains('show')) return;

    const btn = e.target.closest('button');
    if(!btn || !box.contains(btn)) return;

    const txt = (btn.textContent || '').trim();
    if(txt.includes('هذا هو المكان')){
      e.preventDefault(); e.stopPropagation();
      confirmGeoPick();
    }else if(txt === 'إلغاء' || txt === '✕'){
      e.preventDefault(); e.stopPropagation();
      closeGeoPick();
    }else if(txt === '🔍'){
      e.preventDefault(); e.stopPropagation();
      gpSearchPlace();
    }
  }, true);   /* مرحلة الالتقاط — تسبق أي مستمع آخر */
}
