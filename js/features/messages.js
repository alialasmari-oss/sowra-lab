/* صورة من بلدي — features/messages.js
   الرسائل */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, timeAgo } from '../core/format.js';
import { need } from '../core/hub.js';
import { isEditor, state } from '../core/state.js';
import { $, dbErr, esc, prompt, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   notifyDmBan ← admin/reports.js
*/
const notifyDmBan = need('notifyDmBan');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const openProfile = need('openProfile');
const pushNotify = need('pushNotify');
const showJoinBox = need('showJoinBox');
const checkRate = need('checkRate');
const logRate = need('logRate');
/* ═══ عبر الحاجز (نُقل للهيدر) ═══
*/
const isBlockedWith = need('isBlockedWith');
const loadMyBlocks = need('loadMyBlocks');
export function openDmBox(uid,name){
  if(isAnon()){toast('✉️ سجّل مجاناً وراسل المصورين',true);showJoinBox();return}
  state.dmTo={id:uid,name:name};
  const el=$('dmBox');if(!el)return;
  $('dmTitle').textContent='✉️ رسالة إلى '+name;
  $('dmText').value='';
  $('dmCount').textContent='0 / 400';
  el.classList.add('show');
  setTimeout(()=>{const t=$('dmText');if(t)t.focus()},220);
}

export function closeDmBox(){
  const el=$('dmBox');
  if(el)el.classList.remove('show');
  state.dmTo=null;
}

export function dmCount(){
  const t=$('dmText');if(!t)return;
  const n=t.value.length;
  $('dmCount').textContent=n+' / 400';
}

export async function sendDm(){
  const to=state.dmTo;
  if(!to){closeDmBox();return}
  const body=($('dmText').value||'').trim();
  if(body.length<5){toast('اكتب رسالة أوضح',true);return}
  if(body.length>400){toast('الحد ٤٠٠ حرف',true);return}

  // فلتر الألفاظ
  if(typeof checkText==='function'){
    const bad=checkText(body);
    if(bad){toast(bad,true);return}
  }

  const btn=$('dmSend');
  const old=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='⏳'}

  // فحص مسبق: حظر · إغلاق الرسائل · منع إداري
  try{
    if(await isBlockedWith(to.id)){
      toast('🚫 ما تقدر تراسله — فيه حظر بينكما',true);
      if(btn){btn.disabled=false;btn.textContent=old}
      closeDmBox();
      return;
    }
    const pr=(await sb.from('profiles').select('dm_open').eq('id',to.id).maybeSingle()).data;
    if(pr&&pr.dm_open===false){
      toast('🔕 هذا العضو أقفل استقبال الرسائل',true);
      if(btn){btn.disabled=false;btn.textContent=old}
      closeDmBox();
      return;
    }
    const me=(await sb.from('profiles').select('dm_banned').eq('id',currentUser()?.id).maybeSingle()).data;
    if(me&&me.dm_banned){
      toast('🚫 إرسال الرسائل موقوف بحسابك — شوف التفاصيل بـ«رسائلي»',true);
      if(btn){btn.disabled=false;btn.textContent=old}
      closeDmBox();
      return;
    }
  }catch(e){}

  try{
    // حد: رسالتان يومياً لنفس الشخص
    const since=new Date(Date.now()-86400000).toISOString();
    const c=await sb.from('dm').select('id',{count:'exact',head:true})
      .eq('from_id',currentUser()?.id).eq('to_id',to.id).gte('created_at',since);
    if((c.count||0)>=2){
      toast('أرسلت رسالتين له اليوم — انتظر رده',true);
      return;
    }

    const {error}=await sb.from('dm').insert({
      from_id:currentUser()?.id, to_id:to.id, body,
      photo_id:(state.curPhoto&&state.curPhoto.user_id===to.id)?state.curPhoto.id:null
    });
    if(error)throw error;

    // إشعار للمستقبِل
    try{
      const me=(await sb.from('profiles').select('display_name').eq('id',currentUser()?.id).maybeSingle()).data;
      if(typeof pushNotify==='function')pushNotify({
        title:'✉️ رسالة جديدة',
        body:((me&&me.display_name)||'مصوّر')+' راسلك',
        url:'/',
        user_ids:[to.id]
      });
    }catch(e){}

    toast('انرسلت رسالتك ✅');
    closeDmBox();
  }catch(e){
    const msg=String((e&&e.message)||'');
    // خطأ سياسة = حظر أو إغلاق الرسائل
    if(/row-level|policy|violates|42501/i.test(msg)){
      toast('🚫 ما تقدر تراسله — إما حاظرك أو أقفل الرسائل',true);
      closeDmBox();
    }else{
      toast('تعذر الإرسال: '+msg,true);
    }
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old}
  }
}

