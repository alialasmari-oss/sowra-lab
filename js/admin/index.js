/* صورة من بلدي — admin/index.js
   التبويبات والصلاحيات */

import { currentUser, sb } from '../core/db.js';
import { get, need } from '../core/hub.js';
import { imgUrl, thumbUrl } from '../core/media.js';
import { isCurator, isEditor, isOwner, state } from '../core/state.js';
import { $, dbErr, esc, toast } from '../core/ui.js';
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
    if(ae)ae.style.display='';
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
  /* ═══ كان هنا select('*') بلا حدّ ═══
     يجلب كل صور المنصة بكل أعمدتها عند كل فتحةٍ للترس. عند خمسة آلاف
     صورة: عدّة ميغابايت في كل مرة، وخمسة آلاف بطاقة في الصفحة. وهذا
     الطريق كان يُغذّي التبويبين ٣ والشبكة معاً.
     صار الترس يجلب خريطة البلاغات وحدها — وهي صفٌّ صغير لكل بلاغ —
     ثم يطلب الصور بمرشِّحاتها من loadAdmList، مُقيَّدةً بحدّ. */
  const rp=await sb.from('reports').select('photo_id');
  if(rp.error){$('admList').innerHTML=`<div class="empty">⚠️ خطأ في جلب البلاغات:<br><span style="direction:ltr;display:inline-block;color:var(--sadu);font-size:12px">${rp.error.message}</span></div>`;return}
  state.admReps={};
  (rp.data||[]).forEach(r=>state.admReps[r.photo_id]=(state.admReps[r.photo_id]||0)+1);
  admSetTab(state.admTab);
}

/* ═══ شريط مرشِّحات قائمة الإشراف ═══
   نفس شريط شبكة الترشيح — وبه يجد المالك الصورة المصنَّفة خطأً
   ليصحّحها، وكان ذلك متعذّراً: قائمةٌ بلا بحثٍ ولا مرشِّح. */
const ADM_LIMIT = 60;

export function admTools(){
  if(!$('admTools')) return;
  if($('adQ')) return;                    /* مرسومٌ سلفاً — لا نمسح ما كتبه */
  const regs = $('fRegion') ? $('fRegion').innerHTML : '<option value="">كل المناطق</option>';
  const cats = [['','كل التصنيفات'],['nature','🌿 طبيعة'],['arch','🏛️ عمارة'],
                ['wildlife','🦅 طيور'],['people','👥 أشخاص'],['bw','⬛ أبيض وأسود'],
                ['heritage','🏺 تراث'],['landmark','🕌 معلم'],['other','📷 أخرى']];
  const st = "background:var(--card2);border:1px solid var(--line);border-radius:11px;padding:9px;color:var(--txt);font-family:'Tajawal';font-size:12.5px;outline:none;min-width:0";
  $('admTools').innerHTML = `<div class="wk-tools">
    <input id="adQ" placeholder="ابحث بعنوان الصورة…" oninput="admSearch()" style="${st};grid-column:1/-1">
    <select id="adCat" onchange="loadAdmList()" style="${st}">
      ${cats.map(c=>`<option value="${c[0]}">${c[1]}</option>`).join('')}
    </select>
    <select id="adSort" onchange="loadAdmList()" style="${st}">
      <option value="new">🆕 الأحدث</option>
      <option value="old">🕰️ الأقدم</option>
    </select>
    <select id="adReg" onchange="loadAdmList()" style="${st};grid-column:1/-1">${regs}</select>
  </div>`;
}

let _adT = null;
export function admSearch(){
  clearTimeout(_adT);
  _adT = setTimeout(() => { loadAdmList(); }, 350);
}

