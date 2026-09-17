/* صورة من بلدي — admin/contest.js
   المسابقة والراعي والتحدي */

import { sb } from '../core/db.js';
import { get, need } from '../core/hub.js';
import { compressTo, imgUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';
const _CW_ = () => get('CW');

/* ═══ عبر الحاجز ═══
   loadAdmWeek ← admin/index.js
   loadChallenge ← features/contest.js
   loadSponsor ← features/contest.js
   loadWeek ← features/contest.js
   needEditor ← admin/team.js
*/
const loadAdmWeek = need('loadAdmWeek');
const loadChallenge = need('loadChallenge');
const loadSponsor = need('loadSponsor');
const loadWeek = need('loadWeek');
const needEditor = need('needEditor');

export async function admSpBlock(){
  const r=await sb.from('site_banner').select('*').eq('id',1).maybeSingle();
  const b=r.data||{active:false,image_path:'',link_url:''};
  state.banner=b;
  return `
  <div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-top:16px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">📣 بنر الراعي (رأس الصفحة) ${b.active?'<span style="font-size:11px;color:var(--palm);font-weight:700">● ظاهر</span>':'<span style="font-size:11px;color:var(--txt-dim)">○ مخفي</span>'}</div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px;line-height:1.8">📐 مقاس التصميم: <b>1600 × 400 بكسل</b> (نسبة 4:1) · JPG أو PNG · يفضل أقل من 300KB</div>
    ${b.image_path?`<img src="${imgUrl(b.image_path)}" style="width:100%;aspect-ratio:4/1;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:10px">`:''}
    <input id="spName" placeholder="اسم الراعي (مثال: متجر عدسة)" value="${esc(b.sponsor_name||'')}"/>
    <input id="spCat" placeholder="النشاط (مثال: معدات تصوير)" value="${esc(b.sponsor_cat||'')}"/>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input id="spLat" placeholder="خط العرض (اختياري)" type="number" step="any" value="${b.sponsor_lat||''}" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;direction:ltr">
      <input id="spLng" placeholder="خط الطول (اختياري)" type="number" step="any" value="${b.sponsor_lng||''}" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;direction:ltr">
    </div>
    <textarea id="spDeal" placeholder="عرض الراعي (اختياري — مثال: خصم 15% على معدات التصوير)" rows="2" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;resize:none;margin-bottom:8px">${esc(b.sponsor_deal||'')}</textarea>
    <input id="spCode" placeholder="كود الخصم (اختياري — مثال: SOWRA15)" value="${esc(b.sponsor_code||'')}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px;direction:ltr;text-align:left;letter-spacing:1px">
    <input id="spLink" placeholder="رابط الراعي عند الضغط (اختياري)" value="${esc(b.link_url)}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:10px;direction:ltr;text-align:left">
    <input type="file" id="spFile" accept="image/*" style="display:none" onchange="admSpUpload(this.files[0])">
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" style="flex:1" onclick="$('spFile').click()">📤 ${b.image_path?'تغيير الصورة':'رفع صورة البنر'}</button>
      <button class="btn" style="flex:1;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="admSpSaveLink()">💾 حفظ الرابط</button>
      ${b.image_path?`<button class="btn" style="flex:1;${b.active?'background:var(--card2);border:1px solid var(--line);color:var(--txt)':'background:var(--palm)'}" onclick="admSpToggle()">${b.active?'🙈 إخفاء':'👁️ تفعيل'}</button>`:''}
      ${b.image_path?`<button class="btn" style="flex:0 0 auto;background:var(--sadu)" onclick="admSpDelete()">🗑️ حذف</button>`:''}
    </div>
  </div>`;
}

export async function admSpUpload(f){
  if(!f)return;
  toast('⏳ جاري رفع البنر...');
  const blob=await compressTo(f,1600,0.88);
  const path=`banners/sponsor_${Date.now()}.jpg`;
  const up=await sb.storage.from('photos').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});
  if(up.error){toast('فشل الرفع: '+up.error.message,true);return}
  const {error}=await sb.from('site_banner').update({image_path:path,sponsor_name:$('spName').value.trim(),sponsor_cat:$('spCat').value.trim(),sponsor_lat:parseFloat($('spLat').value)||null,sponsor_lng:parseFloat($('spLng').value)||null,sponsor_deal:$('spDeal').value.trim(),sponsor_code:$('spCode').value.trim(),updated_at:new Date().toISOString()}).eq('id',1);
  if(error){toast('فشل الحفظ',true);return}
  toast('ارتفع البنر ✅ — فعّله متى ما جهزت');
  await loadAdmWeek();loadSponsor();
}

