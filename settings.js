/* صورة من بلدي — admin/settings.js
   المفاتيح والصيانة */

import { sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { compressTo } from '../core/media.js';
import { isOwner, reelsState, state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   initVideoUpload ← features/reels.js
   listBucketAll ← admin/misc.js
   loadAdmWeek ← admin/index.js
   loadPhotos ← features/feed.js
   loadSponsor ← features/contest.js
   needOwner ← admin/team.js
   pushNotify ← features/notify.js
*/
const initVideoUpload = need('initVideoUpload');
const listBucketAll = need('listBucketAll');
const loadAdmWeek = need('loadAdmWeek');
const loadPhotos = need('loadPhotos');
const loadSponsor = need('loadSponsor');
const needOwner = need('needOwner');
const pushNotify = need('pushNotify');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');
export function admGoogleLoginBlock(){
  const b=state.banner;
  const on=!!b.google_login;
  return `<div style="background:var(--card);border:1.5px solid ${on?'var(--qblue)':'var(--line)'};border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">🔵 تسجيل الدخول بـ Google <span style="font-size:11px;font-weight:700;color:${on?'var(--qblue)':'var(--txt-dim)'}">${on?'● مفعّل للجميع':'○ مطفأ'}</span></div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px">يظهر زر Google لكل الزوار في صفحة الحساب.</div>
    <button class="btn" style="width:100%;${on?'background:var(--sadu)':'background:var(--qblue)'}" onclick="admGoogleToggle()">${on?'🙈 إخفاء الزر':'👁️ إظهار زر Google'}</button>
  </div>`;
}

export async function admGoogleToggle(){
  if(!needOwner('مفاتيح الدخول'))return;
  const b=state.banner;
  const {error}=await sb.from('site_banner').update({google_login:!b.google_login}).eq('id',1);
  if(error){toast('فشلت العملية: '+error.message,true);return}
  toast(!b.google_login?'زر Google ظاهر للجميع 🔵':'اختفى الزر');
  await loadSponsor();await loadAdmWeek();
}

export function admMaintBlock(){
  const b=state.banner;
  const on=!!b.maintenance;
  return `
  <div style="background:var(--card);border:1.5px solid ${on?'var(--star)':'var(--line)'};border-radius:14px;padding:14px;margin-top:16px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">🚧 وضع الصيانة (تحت الإنشاء) ${on?'<span style="font-size:11px;color:#A87500;font-weight:700">● مفعل — الزوار محجوبون</span>':'<span style="font-size:11px;color:var(--txt-dim)">○ مطفأ</span>'}</div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px;line-height:1.8">عند التفعيل: الزوار يشوفون صفحة «تحت التطوير» — وأنت كمشرف تتصفح وتشتغل عادي.</div>
    <input id="mtMsg" placeholder="رسالة اختيارية للزوار (مثال: نرجع لكم الساعة 9)" value="${esc(b.maintenance_msg||'')}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:10px">
    <div style="display:flex;gap:8px">
      <button class="btn" style="flex:1;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="admMaintSaveMsg()">💾 حفظ الرسالة</button>
      <button class="btn" style="flex:1;${on?'background:var(--palm)':'background:var(--star);color:var(--ink)'}" onclick="admMaintToggle()">${on?'▶️ إعادة فتح الموقع':'🚧 تفعيل الصيانة'}</button>
    </div>
  </div>`;
}

export async function admMaintToggle(){
  if(!needOwner('ستارة الصيانة'))return;
  const b=state.banner;
  const to=!b.maintenance;
  if(to&&!confirm('تفعيل وضع الصيانة؟ كل الزوار (عدا المشرفين) بيشوفون صفحة تحت التطوير.'))return;
  const {error}=await sb.from('site_banner').update({maintenance:to,maintenance_msg:$('mtMsg').value.trim()}).eq('id',1);
  if(error){toast('فشلت العملية: '+error.message,true);return}
  toast(to?'الموقع دخل وضع الصيانة 🚧':'الموقع رجع مفتوحاً للجميع 🎉');
  await loadAdmWeek();
}

export async function admMaintSaveMsg(){
  const {error}=await sb.from('site_banner').update({maintenance_msg:$('mtMsg').value.trim()}).eq('id',1);
  if(error){toast('فشل الحفظ',true);return}
  toast('انحفظت الرسالة ✅');
}

/* ====== تحدي الأسبوع ====== */

export function admReelsBlock(){
  if(!isOwner())return '';
  const st=reelsState();
  const cfg={
    off:  {c:'var(--line)',  t:'○ مطفأة',  d:'التبويب مخفي · لا رفع للمقاطع'},
    soon: {c:'var(--star)',  t:'◐ قريباً', d:'شاشة تشويق · لا رفع للمقاطع'},
    open: {c:'var(--palm)',  t:'● مفتوحة', d:'تعمل كاملة · الرفع متاح'}
  }[st];

  return `<div style="background:var(--card);border:1.5px solid ${cfg.c};border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:3px">🎬 أضواء الديرة <span style="font-size:11px;color:${cfg.c}">${cfg.t}</span></div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:12px;line-height:1.85">${cfg.d}</div>
    <div class="rs-states">
      <button class="rs-st ${st==='off'?'on':''}" onclick="admSetReels('off')">
        <b>○ مطفأة</b><span>التبويب مخفي تماماً</span>
      </button>
      <button class="rs-st ${st==='soon'?'on soon':''}" onclick="admSetReels('soon')">
        <b>◐ قريباً</b><span>شاشة تشويق تبني التوقع</span>
      </button>
      <button class="rs-st ${st==='open'?'on open':''}" onclick="admSetReels('open')">
        <b>● مفتوحة</b><span>الرفع والعرض يعملان</span>
      </button>
    </div>
    <div style="font-size:10.5px;color:var(--txt-dim);margin-top:9px;line-height:1.75">
      ⚠️ المقطع الواحد يعادل ١٦ صورة نقلاً — راقب الحصة إن فتحتها.
    </div>
  </div>`;
}

export async function admSetReels(reelsMode){
  if(!needOwner('أضواء الديرة'))return;
  const vals={
    off:  {video_enabled:false, reels_soon:false},
    soon: {video_enabled:false, reels_soon:true},
    open: {video_enabled:true,  reels_soon:false}
  }[reelsMode];
  if(!vals)return;

  const {error}=await sb.from('site_banner').update(vals).eq('id',1);
  if(error){toast('تعذرت العملية: '+error.message,true);return}

  ['banner','__SPB'].forEach(function(k){
    if(window[k]){window[k].video_enabled=vals.video_enabled;window[k].reels_soon=vals.reels_soon}
  });

  const msg={off:'انطفأت الأضواء',soon:'◐ وضع «قريباً» مفعّل',open:'🎬 الأضواء مفتوحة للجميع'}[reelsMode];
  toast(msg);
  try{if(typeof initVideoUpload==='function')initVideoUpload()}catch(e){}
  // لو كنا بصفحة الأضواء وانطفأت — نرجع للرئيسية
  try{
    if(reelsMode==='off'){
      const cur=document.querySelector('.page.on');
      if(cur&&cur.id==='page-reels')go('feed');
    }
  }catch(e){}
  loadAdmWeek();
}

export function admInspectBlock(){
  const b=state.banner;
  const on=!!b.inspect_enabled;
  return `<div style="background:var(--card);border:1.5px solid ${on?'var(--qteal)':'var(--line)'};border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">🤖 الفاحص الذكي <span style="font-size:11px;font-weight:700;color:${on?'var(--qteal)':'var(--txt-dim)'}">${on?'● مفعّل':'○ مطفأ'}</span></div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px;line-height:1.8">يفحص كل صورة قبل النشر: يمنع المخالف، وينبّه على الوجوه ولوحات المركبات، ويقترح التصنيف. التكلفة ~$0.1 لكل 1000 صورة.</div>
    <button class="btn" style="width:100%;${on?'background:var(--sadu)':'background:var(--qteal)'}" onclick="admInspectToggle()">${on?'🙈 إيقاف الفاحص':'▶️ تفعيل الفاحص'}</button>
  </div>`;
}

export async function admInspectToggle(){
  if(!needOwner('الفاحص الذكي'))return;
  const b=state.banner;
  const {error}=await sb.from('site_banner').update({inspect_enabled:!b.inspect_enabled}).eq('id',1);
  if(error){toast('فشلت العملية: '+error.message,true);return}
  toast(!b.inspect_enabled?'الفاحص الذكي مفعّل 🤖':'اتوقف الفاحص');
  await loadSponsor();await loadAdmWeek();
}

/* أفكار تحديات جاهزة */

export function admCommBlock(){
  const b=state.banner;
  const on=!!b.commercial_enabled;
  return `<div style="background:var(--card);border:1.5px solid ${on?'var(--palm)':'var(--line)'};border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">💼 الاستخدام التجاري <span style="font-size:11px;font-weight:700;color:${on?'var(--palm)':'var(--txt-dim)'}">${on?'● مفعّل':'○ مطفأ'}</span></div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px;line-height:1.8">يظهر للمصور خيار الموافقة على عرض صورته للجهات. فعّله حين تجهز لاستقبال الطلبات.</div>
    <button class="btn" style="width:100%;${on?'background:var(--sadu)':'background:var(--palm)'}" onclick="admCommToggle()">${on?'🙈 إخفاء الخيار':'▶️ تفعيل الخيار'}</button>
  </div>`;
}

export async function admCommToggle(){
  if(!needOwner('الاستخدام التجاري'))return;
  const b=state.banner;
  const {error}=await sb.from('site_banner').update({commercial_enabled:!b.commercial_enabled}).eq('id',1);
  if(error){toast('فشلت العملية: '+error.message,true);return}
  toast(!b.commercial_enabled?'ظهر خيار الاستخدام التجاري 💼':'اختفى الخيار');
  await loadSponsor();await loadAdmWeek();
}

/* ====== الفاحص الذكي ====== */