export async function loadAdmList(){
  const box = $('admList'); if(!box) return;
  const rep = state.admTab === 'rep';
  admTools();
  const tb = $('admTools'); if(tb) tb.style.display = rep ? 'none' : '';
  box.innerHTML = '<div class="empty">⏳</div>';

  let q = sb.from('photos').select('*, profiles!user_id(display_name, banned)');

  if(rep){
    /* تبويب المراجعة: المبلَّغ عنها أو المخفيّة — لا كل الصور */
    const ids = Object.keys(state.admReps||{}).map(Number);
    q = ids.length ? q.or(`hidden.eq.true,id.in.(${ids.join(',')})`) : q.eq('hidden', true);
    q = q.order('created_at', {ascending:false}).limit(ADM_LIMIT);
  }else{
    const term = ($('adQ')||{}).value || '';
    const cat  = ($('adCat')||{}).value || '';
    const reg  = ($('adReg')||{}).value || '';
    const srt  = ($('adSort')||{}).value || 'new';
    if(term.trim()) q = q.ilike('title', '%'+term.trim()+'%');
    if(cat) q = q.eq('category', cat);
    if(reg) q = q.eq('region', reg);
    q = q.order('created_at', {ascending: srt === 'old'}).limit(ADM_LIMIT);
  }

  const r = await q;
  if(r.error){ dbErr('جلب الصور', r.error); box.innerHTML=''; return; }
  state.admPhotos = r.data || [];
  admRender();
  if(!rep && state.admPhotos.length >= ADM_LIMIT){
    box.insertAdjacentHTML('afterbegin',
      `<div class="empty" style="padding:10px;grid-column:1/-1;font-size:12px">`
      + `بلغنا حدّ العرض (${ADM_LIMIT}) — ضيّق البحث لترى الباقي</div>`);
  }
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
  $('admPlaces').style.display=t==='plc'?'':'none';
  $('admFb').style.display=t==='fb'?'':'none';
  $('admSt').style.display=t==='st'?'':'none';
  $('admWk').style.display=t==='wk'?'':'none';
  const aq=$('admQs');if(aq)aq.style.display=t==='qs'?'':'none';
  const am=$('admMu');if(am)am.style.display=t==='mu'?'':'none';
  const ae=$('admEC');if(ae)ae.style.display=t==='ec'?'':'none';
  /* كان 'block' — ونمطٌ سطريّ يغلب الورقة كلها مهما كتبنا فيها.
     فقائمة الإشراف تبقى بطاقةً واحدة بالسطر على سطح المكتب ولو
     جعلناها شبكةً بالأنماط: السطر هذا يمحو ذلك عند كل نقرة تبويب.
     والفراغ '' يرجع العنصر لما تقوله الورقة — وهو معنى «أظهره». */
  $('admList').style.display=(t==='rep'||t==='all')?'':'none';
  if(t==='plc')renderPlaces();
  else if(t==='fb')loadFb();
  else if(t==='st'){loadStats();setTimeout(loadCommercial,400);}
  else if(t==='wk')loadAdmWeek();
  else if(t==='qs')loadAdmQuests();
  else if(t==='mu')loadAdmMusic();
  if(t==='ec')loadEC();
  else if(t==='rep'||t==='all')loadAdmList();
}

/* ====== الإحصائيات ====== */

export let CW=null;

/* ═══ لماذا دالة وليست القيمة نفسها ═══
   admin/contest.js كان يقرأ المسابقة بـget('CW') — والحاجز يسجّل
   ما يُعطى له بـObject.assign، وهذا ينسخ قيمة الارتباط لحظة التسجيل
   لا الارتباط نفسه. والتسجيل يجري وقت تحميل وحدة الإشراف، وCW حينها
   null دائماً، ويظلّ null بالسجلّ للأبد ولو أسندنا له ألف مرة بعدها.
   فكان _CW_() يعيد undefined، فكل زر يلمس المسابقة معطوب:
     · «تفعيل للجمهور» ينهار على undefined.active — وهي رسالة الخطأ
       التي يراها المشرف
     · «حفظ البيانات» يسقط شرط التحديث فيُدرج مسابقة جديدة كل مرة
     · «الترشيح» يقول «أنشئ المسابقة أول» وهي منشأة
     · «إنهاء» و«إزالة» يستعلمان contest_id=undefined
   والدالة تُنسخ بمرجعها فتقرأ الارتباط الحيّ عند كل نداء — هذا هو
   الفرق بين get(قيمة) وneed(دالة) بالحاجز. */
export const getCW = () => CW;

/* ═══ شبكة الترشيح ═══
   كان الترشيح يجري من تبويب 🗂️: قائمةٌ عمودية، كل صورة بطاقةٌ بعرض
   الشاشة تحتها ثمانية أزرار — فالمشرف يمرّر طويلاً ولا يرى الصور
   متجاورةً ليوازن بينها، وهو جوهر العمل: أن تختار خمساً من بين
   عشرات بنظرةٍ واحدة. فصارت شبكةً مربّعة هنا، حيث تُدار المسابقة،
   وعلى كل صورة مربّعُ اختيار ينقلب ✓ ويُحفظ فوراً.
   والمرشَّحة تتقدّم الصفّ ليُرى المختار أولاً. */