export async function admSpSaveLink(){
  const {error}=await sb.from('site_banner').update({link_url:$('spLink').value.trim(),sponsor_name:$('spName').value.trim(),sponsor_cat:$('spCat').value.trim(),sponsor_lat:parseFloat($('spLat').value)||null,sponsor_lng:parseFloat($('spLng').value)||null,sponsor_deal:$('spDeal').value.trim(),sponsor_code:$('spCode').value.trim()}).eq('id',1);
  if(error){toast('فشل الحفظ',true);return}
  toast('انحفظ الرابط ✅');loadSponsor();
}

export async function admSpToggle(){
  if(!needEditor('بنر الراعي'))return;
  const b=state.banner;
  const {error}=await sb.from('site_banner').update({active:!b.active}).eq('id',1);
  if(error){toast('فشلت العملية',true);return}
  toast(b.active?'اختفى البنر':'انطلق البنر برأس الصفحة 📣');
  await loadAdmWeek();loadSponsor();
}

export async function admWeekSave(){
  const data={week_label:$('wkLabel').value.trim(),sponsor_name:$('wkSponsor').value.trim(),prize:$('wkPrize').value.trim()};
  const q=_CW_()?sb.from('weekly_contest').update(data).eq('id',_CW_().id):sb.from('weekly_contest').insert({...data,active:false});
  const {error}=await q;
  if(error){toast('تعذر الحفظ: '+error.message,true);return}
  toast('انحفظت المسابقة ✅');await loadAdmWeek();await loadWeek();
}

export async function admWeekToggle(){
  if(!needEditor('المسابقة'))return;
  const {error}=await sb.from('weekly_contest').update({active:!_CW_().active}).eq('id',_CW_().id);
  if(error){toast('فشلت العملية',true);return}
  toast(_CW_().active?'أُوقفت المسابقة':'انطلقت المسابقة للجمهور 🎉');
  await loadAdmWeek();await loadWeek();
}

export async function admWeekAdd(pid){
  if(!_CW_()){toast('أنشئ المسابقة أول من تبويب 🏆',true);return}
  if(_CW_().ended_at){toast('المسابقة منتهية — أنشئ جديدة من تبويب 🏆',true);return}
  const en=await sb.from('weekly_entries').select('photo_id').eq('contest_id',_CW_().id);
  if((en.data||[]).length>=5){toast('اكتمل العدد — 5 لقطات كحد أقصى',true);return}
  const {error}=await sb.from('weekly_entries').insert({contest_id:_CW_().id,photo_id:pid});
  if(error){toast(error.code==='23505'?'مرشحة من قبل':'تعذر الترشيح',true);return}
  toast('انضافت للترشيحات 🏆');
}

export async function admWeekRemove(pid){
  await sb.from('weekly_entries').delete().eq('contest_id',_CW_().id).eq('photo_id',pid);
  toast('أُزيلت');await loadAdmWeek();
}

export async function admWeekEnd(){
  const bd=await sb.from('weekly_board').select('*').eq('contest_id',_CW_().id);
  let win=null,mx=0;(bd.data||[]).forEach(r=>{if(r.votes>mx){mx=r.votes;win=r.photo_id}});
  if(!win){if(!confirm('ما فيه أصوات بعد — إنهاء المسابقة بدون فائز؟'))return}
  else if(!confirm('إنهاء المسابقة وإعلان الفائز؟ يظهر التتويج بالرئيسية لمدة أسبوع.'))return;
  const {error}=await sb.from('weekly_contest').update({active:false,ended_at:new Date().toISOString(),winner_photo_id:win}).eq('id',_CW_().id);
  if(error){toast('فشل الإنهاء: '+error.message,true);return}
  toast(win?'أُعلن الفائز — مبروك للمتوّج 👑':'أُنهيت المسابقة');
  await loadAdmWeek();await loadWeek();
}

export async function admWeekNew(){
  const {error}=await sb.from('weekly_contest').insert({active:false});
  if(error){toast('تعذر الإنشاء',true);return}
  toast('مسابقة جديدة جاهزة للتجهيز ✨');
  await loadAdmWeek();
}

