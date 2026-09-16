/* صورة من بلدي — features/promo.js
   النشر بالسوشال */

import { imgUrl, thumbUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

export let PROMO_ID=null;

export function openPromo(pid){
  if(!state.isAdmin){toast('للمشرف فقط',true);return}
  const p=state.photos.find(x=>x.id===pid);
  if(!p)return;
  PROMO_ID=pid;
  const loc=p.abroad?(p.country||p.city):((p.village?p.village+' · ':'')+p.city);
  const txt='📸 '+p.title+'\n📍 '+loc+'\n📷 عدسة '+(p.photographer||'مصوّر')+'\n\nمن «صورة من بلدي» — عدسات أهل الديار 🇸🇦';
  $('pmText').value=txt;
  $('pmPreview').src=thumbUrl(p.image_path);
  $('promoBox').classList.add('show');
}

export function closePromo(){
  const el=$('promoBox');
  if(el)el.classList.remove('show');
  PROMO_ID=null;
}

export function promoText(){
  return ($('pmText')?$('pmText').value:'')+'\n\nhttps://sowra.app';
}

export async function promoCopy(){
  try{
    await navigator.clipboard.writeText(promoText());
    toast('انتسخ النص ✅ — الصقه بالمنصة');
  }catch(e){toast('تعذر النسخ',true)}
}

export async function promoDownload(){
  const p=state.photos.find(x=>x.id===PROMO_ID);
  if(!p)return;
  toast('⏳ نجهّز الصورة...');
  try{
    const r=await fetch(imgUrl(p.image_path));
    const b=await r.blob();
    const f=new File([b],'sowra-'+p.id+'.jpg',{type:'image/jpeg'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){
      await navigator.share({files:[f],text:promoText(),url:'https://sowra.app'});
      return;
    }
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b);
    a.download='sowra-'+p.id+'.jpg';
    a.click();
    toast('انحفظت الصورة 📥');
  }catch(e){toast('تعذر التجهيز',true)}
}

export function promoOpen(net){
  const t=encodeURIComponent(promoText());
  const u=encodeURIComponent('https://sowra.app');
  const links={
    x:'https://twitter.com/intent/tweet?text='+t,
    wa:'https://wa.me/?text='+t,
    tg:'https://t.me/share/url?url='+u+'&text='+encodeURIComponent($('pmText').value),
    ig:'https://www.instagram.com/'
  };
  if(net==='ig'){
    promoCopy();
    toast('انتسخ النص — نزّل الصورة والصقه بإنستقرام');
  }
  window.open(links[net],'_blank','noopener');
}

/* ====== رمز QR — توليد محلي بلا مكتبات خارجية ====== */