/* ═══ لماذا استعلامٌ مستقلّ لا state.admPhotos ═══
   كانت الشبكة ترسم state.admPhotos كلها — وهي ثمرة select('*') بلا
   حدٍّ يجلب كل صور المنصة عند كل فتحةٍ للترس. عند خمسة آلاف صورة
   ينهار هذا قبل أن تنهار الشبكة: عدّة ميغابايت في كل مرة، ثم خمسة
   آلاف خليّة في الصفحة.
   والأهمّ أن المشرف لا يريد خمسة آلاف أصلاً — يريد خمساً من صور
   هذا الأسبوع. فعرضُ الكل ليس ميزةً تُصلَح بل خطأٌ يُحذف.
   فصارت الشبكة نافذةً: تفتح على آخر سبعة أيام، ومعها بحثٌ ومرشّحات،
   والاستعلام مُقيَّد بـ٤٨ صفاً لا يُجلب منها إلا الأعمدة المعروضة.
   والمرشَّحات تُجلب بمعرّفاتها دائماً وتتقدّم الصفّ مهما كان المرشِّح،
   وإلا اختفى اختيارُ المشرف عن عينه لمجرّد أنه بدّل المنطقة. */
const WK_LIMIT = 48;

function wkTools(){
  const regs = ($('fRegion') ? $('fRegion').innerHTML : '<option value="">كل المناطق</option>')
                 .replace('كل المناطق','كل المناطق');
  const cats = [['','كل التصنيفات'],['nature','🌿 طبيعة'],['arch','🏛️ عمارة'],
                ['wildlife','🦅 طيور'],['people','👥 أشخاص'],['bw','⬛ أبيض وأسود'],
                ['heritage','🏺 تراث'],['landmark','🕌 معلم'],['other','📷 أخرى']];
  const sel = 'background:var(--card2);border:1px solid var(--line);border-radius:11px;padding:9px;color:var(--txt);font-family:\'Tajawal\';font-size:12.5px;outline:none;min-width:0';
  return `<div class="wk-tools">
    <input id="wkQ" placeholder="ابحث بعنوان الصورة…" oninput="admWeekSearch()" style="${sel};grid-column:1/-1">
    <select id="wkScope" onchange="loadWeekPicker()" style="${sel}">
      <option value="week">🗓️ آخر ٧ أيام</option>
      <option value="month">🗓️ آخر ٣٠ يوماً</option>
      <option value="top">⭐ الأعلى تقييماً</option>
      <option value="all">📚 كل الصور</option>
    </select>
    <select id="wkCat" onchange="loadWeekPicker()" style="${sel}">
      ${cats.map(c=>`<option value="${c[0]}">${c[1]}</option>`).join('')}
    </select>
    <select id="wkReg" onchange="loadWeekPicker()" style="${sel};grid-column:1/-1">${regs}</select>
  </div>
  <div id="wkPickBox"><div class="empty" style="padding:18px">⏳</div></div>`;
}

/* بحثٌ بمهلة: لا نستعلم عند كل حرف */
let _wkT = null;
export function admWeekSearch(){
  clearTimeout(_wkT);
  _wkT = setTimeout(() => { loadWeekPicker(); }, 350);
}

