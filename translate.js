/* صورة من بلدي — features/translate.js
   الترجمة */

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
export async function translateFields(){
  const t=$('aTitle')?$('aTitle').value.trim():'';
  const d=$('aDesc')?$('aDesc').value.trim():'';
  if(!t&&!d){toast('اكتب العنوان أول',true);return}
  const btn=$('trBtn');btn.disabled=true;btn.textContent='⏳ نترجم...';
  try{
    // المسار الأول: مكتبة Supabase
    let data=null, err=null;
    try{
      const res=await sb.functions.invoke('translate',{body:{title:t,description:d}});
      data=res.data; err=res.error;
    }catch(e){err=e}

    // المسار الثاني: fetch مباشر إن فشل الأول
    if(!data||err){
      const sess=await sb.auth.getSession();
      const tok=sess?.data?.session?.access_token;
      const r=await fetch('https://gquzjaxpqeggknhipmzk.supabase.co/functions/v1/translate',{
        method:'POST',
        headers:Object.assign(
          {'Content-Type':'application/json','apikey':'sb_publishable_BNp6Fg3VLXa1Pf4V6QjncQ_f496PquX'},
          tok?{'Authorization':'Bearer '+tok}:{}
        ),
        body:JSON.stringify({title:t,description:d})
      });
      const raw=await r.text();
      if(!r.ok)throw new Error('HTTP '+r.status+' — '+raw.slice(0,100));
      data=JSON.parse(raw);
    }

    if(data&&data.error)throw new Error(data.error);
    state.trTitle=(data&&data.title_en)||'';
    state.trDesc=(data&&data.description_en)||'';
    if(!state.trTitle&&!state.trDesc)throw new Error('رد فاضي');

    const pv=$('trPreview');
    if(pv){
      pv.style.display='block';
      pv.innerHTML=(state.trTitle?'<b>Title</b>'+esc(state.trTitle):'')
        +(state.trDesc?'<div class="d">'+esc(state.trDesc)+'</div>':'');
    }
    btn.textContent='✅ تُرجم — اضغط لإعادة الترجمة';
    toast('انترجم ✅');
  }catch(e){
    toast('تعذرت الترجمة — جرّب مرة ثانية',true);
    btn.textContent='🌐 ترجم العنوان والوصف للإنجليزية';
  }finally{btn.disabled=false}
}

export function resetTranslation(){
  state.trTitle='';state.trDesc='';
  const pv=$('trPreview');if(pv){pv.style.display='none';pv.innerHTML=''}
  const b=$('trBtn');if(b)b.textContent='🌐 ترجم العنوان والوصف للإنجليزية';
}

/* ====== الفاحص الذكي ====== */
