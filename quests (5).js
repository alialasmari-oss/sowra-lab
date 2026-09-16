/* صورة من بلدي — features/quests.js
   كنوز الديرة */

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
export let QUESTS=[];
state.qStops={};
state.qDone=new Set();

export async function loadQuests(){
  try{
    const q=await sb.from('quests').select('*').eq('active',true).order('created_at',{ascending:false});
    QUESTS=q.data||[];
    if(!QUESTS.length)return;
    const s=await sb.from('quest_stops').select('*');
    state.qStops={};
    (s.data||[]).forEach(x=>{(state.qStops[x.quest_id]=state.qStops[x.quest_id]||[]).push(x.photo_id)});
    if(currentUser()&&!isAnon()){
      const c=await sb.from('quest_completions').select('quest_id').eq('user_id',currentUser()?.id);
      state.qDone=new Set((c.data||[]).map(x=>x.quest_id));
    }
  }catch(e){}
}

export async function openQuests(){
  go('quests');
  $('questList').innerHTML='<div class="loader">⏳</div>';
  await loadQuests();
  if(!QUESTS.length){
    $('questList').innerHTML='<div class="empty"><span class="big">🗺️</span>ما فيه رحلات نشطة حالياً<br>ترقّب رحلة الموسم القادم</div>';
    return;
  }
  // زياراتي
  let myVisits=new Set();
  if(currentUser()&&!isAnon()){
    const v=await sb.from('visits').select('photo_id').eq('user_id',currentUser()?.id);
    myVisits=new Set((v.data||[]).map(x=>x.photo_id));
  }

  $('questList').innerHTML=QUESTS.map(q=>{
    const stops=state.qStops[q.id]||[];
    const done=stops.filter(id=>myVisits.has(id)).length;
    const pct=stops.length?Math.round(done/stops.length*100):0;
    const finished=done>=stops.length&&stops.length>0;
    let left='';
    if(q.ends_at){
      const d=Math.ceil((new Date(q.ends_at)-new Date())/86400000);
      left=d>0?`باقي ${d} ${d===1?'يوم':'أيام'}`:'انتهت';
    }
    return `<div class="quest-card ${finished?'done':''}">
      <div class="q-head">
        <span class="q-badge">${q.badge_icon||'🏆'}</span>
        <div class="q-info">
          <div class="q-title">${esc(q.title)}</div>
          <div class="q-sub">${esc(q.subtitle||'')}${q.region?' · '+esc(q.region):''}</div>
        </div>
      </div>
      ${q.sponsor?`<div class="q-sponsor">برعاية <b>${esc(q.sponsor)}</b>${q.prize?` · 🎁 ${esc(q.prize)}`:''}</div>`:''}
      <div class="q-bar"><div class="q-fill" style="width:${pct}%"></div></div>
      <div class="q-meta">
        <span>${done} من ${stops.length} كنز</span>
        ${left?`<span>${left}</span>`:''}
      </div>
      ${finished?`<div class="q-win">🎉 أكملت الرحلة — شارة «${esc(q.badge_name||q.title)}» لك!</div>`:''}
      <div class="q-stops">${stops.map(id=>{
        const p=state.photos.find(x=>x.id===id);
        if(!p)return '';
        const got=myVisits.has(id);
        return `<div class="q-stop ${got?'got':''}" onclick="openSheet(${id})">
          <img src="${thumbUrl(p.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'" loading="lazy" alt="${esc(p.title)}">
          ${got?'<div class="q-check">✓</div>':''}
          <div class="q-stop-name">${esc(p.village||p.city)}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
  }).join('');

  // سجّل الإكمال تلقائياً
  QUESTS.forEach(async q=>{
    const stops=state.qStops[q.id]||[];
    if(!stops.length||state.qDone.has(q.id))return;
    const done=stops.filter(id=>myVisits.has(id)).length;
    if(done>=stops.length&&currentUser()&&!isAnon()){
      await sb.from('quest_completions').insert({quest_id:q.id,user_id:currentUser()?.id});
      state.qDone.add(q.id);
      toast('🎉 أكملت رحلة «'+q.title+'» — مبروك الشارة!');
    }
  });
}

/* شارات المستخدم بالبروفايل */
