/* صورة من بلدي — features/upload.js
   النشر */

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
/* ═══ عبر الحاجز ═══
   readExifTech ← features/exif.js
   renderTechCard ← features/exif.js
   resetTranslation ← features/translate.js
*/
const readExifTech = need('readExifTech');
const renderTechCard = need('renderTechCard');
const resetTranslation = need('resetTranslation');
export function setVis(v){
  state.pendingVis=v;
  const pb=$('visPublic'), pv=$('visPrivate');
  if(pb)pb.classList.toggle('on',v==='public');
  if(pv)pv.classList.toggle('on',v==='private');
  const b=$('pubBtn');
  if(b){
    const isV=!!state.pendingVideo;
    b.textContent = v==='private'
      ? (isV?'🔒 احفظ بخزنتي':'🔒 احفظ بخزنتي')
      : (isV?'انشر المقطع 🎬':'انشر الصورة 🚀');
  }
}

window.setVis=setVis;

export function setDest(abroad){
  state.isAbroad=abroad;
  $('destHome').classList.toggle('on-dest',!abroad);
  $('destAbroad').classList.toggle('on-dest',abroad);
  $('abroadForm').style.display=abroad?'block':'none';
  $('grpRegion').style.display=abroad?'none':'block';
  $('grpCity').style.display=abroad?'none':'block';
  $('grpVillage').style.display=abroad?'none':'block';

  // تنظيف الحقول المخفية — لئلا تتسرب قيم خاطئة
  try{
    if(abroad){
      if($('aRegion'))$('aRegion').value='';
      if($('aCity'))$('aCity').value='';
      if($('aVillage'))$('aVillage').value='';
      // الموقع المحلي لا يصلح لصورة خارج المملكة
      if(state.pendingGeo&&!window.__geoManual){
        state.pendingGeo=null;
        const card=$('geoCard');
        if(card){
          card.classList.add('warn');
          $('geoStatus').textContent='🌍 صورة من خارج المملكة';
          $('geoCoords').textContent='';
          const mb=$('geoManualBox');
          if(mb)mb.style.display='block';
        }
      }
    }else{
      if($('aCountry'))$('aCountry').value='';
    }
    // استنتاج جديد للموقع الحالي إن وُجد
    if(state.pendingGeo&&typeof fillPlaceFromGeo==='function'){
      fillPlaceFromGeo(state.pendingGeo.lat,state.pendingGeo.lng,true);
    }
  }catch(e){}
}

