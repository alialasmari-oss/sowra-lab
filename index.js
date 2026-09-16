/* صورة من بلدي — admin/index.js
   التبويبات والصلاحيات */

import { currentUser, sb } from '../core/db.js';
import { get, need } from '../core/hub.js';
import { imgUrl } from '../core/media.js';
import { isCurator, isEditor, isOwner, state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';
const _ADM_ROLES_ = () => get('ADM_ROLES');
const loadCommercial = need('loadCommercial');

/* ═══ عبر الحاجز ═══
   admChallengeBlock ← admin/contest.js
   admCleanupBlock ← admin/settings.js
   admCommBlock ← admin/settings.js
   admCuratorsBlock ← admin/team.js
   admGoogleLoginBlock ← admin/settings.js
   admInspectBlock ← admin/settings.js
   admMaintBlock ← admin/settings.js
   admNewsBlock ← admin/settings.js
   admReelsBlock ← admin/settings.js
   admRole ← admin/team.js
   admSpBlock ← admin/contest.js
   admSponsorSideBlock ← admin/contest.js
   admSponsorsBtn ← admin/contest.js
   admTeamBlock ← admin/team.js
   loadAdmMusic ← admin/music.js
   loadAdmQuests ← admin/quests.js
   loadEC ← admin/curation.js
   loadFb ← admin/reports.js
   loadStats ← admin/stats.js
   renderPlaces ← admin/places.js
*/
const admChallengeBlock = need('admChallengeBlock');
const admCleanupBlock = need('admCleanupBlock');
const admCommBlock = need('admCommBlock');
const admCuratorsBlock = need('admCuratorsBlock');
const admGoogleLoginBlock = need('admGoogleLoginBlock');
const admInspectBlock = need('admInspectBlock');
const admMaintBlock = need('admMaintBlock');
const admNewsBlock = need('admNewsBlock');
const admReelsBlock = need('admReelsBlock');
const admRole = need('admRole');
const admSpBlock = need('admSpBlock');
const admSponsorSideBlock = need('admSponsorSideBlock');
const admSponsorsBtn = need('admSponsorsBtn');
const admTeamBlock = need('admTeamBlock');
const loadAdmMusic = need('loadAdmMusic');
const loadAdmQuests = need('loadAdmQuests');
const loadEC = need('loadEC');
const loadFb = need('loadFb');
const loadStats = need('loadStats');
const renderPlaces = need('renderPlaces');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');

export async function openAdmin(){
  // محرّر غير مشرف → قسم الترشيحات فقط
  if(typeof state.isAdmin!=='undefined'&&!state.isAdmin&&state.isCurator){
    go('adm');
    ['Rep','All','Plc','Fb','St','Wk','Qs','Mu'].forEach(function(x){
      const e=document.getElementById('admTab'+x);
      if(e)e.style.display='none';
    });
    state.admTab='ec';
    const ec=document.getElementById('admTabEc');
    if(ec){ec.style.display='';ec.classList.add('on')}
    ['admRep','admAll','admPlc','admFb','admSt','admWk','admQs','admMu'].forEach(function(id){
      const e=document.getElementById(id);
      if(e)e.style.display='none';
    });
    const ae=document.getElementById('admEC');
    if(ae)ae.style.display='block';
    loadEC();
    return;
  }
  try{
    const c=(await sb.from('curators').select('id').eq('id',currentUser()?.id).maybeSingle()).data;
    state.isCurator=!!c;
  }catch(e){}
  setTimeout(function(){if(typeof hideRestrictedTabs==='function')hideRestrictedTabs()},150);
  go('adm');
  $('admList').innerHTML='<div class="empty">⏳ جاري التحميل...</div>';
  const [ph,rp]=await Promise.all([
    sb.from('photos').select('*, profiles!user_id(display_name, banned)').order('created_at',{ascending:false}),
    sb.from('reports').select('photo_id')
  ]);
  if(ph.error){$('admList').innerHTML=`<div class="empty">⚠️ خطأ في جلب الصور:<br><span style="direction:ltr;display:inline-block;color:var(--sadu);font-size:12px">${ph.error.message}</span></div>`;return}
  if(rp.error){$('admList').innerHTML=`<div class="empty">⚠️ خطأ في جلب البلاغات:<br><span style="direction:ltr;display:inline-block;color:var(--sadu);font-size:12px">${rp.error.message}</span></div>`;return}
  state.admPhotos=ph.data||[];
  state.admReps={};
  (rp.data||[]).forEach(r=>state.admReps[r.photo_id]=(state.admReps[r.photo_id]||0)+1);
  admSetTab(state.admTab);
}

export function hideRestrictedTabs(){
  try{
    const st=document.getElementById('admTabSt');
    if(st)st.style.display=isOwner()?'':'none';
    ['Wk','Qs','Plc','Mu'].forEach(function(x){
      const e=document.getElementById('admTab'+x);
      if(e)e.style.display=isEditor()?'':'none';
    });
  }catch(e){}
}

export function admRoleBadge(){
  const r=admRole();
  if(!r)return '';
  const x=_ADM_ROLES_()[r]||_ADM_ROLES_().mod;
  return `<div class="adm-role" style="border-color:${x.c};color:${x.c}">${x.ic} ${x.n}</div>`;
}

export function admSetTab(t){
  // فحص الصلاحية
  const tabPerm={wk:'editor',qs:'editor',plc:'editor',mu:'editor'};
  if(t==='ec'&&!isCurator()){toast('🔒 هذا القسم للمحررين',true);return}
  if(t==='st'&&!isOwner()){toast('🔒 الإحصائيات للمالك فقط',true);return}
  if(tabPerm[t]&&!isEditor()){toast('🔒 هذا القسم يحتاج صلاحية أعلى',true);return}

  state.admTab=t;
  ['Rep','All','Plc','Fb','St','Wk','Qs','Mu','Ec'].forEach(x=>{const e=$('admTab'+x);if(e)e.classList.remove('on')});
  const m={rep:'Rep',all:'All',plc:'Plc',fb:'Fb',st:'St',wk:'Wk',qs:'Qs',ec:'Ec',mu:'Mu'};
  const cur=$('admTab'+m[t]);if(cur)cur.classList.add('on');
  $('admPlaces').style.display=t==='plc'?'block':'none';
  $('admFb').style.display=t==='fb'?'block':'none';
  $('admSt').style.display=t==='st'?'block':'none';
  $('admWk').style.display=t==='wk'?'block':'none';
  const aq=$('admQs');if(aq)aq.style.display=t==='qs'?'block':'none';
  const am=$('admMu');if(am)am.style.display=t==='mu'?'block':'none';
  const ae=$('admEC');if(ae)ae.style.display=t==='ec'?'block':'none';
  $('admList').style.display=(t==='rep'||t==='all')?'block':'none';
  if(t==='plc')renderPlaces();
  else if(t==='fb')loadFb();
  else if(t==='st'){loadStats();setTimeout(loadCommercial,400);}
  else if(t==='wk')loadAdmWeek();
  else if(t==='qs')loadAdmQuests();
  else if(t==='mu')loadAdmMusic();
  if(t==='ec')loadEC();
  else admRender();
}

/* ====== الإحصائيات ====== */

export let CW=null;

export async function loadAdmWeek(){
  $('admWk').innerHTML='<div class="empty">⏳</div>';
  const c=await sb.from('weekly_contest').select('*').order('id',{ascending:false}).limit(1).maybeSingle();
  CW=c.data||null;
  let entries=[];
  if(CW){
    const en=await sb.from('weekly_entries').select('photo_id').eq('contest_id',CW.id);
    const ids=(en.data||[]).map(e=>e.photo_id);
    entries=state.admPhotos.filter(p=>ids.includes(p.id));
    if(!state.admPhotos.length){
      const ph=await sb.from('photos').select('id,title').in('id',ids.length?ids:[0]);
      entries=ph.data||[];
    }
  }
  $('admWk').innerHTML=`
    <div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:14px">
      <div style="font-weight:700;font-size:14px;margin-bottom:10px">🏆 مسابقة لقطة الأسبوع ${CW?`<span style="font-size:11px;padding:3px 10px;border-radius:10px;font-weight:700;${CW.active?'background:rgba(46,139,87,.15);color:var(--palm);border:1px solid var(--palm)':'background:var(--card2);color:var(--txt-dim);border:1px solid var(--line)'}">${CW.ended_at?'🏁 منتهية — الفائز أُعلن':(CW.active?'● نشطة الآن':'○ متوقفة')}</span>`:''}</div>
      <input id="wkLabel" placeholder="وسم الأسبوع (مثال: أسبوع الغروب)" value="${CW?esc(CW.week_label):''}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
      <input id="wkSponsor" placeholder="اسم الراعي (اختياري)" value="${CW?esc(CW.sponsor_name):''}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
      <input id="wkPrize" placeholder="الجائزة (اختياري)" value="${CW?esc(CW.prize):''}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:10px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${CW&&CW.ended_at?'':'<button class="btn" style="flex:1" onclick="admWeekSave()">'+(CW?'💾 حفظ البيانات':'➕ إنشاء المسابقة')+'</button>'}
        ${CW&&!CW.ended_at?`<button class="btn" style="flex:1;${CW.active?'background:var(--card2);border:1px solid var(--line);color:var(--txt)':'background:var(--palm)'}" onclick="admWeekToggle()">${CW.active?'⏸️ إيقاف':'▶️ تفعيل للجمهور'}</button>`:''}
        ${CW&&CW.active?`<button class="btn" style="flex:1;background:var(--star);color:var(--ink)" onclick="admWeekEnd()">🏁 إنهاء وإعلان الفائز</button>`:''}
        ${CW&&CW.ended_at?`<button class="btn" style="flex:1;background:var(--palm)" onclick="admWeekNew()">➕ مسابقة جديدة</button>`:''}
        ${CW?`<button class="btn" style="flex:0 0 auto;background:var(--sadu)" onclick="admWeekDelete()">🗑️</button>`:''}
      </div>
    </div>
    <div style="font-weight:700;font-size:14px;margin-bottom:8px">اللقطات المرشحة (${entries.length}/5) <span style="font-size:11px;color:var(--txt-dim);font-weight:400">— رشّح من تبويب 🗂️ بزر 🏆</span></div>
    ${entries.length?entries.map(p=>`
      <div style="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 13px;margin-bottom:8px">
        <div style="flex:1"><b style="font-size:13px">#${p.id} · ${esc(p.title)}</b></div>
        <button class="btn" style="font-size:12px;padding:7px 12px;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="admWeekRemove(${p.id})">إزالة</button>
      </div>`).join(''):'<div class="empty" style="padding:20px">ما فيه ترشيحات بعد</div>'}` + admChallengeBlock() + admReelsBlock() + admInspectBlock() + admCommBlock() + admCleanupBlock() + await admSpBlock() + admSponsorsBtn() + admSponsorSideBlock() +  admNewsBlock() + admGoogleLoginBlock() + admMaintBlock() + await admCuratorsBlock() + await admTeamBlock();
}
/* ====== بنر الراعي ====== */

export function admRender(){
  let list=state.admTab==='rep'?state.admPhotos.filter(p=>(state.admReps[p.id]||0)>0||p.hidden):state.admPhotos;
  if(state.admTab==='rep'){
    list=list.slice().sort((x,y)=>((state.admReps[y.id]||0)-(state.admReps[x.id]||0)));
  }
  if(!list.length){$('admList').innerHTML=`<div class="empty">${state.admTab==='rep'?'✅ ما فيه شيء للمراجعة — الساحة نظيفة':'ما فيه صور'}</div>`;return}
  $('admList').innerHTML=list.map(p=>{
    const rc=state.admReps[p.id]||0;
    return `<div class="card" style="margin-bottom:12px;cursor:default">
      <div class="ph" style="height:150px"><img src="${imgUrl(p.image_path)}" loading="lazy"></div>
      <div class="card-body">
        <div class="card-title">#${p.id} · ${esc(p.title)}</div>
        <div class="card-meta" style="margin-bottom:8px"><span>📷 ${p.profiles?.display_name||'?'} · 📍 ${p.city}</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          ${rc?`<span style="font-size:11px;padding:3px 9px;border-radius:10px;font-weight:700;background:rgba(242,179,61,.15);color:var(--star);border:1px solid var(--star)">🚩 ${rc} بلاغ</span>`:''}
          ${p.hidden?`<span style="font-size:11px;padding:3px 9px;border-radius:10px;font-weight:700;background:rgba(107,98,89,.15);color:var(--txt-dim);border:1px solid var(--line)">🙈 مخفية بقرار إشراف</span>`:''}
          ${p.profiles?.banned?`<span style="font-size:11px;padding:3px 9px;border-radius:10px;font-weight:700;background:rgba(192,57,43,.3);color:#fff;border:1px solid var(--sadu)">صاحبها محظور</span>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn" style="font-size:12px;padding:8px 12px;${p.hidden?'background:var(--palm)':'background:var(--card2);border:1px solid var(--line)'}" onclick="admHide(${p.id},${!p.hidden})">${p.hidden?'👁️ إظهار':'🙈 إخفاء'}</button>
          ${isCurator()?(p.editors_choice
            ? `<button class="btn" style="font-size:12px;padding:8px 12px;background:var(--qteal)" onclick="ecRevoke(${p.id})">🏵️ اسحب الوسام</button>`
            : `<button class="btn" style="font-size:12px;padding:8px 12px;background:var(--card2);border:1px solid var(--qteal);color:var(--qteal)" onclick="ecNominate(${p.id})">🏵️ رشّحها</button>`):''}
          <button class="btn" style="font-size:12px;padding:8px 12px" onclick="admDel(${p.id},'${p.image_path}')">🗑️ حذف نهائي</button>
          <button class="btn" style="font-size:12px;padding:8px 12px;background:var(--star);color:var(--ink)" onclick="admWeekAdd(${p.id})">🏆 رشّح</button>
          <button class="btn" style="font-size:12px;padding:8px 12px;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="admClearBadges(${p.id})">🗳️ مسح الأوسمة</button>
          <button class="btn" style="font-size:12px;padding:8px 12px;background:var(--star);color:var(--ink)" onclick="admAddToQuest(${p.id})">🗝️ لكنز</button>
          <button class="btn" style="font-size:12px;padding:8px 12px;${p.profiles?.banned?'background:var(--palm)':'background:var(--card2);border:1px solid var(--line)'}" onclick="admBan('${p.user_id}',${!(p.profiles?.banned)})">${p.profiles?.banned?'فك الحظر':'⛔ حظر المصور'}</button>
          ${rc?`<button class="btn" style="font-size:12px;padding:8px 12px;background:var(--card2);border:1px solid var(--line)" onclick="admClear(${p.id})">مسح البلاغات</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

export async function admClear(id){
  const { error } = await sb.from('reports').delete().eq('photo_id',id);
  if(error){toast('فشلت العملية',true);return}
  toast('مُسحت البلاغات');
  await openAdmin();
}


/* ====== إدارة لقطة الأسبوع ====== */