/* ====== صندوق الوارد ====== */
state.dmTab='in';

export function setDmTab(t){
  state.dmTab=t;
  renderInbox();
}

export async function renderInbox(){
  const el=$('inboxList');if(!el)return;
  await loadMyBlocks();
  if(isAnon()){el.innerHTML='';return}
  const tab=state.dmTab||'in';
  const isOut=(tab==='out');
  el.innerHTML='<div class="loader" style="padding:16px">⏳</div>';
  try{
    const r=await sb.from('dm')
      .select('*')
      .eq(isOut?'from_id':'to_id',currentUser()?.id)
      .eq(isOut?'del_from':'del_to',false)
      .order('created_at',{ascending:false}).limit(60);
    if(r.error)throw r.error;
    let list=r.data||[];
    // استبعاد المحظورين
    if(state.myBlocks&&state.myBlocks.size){
      const k=isOut?'to_id':'from_id';
      list=list.filter(m=>!state.myBlocks.has(m[k]));
    }

    // أسماء الطرف الآخر
    const names={};
    if(list.length){
      try{
        const key=isOut?'to_id':'from_id';
        const ids=[...new Set(list.map(m=>m[key]))];
        const pr=await sb.from('profiles').select('id,display_name').in('id',ids);
        (pr.data||[]).forEach(u=>{names[u.id]=u.display_name||'مصوّر'});
      }catch(e){}
    }

    const tabs=`<div class="dm-tabs">
        <button class="${!isOut?'on':''}" onclick="setDmTab('in')">📥 الوارد</button>
        <button class="${isOut?'on':''}" onclick="setDmTab('out')">📤 المرسلة</button>
      </div>`;

    if(!list.length){
      el.innerHTML=tabs+'<div class="empty" style="padding:22px"><span class="big">📭</span>'
        +(isOut?'ما أرسلت رسائل بعد':'ما وصلك رسائل')+'</div>';
      return;
    }
    const unreadN=list.filter(m=>!m.read_at).length;
    el.innerHTML=tabs+`<div class="msgs-bar">
        <span>${isOut?'المرسلة':'الوارد'} (${list.length})${(!isOut&&unreadN)?' · '+unreadN+' جديدة':''}</span>
        <button onclick="clearInbox()">🗑️ امسح الكل</button>
      </div>`+list.map(m=>{
      const other=isOut?m.to_id:m.from_id;
      const nm=names[other]||'مصوّر';
      const unread=!isOut&&!m.read_at;
      return `<div class="dm-card${unread?' unread':''}">
        <div class="dm-top">
          <span class="dm-from" onclick="openProfile('${other}')">${isOut?'إلى: ':''}${esc(nm)}</span>
          <span class="dm-time">${(timeAgo(m.created_at)||{}).txt||''}${isOut?(m.read_at?' · ✓✓ قرأها':' · ✓ أُرسلت'):''}</span>
        </div>
        <div class="dm-body">${esc(m.body)}</div>
        <div class="dm-acts">
          ${isOut?'':`<button onclick="openDmBox('${other}','${esc(nm)}')">↩️ رد</button>`}
          <button onclick="delDm(${m.id})">${(isOut&&!m.read_at)?'↩️ اسحبها':'🗑️ حذف'}</button>
          ${isOut?'':`<button onclick="reportDm(${m.id})">🚩 إبلاغ</button>
          <button onclick="blockUser('${other}','${esc(nm).replace(/'/g,"&#39;")}')">🚫 احظره</button>`}
        </div>
      </div>`;
    }).join('');

    // تعليم المقروء — الوارد فقط
    const un=isOut?[]:list.filter(m=>!m.read_at).map(m=>m.id);
    if(un.length){
      try{await sb.from('dm').update({read_at:new Date().toISOString()}).in('id',un)}catch(e){}
    }
  }catch(e){
    el.innerHTML='<div class="empty" style="padding:18px">تعذر تحميل الرسائل<br><span style="font-size:11px;direction:ltr;display:inline-block">'+esc((e&&e.message)||'')+'</span></div>';
  }
}

export async function delDm(id){
  const isOut=(state.dmTab==='out');
  try{
    const m=(await sb.from('dm').select('read_at,from_id,to_id').eq('id',id).maybeSingle()).data;
    if(!m){toast('الرسالة غير موجودة',true);return}

    // المرسل قبل القراءة → حذف كامل من الطرفين
    if(isOut&&!m.read_at){
      if(!confirm('سحب الرسالة؟\nما قرأها بعد — راح تختفي من عنده أيضاً.'))return;
      const {data,error}=await sb.from('dm').delete().eq('id',id).select('id');
      if(error){toast('تعذر السحب: '+error.message,true);return}
      if(!data||!data.length){toast('تعذر السحب — ربما قرأها الآن',true);renderInbox();return}
      toast('انسحبت الرسالة ✅');
    }else{
      // إخفاء من عندي فقط
      const msg=isOut
        ? 'حذف من سجلك؟\nقرأها الطرف الآخر — تبقى عنده.'
        : 'حذف الرسالة من صندوقك؟';
      if(!confirm(msg))return;
      const field=isOut?{del_from:true}:{del_to:true};
      const {error}=await sb.from('dm').update(field).eq('id',id);
      if(error){toast('تعذر الحذف: '+error.message,true);return}
      toast('انحذفت من عندك');
    }
    renderInbox();
    if(typeof dmUnreadCount==='function')dmUnreadCount();
  }catch(e){toast('تعذر الحذف',true)}
}

export async function reportDm(id){
  if(!confirm('إبلاغ الإدارة عن هذي الرسالة؟'))return;
  try{
    // معلومات كاملة عبر الدالة الآمنة
    let inf=null;
    try{
      const rr=await sb.rpc('dm_report_info',{mid:id});
      inf=rr.data;
    }catch(e){}

    // احتياطي لو أخفقت الدالة
    if(!inf){
      const m=(await sb.from('dm').select('body,from_id,created_at').eq('id',id).maybeSingle()).data;
      if(!m){toast('الرسالة غير موجودة',true);return}
      let nm='مصوّر';
      try{
        const pr=(await sb.from('profiles').select('display_name').eq('id',m.from_id).maybeSingle()).data;
        if(pr&&pr.display_name)nm=pr.display_name;
      }catch(e){}
      inf={uid:m.from_id,name:nm,email:'',body:m.body,created_at:m.created_at};
    }

    const when=new Date(inf.created_at).toLocaleDateString('ar-SA');
    // body = ما يراه المبلّغ · admin_note = ما تراه الإدارة وحدها
    await sb.from('feedback').insert({
      user_id:currentUser()?.id, kind:'other',
      body:'🚩 بلاغ عن رسالة خاصة وصلتني بتاريخ '+when,
      admin_note:'المرسِل: '+(inf.name||'مصوّر')+'\n'
        +(inf.email?('البريد: '+inf.email+'\n'):'')
        +'المعرّف: '+inf.uid+'\n'
        +'التاريخ: '+when+'\n\n'
        +'نص الرسالة:\n«'+(inf.body||'')+'»'
    });
    toast('✅ وصل بلاغك — تشوف رد الإدارة بـ«رسائلي»');
    /* إشعار للإدارة — to:'admins'
       الوظيفة smart-service تجلب المشرفين بنفسها بمفتاح الخدمة،
       فلم يعد المتصفح يحتاج قراءة جدول admins (كان مكشوفاً للجميع). */
    try{
      if(typeof pushNotify==='function'){
        pushNotify({
          title:'🚩 بلاغ جديد',
          body:'رسالة خاصة من '+(inf.name||'مصوّر'),
          url:'/',
          to:'admins'
        });
      }
    }catch(e){}
  }catch(e){toast('تعذر الإبلاغ: '+((e&&e.message)||''),true)}
}

/* عدّاد الرسائل غير المقروءة */

export async function dmUnreadCount(){
  try{
    if(isAnon())return 0;
    const r=await sb.from('dm').select('id',{count:'exact',head:true})
      .eq('to_id',currentUser()?.id).eq('del_to',false).is('read_at',null);
    const n=r.count||0;
    const b=$('dmBadge');
    if(b){
      b.textContent=n>9?'9+':String(n);
      b.style.display=n?'inline-flex':'none';
    }
    return n;
  }catch(e){return 0}
}

/* مفتاح استقبال الرسائل */

export async function toggleDmOpen(cb){
  if(isAnon())return;
  const v=!!cb.checked;
  const {error}=await sb.from('profiles').update({dm_open:v}).eq('id',currentUser()?.id);
  if(error){dbErr('حفظ التفضيل',error,'تعذر الحفظ');cb.checked=!v;return}
  toast(v?'صرت تستقبل الرسائل ✉️':'أقفلت الرسائل 🔕');
}

/* ====== البحث عن مصورين ====== */

export async function clearInbox(){
  const isOut=(state.dmTab==='out');
  if(!confirm('مسح كل الرسائل '+(isOut?'المرسلة':'الواردة')+' من سجلك؟'))return;
  const field=isOut?{del_from:true}:{del_to:true};
  const {error}=await sb.from('dm').update(field)
    .eq(isOut?'from_id':'to_id',currentUser()?.id)
    .eq(isOut?'del_from':'del_to',false);
  if(error){toast('تعذر المسح: '+error.message,true);return}
  toast('انمسح السجل ✅');
  renderInbox();
  if(typeof dmUnreadCount==='function')dmUnreadCount();
}

/* ====== نظام الحظر ====== */
state.myBlocks=new Set();


/* ═══ رسالة الزائر للإدارة ═══
   كانت هذه الدالة داخل js/admin/reports.js — أي داخل وحدة الإشراف
   الكسولة التي لا تُحمَّل إلا بضغط الترس. ونموذجها بصفحة «رسائلي»
   يستعمله كل زائر، فكان الزر يرمي «sendFeedback is not defined»
   لكل من لم يفتح لوحة الإشراف — أي لكل الناس إلا المالك.

   وأسوأ ما فيه أن فاحصنا كان يعرف أنها مفقودة ويستثنيها بالاسم
   ضمن «مؤجّلة للإشراف». والدرس: ما يقرّر أن الدالة إشرافية هو
   موضع زرّها بالصفحة، لا اسم الملف الذي وُضعت فيه. */
export async function sendFeedback(){
  const kind=$('fbKind').value,body=$('fbBody').value.trim();
  if(body.length<3)return toast('اكتب رسالتك أول',true);
  if(typeof checkText==='function'){
    const bad=checkText(body,{allowLink:true});
    if(bad){toast(bad,true);return}
  }
  if(typeof checkRate==='function'){
    const lim=await checkRate('message');
    if(lim){toast(lim,true);return}
  }
  const b=$('fbGo');b.disabled=true;b.textContent='⏳';
  const { error } = await sb.from('feedback').insert({user_id:currentUser()?.id,kind,body});
  b.disabled=false;b.textContent='إرسال 📨';
  if(error){toast('تعذر الإرسال: '+error.message,true);return}
  if(typeof logRate==='function')logRate('message');
  $('fbBody').value='';
  toast('وصلت رسالتك للإدارة، شكراً لك 🙏');

  /* ═══ إشعار الإدارة ═══
     كانت الدالة تُدرج الرسالة وتقول للمرسِل «وصلت» وتنتهي — والإدارة
     لا تعلم حتى تفتح اللوحة بنفسها. وطريقا البلاغ والردّ يُشعران،
     فكان الاقتراح وحده منسيّاً.
     to:'admins' تجعل وظيفة smart-service تجلب المشرفين بمفتاح الخدمة
     من طرف الخادم — فلا يحتاج الزائر قراءة جدول admins. */
  try{
    const KIND = {suggestion:'💡 اقتراح', complaint:'⚠️ شكوى',
                  question:'❓ استفسار', other:'📝 رسالة'};
    const nm = (await sb.from('profiles').select('display_name')
                 .eq('id', currentUser()?.id).maybeSingle()).data?.display_name || 'عضو';
    pushNotify({
      title: (KIND[kind] || '📨 رسالة') + ' جديد',
      body: nm + ': ' + body.slice(0, 90) + (body.length > 90 ? '…' : ''),
      url: '/',
      to: 'admins'
    });
  }catch(e){ console.warn('[رسالة] تعذّر إشعار الإدارة', e); }
}
