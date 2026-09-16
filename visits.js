/* صورة من بلدي — features/visits.js
   الزيارات الميدانية */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText } from '../core/format.js';
import { need } from '../core/hub.js';
import { imgUrl, thumbUrl } from '../core/media.js';
import { isOwner, state } from '../core/state.js';
import { $, esc, prompt, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const pushNotify = need('pushNotify');
const render = need('render');
export async function renderVisits(p){
  const el=$('visitBox');if(!el)return;
  if(!p.lat||!p.lng){el.style.display='none';return}
  el.style.display='block';
  el.className='visit-box';
  el.innerHTML='<div class="visit-far">⏳</div>';

  const r=await sb.from('visits').select('user_id,note,created_at,profiles!user_id(display_name)').eq('photo_id',p.id).order('created_at',{ascending:false});
  const list=r.data||[];
  const mine=currentUser()?list.find(v=>v.user_id===currentUser()?.id):null;

  // احسب المسافة
  let near=false, dist=null;
  if(window.__USER_LAT){
    dist=Math.hypot((p.lat-window.__USER_LAT)*111000,(p.lng-window.__USER_LNG)*111000*Math.cos(p.lat*Math.PI/180));
    near=dist<=500;
  }

  let btn='';
  if(mine){
    btn=`<button class="visit-btn done" onclick="removeVisit(${p.id})">✓ زرته — إلغاء</button>`;
  } else if(near){
    btn=`<button class="visit-btn" onclick="addVisit(${p.id})">✅ زرت هذا المكان</button>`;
  } else if(dist!==null){
    btn=`<span class="visit-far">📍 تبعد ${dist>1000?(dist/1000).toFixed(1)+' كم':Math.round(dist)+' م'} — اقترب لتسجيل زيارتك</span>`;
  } else {
    btn=`<span class="visit-far">فعّل الموقع لتسجيل زيارتك</span>`;
  }

  el.innerHTML=`
    <div class="visit-head">
      <span class="visit-count">👣 ${list.length} ${list.length===1?'زائر':'زائرين'}</span>
      ${btn}
    </div>
    ${mine?`<div style="display:flex;gap:6px;margin-top:6px">
      <input id="vNote" placeholder="انطباعك عن المكان (اختياري)" value="${esc(mine.note||'')}" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:8px 11px;font-family:'Tajawal';font-size:12.5px;color:var(--txt);outline:none">
      <button class="btn" style="font-size:12px;padding:7px 13px" onclick="saveVisitNote(${p.id})">حفظ</button>
    </div>`:''}
    ${list.filter(v=>v.note).map(v=>`<div class="visit-note"><b>${esc(v.profiles?.display_name||'زائر')}</b>${esc(v.note)}</div>`).join('')}`;
}

export async function addVisit(pid){
  if(isAnon()){toast('سجّل أول عشان توثّق زيارتك',true);return}
  const ph=state.photos.find(x=>x.id===pid);
  if(!ph||!ph.lat||!ph.lng){toast('ما فيه موقع مسجّل لهذه الصورة',true);return}

  // قراءة الموقع لحظة الضغط
  toast('📍 نتحقق من موقعك...');
  const pos=await new Promise(res=>{
    if(!navigator.geolocation)return res(null);
    navigator.geolocation.getCurrentPosition(
      p2=>res(p2.coords),
      ()=>res(null),
      {enableHighAccuracy:true,timeout:12000,maximumAge:0}
    );
  });
  if(!pos){toast('تعذر تحديد موقعك — فعّل الموقع وحاول ثانية',true);return}

  window.__USER_LAT=pos.latitude;window.__USER_LNG=pos.longitude;
  const dist=Math.hypot((ph.lat-pos.latitude)*111000,(ph.lng-pos.longitude)*111000*Math.cos(ph.lat*Math.PI/180));
  if(dist>500){
    const txt=dist>1000?((dist/1000).toFixed(1)+' كم'):(Math.round(dist)+' متراً');
    toast('لا زلت بعيداً — '+txt+' عن الموقع',true);
    renderVisits(ph);
    return;
  }

  const {error}=await sb.from('visits').insert({photo_id:pid,user_id:currentUser()?.id});
  if(error){toast('تعذر التسجيل: '+error.message,true);return}
  toast('انسجّلت زيارتك 👣');
  // إشعار لصاحب الصورة
  try{
    if(ph.user_id&&ph.user_id!==currentUser()?.id&&typeof pushNotify==='function'){
      const me=(await sb.from('profiles').select('display_name').eq('id',currentUser()?.id).maybeSingle()).data;
      const loc=ph.abroad?(ph.country||ph.city):(ph.village||ph.city);
      pushNotify({
        title:'👣 أحد زار مكان صورتك',
        body:((me&&me.display_name)||'زائر')+' وصل إلى '+loc+' — «'+ph.title+'»',
        url:'/',
        user_ids:[ph.user_id]
      });
    }
  }catch(e){}
  await loadVisitCounts();render();
  renderVisits(state.curPhoto);
}

export async function removeVisit(pid){
  await sb.from('visits').delete().eq('photo_id',pid).eq('user_id',currentUser()?.id);
  toast('انشالت الزيارة');
  await loadVisitCounts();render();
  renderVisits(state.curPhoto);
}

export async function saveVisitNote(pid){
  const t=$('vNote').value.trim();
  const badV=checkText(t);
  if(badV){toast(badV,true);return}
  const {error}=await sb.from('visits').update({note:t}).eq('photo_id',pid).eq('user_id',currentUser()?.id);
  if(error){toast('تعذر الحفظ',true);return}
  toast('انحفظ انطباعك ✅');
  renderVisits(state.curPhoto);
}
/* ====== عدادات الزيارات للشبكة ====== */

/* → state.visitCounts */

export async function loadVisitCounts(){
  try{
    const r=await sb.from('visits').select('photo_id');
    state.visitCounts={};
    (r.data||[]).forEach(v=>{state.visitCounts[v.photo_id]=(state.visitCounts[v.photo_id]||0)+1});
  }catch(e){}
}

/* ====== بطاقة المشاركة ====== */
