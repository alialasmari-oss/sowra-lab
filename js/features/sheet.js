/* صورة من بلدي — features/sheet.js
   نافذة الصورة */

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
const sharePhoto = need('sharePhoto');
/* ═══ عبر الحاجز ═══
   tagName ← features/upload.js
*/
const tagName = need('tagName');

/* state.profUid → state.profUid */
/* state.reelsList → state.reelsList */
/* ═══ عبر الحاجز ═══
   deleteMyPhoto ← features/edit.js
   drawStars ← features/rating.js
   openEdit ← features/edit.js
   renderComments ← features/rating.js
   renderPoll ← features/rating.js
*/
const deleteMyPhoto = need('deleteMyPhoto');
const drawStars = need('drawStars');
const openEdit = need('openEdit');
const renderComments = need('renderComments');
const renderPoll = need('renderPoll');
state.myRating=0;
state.myBadgeSet=new Set();

window.CLAIM_MAP=window.CLAIM_MAP||{};

export async function openSheet(id){
  state.curId=id;state.curPhoto=state.photos.find(x=>x.id===id);
  /* صورة غير موجودة: كانت الدالة تمضي على undefined فترمي عند أول
     حقل. ويقع هذا واقعاً لا نظرياً — رابط p/<id>.html مفهرس بقوقل
     أو مُرسَل بواتساب لصورة حُذفت بعدها. نخرج بهدوء برسالة. */
  if(!state.curPhoto){
    console.warn('[ورقة] لا توجد صورة بالمعرّف', id);
    if(typeof toast==='function')toast('الصورة غير موجودة — قد تكون حُذفت',true);
    return;
  }
  try{bumpJoinCounter()}catch(e){}
   const p=state.curPhoto;
  const isVid=p.media_type==='video';
  const vfx=(p.filter_key&&p.filter_key!=='none'&&typeof filterCss==='function')?filterCss(p.filter_key):'none';
  $('sPh').innerHTML=isVid
    ? `<video controls playsinline webkit-playsinline preload="metadata" style="width:100%;height:100%;object-fit:contain;background:#000;filter:${vfx}"><source src="${vidUrl(p.image_path)}" type="video/mp4"></video>`
    : `<img src="${imgUrl(p.image_path)}" onclick="zoomOpen(this.src)" alt="${esc(p.title)}">
    <button class="zoombtn" id="zoomBtn" onclick="togglePhotoZoom()">⤢ عرض كامل</button>`;
  if(!seenViews.has(p.id)){seenViews.add(p.id);try{sb.rpc('bump_view',{pid:p.id}).then(()=>{},()=>{})}catch(_){}}
  $('sPh').classList.remove('full');
  $('sTitle').textContent=p.title;
  const _who=`<span class="s-who" onclick="closeSheet();openProfile('${p.user_id}')">${rankOf(p).ic} ${esc(p.photographer)}</span>`;
  $('sLoc').innerHTML=(p.abroad?`🌍 عدسة مسافر · ${esc(p.country||p.city)} — عدسة ${_who}`:`📍 ${esc(p.region)} · ${esc(p.city)}${p.village?' · '+esc(p.village):''} — عدسة ${_who}`)
    +`<br><a class="mapbtn" href="${p.lat?`https://maps.google.com/?q=${p.lat},${p.lng}`:`https://maps.google.com/?q=${encodeURIComponent(p.abroad?(p.country||p.city):((p.village?p.village+' ':'')+p.city+' '+p.region))}`}" target="_blank" rel="noopener">🗺️ افتح الموقع على قوقل ماب${p.lat?'':' (بحث بالاسم)'}</a>`;
 
  renderFollow(p);
  renderVisits(p);
  renderClaim(p);
  // الترجمة الإنجليزية
  const en=$('sEn');
  if(en){
    if(p.title_en||p.description_en){
      en.style.display='block';
      en.innerHTML=(p.title_en?'<b>'+esc(p.title_en)+'</b>':'')
        +(p.description_en?esc(p.description_en):'');
    }else en.style.display='none';
  }
  const _ec=$('sEC');
  if(_ec)_ec.style.display=p.editors_choice?'block':'none';
  try{renderPhotoTags(p)}catch(e){}
  try{renderPhotoTech(p)}catch(e){}
  try{renderTimeline(p)}catch(e){}
  // شارة الاستخدام التجاري
  const cb=$('sComm');
  if(cb)cb.style.display=p.commercial?'inline-flex':'none';
  // الوصف
  const dsc=$('sDesc');
  if(dsc){
    if(p.description&&p.description.trim()){
      dsc.style.display='block';
      dsc.textContent=p.description;
    }else dsc.style.display='none';
  }
  // تاريخ النشر
  const dt=$('sDate');
  if(dt){
    const t=timeAgo(p.created_at);
    if(t&&t.txt){
      dt.style.display='block';
      dt.innerHTML='📅 <span title="'+esc(t.full)+'">'+t.txt+'</span>';
      dt.onclick=function(){toast(t.full)};
    }else dt.style.display='none';
  }
  // الفيديو: نص تقييم مختلف وإخفاء الأوسمة
  const rl=$('rateLabel');
  if(rl)rl.textContent=isVid?'وش تقييمك للمقطع؟':'وش تقييمك للصورة؟';
  const pb=$('pollBox');
  if(pb)pb.style.display=isVid?'none':'block';
  if(isVid&&p.music_key){
    const lc=$('sLoc');
    if(lc)lc.innerHTML+='<br><span style="font-size:12px;color:var(--txt-dim)">🎵 '+esc(p.music_key)+'</span>';
  }
  const shb=$('shareBtn');
  if(shb)shb.onclick=function(){shareCard(p)};       /* بطاقة صورة بلا رابط — الافتراضي */
  const cdb=$('cardBtn');
  if(cdb)cdb.onclick=function(){sharePhoto(p)};      /* نسخ الرابط لمن طلبه */
  const dbw=$('deleteBtn');
  if(dbw){
    const isMine=!!(currentUser() && p.user_id===currentUser()?.id);
    const canEdit=isMine||(isOwner());
    dbw.style.display=(isMine||canEdit)?'block':'none';
    if(isMine){
      const dbi=$('deleteBtnInner');
      if(dbi){
        dbi.textContent=(p.media_type==='video')?'🗑️ حذف المقطع':'🗑️ حذف صورتي';
        dbi.onclick=function(){deleteMyPhoto(p.id,p.image_path)};
      }
      // زر السحب للخزنة
      let vb=document.getElementById('vaultBtn');
      if(!vb){
        vb=document.createElement('button');
        vb.id='vaultBtn';
        vb.style.cssText="background:none;border:none;color:var(--txt-dim);font-family:'Tajawal';font-size:12px;font-weight:700;cursor:pointer;text-decoration:underline;display:block;margin:6px auto 0";
        dbw.appendChild(vb);
      }
      const isPriv=p.visibility==='private';
      const isVd=p.media_type==='video';
      vb.textContent=isPriv
        ? (isVd?'📢 انشر المقطع للجميع':'📢 انشرها للجميع')
        : (isVd?'🔒 اسحب المقطع لخزنتي':'🔒 اسحبها لخزنتي');
      vb.onclick=function(){isPriv?publishFromVault(p.id):moveToVault(p.id)};
    }

    // زر التعديل — لصاحبها وللمالك
    let eb=document.getElementById('editBtn');
    if(canEdit){
      if(!eb){
        eb=document.createElement('button');
        eb.id='editBtn';
        eb.style.cssText="background:none;border:none;color:var(--qblue);font-family:'Tajawal';font-size:12px;font-weight:700;cursor:pointer;text-decoration:underline;display:block;margin:6px auto 0";
        dbw.appendChild(eb);
      }
      eb.style.display='block';
      const vd=(p.media_type==='video');
      eb.textContent=isMine
        ? (vd?'✏️ عدّل العنوان':'✏️ عدّل العنوان والوصف')
        : (vd?'🛡️ عدّل المقطع (مالك)':'🛡️ عدّل الصورة (مالك)');
      eb.onclick=function(){openEdit(p.id)};
    }else if(eb){
      eb.style.display='none';
    }
  }
  $('overlay').classList.add('show');
  document.body.style.overflow='hidden';
  // تقييمي وأوسمتي وتعليقات — من القاعدة
  state.myRating=0;state.myBadgeSet=new Set();
  drawStars();renderPoll();
  $('cList').innerHTML='<div class="loader" style="padding:10px">⏳</div>';
  const [rt,bd,cm]=await Promise.all([
    sb.from('ratings').select('stars').eq('photo_id',id).eq('user_id',currentUser()?.id).maybeSingle(),
    sb.from('badge_votes').select('badge_key').eq('photo_id',id).eq('user_id',currentUser()?.id),
    sb.from('comments').select('body,created_at,profiles!user_id(display_name)').eq('photo_id',id).order('created_at')
  ]);
  state.myRating=rt.data?rt.data.stars:0;
  (bd.data||[]).forEach(x=>state.myBadgeSet.add(x.badge_key));
  state.curPhoto._comments=(cm.data||[]);
  $('thanks').style.display=state.myRating?'block':'none';
  drawStars();renderPoll();renderComments();
}

