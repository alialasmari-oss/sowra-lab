/* صورة من بلدي — features/account-media.js
   الصورة الشخصية والغلاف */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, rankOf } from '../core/format.js';
import { need } from '../core/hub.js';
import { avatarUrl, imgUrl, thumbUrl, vidUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   openAcc ← features/account.js
   renderAccIn ← features/account.js
*/
const openAcc = need('openAcc');
const renderAccIn = need('renderAccIn');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');
const maybeAskNotifs = need('maybeAskNotifs');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const checkRaceProgress = need('checkRaceProgress');
const closeSheet = need('closeSheet');
const loadPhotos = need('loadPhotos');
const openSheet = need('openSheet');
const pushNotify = need('pushNotify');
const refreshOne = need('refreshOne');
const render = need('render');
const showJoinBox = need('showJoinBox');
export async function uploadAvatar(inp){
  const f=inp.files[0];if(!f)return;
  if(isAnon()){toast('📷 سجّل مجاناً وحمّل صورتك الشخصية',true);showJoinBox();return}
  if(f.size>4*1024*1024){toast('الصورة كبيرة — الحد 4 ميجا',true);inp.value='';return}
  toast('⏳ نرفع صورتك...');
  try{
    // تصغير لمربع 400
    const blob=await new Promise((res,rej)=>{
      const img=new Image();
      img.onload=()=>{
        const S=400;
        const cv=document.createElement('canvas');cv.width=S;cv.height=S;
        const ctx=cv.getContext('2d');

        // قص مربع من الوسط العلوي
        const rt=Math.max(S/img.width,S/img.height);
        const dw=img.width*rt, dh=img.height*rt;
        ctx.drawImage(img,(S-dw)/2,(S-dh)*0.3,dw,dh);

        URL.revokeObjectURL(img.src);
        cv.toBlob(b=>b?res(b):rej(new Error('فشل')),'image/jpeg',0.88);
      };
      img.onerror=rej;
      img.src=URL.createObjectURL(f);
    });

    const path=currentUser()?.id+'/avatar.jpg';
    const up=await sb.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',upsert:true,cacheControl:'60'});
    if(up.error)throw up.error;
    const {error}=await sb.from('profiles').update({avatar_path:path}).eq('id',currentUser()?.id);
    if(error)throw error;
    toast('انحفظت صورتك ✅');
    if(typeof renderAccAvatar==='function')renderAccAvatar();
    if(state.profUid)state.profUid='';
  }catch(e){toast('تعذر الرفع: '+(e.message||''),true)}
  finally{inp.value=''}
}


/* ====== صورة الحساب بصفحة حسابي ====== */
export async function renderAccAvatar(){
  const el=$('accAvatar');if(!el)return;
  if(isAnon()){el.innerHTML='';return}
  try{
    const r=await sb.from('profiles').select('avatar_path').eq('id',currentUser()?.id).maybeSingle();
    const path=r.data&&r.data.avatar_path;
    const mine=state.photos.filter(x=>x.user_id===currentUser()?.id);
    const rk=mine.length?rankOf(mine[0]):{ic:'🌱'};
    el.innerHTML=path
      ? `<img class="pf-avatar" src="${avatarUrl(path)}?t=${Date.now()}" alt="">`
      : `<div class="pf-avatar-ph">${rk.ic}</div>`;
  }catch(e){}
}

/* ====== إحصائياتي — بأسلوب 500px ====== */
window.__stPeriod=7; /* ثابت */
state.statsSort='stars';
export async function saveProfileAll(){
  if(isAnon()){toast('💾 سجّل مجاناً واحفظ بياناتك',true);showJoinBox();return}
  const name=($('accEditName')?$('accEditName').value:'').trim();
  const region=($('accRegion')?$('accRegion').value:'').trim();
  const bio=($('accBio')?$('accBio').value:'').trim();
  if(!name){toast('الاسم ما يصير فاضي',true);return}
  const bn=checkText(name);
  if(bn){toast('الاسم: '+bn,true);return}
  const br=checkText(region);
  if(br){toast('المنطقة: '+br,true);return}
  const bb=checkText(bio);
  if(bb){toast('النبذة: '+bb,true);return}

  const {error}=await sb.from('profiles').update({display_name:name,region,bio}).eq('id',currentUser()?.id);
  if(error){toast('تعذر الحفظ: '+error.message,true);return}
  toast('انحفظت بياناتك ✅');
  await loadPhotos();
  if(typeof renderAccIn==='function')renderAccIn();
  render();
}

/* ====== قوائم المتابعة ====== */
export function coverUrl(path){
  return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
export async function uploadCover(inp){
  const f=inp.files[0];if(!f)return;
  // تلميح المقاس
  if(!sessionStorage.getItem('cover_hint')){
    try{sessionStorage.setItem('cover_hint','1')}catch(e){}
  }
  if(isAnon()){toast('🖼️ سجّل مجاناً وخصّص غلافك',true);showJoinBox();return}
  if(f.size>6*1024*1024){toast('الصورة كبيرة — الحد 6 ميجا',true);inp.value='';return}
  toast('⏳ نرفع الغلاف...');
  try{
    // قص لنسبة 3:1 بعرض 1200
    const blob=await new Promise((res,rej)=>{
      const img=new Image();
      img.onload=()=>{
        const W=1200,H=400;
        const cv=document.createElement('canvas');cv.width=W;cv.height=H;
        const ctx=cv.getContext('2d');

        // قص يملأ الإطار — الوسط العلوي (أهم جزء بالمناظر)
        const rt=Math.max(W/img.width,H/img.height);
        const dw=img.width*rt, dh=img.height*rt;
        const oy=(H-dh)*0.35;
        ctx.drawImage(img,(W-dw)/2,oy,dw,dh);

        URL.revokeObjectURL(img.src);
        cv.toBlob(b=>b?res(b):rej(new Error('فشل')),'image/jpeg',0.86);
      };
      img.onerror=rej;
      img.src=URL.createObjectURL(f);
    });

    const path=currentUser()?.id+'/cover.jpg';
    const up=await sb.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',upsert:true,cacheControl:'60'});
    if(up.error)throw up.error;
    const {error}=await sb.from('profiles').update({cover_path:path}).eq('id',currentUser()?.id);
    if(error)throw error;
    toast('انحفظ الغلاف 🖼️');
    if(typeof renderAccCover==='function')renderAccCover();
    if(state.profUid)state.profUid='';
  }catch(e){toast('تعذر الرفع: '+(e.message||''),true)}
  finally{inp.value=''}
}
export async function renderAccCover(){
  const el=$('accCover'), hero=$('accHero');
  if(!el||!hero)return;
  if(isAnon())return;
  try{
    const r=await sb.from('profiles').select('cover_path').eq('id',currentUser()?.id).maybeSingle();
    const path=r.data&&r.data.cover_path;
    if(path){
      el.style.backgroundImage='url("'+coverUrl(path)+'?t='+Date.now()+'")';
      hero.classList.add('has-bg');
    }else{
      el.style.backgroundImage='';
      hero.classList.remove('has-bg');
    }
  }catch(e){}
}

/* ====== فلترة السمات ====== */
state.tags=[];