export async function admSpDelete(){
  if(!needEditor('حذف الراعي'))return;
  const b=state.banner;
  if(!confirm('حذف بنر الراعي نهائياً؟ الصورة تنمسح من المخزن والإعدادات تتصفّر.'))return;
  if(b.image_path)await sb.storage.from('photos').remove([b.image_path]).catch(()=>{});
  const {error}=await sb.from('site_banner').update({active:false,image_path:'',link_url:''}).eq('id',1);
  if(error){toast('فشل الحذف',true);return}
  toast('انحذف البنر نهائياً 🗑️');
  await loadAdmWeek();loadSponsor();
}

export async function admWeekDelete(){
  if(!needEditor('حذف الجولة'))return;
  if(!confirm(`حذف مسابقة «${_CW_().week_label||'بلا وسم'}» نهائياً؟ تنمسح بترشيحاتها وأصواتها، ويختفي أي تتويج مرتبط بها من الرئيسية.`))return;
  const {error}=await sb.from('weekly_contest').delete().eq('id',_CW_().id);
  if(error){toast('فشل الحذف: '+error.message,true);return}
  toast('انحذفت المسابقة 🗑️');
  await loadAdmWeek();await loadWeek();
}

export function admSponsorsBtn(){
  const b=state.banner;
  const on=!!b.sponsors_btn;
  return `<div style="background:var(--card);border:1.5px solid ${on?'var(--qblue)':'var(--line)'};border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">🤝 زر الرعاة بالرئيسية <span style="font-size:11px;font-weight:700;color:${on?'var(--qblue)':'var(--txt-dim)'}">${on?'● ظاهر':'○ مخفي'}</span></div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px">زر «🤝 الرعاة» في قائمة الفلتر.</div>
    <button class="btn" style="width:100%;${on?'background:var(--sadu)':'background:var(--qblue)'}" onclick="admSponsorsBtnToggle()">${on?'🙈 إخفاء زر الرعاة':'👁️ إظهار زر الرعاة'}</button>
  </div>`;
}

export async function admSponsorsBtnToggle(){
  if(!needEditor('صفحة الرعاة'))return;
  const b=state.banner;
  const{error}=await sb.from('site_banner').update({sponsors_btn:!b.sponsors_btn}).eq('id',1);
  if(error){toast('فشلت العملية',true);return}
  toast(!b.sponsors_btn?'زر الرعاة ظاهر 🤝':'اختفى الزر');
  await loadAdmWeek();await loadSponsor();
}

export function admSponsorSideBlock(){
  const b=state.banner;
  const on=!!b.side_active;
  return `
  <div style="background:var(--card);border:1.5px solid ${on?'var(--palm)':'var(--line)'};border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">📌 بطاقة الراعي بالرئيسية ${on?'<span style="font-size:11px;color:var(--palm);font-weight:700">● ظاهرة</span>':'<span style="font-size:11px;color:var(--txt-dim)">○ مخفية</span>'}</div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px">البطاقة الصغيرة (الاسم + النشاط) التي تظهر فوق الصور بالرئيسية.</div>
    <button class="btn" style="width:100%;${on?'background:var(--sadu)':'background:var(--palm)'}" onclick="admSideBannerToggle()">${on?'🙈 إخفاء البطاقة':'👁️ إظهار البطاقة بالرئيسية'}</button>
  </div>`;
}

export async function admSideBannerToggle(){
  if(!needEditor('البطاقة الجانبية'))return;
  const b=state.banner;
  const {error}=await sb.from('site_banner').update({side_active:!b.side_active}).eq('id',1);
  if(error){toast('فشلت العملية: '+error.message,true);return}
  toast(!b.side_active?'البطاقة ظاهرة بالرئيسية 📌':'اختفت البطاقة');
  await loadSponsor();await loadAdmWeek();
}

