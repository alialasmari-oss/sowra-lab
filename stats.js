/* صورة من بلدي — admin/stats.js
   الإحصائيات */

import { sb } from '../core/db.js';
import { isOwner } from '../core/state.js';
import { $, esc } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

export async function loadStats(){
  if(!isOwner()){
    const e=$('admSt');
    if(e)e.innerHTML='<div class="empty" style="padding:26px"><span class="big">🔒</span>الإحصائيات للمالك فقط</div>';
    return;
  }
  $('admSt').innerHTML='<div class="empty">⏳</div>';
  const [st,us]=await Promise.all([sb.rpc('admin_stats'),sb.rpc('admin_users')]);
  if(st.error||!st.data){$('admSt').innerHTML=`<div class="empty">⚠️ تعذر تحميل الإحصائيات<br><span style="font-size:11px">${esc(st.error?.message||'لا توجد بيانات')}</span></div>`;return}
  const s=st.data;
  const card=(n,l,ic)=>`<div style="background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:14px 8px;text-align:center">
    <div style="font-size:22px">${ic}</div>
    <div style="font-size:24px;font-weight:700;color:var(--sand)">${n}</div>
    <div style="font-size:11px;color:var(--txt-dim)">${l}</div></div>`;
  let html=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
    ${card(s.users,'مسجلين','👤')}${card(s.guests,'زوار','👀')}${card(s.photos,'صورة','📸')}
    ${card(s.ratings,'تقييم','⭐')}${card(s.comments,'تعليق','💬')}${card(s.badges,'صوت وسام','🗳️')}
    ${card(s.fb_new,'رسالة جديدة','📨')}${card(s.hidden,'مخفية','🙈')}${card(s.places,'مكان مضاف','📍')}
  </div>
  <div style="font-weight:700;font-size:15px;margin-bottom:10px">👥 المسجلون (${(us.data||[]).length})</div>`;
  html+=(us.data||[]).length
    ?(us.data.map(u=>`<div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 13px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="min-width:0">
          <b style="font-size:14px">${esc(u.display_name)}</b>
          <div style="font-size:11.5px;color:var(--txt-dim);direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis">${esc(u.email)}</div>
        </div>
        <div style="text-align:center;flex:0 0 auto">
          <div style="font-size:15px;font-weight:700;color:var(--sand)">${u.photos_count} 📸</div>
          <div style="font-size:10px;color:var(--txt-dim)">${new Date(u.created_at).toLocaleDateString('ar-SA')}</div>
        </div>
      </div>`).join(''))
    :'<div class="empty">ما فيه مسجلين بعد</div>';
  $('admSt').innerHTML=html;
}

/* صورة من بلدي — admin.js | نسخة المختبر م1 */
