/* صورة من بلدي — features/contest.js
   المسابقة والراعي والتحدي */

import { currentUser, sb } from '../core/db.js';
import { rankOf } from '../core/format.js';
import { need } from '../core/hub.js';
import { imgUrl, thumbUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';
const shootThere = need('shootThere');

/* ═══ عبر الحاجز ═══
   applyPendingPlace ← features/map.js
   initCommBox ← features/notify.js
   initGoogleBtn ← features/account.js
   initInspect ← features/notify.js
   initVideoUpload ← features/reels.js
   renderNewsBanner ← features/feed.js
   renderSponsorSide ← features/feed.js
*/
const applyPendingPlace = need('applyPendingPlace');
const initCommBox = need('initCommBox');
const initGoogleBtn = need('initGoogleBtn');
const initInspect = need('initInspect');
const initVideoUpload = need('initVideoUpload');
const renderNewsBanner = need('renderNewsBanner');
const renderSponsorSide = need('renderSponsorSide');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');

export let WEEK=null;
state.weekMode='live';
state.weekEntries=[];
state.weekVotes={};
state.myWeekVote=null;

export async function loadWeek(){
  WEEK=null;state.weekMode='live';
  try{
    const c=await sb.from('weekly_contest').select('*').eq('active',true).order('id',{ascending:false}).limit(1).maybeSingle();
    if(c.data){WEEK=c.data;}
    else{
      const e=await sb.from('weekly_contest').select('*').not('ended_at','is',null).order('ended_at',{ascending:false}).limit(1).maybeSingle();
      if(e.data && (Date.now()-new Date(e.data.ended_at).getTime()) < 7*24*3600*1000){
        WEEK=e.data;state.weekMode='results';
      }
    }
  }catch(err){WEEK=null}
  const strip=$('weekStrip');if(!strip)return;
  if(!WEEK){strip.style.display='none';return}
  strip.style.display='block';
  if(state.weekMode==='results'){
    const win=state.photos.find(x=>x.id===WEEK.winner_photo_id);
    strip.classList.add('win');
    strip.innerHTML=win
      ?`👑 <b>فائز لقطة الأسبوع:</b> ${rankOf(win).ic} ${esc(win.photographer)} — «${esc(win.title)}» · شاهد النتيجة`
      :`🏁 <b>لقطة الأسبوع انتهت</b> — شاهد النتيجة`;
  }else{
    strip.classList.remove('win');
    strip.innerHTML=`🏆 <b>لقطة الأسبوع</b> — شاهد اللقطات الخمس وصوّت ${WEEK.sponsor_name?'· برعاية '+esc(WEEK.sponsor_name):''}`;
  }
}

export async function openWeek(){
  if(!WEEK){toast('ما فيه مسابقة حالياً');return}
  go('week');
  $('weekBody').innerHTML='<div class="empty">⏳</div>';
  const [en,bd,mv]=await Promise.all([
    sb.from('weekly_entries').select('photo_id').eq('contest_id',WEEK.id),
    sb.from('weekly_board').select('*').eq('contest_id',WEEK.id),
    (state.weekMode==='live'&&currentUser())?sb.from('weekly_votes').select('photo_id').eq('contest_id',WEEK.id).eq('user_id',currentUser()?.id).maybeSingle():Promise.resolve({data:null})
  ]);
  state.weekVotes={};(bd.data||[]).forEach(r=>state.weekVotes[r.photo_id]=r.votes);
  state.myWeekVote=mv.data?.photo_id??null;
  const ids=(en.data||[]).map(e=>e.photo_id);
  state.weekEntries=state.photos.filter(p=>ids.includes(p.id));
  renderWeek();
}

export function renderWeek(){
  const results=state.weekMode==='results';
  $('weekTitle').textContent=(results?'🏁 نتيجة لقطة الأسبوع':'🏆 لقطة الأسبوع')+(WEEK.week_label?' — '+WEEK.week_label:'');
  $('weekSponsor').innerHTML=[WEEK.sponsor_name?`برعاية <b style="color:var(--sadu)">${esc(WEEK.sponsor_name)}</b>`:'',WEEK.prize?`🎁 الجائزة: ${esc(WEEK.prize)}`:''].filter(Boolean).join(' · ')||(results?'':'صوّت لأجمل لقطة — صوت واحد وتقدر تغيّره');
  const sorted=state.weekEntries.slice().sort((a,b)=>(state.weekVotes[b.id]||0)-(state.weekVotes[a.id]||0));
  const winId=results?(WEEK.winner_photo_id??(sorted[0]?.id)):(sorted[0]&&(state.weekVotes[sorted[0].id]||0)>0?sorted[0].id:null);
  $('weekBody').innerHTML=state.weekEntries.length?sorted.map((p,i)=>{
    const v=state.weekVotes[p.id]||0, isWin=p.id===winId;
    return `<div class="card wcard ${isWin&&results?'winner':''} ${state.myWeekVote===p.id&&!results?'voted':''}">
      <div class="ph" style="height:170px"><img src="${thumbUrl(p.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'" alt="${esc(p.title)}">
        ${isWin?'<div class="medal">👑 '+(results?'الفائز':'متصدرة')+'</div>':(results?`<div class="medal">#${i+1}</div>`:'')}
      </div>
      <div class="card-body">
        <div class="card-title">${esc(p.title)}</div>
        <div class="card-meta"><span class="who">${rankOf(p).ic} ${esc(p.photographer)}</span><span>🗳️ ${v} صوت</span></div>
        ${results?'':`<button class="btn wvote ${state.myWeekVote===p.id?'on':''}" onclick="voteWeek(${p.id})">${state.myWeekVote===p.id?'✓ صوتك هنا':'صوّت لهذه اللقطة'}</button>`}
      </div>
    </div>`;
  }).join(''):'<div class="empty">🎬 اللقطات الخمس تُعلن قريباً — ترقبوا</div>';
}

export async function voteWeek(pid){
  const {error}=await sb.from('weekly_votes').upsert({contest_id:WEEK.id,user_id:currentUser()?.id,photo_id:pid});
  if(error){toast('تعذر التصويت',true);return}
  state.myWeekVote=pid;
  const bd=await sb.from('weekly_board').select('*').eq('contest_id',WEEK.id);
  state.weekVotes={};(bd.data||[]).forEach(r=>state.weekVotes[r.photo_id]=r.votes);
  toast('تم تصويتك 🗳️');
  renderWeek();
}

/* ====== بنر الراعي ====== */

export async function loadSponsor(){
  try{
    const r=await sb.from('site_banner').select('*').eq('id',1).maybeSingle();
    const b=r.data||null;
    state.banner=b;
    // زر جوجل يظهر فور جهوز البيانات
    try{if(typeof initGoogleBtn==='function')initGoogleBtn()}catch(e){}
    try{if(typeof renderNewsBanner==='function')renderNewsBanner()}catch(e){}
    state.banner=b||{};
    // البطاقة الجانبية
    if(typeof renderSponsorSide==='function')renderSponsorSide();
    // زر الرعاة
    renderSponsorsBtn();
    if(typeof initGoogleBtn==='function')initGoogleBtn();
    if(typeof initVideoUpload==='function')initVideoUpload();
    if(typeof initCommBox==='function')initCommBox();
    if(typeof initInspect==='function')initInspect();
  }catch(e){}
}

/* ====== صفحة الرعاة ====== */

export function openSponsorsPage(){
  go('sponsors');
  const SP=state.banner;
  // البنر الكبير برأس الصفحة
  const el=$('spBannerPage');
  if(el&&SP&&SP.active&&SP.image_path){
    el.innerHTML=(SP.link_url?`<a href="${esc(SP.link_url)}" target="_blank" rel="noopener">`:'')
      +`<img src="${imgUrl(SP.image_path)}" style="width:100%;aspect-ratio:4/1;object-fit:cover;border-radius:14px;border:1.5px solid var(--line);display:block" alt="راعي المنصة">`
      +(SP.link_url?'</a>':'');
  } else if(el){ el.innerHTML=''; }
  // البطاقة التفصيلية
  if(SP&&SP.active&&SP.image_path){
    const logo=imgUrl(SP.image_path);
    $('spListPage').innerHTML=`
      <div class="sp-card">
        <div class="sp-card-head">
          ${SP.link_url?`<a href="${esc(SP.link_url)}" target="_blank" rel="noopener"><img src="${logo}" alt="${esc(SP.sponsor_name||'')}"></a>`:`<img src="${logo}" alt="${esc(SP.sponsor_name||'')}">`}
          <div class="sp-card-info">
            <div class="sp-card-name">${esc(SP.sponsor_name||'الراعي الرسمي')}</div>
            <div class="sp-card-cat">${esc(SP.sponsor_cat||'')}</div>
          </div>
          <span class="sp-tag">⭐ الراعي الرسمي</span>
        </div>
        ${SP.sponsor_deal?`<div class="sp-card-body"><div class="sp-deal">${esc(SP.sponsor_deal)}${SP.sponsor_code?`<br><span class="sp-code">${esc(SP.sponsor_code)}</span>`:''}</div></div>`:''}
      </div>`;
  } else {
    $('spListPage').innerHTML=`<div class="empty" style="padding:26px 14px">🌟 مقعد الراعي الرسمي بانتظار علامتك</div>`;
  }
}

export function renderSponsorsBtn(){
  const btn=$('fdSponsorsBtn');if(!btn)return;
  const sp=state.banner;
  btn.style.display=(sp&&sp.sponsors_btn)?'inline-block':'none';
}

/* ====== تحدي الأسبوع ====== */

export let CHALLENGE=null;

export async function loadChallenge(){
  const el=$('challengeStrip');if(!el)return;
  try{
    const r=await sb.from('challenge').select('*').eq('id',1).maybeSingle();
    CHALLENGE=r.data||null;
    window.__CH=CHALLENGE||{};
  }catch(e){CHALLENGE=null}
  if(!CHALLENGE||!CHALLENGE.active||!CHALLENGE.title){el.style.display='none';return}
  let left='';
  if(CHALLENGE.ends_at){
    const d=Math.ceil((new Date(CHALLENGE.ends_at)-new Date())/86400000);
    if(d>0)left=' · باقي '+d+(d===1?' يوم':' أيام');
    else if(d===0)left=' · ينتهي اليوم';
    else {el.style.display='none';return}
  }
  el.style.display='block';
  const reg=CHALLENGE.region?'<span class="ch-tag">📍 '+esc(CHALLENGE.region)+'</span>':'';
  const cat=CHALLENGE.cat?'<span class="ch-tag">'+esc(catName(CHALLENGE.cat))+'</span>':'';
  const prize=CHALLENGE.prize?'<div class="ch-prize">🎁 '+esc(CHALLENGE.prize)+'</div>':'';
  el.innerHTML='🎯 <b>تحدي الأسبوع:</b> '+esc(CHALLENGE.title)+
    ((reg||cat)?'<div class="ch-tags">'+reg+cat+'</div>':'')+
    (CHALLENGE.hint?'<div class="ch-hint">'+esc(CHALLENGE.hint)+'</div>':'')+
    prize+
    '<div class="ch-left">'+left.replace(' · ','')+'</div>'+
    '<button class="ch-join" onclick="event.stopPropagation();joinChallenge()">📷 شارك بالتحدي</button>';
  el.onclick=function(){joinChallenge()};
}

/* ====== المشاركة بالتحدي ====== */

export function catName(k){
  const m={nature:'🌿 طبيعة',arch:'🏛️ عمارة',wildlife:'🦅 طيور وحيوانات',
    people:'👥 أشخاص',bw:'⬛ أبيض وأسود',landmark:'🕌 معلم',heritage:'🏺 تراث',other:'📷 أخرى'};
  return m[k]||k;
}

export function joinChallenge(){
  go('add');
  const c=window.__CH||{};
  if(c.region&&typeof shootThere==='function'){
    window.__pendingPlace={region:c.region,city:''};
    if(typeof applyPendingPlace==='function')applyPendingPlace(0);
  }
  setTimeout(function(){
    try{
      // التصنيف
      if(c.cat&&$('aCat')){
        const co=Array.from($('aCat').options).find(o=>o.value===c.cat);
        if(co)$('aCat').value=c.cat;
      }
      // تلميح بالعنوان
      if(c.title&&$('aTitle')&&!$('aTitle').value.trim()){
        $('aTitle').placeholder='تحدي: '+c.title;
      }
      if(typeof toast==='function')toast('🎯 '+c.title+' — صوّر وشارك');
    }catch(e){}
  },240);
}