export function closeSheet(){$('overlay').classList.remove('show');document.body.style.overflow=''}

export function togglePhotoZoom(){
  const full=$('sPh').classList.toggle('full');
  $('zoomBtn').textContent=full?'⤡ تصغير':'⤢ عرض كامل';
}

export function renderPhotoTags(p){
  const el=$('sTags');if(!el)return;
  const tags=p.tags||[];
  if(!tags.length||typeof tagName!=='function'){el.style.display='none';return}
  el.style.display='flex';
  el.innerHTML=tags.map(k=>'<span class="s-tag">'+esc(tagName(k))+'</span>').join('');
}

/* ====== فلتر السبق ====== */
state.onlyClaims=false;

export function renderPhotoTech(p){
  const el=$('sTech');if(!el)return;
  const t=p.exif||{};
  const has=t.camera||t.lens||t.focal||t.aperture||t.iso||t.shutter;
  if(!has||p.media_type==='video'){el.style.display='none';return}
  el.style.display='block';
  const set=[t.focal,t.aperture,t.shutter,t.iso].filter(Boolean);
  el.innerHTML=
    (t.camera?'<div class="st-cam">📷 '+esc(t.camera)+'</div>':'')+
    (t.lens?'<div class="st-cam" style="font-weight:400;font-size:11.5px;color:var(--txt-dim)">🔭 '+esc(t.lens)+'</div>':'')+
    (set.length?'<div class="st-set">'+set.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'');
}