export async function loadWeekPicker(){
  const box = $('wkPickBox'); if(!box) return;
  box.innerHTML = '<div class="empty" style="padding:18px">⏳</div>';

  /* المرشَّحات أولاً — بمعرّفاتها، مهما كان المرشِّح */
  let picked = [];
  if(CW){
    const en = await sb.from('weekly_entries').select('photo_id').eq('contest_id', CW.id);
    const ids = (en.data||[]).map(e => e.photo_id);
    if(ids.length){
      const r = await sb.from('photos_ranked')
        .select('id,title,image_path,avg_stars').in('id', ids);
      if(r.error){ dbErr('جلب الترشيحات', r.error); return; }
      picked = r.data || [];
    }
  }
  const on = new Set(picked.map(p => p.id));

  const term  = ($('wkQ')     || {}).value || '';
  const scope = ($('wkScope') || {}).value || 'week';
  const cat   = ($('wkCat')   || {}).value || '';
  const reg   = ($('wkReg')   || {}).value || '';
  const since = d => new Date(Date.now() - d*864e5).toISOString();

  let q = sb.from('photos_ranked').select('id,title,image_path,avg_stars');
  if(term.trim()) q = q.ilike('title', '%'+term.trim()+'%');
  if(cat) q = q.eq('category', cat);
  if(reg) q = q.eq('region', reg);
  if(scope === 'week')  q = q.gte('created_at', since(7));
  if(scope === 'month') q = q.gte('created_at', since(30));
  q = (scope === 'top')
        ? q.order('avg_stars', {ascending:false}).order('id', {ascending:false})
        : q.order('created_at', {ascending:false});

  const r = await q.limit(WK_LIMIT);
  if(r.error){ dbErr('جلب صور الترشيح', r.error); return; }

  const rest = (r.data||[]).filter(p => p.image_path && !on.has(p.id));

  const cell = p => {
    const sel = on.has(p.id);
    return `<div class="wk-cell${sel?' on':''}" data-id="${p.id}" onclick="admWeekPick(${p.id})" title="${esc(p.title)}">
      <img src="${thumbUrl(p.image_path)}" loading="lazy" alt="${esc(p.title)}">
      <span class="wk-box">${sel?'✓':''}</span>
      <span class="wk-t">#${p.id} · ${esc(p.title)}</span>
    </div>`;
  };
  const grid = arr => '<div class="wk-pick">' + arr.map(cell).join('') + '</div>';

  /* ═══ قسمان بعنوانين، لا صفٌّ واحد ═══
     سأل المالك: رشّحتُ «عمارة» فتظهر لي صورةُ شجرٍ دائماً — لماذا؟
     والسبب أنها من الخمس المرشَّحة، والمرشَّحة تتقدّم الصفّ مهما كان
     المرشِّح عمداً: لئلا يغيب اختياره عن عينه لأنه بدّل تصنيفاً.
     لكني خلطتها بالنتائج في شبكةٍ واحدة، فبدت كأنها نتيجةُ بحثٍ
     خاطئة. والعلّة في البيان لا في السلوك: فصلناهما بعنوانين.
     فإن ظهرت صورةٌ تحت «نتائج البحث» وتصنيفها لا يطابق، فالخلل حينها
     في تصنيفها بالقاعدة لا في المرشِّح. */
  let html = '';
  if(picked.length){
    html += `<div class="wk-sec">🏆 المرشَّحة الآن (${picked.length}/5)`
         +  `<span>تظهر دائماً مهما غيّرت المرشِّح</span></div>` + grid(picked);
  }
  html += `<div class="wk-sec">🔎 نتائج البحث (${rest.length})`
       +  (rest.length >= WK_LIMIT ? `<span>بلغنا حدّ العرض ${WK_LIMIT} — ضيّق البحث</span>` : '')
       +  `</div>`;
  html += rest.length ? grid(rest)
        : '<div class="empty" style="padding:22px">ما فيه صور بهذا المرشِّح — وسّعه أو ابحث باسمٍ آخر</div>';

  box.innerHTML = html;
}

