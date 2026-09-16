/* صورة من بلدي — admin/team.js
   الرتب والفريق والمحررون */

import { currentUser, sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { isEditor, isOwner, state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   loadAdmWeek ← admin/index.js
*/
const loadAdmWeek = need('loadAdmWeek');

export const ADM_ROLES={
  owner:  {n:'مالك',   ic:'👑', c:'#D63A2F'},
  editor: {n:'محرّر',  ic:'✏️', c:'#E8A020'},
  mod:    {n:'مراجع',  ic:'🛡️', c:'#2E8B57'}
};

export function admRole(){ return state.admRole||''; }

export function needOwner(what){
  if(isOwner())return true;
  toast('🔒 '+(what||'هذا الإجراء')+' للمالك فقط',true);
  return false;
}

export function needEditor(what){
  if(isEditor())return true;
  toast('🔒 '+(what||'هذا الإجراء')+' يحتاج صلاحية أعلى',true);
  return false;
}

/* ====== إدارة المشرفين (للمالك) ====== */

export async function admTeamBlock(){
  if(!isOwner())return '';
  let rows='';
  try{
    const r=await sb.from('admins').select('id,role,name,added_at').order('added_at');
    const list=r.data||[];
    rows=list.map(x=>{
      const rl=ADM_ROLES[x.role]||ADM_ROLES.mod;
      const me=!!(currentUser()&&x.id===currentUser()?.id);
      return `<div class="tm-row">
        <div class="tm-info">
          <div class="tm-name">${rl.ic} ${esc(x.name||'مشرف')}${me?' <span style="font-size:10px;color:var(--txt-dim)">(أنت)</span>':''}</div>
          <div class="tm-id">${x.id.slice(0,8)}…</div>
        </div>
        <select class="tm-sel" ${me?'disabled':''} onchange="admSetRole('${x.id}',this.value)">
          ${Object.keys(ADM_ROLES).map(k=>`<option value="${k}" ${x.role===k?'selected':''}>${ADM_ROLES[k].ic} ${ADM_ROLES[k].n}</option>`).join('')}
        </select>
        ${me?'':`<button class="tm-del" onclick="admRemove('${x.id}')">✕</button>`}
      </div>`;
    }).join('');
  }catch(e){rows='<div style="font-size:12px;color:var(--txt-dim)">تعذر التحميل</div>'}

  return `<div style="background:var(--card);border:1.5px solid var(--sadu);border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">👥 فريق الإشراف <span style="font-size:11px;color:var(--sadu)">● للمالك</span></div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:11px;line-height:1.85">
      👑 <b>مالك:</b> كل الصلاحيات · ✏️ <b>محرّر:</b> المسابقة والكنوز والأماكن · 🛡️ <b>مراجع:</b> البلاغات والإخفاء والرسائل
    </div>
    ${rows}
    <div class="tm-add-wrap">
      <div class="tm-lbl">➕ أضف مشرفاً</div>
      <input id="tmSearch" placeholder="ابحث عن العضو بالاسم..." oninput="tmSearchUsers()" autocomplete="off">
      <div id="tmResults" class="tm-results"></div>
      <div id="tmPicked" class="tm-picked" style="display:none"></div>
      <div class="tm-add">
        <select id="tmRole">
          <option value="mod">🛡️ مراجع</option>
          <option value="editor">✏️ محرّر</option>
          <option value="owner">👑 مالك</option>
        </select>
        <button id="tmAddBtn" onclick="admAddMember()" disabled>➕ عيّنه</button>
      </div>
    </div>
/* ═══ عبر الحاجز (typeof) ═══
   pushNotify ← features/notify.js
*/
const pushNotify = need('pushNotify');
  </div>`;
}

export async function admSetRole(uid,role){
  if(!needOwner('تغيير الرتب'))return;
  const {error}=await sb.from('admins').update({role}).eq('id',uid);
  if(error){toast('تعذر التغيير: '+error.message,true);return}
  toast('انتغيّرت الرتبة ✅');
  loadAdmWeek();
}

export async function admRemove(uid){
  if(!needOwner('إزالة المشرفين'))return;
  if(!confirm('إزالة هذا المشرف نهائياً؟'))return;
  const {error}=await sb.from('admins').delete().eq('id',uid);
  if(error){toast('تعذرت الإزالة: '+error.message,true);return}
  toast('انحذف المشرف');
  loadAdmWeek();
}

export async function admAddMember(){
  if(!needOwner('تعيين المشرفين'))return;
  const pick=state.tmPick;
  if(!pick){toast('اختر العضو أول',true);return}
  const role=$('tmRole').value;
  const {error}=await sb.from('admins').insert({id:pick.id,role,name:pick.name});
  if(error){toast('تعذرت الإضافة: '+error.message,true);return}
  toast('✅ '+pick.name+' صار '+((ADM_ROLES[role]||{}).n||role));
  tmClearPick();
  loadAdmWeek();
}

/* ====== مسح الرسائل المنتهية (للمالك) ====== */

export let _tmT=null;
state.tmPick=null;

export function tmSearchUsers(){
  clearTimeout(_tmT);
  _tmT=setTimeout(_tmRun,400);
}

export async function _tmRun(){
  const q=($('tmSearch').value||'').trim();
  const box=$('tmResults');if(!box)return;
  if(q.length<2){box.innerHTML='';return}
  box.innerHTML='<div class="tm-hint">⏳</div>';
  try{
    const r=await sb.from('profiles').select('id,display_name,region')
      .ilike('display_name','%'+q+'%').limit(12);
    let list=r.data||[];
    // استبعاد المشرفين الحاليين
    try{
      const ex=await sb.from('admins').select('id');
      const have=(ex.data||[]).map(x=>x.id);
      list=list.filter(u=>!have.includes(u.id));
    }catch(e){}

    if(!list.length){box.innerHTML='<div class="tm-hint">ما لقينا أحداً</div>';return}
    box.innerHTML=list.map(u=>`
      <div class="tm-res" onclick="tmPick('${u.id}','${esc(u.display_name||'مصوّر').replace(/'/g,"&#39;")}')">
        <span>${esc(u.display_name||'مصوّر')}</span>
        ${u.region?`<small>${esc(u.region)}</small>`:''}
      </div>`).join('');
  }catch(e){box.innerHTML='<div class="tm-hint">تعذر البحث</div>'}
}

export function tmPick(id,name){
  state.tmPick={id,name};
  $('tmResults').innerHTML='';
  $('tmSearch').value='';
  const p=$('tmPicked');
  if(p){
    p.style.display='flex';
    p.innerHTML='<b>'+esc(name)+'</b><button onclick="tmClearPick()">✕</button>';
  }
  const b=$('tmAddBtn');if(b)b.disabled=false;
}

export function tmClearPick(){
  state.tmPick=null;
  const p=$('tmPicked');if(p)p.style.display='none';
  const b=$('tmAddBtn');if(b)b.disabled=true;
}

export async function admCuratorsBlock(){
  if(!isOwner())return '';
  let rows='';
  try{
    const r=await sb.from('curators').select('id,name,added_at').order('added_at');
    const list=r.data||[];
    rows=list.length
      ? list.map(x=>`<div class="cu-row">
          <span class="cu-name">🏵️ ${esc(x.name||'محرّر')}</span>
          <button class="cu-del" onclick="admRemoveCurator('${x.id}','${esc(x.name||'محرّر').replace(/'/g,"&#39;")}')">✕</button>
        </div>`).join('')
      : '<div class="cu-empty">ما عيّنت محررين بعد</div>';
  }catch(e){rows='<div class="cu-empty">تعذر التحميل</div>'}

  return `<div style="background:var(--card);border:1.5px solid var(--qteal);border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">🏵️ هيئة المحررين <span style="font-size:11px;color:var(--qteal)">● للمالك</span></div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:11px;line-height:1.85">
      اختر <b>أي عضو</b> تراه صاحب عين بصيرة — ما يحتاج يكون مشرفاً. المحررون يرشّحون الصور المميزة ويصوّتون عليها.
      <br><span style="opacity:.8">المالك والمحرّرون (بالرتب) محررون تلقائياً.</span>
    </div>
    ${rows}
    <div class="cu-add">
      <input id="cuSearch" placeholder="ابحث عن العضو بالاسم..." oninput="cuSearchUsers()" autocomplete="off">
      <div id="cuResults" class="cu-results"></div>
      <div id="cuPicked" class="cu-picked" style="display:none"></div>
      <button id="cuAddBtn" onclick="admAddCurator()" disabled>🏵️ عيّنه محرّراً</button>
    </div>
  </div>`;
}

export let _cuT=null;
state.cuPick=null;

export function cuSearchUsers(){
  clearTimeout(_cuT);
  _cuT=setTimeout(_cuRun,400);
}

export async function _cuRun(){
  const q=($('cuSearch').value||'').trim();
  const box=$('cuResults');if(!box)return;
  if(q.length<2){box.innerHTML='';return}
  box.innerHTML='<div class="cu-empty">⏳</div>';
  try{
    const r=await sb.from('profiles').select('id,display_name,region')
      .ilike('display_name','%'+q+'%').limit(12);
    let list=r.data||[];
    try{
      const ex=await sb.from('curators').select('id');
      const have=(ex.data||[]).map(x=>x.id);
      list=list.filter(u=>!have.includes(u.id));
    }catch(e){}
    if(!list.length){box.innerHTML='<div class="cu-empty">ما لقينا أحداً</div>';return}

    // عدد صور كل مرشّح — يساعد بالاختيار
    const counts={};
    try{
      if(typeof state.photos!=='undefined'){
        state.photos.forEach(p=>{counts[p.user_id]=(counts[p.user_id]||0)+1});
      }
    }catch(e){}

    box.innerHTML=list.map(u=>{
      const n=counts[u.id]||0;
      return `<div class="cu-res" onclick="cuPick('${u.id}','${esc(u.display_name||'مصوّر').replace(/'/g,"&#39;")}')">
        <span>${esc(u.display_name||'مصوّر')}</span>
        <small>${u.region?esc(u.region)+' · ':''}${n} صورة</small>
      </div>`;
    }).join('');
  }catch(e){box.innerHTML='<div class="cu-empty">تعذر البحث</div>'}
}

export function cuPick(id,name){
  state.cuPick={id,name};
  $('cuResults').innerHTML='';
  $('cuSearch').value='';
  const p=$('cuPicked');
  if(p){
    p.style.display='flex';
    p.innerHTML='<b>'+esc(name)+'</b><button onclick="cuClearPick()">✕</button>';
  }
  const b=$('cuAddBtn');if(b)b.disabled=false;
}

export function cuClearPick(){
  state.cuPick=null;
  const p=$('cuPicked');if(p)p.style.display='none';
  const b=$('cuAddBtn');if(b)b.disabled=true;
}

export async function admAddCurator(){
  if(!needOwner('تعيين المحررين'))return;
  const pick=state.cuPick;
  if(!pick){toast('اختر العضو أول',true);return}

  const {error}=await sb.from('curators').insert({id:pick.id,name:pick.name});
  if(error){
    if(error.code==='23505'){toast('محرّر أصلاً 🏵️',true);return}
    toast('تعذر التعيين: '+error.message,true);return;
  }

  // إشعار ورسالة ترحيب
  try{
    if(typeof pushNotify==='function')pushNotify({
      title:'🏵️ صرت من هيئة المحررين',
      body:'تقدر ترشّح الصور المميزة وتصوّت عليها',
      url:'/',
      user_ids:[pick.id]
    });
    await sb.from('feedback').insert({
      user_id:pick.id, kind:'other', status:'done',
      body:'🏵️ مرحباً بك في هيئة المحررين\n\n'
        +'اخترناك لعينك البصيرة — صرت تقدر ترشّح الصور المميزة للحصول على وسام «اختيار المحررين» وتصوّت على ترشيحات غيرك.\n\n'
        +'الترشيح من صفحة أي صورة، والتصويت من قسم المحررين.\n\n'
        +'شكراً لأنك تساعدنا نبرز أجمل ما توثّقه عدسات أهل الديار.'
    });
  }catch(e){}

  toast('🏵️ '+pick.name+' صار محرّراً — وانبلّغ');
  cuClearPick();
  loadAdmWeek();
}

export async function admRemoveCurator(uid,name){
  if(!needOwner('إزالة المحررين'))return;
  if(!confirm('سحب صفة المحرّر عن '+(name||'هذا العضو')+'؟'))return;
  const {error}=await sb.from('curators').delete().eq('id',uid);
  if(error){toast('تعذرت الإزالة: '+error.message,true);return}
  toast('انسحبت صفة المحرّر');
  loadAdmWeek();
}

/* ═══ لوحة الترشيحات ═══ */