/* ====== هذا المكان عبر الزمن ====== */

export function renderTimeline(p){
  const el=$('sTimeline');if(!el)return;
  if(!p.lat||!p.lng||p.media_type==='video'){el.style.display='none';return}

  const d=x=>Math.hypot((x.lat-p.lat)*111000,(x.lng-p.lng)*111000*Math.cos(p.lat*Math.PI/180));
  const same=state.photos.filter(x=>
    x.lat&&x.lng&&x.media_type!=='video'&&
    x.visibility!=='private'&&
    d(x)<=200
  ).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

  if(same.length<2){el.style.display='none';return}

  const first=new Date(same[0].created_at);
  const last=new Date(same[same.length-1].created_at);
  const span=Math.round((last-first)/86400000);
  let spanTxt='';
  if(span>=365)spanTxt=Math.floor(span/365)+' سنة';
  else if(span>=30)spanTxt=Math.floor(span/30)+' شهر';
  else if(span>0)spanTxt=span+' يوم';

  el.style.display='block';
  el.innerHTML=`
    <div class="tl-head">
      <span>📅 هذا المكان عبر الزمن</span>
      <b>${same.length} صورة${spanTxt?' · '+spanTxt:''}</b>
    </div>
    <div class="tl-strip">
      ${same.map(x=>{
        const dt=new Date(x.created_at);
        const mon=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][dt.getMonth()];
        const cur=x.id===p.id;
        return `<div class="tl-item${cur?' cur':''}" onclick="${cur?'':'openSheet('+x.id+')'}">
          <img src="${thumbUrl(x.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(x.image_path)}'" loading="lazy" alt="">
          <div class="tl-date">${mon} ${dt.getFullYear()}</div>
          ${cur?'<div class="tl-now">الحالية</div>':''}
        </div>`;
      }).join('')}
    </div>`;
}

/* ====== الرسائل بين الأعضاء ====== */
state.dmTo=null;

export const seenViews=new Set();
/* ====== المفضلة ====== */

export let lbW=100;

export function zoomOpen(src){
  lbW=100;
  const im=$('lbImg');im.src=src;im.style.width='100%';
  $('lightbox').classList.add('show');
  document.body.style.overflow='hidden';
}

export function zoomClose(){
  $('lightbox').classList.remove('show');
  document.body.style.overflow='';
}

export function lbScaleBy(f){
  lbW=Math.min(600,Math.max(100,lbW*f));
  $('lbImg').style.width=lbW+'%';
}

export function lbDbl(){lbW=lbW>100?100:250;$('lbImg').style.width=lbW+'%';}

/* ====== الخريطة التفاعلية ====== */
