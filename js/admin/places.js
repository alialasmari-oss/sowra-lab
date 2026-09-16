/* صورة من بلدي — admin/places.js
   الأماكن المخصّصة */

import { sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   needEditor ← admin/team.js
*/
const needEditor = need('needEditor');

export function plcFillCities(){
  const r=$('plcRegion').value,c=$('plcCity');
  c.innerHTML='<option value="">المدينة (اختياري)</option>';
  if(r&&GEO[r])GEO[r].forEach(x=>c.innerHTML+=`<option>${x}</option>`);
}

export function renderPlaces(){
  const reg=$('plcRegion'),sel=reg.value;
  reg.innerHTML='<option value="">اختر المنطقة</option>';
  for(const r in BASE_GEO)reg.innerHTML+=`<option>${r}</option>`;
  if(sel)reg.value=sel;
  plcFillCities();
  $('plcList').innerHTML=geo.custom.length
    ?geo.custom.map(c=>`
      <div style="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 13px;margin-bottom:8px">
        <div style="flex:1">
          <b style="font-size:14px">${esc(c.name)}</b>
          <div style="font-size:11px;color:var(--txt-dim)">${KIND_AR[c.kind]}${c.city?' · '+esc(c.city):''} · ${esc(c.region)}</div>
        </div>
        <button class="btn" style="font-size:12px;padding:7px 12px" onclick="admDelPlace(${c.id},'${esc(c.name).replace(/'/g,"\\'")}')">🗑️ حذف</button>
      </div>`).join('')
    :`<div class="empty">ما فيه أماكن مضافة بعد — كل اللي تضيفه هنا يظهر فوراً بقوائم التطبيق</div>`;
}

export async function admAddPlace(){
  const region=$('plcRegion').value,city=$('plcCity').value,name=$('plcName').value.trim(),kind=$('plcKind').value;
  if(!region)return toast('اختر المنطقة',true);
  if(name.length<2)return toast('اكتب اسم المكان',true);
  const { error } = await sb.from('custom_places').insert({region,city,name,kind});
  if(error){
    toast(error.code==='23505'?'المكان مضاف من قبل':'تعذرت الإضافة: '+error.message,true);
    return;
  }
  $('plcName').value='';
  toast('انضاف المكان ✅');
  await loadPlaces();renderPlaces();
}

export async function admDelPlace(id,name){
  if(!needEditor('إدارة الأماكن'))return;
  if(!confirm(`حذف «${name}» من القوائم؟ (الصور المنشورة عليه ما تتأثر)`))return;
  const { error } = await sb.from('custom_places').delete().eq('id',id);
  if(error){toast('تعذر الحذف',true);return}
  toast('انحذف المكان');
  await loadPlaces();renderPlaces();
}