export function applyGeo(pos,source){
  const card=$('geoCard');card.style.display='block';
  pos=validPos(pos);
  const mb=$('geoManualBox');
  if(!pos){
    card.classList.add('warn');
    $('geoStatus').textContent=source==='live'
      ?'⚠️ ما قدرنا نوصل لموقعك'
      :'⚠️ الصورة ما تحمل موقعاً';
    $('geoCoords').textContent='';
    if(mb)mb.style.display='block';
    window.__geoManual=false;
    return;
  }
  if(mb)mb.style.display='none';
  window.__geoManual=false;
  // نستنتج المنطقة والمدينة
  if(typeof fillPlaceFromGeo==='function')fillPlaceFromGeo(pos.lat,pos.lng);
  card.classList.remove('warn');
  state.pendingGeo={lat:pos.lat,lng:pos.lng};
  if(state.isAbroad){
    $('geoStatus').textContent='📡 تم التقاط إحداثيات موقعك'+(pos.acc?` · دقة ±${pos.acc}م`:'');
    $('geoCoords').textContent=`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    return;
  }
  const n=nearestCity(pos.lat,pos.lng);
  $('aRegion').value=n.region;fillAddCities();$('aCity').value=n.city;
  $('geoStatus').textContent=`📡 تم تحديد الموقع تلقائياً: قرب ${n.city} (≈${n.km} كم)`+(pos.acc?` · دقة ±${pos.acc}م`:'');
  $('geoCoords').textContent=`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
}

export async function pickImg(inp,isLive){
  const f=inp.files[0];if(!f)return;
  state.pendingGeo=null;state.pendingFile=f;state.pendingBlob=null;state.pendingVideo=null;
  // إخفاء أي فيديو معلّق
  const _pv=$('videoPreview');
  if(_pv){try{_pv.pause()}catch(e){} _pv.removeAttribute('src'); _pv.load&&_pv.load(); _pv.style.display='none';}
  // معاينة فورية خفيفة (بدون قراءة الملف كاملاً)
  $('drop').style.display='block';
  $('preview').src=URL.createObjectURL(f);$('preview').style.display='block';
  $('dropTxt').textContent='✓ تم اختيار الصورة';
  $('drop').classList.add('has');
  showClearBtn();syncPublishBtn();
  state.curFilter='none';
  try{ renderFilterRow(URL.createObjectURL(f),false); }catch(e){}
  // ضغط بالخلفية من الحين — عشان النشر يكون لحظي
  compress(f).then(b=>{state.pendingBlob=b});
  $('geoCard').style.display='block';$('geoCard').classList.remove('warn');
  $('geoStatus').textContent='⏳ جاري تحديد الموقع...';$('geoCoords').textContent='';
  if(isLive){
    let pos=validPos(await liveLocation());
    if(!pos)pos=validPos(await readExifGPS(f));
    if(!pos)pos=validPos(await readExifGPS2(f));
    applyGeo(pos,'live');
  }else{
    let pos=validPos(await readExifGPS(f));
    if(!pos)pos=validPos(await readExifGPS2(f));
    applyGeo(pos,'exif');
  }
  // بيانات الكاميرا
  state.earlyRes=null;state.geoPlace=null;
  state.exifTech=await readExifTech(f);
  renderTechCard();
  inp.value='';
  // اقتراح ذكي مبكر — لا يمنع النشر
  earlySuggest();
}

/* ====== بطاقة بيانات الكاميرا ====== */

export async function pickVideo(inp){
  if(!videoAllowed()){toast('رفع المقاطع مغلق حالياً 🎬',true);inp.value='';return}
  const f=inp.files[0];if(!f)return;
  const MAXMB=25, MAXSEC=30;
  if(f.size>MAXMB*1024*1024){toast('الفيديو كبير — الحد '+MAXMB+' ميجا',true);inp.value='';return}
  // فحص المدة
  const dur=await new Promise(res=>{
    const v=document.createElement('video');
    v.preload='metadata';
    v.onloadedmetadata=()=>{URL.revokeObjectURL(v.src);res(v.duration||0)};
    v.onerror=()=>res(0);
    v.src=URL.createObjectURL(f);
  });
  if(dur>MAXSEC+1){
    toast('الفيديو طويل ('+Math.round(dur)+' ثانية) — الحد '+MAXSEC+' ثانية',true);
    inp.value='';return;
  }
  state.pendingFile=null;state.pendingBlob=null;state.pendingGeo=null;state.pendingVideo=f;
  $('drop').style.display='block';
  const _im=$('preview');
  if(_im){_im.removeAttribute('src');_im.style.display='none';}
  const pv=$('videoPreview');
  if(pv){pv.src=URL.createObjectURL(f);pv.style.display='block';}
  $('dropTxt').textContent='🎬 تم اختيار الفيديو ('+Math.round(f.size/1048576)+' ميجا)';
  $('drop').classList.add('has');
  showClearBtn();syncPublishBtn();
  state.curFilter='none';
  const _fu=pv?pv.src:URL.createObjectURL(f);
  try{ renderFilterRow(null,true,_fu); }catch(e){}
  captureVideoFrame(f).then(t=>{if(t)renderFilterRow(t,true)}).catch(()=>{});
  $('geoCard').style.display='block';$('geoCard').classList.remove('warn');
  $('geoStatus').textContent='⏳ جاري تحديد الموقع...';$('geoCoords').textContent='';
  const pos=await liveLocation();
  applyGeo(pos,'live');
  inp.value='';
}

/* ضغط الصورة قبل الرفع (أقصى عرض 1600px) */

export async function addPhoto(){
  if(isAnon()){toast('سجّل أول عشان تنشر 📸');openAcc();return}
  const title=$('aTitle').value.trim();
  let region=$('aRegion').value,city=$('aCity').value,country='';
  if(state.isAbroad){
    country=$('aCountry').value.trim();
    if(country.length<2){toast('اكتب الدولة والمدينة 🌍',true);return}
    region='عدسة مسافر';city=country;
  }
  if(!state.pendingFile&&!state.pendingVideo)return toast('اختر صورة أو فيديو أول ⚠️',true);
  // فحص النصوص وحد المعدّل
  if(typeof checkText==='function'){
    const bt=checkText($('aTitle').value);
    if(bt){toast('العنوان: '+bt,true);return}
    const bd=$('aDesc')?checkText($('aDesc').value,{allowLink:true}):null;
    if(bd){toast('الوصف: '+bd,true);return}
    const bv=checkText($('aVillage')?$('aVillage').value:'');
    if(bv){toast('اسم القرية: '+bv,true);return}
  }
  if(typeof checkRate==='function'){
    const lim=await checkRate('photo');
    if(lim){toast(lim,true);return}
  }
  if(!title)return toast('اكتب عنوان للصورة ⚠️',true);
  if(title.length<2)return toast('العنوان قصير — حرفان على الأقل ✏️',true);
  if(title.length>100)return toast('العنوان طويل — 100 حرف كحد أقصى ✏️',true);
  if(!state.isAbroad&&(!region||!city))return toast('حدد المنطقة والمدينة ⚠️',true);
  const btn=$('pubBtn');btn.disabled=true;btn.textContent='⏳ جاري الرفع...';
  try{
    // ═══ مسار الفيديو ═══
    if(state.pendingVideo){
      const vpath=`${currentUser()?.id}/${Date.now()}.mp4`;
      const upv=await sb.storage.from('videos').upload(vpath,state.pendingVideo,{contentType:state.pendingVideo.type||'video/mp4',cacheControl:'31536000'});
      if(upv.error)throw upv.error;
      const insv=await sb.from('photos').insert({
        user_id:currentUser()?.id,title,region,city,category:$('aCat').value||'other',
        abroad:state.isAbroad,country,
        village:state.isAbroad?'':$('aVillage').value.trim(),
        lat:state.pendingGeo?.lat??null,lng:state.pendingGeo?.lng??null,
        image_path:vpath,media_type:'video',filter_key:state.curFilter,music_key:(state.pendingMusicName||''),visibility:state.pendingVis,description:'',commercial:!!($('aComm')&&$('aComm').checked),tags:(state.pickedTags||[]),exif:((document.getElementById('techShow')&&document.getElementById('techShow').checked&&state.exifTech)?state.exifTech:{})
      });
      if(insv.error){
        await sb.storage.from('videos').remove([vpath]).catch(()=>{});
        throw insv.error;
      }
      if(state.pendingVis==='public'){
        try{
          const nm2=(await sb.from('profiles').select('display_name').eq('id',currentUser()?.id).maybeSingle()).data?.display_name||'مصوّر';
          pushNotify({
            title:'🎬 مقطع جديد في الأضواء',
            body:title+' — عدسة '+nm2,
            url:'/',
            exclude:currentUser()?.id
          });
        }catch(e){}
      }
      state.pendingVideo=null;resetFilter();state.pendingVis='public';setVis('public');const _c1=$('clearDraft');if(_c1)_c1.style.display='none';
      const pv=$('videoPreview');if(pv){pv.src='';pv.style.display='none';}
      $('drop').style.display='none';$('geoCard').style.display='none';
      $('aTitle').value='';$('aVillage').value='';if($('aDesc')){$('aDesc').value='';descCount();}if($('aComm'))$('aComm').checked=false;resetTranslation();state.pickedTags=[];renderTagRow();if(typeof hideSuggestions==='function')hideSuggestions();state.earlyRes=null;state.exifTech=null;renderTechCard();
      if(typeof logRate==='function')logRate('photo');
      toast('انرفع الفيديو 🎬');
      try{state.sort='new';state.draftSort='new';}catch(e){}
      if(typeof maybeAskNotifs==='function')maybeAskNotifs();
    setTimeout(function(){if(typeof checkRaceProgress==='function')checkRaceProgress()},3000);
    await loadPhotos();go('feed');
      btn.disabled=false;btn.textContent=(state.pendingVideo?'انشر المقطع 🎬':'انشر الصورة 🚀');
      return;
    }
    const blob=state.pendingBlob||await compress(state.pendingFile);
    // الفاحص الذكي
    const _insp=!!(state.banner.inspect_enabled)||!!state.inspectOn;
    if(_insp&&typeof runInspection==='function'){
      const ok=await runInspection(blob);
      if(!ok){btn.disabled=false;btn.textContent=(state.pendingVis==='private'?'🔒 احفظ بخزنتي':'انشر الصورة 🚀');return}
    }
    const thumb=await compressTo(state.pendingFile,380,0.72);
    const path=`${currentUser()?.id}/${Date.now()}.jpg`;
    const [up,upT]=await Promise.all([
      sb.storage.from('photos').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'}),
      sb.storage.from('photos').upload(thumbPath(path),thumb,{contentType:'image/jpeg',cacheControl:'31536000'})
    ]);
    if(up.error)throw up.error;
    const ins=await sb.from('photos').insert({
      user_id:currentUser()?.id,title,region,city,category:$('aCat').value||'other',
      abroad:state.isAbroad,country,
      village:state.isAbroad?'':$('aVillage').value.trim(),
      lat:state.pendingGeo?.lat??null,lng:state.pendingGeo?.lng??null,
      image_path:path,visibility:state.pendingVis,description:($('aDesc')?$('aDesc').value.trim():''),commercial:!!($('aComm')&&$('aComm').checked),title_en:state.trTitle,description_en:state.trDesc,tags:(state.pickedTags||[]),exif:((document.getElementById('techShow')&&document.getElementById('techShow').checked&&state.exifTech)?state.exifTech:{})
    }).select('id').maybeSingle();
    if(ins.error){
      // فشل التسجيل — ننظف ملفات الصورة من المخزن حتى لا تبقى يتيمة
      await sb.storage.from('photos').remove([path,thumbPath(path)]).catch(()=>{});
      throw ins.error;
    }
    // السبق على الموقع إن سُجّل
    try{
      const cp=$('clPlace'), cr=$('clReason');
      if(cp&&cr&&cp.value.trim()&&cr.value.trim()&&ins.data&&ins.data.id
          &&!(typeof checkText==='function'&&(checkText(cp.value)||checkText(cr.value)))){
        const cl=await sb.from('claims').insert({
          photo_id:ins.data.id,user_id:currentUser()?.id,
          place_name:cp.value.trim(),reason:cr.value.trim(),
          lat:state.pendingGeo?.lat??null,lng:state.pendingGeo?.lng??null
        });
        if(!cl.error){cp.value='';cr.value='';setTimeout(()=>toast('انسجّل سبقك 🏅'),1800);}
      }
    }catch(e){}
    // إشعار للجميع عند نشر صورة عامة
    if(state.pendingVis==='public'){
      try{
        const nm=(await sb.from('profiles').select('display_name').eq('id',currentUser()?.id).maybeSingle()).data?.display_name||'مصوّر';
        pushNotify({
          title:'📸 صورة جديدة من '+(city||region),
          body:title+' — عدسة '+nm,
          url:'/',
          exclude:currentUser()?.id
        });
      }catch(e){}
    }
    state.pendingFile=null;state.pendingGeo=null;state.pendingBlob=null;resetFilter();state.pendingVis='public';setVis('public');const _c2=$('clearDraft');if(_c2)_c2.style.display='none';
    $('preview').style.display='none';$('drop').style.display='none';$('geoCard').style.display='none';
    $('aTitle').value='';$('aVillage').value='';if($('aDesc')){$('aDesc').value='';descCount();}if($('aComm'))$('aComm').checked=false;resetTranslation();state.pickedTags=[];renderTagRow();if(typeof hideSuggestions==='function')hideSuggestions();state.earlyRes=null;state.exifTech=null;renderTechCard();
    if(typeof logRate==='function')logRate('photo');
    toast(state.pendingVis==='private'?'انحفظت بخزنتك 🔒':'نُشرت صورتك 🎉');
    const wasAbroad=state.isAbroad;
    $('aCountry').value='';
    try{state.sort=wasAbroad?'abroad':'new';state.draftSort=state.sort;}catch(e){}
    if(typeof maybeAskNotifs==='function')maybeAskNotifs();
    setTimeout(function(){if(typeof checkRaceProgress==='function')checkRaceProgress()},3000);
    await loadPhotos();go('feed');
  }catch(e){
    if(e.message&&e.message.includes('row-level')){
      // نسأل القاعدة عن السبب الحقيقي
      const [ban,lim]=await Promise.all([sb.rpc('am_i_banned'),sb.rpc('my_uploads_today')]);
      if(ban.data===true)toast('حسابك محظور من النشر — راسل الإدارة من صفحة حسابي ⛔',true);
      else if((lim.data??0)>=10)toast('وصلت حد النشر اليومي (10 صور) — كمّل بكرة 🌙',true);
      else toast('تعذر النشر — تأكد أنك مسجل دخول',true);
    }else if(e.message&&e.message.includes('check constraint')){
      toast('تأكد من البيانات: العنوان 2–100 حرف ✏️',true);
    }else toast('تعذر النشر: '+(e.message||''),true);
  }finally{
    btn.disabled=false;btn.textContent='انشر الصورة 🚀';
  }
}

/* ====== كاميرا التسجيل الداخلية ====== */

export function clearDraft(){
  try{
    const _is=$('inspectStatus');if(_is)_is.style.display='none';
    setTimeout(syncPublishBtn,0);
    state.pendingFile=null;state.pendingBlob=null;state.pendingVideo=null;state.pendingGeo=null;
    const im=$('preview');
    if(im){im.removeAttribute('src');im.style.display='none';}
    const vd=$('videoPreview');
    if(vd){try{vd.pause()}catch(e){} vd.removeAttribute('src'); vd.load&&vd.load(); vd.style.display='none';}
    resetFilter();
    $('drop').style.display='none';
    $('drop').classList.remove('has');
    $('geoCard').style.display='none';
    const cd=$('clearDraft');if(cd)cd.style.display='none';
    toast('انلغت المسودة');
  }catch(e){}
}

export function showClearBtn(){
  const cd=$('clearDraft');
  if(cd)cd.style.display='block';
}

/* ====== موسيقى التسجيل — دمج حقيقي بالملف ====== */

export function syncPublishBtn(){
  const isV=!!state.pendingVideo;
  const b=$('pubBtn');
  if(b)b.textContent=(state.pendingVis==='private')?'🔒 احفظ بخزنتي':(isV?'انشر المقطع 🎬':'انشر الصورة 🚀');
  const t=$('addTitle');
  if(t)t.textContent=isV?'شارك مقطعاً من ديرتك':'شارك صورة من ديرتك';
  const lt=$('lblTitle');
  if(lt)lt.textContent=isV?'عنوان المقطع':'عنوان الصورة';
  const lc=$('lblCat');
  if(lc)lc.textContent=isV?'تصنيف المقطع':'تصنيف الصورة';
  const dg=$('descGroup');
  if(dg)dg.style.display=isV?'none':'block';
  const tg=$('trGroup');
  if(tg)tg.style.display=isV?'none':'block';
  const ti=$('aTitle');
  if(ti)ti.placeholder=isV?'مثال: ضباب الصباح على السودة':'مثال: غروب على جبال السودة';
  const cf=$('claimForm');
  if(cf)cf.style.display=isV?'none':'block';
}

/* ====== نص الصناديق القابلة للطي ====== */

export function syncRulesLabel(){
  const d=$('rulesBox'), l=$('rulesLabel');
  if(!d||!l)return;
  l.textContent=d.open?'📋 إرشادات النشر — اضغط للطي':'📋 إرشادات النشر — اضغط للعرض';
}

export function syncClaimLabel(){
  const d=$('claimForm'), l=$('claimLabel');
  if(!d||!l)return;
  l.textContent=d.open?'🏅 سجّل سبقك في هذا الموقع — اضغط للطي':'🏅 سجّل سبقك في هذا الموقع — اضغط للعرض';
}

export function descCount(){
  const t=$('aDesc'), l=$('descLen');
  if(t&&l)l.textContent=t.value.length+' / 600';
}

/* ====== الترجمة التلقائية ====== */

/* state.trTitle → state.trTitle */

export const PHOTO_TAGS=[
  {k:'pure',   n:'💎 طبيعة نقية'},
  {k:'night',  n:'🌙 ليلي'},
  {k:'season', n:'🍂 موسمي'},
  {k:'hard',   n:'⛰️ صعب الوصول'},
  {k:'rare',   n:'✨ مشهد نادر'},
  {k:'sunrise',n:'🌅 شروق/غروب'}
];
state.pickedTags=[];

export function renderTagRow(){
  const el=$('tagRow');if(!el)return;
  el.innerHTML='';
  PHOTO_TAGS.forEach(t=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='tag-chip'+(state.pickedTags.includes(t.k)?' on':'');
    b.textContent=t.n;
    b.onclick=()=>{
      const i=state.pickedTags.indexOf(t.k);
      if(i>-1)state.pickedTags.splice(i,1);
      else if(state.pickedTags.length<3)state.pickedTags.push(t.k);
      else{toast('حد أقصى ٣ سمات',true);return}
      renderTagRow();
    };
    el.appendChild(b);
  });
}