export function admChallengeBlock(){
  const c=window.__CH||{};
  const on=!!c.active;
  return `<div style="background:var(--card);border:1.5px solid ${on?'var(--qblue)':'var(--line)'};border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">🎯 تحدي الأسبوع <span style="font-size:11px;font-weight:700;color:${on?'var(--qblue)':'var(--txt-dim)'}">${on?'● نشط':'○ مطفأ'}</span></div>
    <input id="chTitle" placeholder="موضوع التحدي (مثال: الأبواب القديمة)" value="${esc(c.title||'')}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
    <input id="chHint" placeholder="وصف أو تلميح (اختياري)" value="${esc(c.hint||'')}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
    <input id="chEnds" type="date" value="${c.ends_at||''}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
    <div style="font-size:11.5px;color:var(--txt-dim);margin:10px 0 6px">توجيه التحدي (اختياري)</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <select id="chRegion" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px;color:var(--txt);font-family:'Tajawal';font-size:12.5px;outline:none">
        <option value="">كل المناطق</option>
        ${['الرياض','مكة المكرمة','المدينة المنورة','القصيم','الشرقية','عسير','تبوك','حائل','الحدود الشمالية','جازان','نجران','الباحة','الجوف'].map(r=>`<option value="${r}" ${c.region===r?'selected':''}>${r}</option>`).join('')}
      </select>
      <select id="chCat" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px;color:var(--txt);font-family:'Tajawal';font-size:12.5px;outline:none">
        <option value="">كل التصنيفات</option>
        ${[['nature','🌿 طبيعة'],['arch','🏛️ عمارة'],['wildlife','🦅 طيور'],['people','👥 أشخاص'],['bw','⬛ أبيض وأسود'],['landmark','🕌 معلم'],['heritage','🏺 تراث']].map(x=>`<option value="${x[0]}" ${c.cat===x[0]?'selected':''}>${x[1]}</option>`).join('')}
      </select>
    </div>
    <input id="chPrize" placeholder="الجائزة أو الحافز (اختياري)" value="${esc(c.prize||'')}" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:10px">
    <div class="ch-ideas">
      <b>أفكار جاهزة:</b>
      <button onclick="chIdea('أجمل غروب في نجد','الرياض','nature')">🌅 غروب نجد</button>
      <button onclick="chIdea('تفاصيل تراثية من الجنوب','عسير','heritage')">🏺 تراث الجنوب</button>
      <button onclick="chIdea('أماكن نادرة في الشرقية','الشرقية','')">💎 نوادر الشرقية</button>
      <button onclick="chIdea('نخيل القصيم','القصيم','nature')">🌴 نخيل القصيم</button>
      <button onclick="chIdea('أبواب ونوافذ قديمة','','arch')">🚪 أبواب قديمة</button>
      <button onclick="chIdea('ليل الصحراء ونجومها','','nature')">🌙 ليل الصحراء</button>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn" style="flex:1;font-size:12px;padding:9px;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="admChSave()">💾 حفظ</button>
      <button class="btn" style="flex:1;font-size:12px;padding:9px;${on?'background:var(--sadu)':'background:var(--qblue)'}" onclick="admChToggle()">${on?'🙈 إيقاف':'▶️ تفعيل'}</button>
    </div>
  </div>`;
}

export async function admChSave(){
  const {error}=await sb.from('challenge').update({
    title:$('chTitle').value.trim(),
    hint:$('chHint').value.trim(),
    ends_at:$('chEnds').value||null,
    region:$('chRegion')?$('chRegion').value:'',
    cat:$('chCat')?$('chCat').value:'',
    prize:$('chPrize')?$('chPrize').value.trim():'',
    updated_at:new Date().toISOString()
  }).eq('id',1);
  if(error){toast('فشل الحفظ: '+error.message,true);return}
  toast('انحفظ التحدي ✅');
  await loadChallenge();await loadAdmWeek();
}

export async function admChToggle(){
  const c=window.__CH||{};
  if(!c.active&&!$('chTitle').value.trim()){toast('اكتب موضوع التحدي أولاً',true);return}
  const {error}=await sb.from('challenge').update({active:!c.active}).eq('id',1);
  if(error){toast('فشلت العملية',true);return}
  toast(!c.active?'التحدي نشط 🎯':'اتوقف التحدي');
  await loadChallenge();await loadAdmWeek();
}

/* ====== إدارة كنوز الديرة ====== */

export function chIdea(title,region,cat){
  if($('chTitle'))$('chTitle').value=title;
  if($('chRegion'))$('chRegion').value=region;
  if($('chCat'))$('chCat').value=cat;
  const d=new Date();d.setDate(d.getDate()+7);
  if($('chEnds'))$('chEnds').value=d.toISOString().slice(0,10);
  toast('اضغط حفظ ثم تفعيل 🎯');
}

/* ====== نظام الرتب ====== */
