/* صورة من بلدي — admin/music.js
   مكتبة الموسيقى */

import { sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { state } from '../core/state.js';
import { $, esc } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   muUrl ← admin/misc.js
   كان يُستدعى مجرّداً معتمداً على نشره بـwindow، وهذا يعمل بالمصادفة
   وحدها: لو تأخّر نشر misc.js سقط الرسم كله بـReferenceError. */
const muUrl = need('muUrl');

export async function loadAdmMusic(){
  const el=$('admMu');if(!el)return;
  el.innerHTML='<div class="loader">⏳</div>';
  const r=await sb.from('music').select('*').order('created_at',{ascending:false});
  state.admMusic=r.data||[];
  el.innerHTML=`
  <div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:14px">
    <div style="font-weight:700;font-size:14px;margin-bottom:8px">🎵 إضافة مقطع</div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px">MP3 خالٍ من الحقوق · حتى 5 ميجا · يُفضّل 30-60 ثانية</div>
    <input id="muName" placeholder="اسم المقطع (مثال: عود هادئ)" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;color:var(--txt);font-family:'Tajawal';font-size:13px;outline:none;margin-bottom:8px">
    <input type="file" id="muFile" accept="audio/*,.mp3,.m4a,.wav" style="display:none" onchange="muPicked()">
    <button class="btn" style="width:100%;background:var(--card2);border:1.5px dashed var(--line);color:var(--txt);margin-bottom:8px" onclick="document.getElementById('muFile').click()">📁 <span id="muFileName">اختر ملف صوتي</span></button>
    <button class="btn" style="width:100%" id="muUpBtn" onclick="muUpload()">📤 رفع المقطع</button>
  </div>
  ${state.admMusic.length?state.admMusic.map(m=>`
    <div style="background:var(--card);border:1.5px solid ${m.active?'var(--palm)':'var(--line)'};border-radius:14px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:20px">🎵</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
          <div style="font-size:11px;color:${m.active?'var(--palm)':'var(--txt-dim)'};font-weight:700">${m.active?'● متاح للأعضاء':'○ مخفي'}</div>
        </div>
      </div>
      <audio controls preload="none" src="${muUrl(m.path)}" style="width:100%;height:36px;margin-bottom:8px"></audio>
      <div style="display:flex;gap:8px">
        <button class="btn" style="flex:1;font-size:12px;padding:7px;${m.active?'background:var(--sadu)':'background:var(--palm)'}" onclick="muToggle(${m.id},${m.active})">${m.active?'🙈 إخفاء':'▶️ إتاحة'}</button>
        <button class="btn" style="flex:1;font-size:12px;padding:7px;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="muDelete(${m.id},'${m.path}')">🗑️ حذف</button>
      </div>
    </div>`).join(''):'<div class="empty" style="padding:20px">ما فيه مقاطع بعد</div>'}`;
}
