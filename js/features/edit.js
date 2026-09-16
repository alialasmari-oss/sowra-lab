/* صورة من بلدي — features/edit.js
   تعديل الصورة */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, rankOf, timeAgo } from '../core/format.js';
import { need } from '../core/hub.js';
import { imgUrl, thumbUrl, vidUrl } from '../core/media.js';
import { isOwner, state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   filterCss ← features/upload.js
   gpUpdateInfo ← features/upload.js
   openAcc ← features/account.js
*/
const filterCss = need('filterCss');
const gpUpdateInfo = need('gpUpdateInfo');
const openAcc = need('openAcc');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const bumpJoinCounter = need('bumpJoinCounter');
const checkRate = need('checkRate');
const loadPhotos = need('loadPhotos');
const logRate = need('logRate');
const moveToVault = need('moveToVault');
const publishFromVault = need('publishFromVault');
const pushNotify = need('pushNotify');
const render = need('render');
const renderClaim = need('renderClaim');
const renderFollow = need('renderFollow');
const renderProfFeed = need('renderProfFeed');
const renderProfTabs = need('renderProfTabs');
const renderVault = need('renderVault');
const renderVisits = need('renderVisits');
const setView = need('setView');
const shareCard = need('shareCard');
/* ═══ عبر الحاجز ═══
   tagName ← features/upload.js
*/
const tagName = need('tagName');

/* state.profUid → state.profUid */
/* state.reelsList → state.reelsList */
/* ═══ عبر الحاجز ═══
   closeSheet ← features/sheet.js
   openSheet ← features/sheet.js
*/
const closeSheet = need('closeSheet');
const openSheet = need('openSheet');
export function openEdit(pid){
  const p=state.photos.find(x=>x.id===pid);
  if(!p)return;
  const _mine=!!(currentUser()&&p.user_id===currentUser()?.id);
  const _owner=(isOwner());
  if(!_mine&&!_owner){toast('🔒 ما تقدر تعدّل صورة غيرك',true);return}
  const isV=p.media_type==='video';
  const el=$('editBox');if(!el)return;
  $('edTitle').value=p.title||'';
  const dg=$('edDescGroup');
  if(dg)dg.style.display=isV?'none':'block';
  if($('edDesc'))$('edDesc').value=p.description||'';
  $('edLabel').innerHTML=(isV?'عدّل عنوان المقطع':'عدّل عنوان الصورة ووصفها')
    +(_mine?'':'<div style="font-size:11px;color:var(--sadu);font-weight:700;margin-top:5px">🛡️ تعديل إداري — صورة '+esc(p.photographer||'عضو')+'</div>');
  state.edTrTitle=p.title_en||'';state.edTrDesc=p.description_en||'';
  const pv=$('edTrPreview');
  if(pv){
    if(state.edTrTitle||state.edTrDesc){
      pv.style.display='block';
      pv.innerHTML=(state.edTrTitle?'<b>Title</b>'+esc(state.edTrTitle):'')
        +(state.edTrDesc?'<div class="d">'+esc(state.edTrDesc)+'</div>':'');
    }else{pv.style.display='none';pv.innerHTML=''}
  }
  const tb=$('edTrBtn');
  if(tb){
    tb.style.display=isV?'none':'block';
    tb.textContent=(state.edTrTitle||state.edTrDesc)?'🌐 أعد الترجمة':'🌐 ترجم للإنجليزية';
  }
  el.dataset.pid=pid;
  el.classList.add('show');
  try{fillEditGeo(p)}catch(e){}
}

export function closeEdit(){
  state.edGeo=null;
  const el=$('editBox');
  if(el)el.classList.remove('show');
}

export async function saveEdit(){
  const el=$('editBox');if(!el)return;
  const pid=+el.dataset.pid;
  const title=$('edTitle').value.trim();
  const desc=$('edDesc')?$('edDesc').value.trim():'';
  if(!title){toast('العنوان ما يصير فاضي',true);return}
  const bt=checkText(title);
  if(bt){toast('العنوان: '+bt,true);return}
  const bd=checkText(desc,{allowLink:true});
  if(bd){toast('الوصف: '+bd,true);return}

  const btn=$('edSave');btn.disabled=true;btn.textContent='⏳';
  const upd={title,description:desc,title_en:state.edTrTitle,description_en:state.edTrDesc};
  // الموقع إن تغيّر
  const g=state.edGeo;
  const cur=state.photos.find(x=>x.id===pid);
  if(g&&(!cur||cur.lat!==g.lat||cur.lng!==g.lng)){
    upd.lat=g.lat; upd.lng=g.lng;
  }
  let q=sb.from('photos').update(upd).eq('id',pid);
  const owner=(isOwner());
  if(!owner)q=q.eq('user_id',currentUser()?.id);
  const {error}=await q;
  btn.disabled=false;btn.textContent='💾 احفظ';
  if(error){toast('تعذر الحفظ: '+error.message,true);return}
  toast('انحفظ التعديل ✅');
  closeEdit();
  await loadPhotos();
  const fresh=state.photos.find(x=>x.id===pid);
  if(fresh&&state.curPhoto&&state.curPhoto.id===pid){state.curPhoto=fresh;openSheet(pid);}
  render();
}

/* ====== ترجمة نافذة التعديل ====== */

/* state.edTrTitle → state.edTrTitle */

export async function translateEdit(){
  const t=$('edTitle')?$('edTitle').value.trim():'';
  const d=$('edDesc')?$('edDesc').value.trim():'';
  if(!t&&!d){toast('اكتب العنوان أول',true);return}
  const btn=$('edTrBtn');btn.disabled=true;btn.textContent='⏳ نترجم...';
  try{
    let data=null,err=null;
    try{
      const res=await sb.functions.invoke('translate',{body:{title:t,description:d}});
      data=res.data;err=res.error;
    }catch(e){err=e}
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
      if(!r.ok)throw new Error('HTTP '+r.status);
      data=JSON.parse(raw);
    }
    if(data&&data.error)throw new Error(data.error);
    state.edTrTitle=(data&&data.title_en)||'';
    state.edTrDesc=(data&&data.description_en)||'';
    const pv=$('edTrPreview');
    if(pv&&(state.edTrTitle||state.edTrDesc)){
      pv.style.display='block';
      pv.innerHTML=(state.edTrTitle?'<b>Title</b>'+esc(state.edTrTitle):'')
        +(state.edTrDesc?'<div class="d">'+esc(state.edTrDesc)+'</div>':'');
    }
    btn.textContent='✅ تُرجم — اضغط للإعادة';
    toast('انترجم ✅');
  }catch(e){
    toast('تعذرت الترجمة — جرّب مرة ثانية',true);
    btn.textContent='🌐 ترجم للإنجليزية';
  }finally{btn.disabled=false}
}