export function tagName(k){
  const t=PHOTO_TAGS.find(x=>x.k===k);
  return t?t.n:k;
}

/* ====== قراءة بيانات الكاميرا من EXIF ====== */

export async function fillPlaceFromGeo(lat,lng,silent,force){
  try{
    let info=await reverseGeo(lat,lng);

    /* ═══ احتياطي محلي ═══
       خدمة الأسماء (nominatim) تفشل أحياناً: محجوبة، أو تجاوزنا حدّها،
       أو الشبكة بطيئة — وقتها كان الحقن يتوقف بصمت.
       جدول COORDS عندنا محلي ولا يحتاج إنترنت، فنستعمله. */
    if(!info || (!info.region && !info.city)){
      try{
        const nc = nearestCity(lat,lng);
        if(nc && nc.city){
          info = {
            region : (info&&info.region ) || (nc.km<=200 ? nc.region : ''),
            city   : (info&&info.city   ) || (nc.km<=60  ? nc.city   : ''),
            village: (info&&info.village) || '',
            country: (info&&info.country) || 'السعودية'
          };
        }
      }catch(e){}
    }

    if(!info)return null;
    state.geoPlace=info;

    const outside=!!(info.country&&!/السعود|Saudi/i.test(info.country));

    // ═══ وضع عدسة مسافر ═══
    if(typeof state.isAbroad!=='undefined'&&state.isAbroad){
      const ct=$('aCountry');
      if(ct&&!ct.value.trim()){
        const parts=[info.city||info.village,info.country].filter(Boolean);
        ct.value=parts.join('، ');
      }
      if(!silent&&typeof toast==='function'&&info.country)toast('🌍 '+info.country);
      return info;
    }

    // ═══ الموقع خارج المملكة ووضع «ديرتي» مفعّل ═══
    if(outside){
      if(!silent&&typeof toast==='function'){
        toast('🌍 الصورة من '+info.country+' — بدّل لـ«عدسة مسافر»',true);
      }
      return info;
    }

    /* force: المستخدم حدّد المكان بنفسه على الخريطة — اختياره يغلب أي قيمة سابقة */
    const rs=$('aRegion');
    const ro=findOpt(rs,info.region);
    if(ro&&rs&&(force||!rs.value)){
      rs.value=ro.value;
      if(typeof fillAddCities==='function')fillAddCities();
      await new Promise(r=>setTimeout(r,180));
    }

    const cs=$('aCity');
    const co=findOpt(cs,info.city)||findOpt(cs,info.village);
    if(co&&cs&&(force||!cs.value))cs.value=co.value;

    // القرية حقل نصي غالباً
    const vs=$('aVillage');
    if(vs&&info.village&&(force||!vs.value.trim())&&vs.tagName==='INPUT'){
      vs.value=info.village;
    }

    if(!silent&&typeof toast==='function'){
      const parts=[info.village,info.city,info.region].filter(Boolean).slice(0,2);
      if(parts.length)toast('📍 '+parts.join(' · '));
    }
    return info;
  }catch(e){return null}
}
