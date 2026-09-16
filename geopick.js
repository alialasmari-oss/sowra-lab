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
  const box=$('geoPickBox');
  if(!box)return;
  bindGeoPickEvents();
  box.classList.add('show');

  const curPhotoRegion = () => {
    try{ return state.curPhoto ? state.curPhoto.region : ''; }catch(e){ return ''; }
  };

  /* نقطة البداية */
  const startAt = () => {
    let c=[23.8859,45.0792], z=5;
    try{
      if(state.geoPickMode==='edit' && state.edGeo){
        return [[state.edGeo.lat, state.edGeo.lng], 13];
      }
      const reg = $('aRegion') ? $('aRegion').value : '';
      if(reg && REGION_CENTER[reg]){
        const r = REGION_CENTER[reg];
        return [[r[0], r[1]], r[2]];
      }
      if(state.pendingGeo){
        return [[state.pendingGeo.lat, state.pendingGeo.lng], 12];
      }
      if(curPhotoRegion() && REGION_CENTER[curPhotoRegion()]){
        const r = REGION_CENTER[curPhotoRegion()];
        return [[r[0], r[1]], r[2]];
      }
    }catch(e){}
    return [c, z];
  };

  const el = document.getElementById('gpMap');
  if(!el){ return; }

  /* ═══ بناء الخريطة بعد جهوز الأبعاد فعلياً ═══ */
  const build = () => {
    try{
      const [center, zoom] = startAt();

      if(state.gpMap){
        /* موجودة — نكتفي بإعادة الحساب والتمركز */
        state.gpMap.invalidateSize(true);
        state.gpMap.setView(center, zoom);
        gpUpdateInfo();
        return;
      }

      state.gpMap = L.map('gpMap', {
        zoomControl: true,
        attributionControl: false,
        fadeAnimation: false,     /* يمنع بلاطات نصف شفافة عند البناء */
        zoomAnimation: false
      }).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        crossOrigin: true
      }).addTo(state.gpMap);

      /* دبابيس الصور المجاورة — تساعد على التعرّف */
      try{
        state.photos
          .filter(p => p.lat && p.lng && !p.abroad)
          .slice(0, 120)
          .forEach(p => {
            const ic = L.divIcon({
              className: '',
              html: '<div style="width:22px;height:22px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"><img src="'+thumbUrl(p.image_path)+'" style="width:100%;height:100%;object-fit:cover"></div>',
              iconSize: [22,22], iconAnchor: [11,11]
            });
            L.marker([p.lat, p.lng], { icon: ic, interactive: false }).addTo(state.gpMap);
          });
      }catch(e){}

      state.gpMap.on('moveend', gpUpdateInfo);
      state.gpMap.on('zoomend', gpUpdateInfo);

      /* إعادة حساب متتابعة — تضمن رسم كل البلاطات */
      const fix = () => { try{ state.gpMap.invalidateSize(true); }catch(e){} };
      requestAnimationFrame(fix);
      [50, 150, 350, 700, 1200].forEach(ms => setTimeout(fix, ms));
      gpUpdateInfo();

    }catch(e){
      console.error('[openGeoPick]', e);
      const gi = $('gpInfo');
      if(gi) gi.textContent = 'تعذر تحميل الخريطة: ' + ((e && e.message) || '');
    }
  };

  /* ═══ مراقب الأبعاد — الأدق لكشف جهوز الحاوية ═══ */
  if(typeof ResizeObserver !== 'undefined'){
    if(window.__gpRO) { try{ window.__gpRO.disconnect(); }catch(e){} }
    let built = false;
    window.__gpRO = new ResizeObserver(entries => {
      for(const en of entries){
        const r = en.contentRect;
        if(r.width > 60 && r.height > 60){
          if(!built){ built = true; build(); }
          else { try{ state.gpMap && state.gpMap.invalidateSize(true); }catch(e){} }
        }
      }
    });
    window.__gpRO.observe(el);
    /* احتياطي لو لم يُطلق المراقب */
    setTimeout(() => { if(!built){ built = true; build(); } }, 900);
  }else{
    /* متصفح قديم — استقصاء */
    let tries = 0;
    const poll = () => {
      if(el.clientHeight > 60 && el.clientWidth > 60) return build();
      if(++tries < 40) return setTimeout(poll, 60);
      build();
    };
    setTimeout(poll, 60);
  }
}

export function closeGeoPick(){
  const box=$('geoPickBox');
  if(box)box.classList.remove('show');
  state.geoPickMode=null;
  if(window.__gpRO){ try{ window.__gpRO.disconnect(); }catch(e){} window.__gpRO=null; }
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