/* ====== الصورة الشخصية والغلاف ====== */

export async function deleteMyPhoto(pid,path){
  const ph=state.photos.find(x=>x.id===pid);
  const _isV=ph&&ph.media_type==='video';
  try{
    const r=await sb.from('weekly_entries').select('id').eq('photo_id',pid).maybeSingle();
    if(r&&r.data){toast(_isV?'⚠️ المقطع مرشح بمسابقة — لا يمكن حذفه':'⚠️ الصورة مرشحة بمسابقة — لا يمكن حذفها الآن',true);return}
  }catch(e){}
  if(!confirm(_isV?'حذف المقطع نهائياً؟ لا يمكن التراجع.':'حذف الصورة نهائياً؟ لا يمكن التراجع.'))return;
  const isVid=ph&&ph.media_type==='video';
  try{
    if(isVid) await sb.storage.from('videos').remove([path]);
    else await sb.storage.from('photos').remove([path,path.replace('.jpg','_t.jpg')]);
  }catch(e){}
  const {error}=await sb.from('photos').delete().eq('id',pid).eq('user_id',currentUser()?.id);
  if(error){toast('تعذر الحذف: '+error.message,true);return}
  toast(isVid?'انحذف المقطع ✅':'انحذفت الصورة ✅');
  closeSheet();
  await loadPhotos();
  if(typeof renderVault==='function')renderVault();
  if(typeof renderProfTabs==='function'&&state.profUid){renderProfTabs();renderProfFeed();}
  if(typeof state.reelsList!=='undefined')state.reelsList=state.photos.filter(x=>x.media_type==='video');
  render();
}
/* ====== بروفايل المصور ====== */

