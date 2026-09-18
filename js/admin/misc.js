/* صورة من بلدي — admin/misc.js
   متفرقات */

import { sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { thumbUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, dbErr, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   loadAdmMusic ← admin/music.js
*/
const loadAdmMusic = need('loadAdmMusic');

export async function listBucketAll(bucket){
  const out=[];
  const skip=n=>!n||n.startsWith('.')||n==='.emptyFolderPlaceholder';
  const root=await sb.storage.from(bucket).list('',{limit:1000});
  const folders=(root.data||[]).filter(x=>!x.id);
  const files=(root.data||[]).filter(x=>x.id);
  files.forEach(f=>{if(!skip(f.name))out.push(f.name)});
  for(const fo of folders){
    const sub=await sb.storage.from(bucket).list(fo.name,{limit:1000});
    (sub.data||[]).forEach(f=>{if(f.id&&!skip(f.name))out.push(fo.name+'/'+f.name)});
  }
  return out;
}

/* ====== مكتبة الموسيقى ====== */

/* state.admMusic → state.admMusic */
export function muUrl(path){return sb.storage.from('music').getPublicUrl(path).data.publicUrl}

export async function muUpload(){
  const name=$('muName').value.trim();
  const f=$('muFile').files[0];
  if(!name){toast('اكتب اسم المقطع',true);return}
  if(!f){toast('اختر ملف MP3',true);return}
  if(f.size>5*1024*1024){toast('الملف كبير — الحد 5 ميجا',true);return}
  const btn=$('muUpBtn');btn.disabled=true;btn.textContent='⏳ نرفع...';
  try{
    const ext=(f.name.split('.').pop()||'mp3').toLowerCase();
    const path=Date.now()+'.'+ext;
    const up=await sb.storage.from('music').upload(path,f,{contentType:f.type||'audio/mpeg',cacheControl:'31536000'});
    if(up.error)throw up.error;
    const ins=await sb.from('music').insert({name,path});
    if(ins.error){await sb.storage.from('music').remove([path]).catch(()=>{});throw ins.error}
    $('muName').value='';$('muFile').value='';
    toast('انرفع المقطع 🎵');
    loadAdmMusic();
  }catch(e){toast('فشل الرفع: '+(e.message||''),true)}
  finally{btn.disabled=false;btn.textContent='📤 رفع المقطع'}
}

export async function muToggle(id,cur){
  const {error}=await sb.from('music').update({active:!cur}).eq('id',id);
  if(error){dbErr('تفعيل المقطع',error);return}
  toast(!cur?'المقطع متاح 🎵':'اختفى المقطع');
  loadAdmMusic();
}

export async function muDelete(id,path){
  if(!confirm('حذف المقطع نهائياً؟'))return;
  await sb.from('music').delete().eq('id',id);
  try{await sb.storage.from('music').remove([path])}catch(e){}
  toast('انحذف المقطع');
  loadAdmMusic();
}

export function muPicked(){
  const f=$('muFile').files[0];
  const lbl=$('muFileName');
  if(lbl)lbl.textContent=f?(f.name+' · '+Math.round(f.size/1024)+' كيلو'):'اختر ملف صوتي';
}

/* ====== الصور المتاحة تجارياً ====== */

export async function loadCommercial(){
  const el=$('admSt');if(!el)return;
  try{
    const r=await sb.from('photos_ranked').select('id,title,city,region,photographer,image_path,avg_stars,commercial')
      .eq('commercial',true).eq('visibility','public').order('avg_stars',{ascending:false});
    const list=r.data||[];
    const box=document.createElement('div');
    box.style.cssText='background:var(--card);border:1.5px solid var(--palm);border-radius:14px;padding:14px;margin-top:14px';
    box.innerHTML='<div style="font-weight:700;font-size:14px;margin-bottom:6px">💼 متاحة للاستخدام التجاري <span style="color:var(--palm)">'+list.length+'</span></div>'
      +'<div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px;line-height:1.8">صور وافق أصحابها على عرضها للجهات — تواصل معهم عند أي طلب</div>'
      +(list.length?list.slice(0,20).map(p=>
        '<div style="display:flex;align-items:center;gap:9px;background:var(--card2);border-radius:10px;padding:7px 10px;margin-bottom:5px;font-size:12px">'
        +'<img src="'+thumbUrl(p.image_path)+'" style="width:34px;height:34px;border-radius:8px;object-fit:cover">'
        +'<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.title)+' <span style="color:var(--txt-dim)">· '+esc(p.photographer||'')+'</span></span>'
        +'<span style="color:var(--star);font-weight:700">★ '+Number(p.avg_stars).toFixed(1)+'</span></div>'
      ).join(''):'<div style="font-size:12px;color:var(--txt-dim)">ما فيه صور بعد</div>');
    el.appendChild(box);
  }catch(e){}
}

/* ====== تفعيل الاستخدام التجاري ====== */


/* فحص صلاحية قبل أي فعل حساس */


/* ═══ هيئة المحررين — أي عضو (للمالك) ═══ */

