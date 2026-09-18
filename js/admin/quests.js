/* صورة من بلدي — admin/quests.js
   كنوز الديرة */

import { sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { state } from '../core/state.js';
import { $, dbErr, esc, prompt, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   needEditor ← admin/team.js
*/
const needEditor = need('needEditor');

export let ADMQ=[];
state.admQs={};

export async function loadAdmQuests(){
  const el=$('admQs');if(!el)return;
  el.innerHTML='<div class="loader">⏳</div>';
  const q=await sb.from('quests').select('*').order('created_at',{ascending:false});
  ADMQ=q.data||[];
  const s=await sb.from('quest_stops').select('*');
  state.admQs={};
  (s.data||[]).forEach(x=>{(state.admQs[x.quest_id]=state.admQs[x.quest_id]||[]).push(x)});
  const c=await sb.from('quest_completions').select('quest_id');
  const done={};
  (c.data||[]).forEach(x=>{done[x.quest_id]=(done[x.quest_id]||0)+1});

  el.innerHTML=`
  <div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:14px">
    <div style="font-weight:700;font-size:14px;margin-bottom:10px">🗝️ رحلة جديدة</div>
    <input id="qTitle" placeholder="اسم الرحلة (مثال: صيف عسير)" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
    <input id="qSub" placeholder="وصف قصير" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
    <input id="qBadge" placeholder="اسم الشارة (مكتشف عسير)" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px;box-sizing:border-box">
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:6px">أيقونة الشارة</div>
    <div class="q-icons" id="qIcons"></div>
    <input type="hidden" id="qIcon" value="🏆">
    <input id="qRegion" placeholder="المنطقة" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input id="qSponsor" placeholder="الراعي (اختياري)" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none">
      <input id="qPrize" placeholder="الجائزة" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none">
    </div>
    <input id="qEnds" type="date" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
    <button class="btn" style="width:100%" onclick="qCreate()">➕ إنشاء الرحلة</button>
  </div>
  ${ADMQ.length?ADMQ.map(q=>{
    const stops=state.admQs[q.id]||[];
    return `<div style="background:var(--card);border:1.5px solid ${q.active?'var(--palm)':'var(--line)'};border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-weight:700;font-size:15px">${q.badge_icon||'🏆'} ${esc(q.title)}</div>
        <span style="font-size:11px;font-weight:700;color:${q.active?'var(--palm)':'var(--txt-dim)'}">${q.active?'● نشطة':'○ مسودة'}</span>
      </div>
      <div style="font-size:12px;color:var(--txt-dim);margin-bottom:8px">${stops.length} كنز · ${done[q.id]||0} أكملوها${q.region?' · '+esc(q.region):''}</div>
      <div style="margin:8px 0">${stops.map(s=>{
        const ph=state.photos.find(p=>p.id===s.photo_id);
        return `<div style="display:flex;align-items:center;gap:8px;background:var(--card2);border-radius:10px;padding:7px 10px;margin-bottom:5px;font-size:12px">
          <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ph?esc(ph.title):'#'+s.photo_id}</span>
          <button onclick="qDelStop(${s.id})" style="background:none;border:none;cursor:pointer;font-size:13px">🗑️</button>
        </div>`;
      }).join('')||'<div style="font-size:12px;color:var(--txt-dim)">أضف كنوزاً من تبويب 🗂️ الصور</div>'}</div>
      <div style="display:flex;gap:8px">
        <button class="btn" style="flex:1;font-size:12px;padding:8px;${q.active?'background:var(--sadu)':'background:var(--palm)'}" onclick="qToggle(${q.id},${q.active})">${q.active?'🙈 إيقاف':'▶️ تفعيل'}</button>
        <button class="btn" style="flex:1;font-size:12px;padding:8px;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="qDelete(${q.id})">🗑️ حذف</button>
      </div>
    </div>`;
  }).join(''):'<div class="empty" style="padding:20px">ما فيه رحلات بعد</div>'}`;
  renderQIcons();
}

export const QICONS=['🏆','🏔️','🕌','🌅','🐪','🌴','🏜️','🌊','⛰️','🗝️','🎖️','🌙','⭐','🦅','🏛️','🌾'];

export function renderQIcons(){
  const el=$('qIcons');if(!el)return;
  const cur=$('qIcon')?$('qIcon').value:'🏆';
  el.innerHTML='';
  QICONS.forEach(ic=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='q-icon'+(ic===cur?' on':'');
    b.textContent=ic;
    b.onclick=()=>{if($('qIcon'))$('qIcon').value=ic;renderQIcons()};
    el.appendChild(b);
  });
}

export async function qCreate(){
  if(!needEditor('الكنوز'))return;
  const title=$('qTitle').value.trim();
  if(!title){toast('اكتب اسم الرحلة',true);return}
  const {error}=await sb.from('quests').insert({
    title,subtitle:$('qSub').value.trim(),badge_icon:$('qIcon').value.trim()||'🏆',
    badge_name:$('qBadge').value.trim(),region:$('qRegion').value.trim(),
    sponsor:$('qSponsor').value.trim(),prize:$('qPrize').value.trim(),
    ends_at:$('qEnds').value||null
  });
  if(error){toast('فشل: '+error.message,true);return}
  toast('انشئت الرحلة 🗝️');loadAdmQuests();
}

export async function qToggle(id,cur){
  const {error}=await sb.from('quests').update({active:!cur}).eq('id',id);
  if(error){dbErr('تفعيل الرحلة',error);return}
  toast(!cur?'الرحلة نشطة 🗝️':'اتوقفت الرحلة');loadAdmQuests();
}

export async function qDelete(id){
  if(!confirm('حذف الرحلة وكنوزها؟'))return;
  await sb.from('quests').delete().eq('id',id);
  toast('انحذفت');loadAdmQuests();
}

export async function qDelStop(sid){
  await sb.from('quest_stops').delete().eq('id',sid);
  loadAdmQuests();
}

export async function admAddToQuest(pid){
  if(!ADMQ.length){await loadAdmQuests();}
  if(!ADMQ.length){toast('أنشئ رحلة أولاً من تبويب 🗝️',true);return}
  const list=ADMQ.map((q,i)=>`${i+1} = ${q.title} (${(state.admQs[q.id]||[]).length} كنز)`).join('\n');
  const pick=prompt('أضف الصورة لأي رحلة؟\n\n'+list);
  if(pick===null)return;
  const idx=parseInt(pick.trim())-1;
  if(isNaN(idx)||!ADMQ[idx]){toast('رقم غير صحيح',true);return}
  const {error}=await sb.from('quest_stops').insert({quest_id:ADMQ[idx].id,photo_id:pid});
  if(error){toast(error.code==='23505'?'موجودة بالرحلة':'فشلت الإضافة',true);return}
  toast('انضافت لـ'+ADMQ[idx].title+' 🗝️');
  loadAdmQuests();
}

/* ====== تفعيل رفع الفيديو ====== */

/* ====== وضع «قريباً» للأضواء ====== */


/* ====== تنظيف الملفات اليتيمة ====== */
