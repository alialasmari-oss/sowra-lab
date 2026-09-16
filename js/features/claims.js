/* صورة من بلدي — features/claims.js
   سبق الموقع */

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
export async function loadClaims(){
  try{
    const r=await sb.from('claims').select('id,photo_id,place_name').eq('active',true);
    state.claimMap={};
    const list=r.data||[];
    if(!list.length)return;
    // جلب الأصوات لحساب حالة التحقق
    const ids=list.map(c=>c.id);
    let votes=[];
    try{
      const v=await sb.from('claim_votes').select('claim_id,stance').in('claim_id',ids);
      votes=v.data||[];
    }catch(e){}
    list.forEach(c=>{
      const mine=votes.filter(v=>v.claim_id===c.id);
      const sup=mine.filter(v=>v.stance==='support').length;
      const dbt=mine.filter(v=>v.stance==='doubt').length;
      let state='new';
      if(sup>=3&&sup>dbt*2)state='verified';
      else if(dbt>sup&&dbt>=2)state='doubted';
      state.claimMap[c.photo_id]={name:c.place_name,sup,dbt,state};
    });
  }catch(e){}
}

/* شارة السبق حسب حالتها */

export function claimBadge(pid,small){
  const c=(typeof state.claimMap!=='undefined'&&state.claimMap)?state.claimMap[pid]:null;
  if(!c)return '';
  const cfg={
    verified:{cls:'ok', ic:'🏅', t:'أول موثّق'},
    doubted: {cls:'dbt',ic:'❓', t:'سبق موضع شك'},
    new:     {cls:'new',ic:'🏅', t:'سبق'}
  }[c.state];
  return '<div class="mc-claim '+cfg.cls+(small?' sm':'')+'">'+cfg.ic+' '+cfg.t
    +(c.sup?'<b>'+c.sup+'</b>':'')+'</div>';
}

export async function renderClaim(p){
  const el=$('claimBox');if(!el)return;
  el.innerHTML='';
  try{
    const r=await sb.from('claims').select('*').eq('photo_id',p.id).eq('active',true).maybeSingle();
    const c=r.data;
    if(!c)return;

    const v=await sb.from('claim_votes').select('user_id,stance,note,profiles!user_id(display_name)').eq('claim_id',c.id);
    const votes=v.data||[];
    const sup=votes.filter(x=>x.stance==='support').length;
    const dbt=votes.filter(x=>x.stance==='doubt').length;
    const tot=sup+dbt||1;
    const mine=currentUser()?votes.find(x=>x.user_id===currentUser()?.id):null;
    const isOwner=!!(currentUser()&&c.user_id===currentUser()?.id);

    const days=Math.ceil((new Date(c.expires_at)-new Date())/86400000);
    const notes=votes.filter(x=>x.note&&x.note.trim());

    let state='new';
    if(sup>=3&&sup>dbt*2)state='verified';
    else if(dbt>sup&&dbt>=2)state='doubted';
    const stCfg={
      verified:{cls:'ok',  ic:'🏅', t:'أول موثّق — تحقّق منه الجمهور'},
      doubted: {cls:'dbt', ic:'❓', t:'سبق موضع شك'},
      new:     {cls:'new', ic:'🏅', t:'ادّعاء سبق — بانتظار الجمهور'}
    }[state];

    el.innerHTML=`<div class="claim-box ${stCfg.cls}">
      <div class="claim-state">${stCfg.ic} ${stCfg.t}</div>
      <div class="claim-head">
        <span class="claim-place">📍 ${esc(c.place_name)}</span>
      </div>
      <div class="claim-reason">${esc(c.reason)}</div>
      ${(c.lat&&c.lng)?`<a class="mapbtn" href="https://maps.google.com/?q=${c.lat},${c.lng}" target="_blank" rel="noopener" style="margin-bottom:10px">🗺️ إحداثيات السبق</a>`:''}
      <div class="claim-bar">
        <div class="sup" style="width:${sup/tot*100}%"></div>
        <div class="dbt" style="width:${dbt/tot*100}%"></div>
      </div>
      <div class="claim-nums">
        <span class="s">✅ ${sup} مؤيّد</span>
        <span class="d">${dbt} مشكّك ❓</span>
      </div>
      ${isOwner?`<div style="font-size:12px;color:var(--txt-dim);text-align:center;padding:6px">هذا سبقك — الجمهور يحكم
        <button onclick="claimDelete(${c.id})" style="background:none;border:none;color:var(--sadu);font-family:'Tajawal';font-size:12px;font-weight:700;cursor:pointer;text-decoration:underline;margin-right:8px">سحب السبق</button></div>`
      :`<div class="claim-acts">
        <button class="claim-btn sup ${mine&&mine.stance==='support'?'on':''}" onclick="claimVote(${c.id},'support',${p.id})">✅ أؤيد</button>
        <button class="claim-btn dbt ${mine&&mine.stance==='doubt'?'on':''}" onclick="claimVote(${c.id},'doubt',${p.id})">❓ أشكك</button>
      </div>`}
      ${notes.length?`<div class="claim-notes">${notes.map(n=>`
        <div class="claim-note ${n.stance==='support'?'s':'d'}">
          <b>${n.stance==='support'?'✅':'❓'} ${esc(n.profiles?.display_name||'زائر')}</b>${esc(n.note)}
        </div>`).join('')}</div>`:''}
      <div class="claim-left">${days>0?'باقي '+days+' يوم على انتهاء السبق':'انتهت مدة السبق'}</div>
    </div>`;
  }catch(e){}
}

export async function claimVote(cid,stance,pid){
  if(isAnon()){toast('سجّل أول عشان تشارك بالحكم',true);return}
  const note=prompt(stance==='support'?'تؤيد السبق — تبي تضيف سبباً؟ (اختياري)':'تشكك بالسبق — وش سببك؟ (اختياري)');
  if(note===null)return;
  const badN=checkText(note);
  if(badN){toast(badN,true);return}
  const {error}=await sb.from('claim_votes').upsert({
    claim_id:cid,user_id:currentUser()?.id,stance,note:(note||'').trim()
  });
  if(error){toast('تعذر التصويت: '+error.message,true);return}
  toast(stance==='support'?'سُجّل تأييدك ✅':'سُجّل تشكيكك ❓');
  const p=state.photos.find(x=>x.id===pid);
  if(p)renderClaim(p);
}

export async function claimDelete(cid){
  if(!confirm('سحب السبق؟ سيختفي مع كل الأصوات.'))return;
  const {error}=await sb.from('claims').delete().eq('id',cid);
  if(error){toast('تعذر السحب',true);return}
  toast('انسحب السبق');
  await loadClaims();
  if(state.curPhoto)renderClaim(state.curPhoto);
  render();
}

/* ====== سباق الديار ====== */

/* state.race → state.race */
