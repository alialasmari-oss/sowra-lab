/* صورة من بلدي — features/account.js
   الحساب والرسائل */

import { currentUser, isAnon, sb, session } from '../core/db.js';
import { checkText } from '../core/format.js';
import { need } from '../core/hub.js';
import { state } from '../core/state.js';
import { $, esc, prompt, toast } from '../core/ui.js';
import { geo, COORDS, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   loadFavs ← features/profile.js
   loadPhotos ← features/feed.js
   openAdmin ← admin/index.js
   pushNotify ← features/notify.js
   renderAccAvatar ← features/profile.js
   renderAccCover ← features/profile.js
*/
const loadFavs = need('loadFavs');
const loadPhotos = need('loadPhotos');
const openAdmin = need('openAdmin');
const pushNotify = need('pushNotify');
const renderAccAvatar = need('renderAccAvatar');
const renderAccCover = need('renderAccCover');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');


/* state.admPhotos → state.admPhotos */
export async function checkAdmin(){
  try{
    if(isAnon()){
      state.isAdmin=false;
      state.admRole='';
      try{localStorage.removeItem('sowra_admin')}catch(e){}
      const g=$('admGear');if(g)g.style.display='none';
      return false;
    }
    let data=null;
    try{
      const r=await sb.from('admins').select('id,role').eq('id',currentUser()?.id).maybeSingle();
      data=r.data;
    }catch(e){}
    // احتياطي: لو فشل عمود role
    if(!data){
      try{
        const r2=await sb.from('admins').select('id').eq('id',currentUser()?.id).maybeSingle();
        data=r2.data;
      }catch(e){}
    }
    state.isAdmin=!!data;
    state.admRole=(data&&data.role)||(data?'owner':'');

    // صفة المحرّر — مستقلة عن الإشراف
    try{
      const cu=(await sb.from('curators').select('id').eq('id',currentUser()?.id).maybeSingle()).data;
      state.isCurator=!!cu;
    }catch(e){state.isCurator=false}

    // المحرّر غير المشرف يدخل اللوحة لقسم الترشيحات فقط
    if(!state.isAdmin&&state.isCurator){
      const g=$('admGear');
      if(g)g.style.display='block';
    }
    try{state.isAdmin?localStorage.setItem('sowra_admin','1'):localStorage.removeItem('sowra_admin')}catch(e){}
    const g=$('admGear');if(g)g.style.display=state.isAdmin?'block':'none';
    return state.isAdmin;
  }catch(e){state.isAdmin=false;return false}
}

/* ============ الحساب الموحد ============ */

export let accMode='in';

export function openAcc(){
  if(currentUser() && !isAnon())renderAccIn();
  else{
    const o=$('accOut'),i=$('accIn');
    if(o)o.style.display='block';
    if(i)i.style.display='none';
  }
  go('acc');
}

export function accTab(m){
  accMode=m;
  const ti=$('accTabIn'),tu=$('accTabUp'),ng=$('accNameGrp'),pb=$('pledgeBox'),ag=$('accGo');
  if(ti)ti.classList.toggle('on',m==='in');
  if(tu)tu.classList.toggle('on',m==='up');
  if(ng)ng.style.display=m==='up'?'block':'none';
  if(pb)pb.style.display=m==='up'?'block':'none';
  if(ag)ag.textContent=m==='up'?'إنشاء الحساب':'دخول';
}

export async function renderAccIn(){
  try{
    let data=null;
    try{
      const r=await sb.from('profiles').select('display_name,bio,region').eq('id',currentUser()?.id).maybeSingle();
      data=r.data;
    }catch(e){}

    const hi=$('accHello');if(hi)hi.textContent='هلا '+((data&&data.display_name)||'مصوّر');
    const en=$('accEditName');if(en)en.value=(data&&data.display_name)||'';
    const rg=$('accRegion');if(rg)rg.value=(data&&data.region)||'';
    const bo=$('accBio');if(bo)bo.value=(data&&data.bio)||'';
    const ml=$('accMail');if(ml)ml.textContent=currentUser()?.email||'';
    const ab=$('accAdminBtn');if(ab)ab.style.display=state.isAdmin?'block':'none';

    const o=$('accOut'),i=$('accIn');
    if(o)o.style.display='none';
    if(i)i.style.display='block';

    // إضافات اختيارية — لا توقف الصفحة إن أخفقت
    try{if(typeof renderAccAvatar==='function')renderAccAvatar()}catch(e){}
    try{if(typeof renderAccCover==='function')renderAccCover()}catch(e){}
  }catch(e){
    console.warn('renderAccIn',e);
    const o=$('accOut'),i=$('accIn');
    if(o)o.style.display='none';
    if(i)i.style.display='block';
  }
}

export async function saveMyName(){
  const en=$('accEditName');
  const name=en?en.value.trim():'';
  if(!name)return toast('اكتب اسم',true);
  const upd={display_name:name};
  const rg=$('accRegion');if(rg)upd.region=rg.value.trim();
  const bo=$('accBio');if(bo)upd.bio=bo.value.trim();
  const { error } = await sb.from('profiles').update(upd).eq('id',currentUser()?.id);
  if(error){toast('تعذر الحفظ',true);return}
  const hi=$('accHello');if(hi)hi.textContent='هلا '+name;
  toast('انحفظت بياناتك ✅');
  try{await loadPhotos()}catch(e){}
}

export async function accSubmit(){
  const em=$('accEmail'),pw=$('accPass');
  const email=em?em.value.trim():'', pass=pw?pw.value:'';
  if(!email||!pass)return toast('عبّي الإيميل وكلمة السر',true);

  const b=$('accGo');
  const old=b?b.textContent:'دخول';
  if(b){b.disabled=true;b.textContent='⏳'}

  try{
    if(accMode==='up'){
      const nm=$('accName');
      const name=nm?nm.value.trim():'';
      if(!name){toast('اكتب اسمك',true);return}
      const pc=$('pledgeChk');
      if(pc&&!pc.checked){toast('لازم توافق على الشروط والتعهد أول ✋',true);return}
      const { data, error } = await sb.auth.signUp({
        email,password:pass,options:{data:{display_name:name}}
      });
      if(error)throw error;
      if(!data.session){toast('أُرسل رابط تأكيد لإيميلك 📧');return}
      session.user = data.session.user;
    }else{
      const { data, error } = await sb.auth.signInWithPassword({email,password:pass});
      if(error)throw error;
      /* ⚠️ كان هنا:  const { data:{ session } } = ...
         الاسم session يحجب الكائن المشترك المستورد من core/db.js،
         فتُكتب الجلسة على المتغير المحلي ويبقى المشترك على المستخدم
         المجهول — فيرى checkAdmin مستخدماً مجهولاً ولا يظهر الترس.
         نسمّي المحلي s حتى يصل التحديث للكائن المشترك فعلاً. */
      const { data:{ session: s } } = await sb.auth.getSession();
      session.user = (s&&s.user)||(data&&data.user);
      if(!currentUser())throw new Error('تعذر قراءة الجلسة');
    }

    // كل ما بعد الدخول محصّن — لا يمنع اكتمال العملية
    try{await checkAdmin()}catch(e){}
    try{await renderAccIn()}catch(e){}
    toast(state.isAdmin?'أهلاً بالمشرف 👮':'حياك الله 🌟');
    try{if(state.isAdmin&&typeof openAdmin==='function')openAdmin()}catch(e){}
    try{await loadPhotos()}catch(e){}
    try{if(typeof loadFavs==='function')loadFavs()}catch(e){}
  }catch(e){
    const msg=(e&&e.message)||'';
    toast(msg.includes('Invalid')?'بيانات الدخول غير صحيحة':(msg||'تعذرت العملية'),true);
  }finally{
    if(b){b.disabled=false;b.textContent=old}
  }
}

export async function accLogout(){
  try{await sb.auth.signOut()}catch(e){}
  try{localStorage.removeItem('sowra_admin')}catch(e){}
  location.reload();
}

export async function admLogout(){await accLogout()}

/* ====== رسائلي ====== */

export function openMsgs(){
  go('msgs');
  loadMyMsgs();
}

export async function loadMyMsgs(){
  const el=$('myMsgs');if(!el)return;
  if(!currentUser()){el.innerHTML='';return}
  el.innerHTML='<div style="text-align:center;color:var(--txt-dim);padding:8px">⏳</div>';
  try{
    const r=await sb.from('feedback').select('*').eq('user_id',currentUser()?.id).order('created_at',{ascending:false});
    const list=r.data||[];
    const done=list.filter(m=>m.status!=='new').length;
    el.innerHTML=(list.length?`<div class="msgs-bar">
        <span>سجل رسائلك (${list.length})</span>
        ${done?`<button onclick="clearMyMsgs()">🗑️ امسح المنتهية (${done})</button>`:''}
      </div>`:'')
      +(list.map(m=>`
      <div class="msg-card">
        <div class="mk">
          <span>${(typeof FB_AR!=='undefined'&&FB_AR[m.kind])||m.kind} · ${new Date(m.created_at).toLocaleDateString('ar-SA')}</span>
          <span class="msg-st ${m.status==='new'?'new':'done'}">${
            /^(🚫|✅ تم رفع)/.test(m.body||'') ? '📢 قرار إداري'
            : (m.status==='new'?'⏳ قيد المراجعة':'✅ تمت المعالجة')
          }</span>
        </div>
        <div class="mb">${esc(m.body)}</div>
        ${m.reply?`<div class="msg-reply"><b>رد الإدارة:</b><br>${esc(m.reply)}</div>`:''}
        <div class="msg-acts">
          <button class="msg-reply-btn" onclick="replyToAdmin(${m.id})">↩️ رد على الإدارة</button>
          ${m.status==='new'
            ?'<span class="msg-lock">🔒 قيد المراجعة</span>'
            :`<button class="msg-del" onclick="delMyMsg(${m.id})">🗑️ حذف</button>`}
        </div>
      </div>`).join('')||'<div class="empty" style="padding:18px">ما أرسلت رسائل بعد</div>');
  }catch(e){
    el.innerHTML='<div class="empty" style="padding:14px">تعذر تحميل السجل</div>';
  }
}

export async function signInWithGoogle(){
  try{
    /* origin وحده يسقط المسار: بـsowra-lab يصير
       https://alialasmari-oss.github.io بدل .../sowra-lab/ — ولأنه غير
       مُدرج بقائمة Redirect URLs يتجاهله Supabase ويرجع لـSite URL
       (sowra.app)، فينتهي المستخدم بموقع آخر كلياً.
       إضافة pathname تُبقينا بنفس النشر — وعلى sowra.app النتيجة ذاتها. */
    const{error}=await sb.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:window.location.origin+window.location.pathname}
    });
    if(error)toast('تعذر الدخول بـGoogle: '+error.message,true);
  }catch(e){toast('تعذر الدخول بـGoogle',true)}
}