export async function loadAdmWeek(){
  $('admWk').innerHTML='<div class="empty">⏳</div>';
  const c=await sb.from('weekly_contest').select('*').order('id',{ascending:false}).limit(1).maybeSingle();
  CW=c.data||null;
  let entries=[];
  if(CW){
    const en=await sb.from('weekly_entries').select('photo_id').eq('contest_id',CW.id);
    const ids=(en.data||[]).map(e=>e.photo_id);
    /* المعرّفات وحدها تكفي للعدّاد — وadmPhotos صارت مقيَّدةً بمرشِّح
       فلا يصحّ عدّ المرشَّحات منها */
    entries=ids.map(id=>({id}));
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
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">اللقطات المرشحة <span id="wkCount">(${entries.length}/5)</span></div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:9px">اضغط الصورة لترشيحها — تنقلب العلامة ✓ وتُحفظ فوراً</div>
    ${wkTools()}` + admChallengeBlock() + admReelsBlock() + admInspectBlock() + admCommBlock() + admCleanupBlock() + await admSpBlock() + admSponsorsBtn() + admSponsorSideBlock() +  admNewsBlock() + admGoogleLoginBlock() + admMaintBlock() + await admCuratorsBlock() + await admTeamBlock();
  /* الشبكة تُحمَّل باستعلامها الخاص بعد رسم اللوحة */
  loadWeekPicker();
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
      <!-- كانت imgUrl: الصورة الأصلية كاملةً لكل صفٍّ بالقائمة. فعند
           مئة صورة تُنزَّل مئة صورة كاملة عند كل فتحةٍ للترس، وعند ألفٍ
           ألف. وهي تُعرض في مربّعٍ صغير لا يحتاج عُشر ذلك.
           thumbUrl المصغّرة، وimgUrl احتياطٌ لصورةٍ قديمة بلا مصغّرة. -->
      <div class="ph sq" style="cursor:zoom-in" onclick="openSheet(${p.id})" title="اضغط للتكبير"><img src="${thumbUrl(p.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'" loading="lazy" alt="${esc(p.title)}"></div>
      <div class="card-body">
        <div class="card-title">#${p.id} · ${esc(p.title)}</div>
        <div class="card-meta" style="margin-bottom:8px"><span>📷 ${p.profiles?.display_name||'?'} · 📍 ${p.city}</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          ${rc?`<span style="font-size:11px;padding:3px 9px;border-radius:10px;font-weight:700;background:rgba(242,179,61,.15);color:var(--star);border:1px solid var(--star)">🚩 ${rc} بلاغ</span>`:''}
          ${p.hidden?`<span style="font-size:11px;padding:3px 9px;border-radius:10px;font-weight:700;background:rgba(107,98,89,.15);color:var(--txt-dim);border:1px solid var(--line)">🙈 مخفية بقرار إشراف</span>`:''}
          ${p.profiles?.banned?`<span style="font-size:11px;padding:3px 9px;border-radius:10px;font-weight:700;background:rgba(192,57,43,.3);color:#fff;border:1px solid var(--sadu)">صاحبها محظور</span>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn" title="${p.hidden?'إظهار الصورة للزوار مرة أخرى':'إخفاء الصورة عن الزوار — تبقى محفوظة ويمكن إرجاعها'}" style="font-size:12px;padding:8px 12px;${p.hidden?'background:var(--palm)':'background:var(--card2);border:1px solid var(--line)'}" onclick="admHide(${p.id},${!p.hidden})">${p.hidden?'👁️ إظهار':'🙈 إخفاء'}</button>
          ${isCurator()?(p.editors_choice
            ? `<button class="btn" title="سحب وسام «اختيار المحررين» من هذه الصورة" style="font-size:12px;padding:8px 12px;background:var(--qteal)" onclick="ecRevoke(${p.id})">🏵️ اسحب الوسام</button>`
            : `<button class="btn" title="منح الصورة وسام «اختيار المحررين»" style="font-size:12px;padding:8px 12px;background:var(--card2);border:1px solid var(--qteal);color:var(--qteal)" onclick="ecNominate(${p.id})">🏵️ رشّحها</button>`):''}
          <button class="btn" title="حذف الصورة وملفها من التخزين نهائياً — لا رجعة" style="font-size:12px;padding:8px 12px" onclick="admDel(${p.id},'${p.image_path}')">🗑️ حذف نهائي</button>
          <button class="btn" title="ترشيح الصورة لمسابقة «لقطة الأسبوع»" style="font-size:12px;padding:8px 12px;background:var(--star);color:var(--ink)" onclick="admWeekAdd(${p.id})">🏆 رشّح</button>
          <button class="btn" title="مسح أوسمة الأعضاء (التقييمات الرمزية) عن هذه الصورة" style="font-size:12px;padding:8px 12px;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="admClearBadges(${p.id})">🗳️ مسح الأوسمة</button>
          <button class="btn" title="إضافة الصورة إلى أحد «كنوز الديرة»" style="font-size:12px;padding:8px 12px;background:var(--star);color:var(--ink)" onclick="admAddToQuest(${p.id})">🗝️ لكنز</button>
          <button class="btn" title="${p.profiles?.banned?'فك الحظر عن صاحب الصورة ليعود للنشر':'حظر صاحب الصورة من النشر بالمنصة'}" style="font-size:12px;padding:8px 12px;${p.profiles?.banned?'background:var(--palm)':'background:var(--card2);border:1px solid var(--line)'}" onclick="admBan('${p.user_id}',${!(p.profiles?.banned)})">${p.profiles?.banned?'فك الحظر':'⛔ حظر المصور'}</button>
          ${rc?`<button class="btn" title="مسح البلاغات المسجّلة على هذه الصورة" style="font-size:12px;padding:8px 12px;background:var(--card2);border:1px solid var(--line)" onclick="admClear(${p.id})">مسح البلاغات</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

export async function admClear(id){
  const { error } = await sb.from('reports').delete().eq('photo_id',id);
  if(error){dbErr('مسح البلاغات',error);return}
  toast('مُسحت البلاغات');
  await openAdmin();
}


/* ====== إدارة لقطة الأسبوع ====== */