export function fillEditGeo(p){
  const card=$('edGeoCard'), main=$('edGeoMain'), sub=$('edGeoSub');
  if(!card)return;
  state.edGeo=(p.lat&&p.lng)?{lat:p.lat,lng:p.lng}:null;

  const place=p.abroad?(p.country||p.city):((p.village?p.village+' · ':'')+(p.city||''));
  if(state.edGeo){
    card.classList.remove('warn');
    if(main)main.textContent=place||'موقع محدّد';
    if(sub)sub.textContent=p.lat.toFixed(5)+', '+p.lng.toFixed(5);
  }else{
    card.classList.add('warn');
    if(main)main.textContent='⚠️ بلا إحداثيات';
    if(sub)sub.textContent='اضغط لتحديد المكان على الخريطة';
  }
}

export function openEditGeo(){
  const box=$('geoPickBox');if(!box)return;
  state.geoPickMode='edit';
  box.classList.add('show');

  setTimeout(function(){
    try{
      if(!state.gpMap){
        let c=[23.8859,45.0792], z=5;
        if(state.edGeo){c=[state.edGeo.lat,state.edGeo.lng];z=13}
        else if(state.curPhoto&&state.curPhoto.region){
          const RC={'الرياض':[24.7136,46.6753,9],'مكة المكرمة':[21.3891,39.8579,9],
            'المدينة المنورة':[24.5247,39.5692,9],'القصيم':[26.3260,43.9750,9],
            'الشرقية':[26.4207,50.0888,8],'عسير':[18.2465,42.5117,9],
            'تبوك':[28.3835,36.5662,8],'حائل':[27.5219,41.6907,9],
            'الحدود الشمالية':[30.9843,41.0231,8],'جازان':[16.8892,42.5511,9],
            'نجران':[17.4924,44.1277,9],'الباحة':[20.0129,41.4677,10],'الجوف':[29.7859,40.2000,8]};
          if(RC[state.curPhoto.region]){c=[RC[state.curPhoto.region][0],RC[state.curPhoto.region][1]];z=RC[state.curPhoto.region][2]}
        }
        state.gpMap=L.map('gpMap',{zoomControl:true,attributionControl:false}).setView(c,z);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(state.gpMap);
        try{
          state.photos.filter(p=>p.lat&&p.lng&&!p.abroad).slice(0,120).forEach(p=>{
            const ic=L.divIcon({className:'',html:'<div style="width:22px;height:22px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"><img src="'+thumbUrl(p.image_path)+'" style="width:100%;height:100%;object-fit:cover"></div>',iconSize:[22,22],iconAnchor:[11,11]});
            L.marker([p.lat,p.lng],{icon:ic,interactive:false}).addTo(state.gpMap);
          });
        }catch(e){}
        state.gpMap.on('moveend',gpUpdateInfo);
      }else if(state.edGeo){
        state.gpMap.setView([state.edGeo.lat,state.edGeo.lng],13);
      }
      state.gpMap.invalidateSize();
      gpUpdateInfo();
    }catch(e){}
  },220);
}

/* ====== دعوة التسجيل بعد تفاعل حقيقي ====== */
state.opened=0;