export function initGoogleBtn(){
  const wrap=$('googleBtnWrap');if(!wrap)return;
  const sp=state.banner;
  wrap.style.display=(sp&&sp.google_login)?'block':'none';
}

/* ====== حذف رسائلي ====== */

export async function delMyMsg(id){
  if(!confirm('حذف هذي الرسالة من سجلك؟'))return;
  const {data,error}=await sb.from('feedback').delete().eq('id',id).eq('user_id',currentUser()?.id).select('id');
  if(error){toast('تعذر الحذف: '+error.message,true);return}
  if(!data||!data.length){toast('ما تنحذف وهي قيد المراجعة 🔒',true);return}
  toast('انحذفت');
  loadMyMsgs();
}

export async function clearMyMsgs(){
  if(!confirm('مسح كل الرسائل المنتهية من سجلك؟\nالرسائل قيد المراجعة تبقى.'))return;
  const {error}=await sb.from('feedback').delete()
    .eq('user_id',currentUser()?.id).neq('status','new');
  if(error){toast('تعذر المسح: '+error.message,true);return}
  toast('انمسح السجل ✅');
  loadMyMsgs();
}

/* ====== الرد على الإدارة ====== */

export async function replyToAdmin(refId){
  const t=prompt('اكتب ردك للإدارة:');
  if(t===null)return;
  const body=(t||'').trim();
  if(body.length<5){toast('اكتب رسالة أوضح',true);return}
  if(body.length>600){toast('الحد ٦٠٠ حرف',true);return}

  if(typeof checkText==='function'){
    const bad=checkText(body);
    if(bad){toast(bad,true);return}
  }

  try{
    const {error}=await sb.from('feedback').insert({
      user_id:currentUser()?.id,
      kind:'other',
      body:'↩️ رد على رسالة سابقة (#'+refId+')\n\n'+body,
      status:'new'
    });
    if(error)throw error;

    /* إشعار للإدارة — to:'admins' (المتصفح لم يعد يقرأ جدول admins) */
    try{
      if(typeof pushNotify==='function'){
        pushNotify({
          title:'💬 رد من عضو',
          body:body.slice(0,80),
          url:'/',
          to:'admins'
        });
      }
    }catch(e){}

    toast('✅ وصل ردك — الإدارة تراجعه');
    loadMyMsgs();
  }catch(e){
    toast('تعذر الإرسال: '+((e&&e.message)||''),true);
  }
}
