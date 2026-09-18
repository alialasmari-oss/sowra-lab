/* صورة من بلدي — admin/reports.js
   البلاغات والرسائل والإخفاء */

import { currentUser, sb } from '../core/db.js';
import { checkText } from '../core/format.js';
import { need } from '../core/hub.js';
import { allPaths } from '../core/media.js';
import { isOwner, state } from '../core/state.js';
import { $, dbErr, esc, prompt, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   checkRate ← features/limits.js
   loadPhotos ← features/feed.js
   logRate ← features/limits.js
   needEditor ← admin/team.js
   needOwner ← admin/team.js
   openAdmin ← admin/index.js
   pushNotify ← features/notify.js
*/
const checkRate = need('checkRate');
const loadPhotos = need('loadPhotos');
const logRate = need('logRate');
const needEditor = need('needEditor');
const needOwner = need('needOwner');
const openAdmin = need('openAdmin');
const pushNotify = need('pushNotify');

export async function loadFb(){
  $('admFb').innerHTML='<div class="empty">⏳</div>';
  const { data, error } = await sb.from('feedback').select('*, profiles!user_id(display_name)').order('created_at',{ascending:false});
  // حالة المنع لكل معرّف مذكور بالبلاغات
  state.dmBanMap={};
  try{
    const uids=[...new Set((data||[]).map(f=>_dmUid(f.admin_note)).filter(Boolean))];
    if(uids.length){
      const pr=await sb.from('profiles').select('id,dm_banned').in('id',uids);
      (pr.data||[]).forEach(u=>{state.dmBanMap[u.id]=!!u.dm_banned});
    }
  }catch(e){}
  if(error){$('admFb').innerHTML=`<div class="empty">⚠️ ${error.message}</div>`;return}
  if(!data.length){$('admFb').innerHTML='<div class="empty">📭 ما فيه رسائل بعد</div>';return}
  const newN=data.filter(f=>f.status==='new').length;
  const doneN=data.length-newN;
  $('admFb').innerHTML=`<div class="fb-bar">
      <span>📨 ${data.length} رسالة${newN?' · <b>'+newN+' جديدة</b>':''}</span>
      ${(doneN&&isOwner())?`<button onclick="fbClearDone(${doneN})">🗑️ امسح المنتهية (${doneN})</button>`:''}
    </div>`+data.map(f=>`
    <div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px;margin-bottom:10px;${f.status==='done'?'opacity:.55':''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:10px;background:var(--card2);border:1px solid var(--line)">${FB_AR[f.kind]||f.kind}</span>
        <span style="font-size:11px;color:var(--txt-dim)">${esc(f.profiles?.display_name||'زائر')} · ${new Date(f.created_at).toLocaleDateString('ar-SA')}</span>
      </div>
      <div style="font-size:14px;line-height:1.8;margin-bottom:${f.admin_note?'8px':'10px'}">${esc(f.body)}</div>
      ${f.admin_note?`<div style="background:var(--card2);border:1px solid var(--star);border-radius:11px;padding:10px 12px;margin-bottom:10px;font-size:12.5px;line-height:1.9;white-space:pre-wrap;color:var(--txt-dim)"><b style="color:var(--star);display:block;margin-bottom:5px">🔒 تفاصيل للإدارة</b>${esc(f.admin_note)}${_dmUid(f.admin_note)?(
            (state.dmBanMap&&state.dmBanMap[_dmUid(f.admin_note)])
              ? `<button class="fb-ban ok" onclick="admDmBan('${_dmUid(f.admin_note)}',false)">✅ ارفع منع المراسلة</button>`
              : `<button class="fb-ban" onclick="admDmBan('${_dmUid(f.admin_note)}',true)">🚫 امنعه من المراسلة</button>`
          ):''}</div>`:''}
      <div style="display:flex;gap:8px">
        ${f.status==='new'
          ?`<button class="btn" style="font-size:12px;padding:7px 14px;background:var(--qblue)" onclick="fbReply(${f.id})">💬 رد</button>
           <button class="btn" style="font-size:12px;padding:7px 14px;background:var(--palm)" onclick="fbDone(${f.id})">✓ تم التعامل</button>`
          :`<span style="font-size:12px;color:var(--palm);font-weight:700;padding:7px 0">✓ منتهية</span>`}
        <button class="btn" style="font-size:12px;padding:7px 14px;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="fbDel(${f.id})">🗑️ حذف</button>
      </div>
    </div>`).join('');
}

export async function fbReply(id){
  const t=prompt('اكتب رد الإدارة على الرسالة:');
  if(t===null||!t.trim())return;
  const {error}=await sb.from('feedback').update({reply:t.trim(),status:'done'}).eq('id',id);
  if(error){toast('فشل الرد: '+error.message,true);return}
  // إشعار لصاحب الرسالة
  try{
    const fb=(await sb.from('feedback').select('user_id').eq('id',id).maybeSingle()).data;
    if(fb&&fb.user_id){
      pushNotify({
        title:'💬 رد من الإدارة',
        body:t.trim().slice(0,90),
        url:'/',
        user_ids:[fb.user_id]
      });
    }
  }catch(e){}
  toast('انرسل الرد 💬');loadFb();
}

export async function fbDone(id){
  const { error } = await sb.from('feedback').update({status:'done'}).eq('id',id);
  if(error){dbErr('تعليم الرسالة',error);return}
  loadFb();
}

export async function fbDel(id){
  if(!confirm('حذف الرسالة نهائياً؟'))return;
  const { error } = await sb.from('feedback').delete().eq('id',id);
  if(error){dbErr('حذف الرسالة',error);return}
  loadFb();
}

export async function fbClearDone(n){
  if(!needOwner('المسح الجماعي'))return;
  if(!confirm('مسح '+n+' رسالة منتهية؟\n\nالرسائل الجديدة تبقى — والمسح نهائي.'))return;
  if(!confirm('تأكيد أخير: هذا الإجراء لا يمكن التراجع عنه.'))return;

  // نجلب المعرّفات أولاً ثم نحذفها — أوثق من neq
  const q=await sb.from('feedback').select('id').eq('status','done');
  if(q.error){toast('تعذر القراءة: '+q.error.message,true);return}
  const ids=(q.data||[]).map(x=>x.id);
  if(!ids.length){toast('ما فيه رسائل منتهية',true);return}
  const {data,error}=await sb.from('feedback').delete().in('id',ids).select('id');
  if(error){toast('تعذر المسح: '+(error.message||error.code||''),true);return}
  const n2=(data||[]).length;
  if(!n2){toast('ما انمسح شيء — تحقق من صلاحيات الحذف',true);return}
  toast('انمسحت '+n2+' رسالة ✅');
  loadFb();
}

/* ====== منع من المراسلة (إداري) ====== */

export const KIND_AR={city:'مدينة',village:'قرية',landmark:'معلم'};
/* ====== مراسلة الإدارة ====== */

export const FB_AR={suggestion:'💡 اقتراح',complaint:'⚠️ شكوى',question:'❓ استفسار',other:'📝 أخرى'};

export async function admHide(id,hide){
  const { error } = await sb.from('photos').update({hidden:hide}).eq('id',id);
  if(error){toast('فشلت العملية: '+(error.message||error.code||''),true);return}
  toast(hide?'أُخفيت الصورة':'أُظهرت الصورة');
  await openAdmin();await loadPhotos();
}

export async function admDel(id,path){
  if(!needOwner('حذف الصور نهائياً'))return;
  if(!confirm('حذف نهائي؟ لا يمكن التراجع.'))return;
  const it=(state.admPhotos||[]).find(x=>x.id===id)||state.photos.find(x=>x.id===id);
  const isVid=it&&it.media_type==='video';
  const { error } = await sb.from('photos').delete().eq('id',id);
  if(error){dbErr('حذف البلاغ',error);return}
  try{
    if(isVid) await sb.storage.from('videos').remove([path]);
    else await sb.storage.from('photos').remove(allPaths(path));   /* المصغّرة والأرشيف معاً */
  }catch(e){}
  toast(isVid?'حُذف الفيديو نهائياً':'حُذفت الصورة نهائياً');
  await openAdmin();await loadPhotos();
}

export async function admBan(uid,ban){
  if(!needOwner('حظر المستخدمين'))return;
  if(ban&&!confirm('حظر المصور؟ لن يستطيع النشر أو التعليق.'))return;
  const { error } = await sb.from('profiles').update({banned:ban}).eq('id',uid);
  if(error){dbErr('الحظر',error);return}
  toast(ban?'تم حظر المصور ⛔':'فُك الحظر');
  await openAdmin();
}

export async function admClearBadges(pid){
  const pick=prompt(
'مسح أوسمة الصورة #'+pid+' — اكتب الرقم:\n\n'+
'0 = الكل (تصفير شامل)\n'+
'1 = 📱 تصلح خلفية شاشة\n'+
'2 = ❤️ بحطها خلفية جوالي\n'+
'3 = 🌍 مسابقات عالمية\n'+
'4 = 🇸🇦 واجهة تشرّف السعودية\n'+
'5 = 🖼️ تستاهل تنطبع لوحة','0');
  if(pick===null)return;
  const keys={1:'wall',2:'mine',3:'global',4:'face',5:'print'};
  let q=sb.from('badge_votes').delete().eq('photo_id',pid);
  const k=keys[pick.trim()];
  if(pick.trim()!=='0'&&!k){toast('اكتب رقماً من 0 إلى 5',true);return}
  if(k)q=q.eq('badge_key',k);
  const {error}=await q;
  if(error){toast('فشل المسح: '+error.message,true);return}
  toast(k?'انمسح الوسام المحدد 🗳️':'انصفرت كل أوسمة الصورة 🗳️');
  await loadPhotos();openAdmin();
}

/* ====== وضع الصيانة ====== */

export function _dmUid(note){
  const m=String(note||'').match(/المعرّف:\s*([0-9a-f-]{36})/i);
  return m?m[1]:'';
}

export async function admDmBan(uid,ban){
  if(!needEditor('منع المراسلة'))return;
  if(typeof ban==='undefined')ban=true;

  let reason='';
  if(ban){
    reason=prompt('سبب المنع (يصل العضو):','إساءة استخدام الرسائل الخاصة');
    if(reason===null)return;
    reason=(reason||'').trim()||'إساءة استخدام الرسائل الخاصة';
  }else{
    if(!confirm('رفع المنع عن هذا العضو؟'))return;
  }

  const {error}=await sb.from('profiles').update({dm_banned:ban}).eq('id',uid);
  if(error){toast('تعذرت العملية: '+error.message,true);return}
  if(state.dmBanMap)state.dmBanMap[uid]=ban;

  await notifyDmBan(uid,ban,reason);
  toast(ban?'🚫 انمنع — وانبلّغ بالسبب':'✅ انرفع المنع — وانبلّغ');
  loadFb();
}

/* إبلاغ العضو بقرار المنع أو رفعه */

export async function notifyDmBan(uid,ban,reason){
  try{
    const body=ban
      ? '🚫 تم إيقاف إرسالك للرسائل الخاصة\n\n'
        +'السبب: '+reason+'\n\n'
        +'حسابك يعمل طبيعياً — تنشر وتعلّق وتقيّم كالعادة، لكن إرسال الرسائل الخاصة موقوف.\n\n'
        +'لو ترى أن القرار غير صحيح، اضغط «↩️ رد على الإدارة» تحت هذي الرسالة وراح نراجعه.'
      : '✅ تم رفع إيقاف الرسائل عن حسابك\n\n'
        +'تقدر ترسل رسائل خاصة من جديد — نرجو الالتزام بآداب التواصل.';

    await sb.from('feedback').insert({
      user_id:uid,
      kind:'other',
      body:body,
      reply:'',
      status:'done'
    });

    if(typeof pushNotify==='function'){
      pushNotify({
        title: ban?'🚫 إيقاف الرسائل الخاصة':'✅ رُفع إيقاف الرسائل',
        body: ban?('السبب: '+reason):'تقدر ترسل رسائل من جديد',
        url:'/',
        user_ids:[uid]
      });
    }
  }catch(e){}
}

/* ═══════════════════════════════════════════
   اختيار المحررين — Editors' Choice
   ═══════════════════════════════════════════ */
