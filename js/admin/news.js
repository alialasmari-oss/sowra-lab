/* صورة من بلدي — admin/news.js
   بنر التحديثات */

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
export function admNewsBlock(){
  if(!isOwner())return '';
  const b=state.banner;
  const on=!!b.news_on;
  return `<div style="background:var(--card);border:1.5px solid ${on?'var(--qteal)':'var(--line)'};border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">✨ بنر التحديثات <span style="font-size:11px;color:${on?'var(--qteal)':'var(--txt-dim)'}">${on?'● ظاهر':'○ مطفأ'}</span></div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:11px;line-height:1.85">
      يظهر بأعلى الرئيسية <b>مرة واحدة لكل عضو</b> — يضغط «فهمت» فيختفي نهائياً.
    </div>
    <input id="nwTitle" placeholder="العنوان — مثال: وصلت ميزات جديدة 🎉" value="${esc(b.news_title||'')}"
      style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
    <textarea id="nwBody" rows="4" placeholder="التفاصيل — اكتب ما الجديد بالمنصة..."
      style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;line-height:1.9;outline:none;resize:vertical;margin-bottom:10px">${esc(b.news_body||'')}</textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" style="flex:1;min-width:110px;background:var(--card2);border:1px solid var(--line);color:var(--txt);font-size:12.5px;padding:10px" onclick="admNewsSave()">💾 احفظ</button>
      <button class="btn" style="flex:1;min-width:110px;${on?'background:var(--sadu)':'background:var(--qteal)'};font-size:12.5px;padding:10px" onclick="admNewsToggle()">${on?'🙈 أخفِ البنر':'✨ اعرض البنر'}</button>
    </div>
    <button class="btn" style="width:100%;margin-top:8px;background:var(--qblue);font-size:12.5px;padding:11px" onclick="admBroadcast()">🔔 أرسل إشعاراً للجميع</button>
    <div style="font-size:10.5px;color:var(--txt-dim);margin-top:8px;line-height:1.75">
      💡 الحفظ يعطي البنر رقماً جديداً — فيظهر حتى لمن أخفاه سابقاً.
    </div>
  </div>`;
}

export async function admNewsSave(){
  if(!needOwner('تحرير البنر'))return;
  const t=($('nwTitle').value||'').trim();
  const bd=($('nwBody').value||'').trim();
  if(!t){toast('اكتب عنواناً',true);return}

  const nid='n'+Date.now();
  const {error}=await sb.from('site_banner').update({
    news_title:t.slice(0,120),
    news_body:bd.slice(0,600),
    news_id:nid
  }).eq('id',1);
  if(error){toast('تعذر الحفظ: '+error.message,true);return}

  if(state.banner){state.banner.news_title=t;state.banner.news_body=bd;state.banner.news_id=nid}
  if(state.banner){state.banner.news_title=t;state.banner.news_body=bd;state.banner.news_id=nid}
  toast('انحفظ — راح يظهر للجميع من جديد ✨');
  loadAdmWeek();
}

export async function admNewsToggle(){
  if(!needOwner('عرض البنر'))return;
  const b=state.banner;
  const nv=!b.news_on;
  if(nv&&!(b.news_title||'').trim()){toast('اكتب العنوان واحفظ أول',true);return}

  const {error}=await sb.from('site_banner').update({news_on:nv}).eq('id',1);
  if(error){toast('تعذرت العملية: '+error.message,true);return}
  if(state.banner)state.banner.news_on=nv;
  if(state.banner)state.banner.news_on=nv;
  toast(nv?'✨ البنر ظاهر للجميع':'انخفى البنر');
  loadAdmWeek();
}

/* ═══ إشعار جماعي ═══ */

export async function admBroadcast(){
  if(!needOwner('الإشعار الجماعي'))return;
  const b=state.banner;
  const t=($('nwTitle').value||b.news_title||'').trim();
  const bd=($('nwBody').value||b.news_body||'').trim();
  if(!t){toast('اكتب العنوان أول',true);return}

  if(!confirm('إرسال إشعار لكل من فعّل الإشعارات؟\n\n«'+t+'»\n\nما ينرسل إلا مرة — تأكد من النص.'))return;

  const btn=event&&event.target;
  if(btn){btn.disabled=true;btn.textContent='⏳ نرسل...'}

  try{
    const r=await sb.from('push_subs').select('user_id');
    const ids=[...new Set((r.data||[]).map(x=>x.user_id))];
    if(!ids.length){toast('ما فيه أحد فعّل الإشعارات بعد',true);return}

    if(typeof pushNotify==='function'){
      // دفعات من ٥٠ — تفادياً لحدود الوظيفة
      for(let i=0;i<ids.length;i+=50){
        await pushNotify({
          title:t.slice(0,60),
          body:(bd||'افتح التطبيق وشوف الجديد').slice(0,120),
          url:'/',
          user_ids:ids.slice(i,i+50)
        });
      }
    }
    toast('🔔 انرسل لـ'+ids.length+' عضواً');
  }catch(e){
    toast('تعذر الإرسال: '+((e&&e.message)||''),true);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='🔔 أرسل إشعاراً للجميع'}
  }
}

/* ═══ إصلاح صور المسافر بإحداثيات محلية ═══ */
