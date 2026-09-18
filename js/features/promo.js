/* صورة من بلدي — features/promo.js
   النشر بالسوشال */

import { thumbUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';
import { need } from '../core/hub.js';
/* ═══ عبر الحاجز ═══
   shareCard ← features/share.js
*/
const shareCard = need('shareCard');

export let PROMO_ID=null;

export function openPromo(pid){
  if(!state.isAdmin){toast('للمشرف فقط',true);return}
  /* كانت ترجع بصمت: يضغط المشرف 📢 فلا يحدث شيء ولا يُقال له لماذا.
     والخلاصة العامة لا تضمّ المخفيّات ولا ما بالخزنة. */
  const p=state.photos.find(x=>x.id===pid)
        || (state.admPhotos||[]).find(x=>x.id===pid);
  if(!p){toast('الصورة غير موجودة بالقائمة الحالية',true);return}
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

/* ═══ لماذا صارت بطاقةً بلا نصٍّ ولا رابط ═══
   كان هذا السطر:
     navigator.share({files:[f], text:promoText(), url:'https://sowra.app'})
   ثلاثُ حمولات في نداءٍ واحد: ملفٌ ونصٌّ ورابط. وواتساب وأكثر
   التطبيقات تفصلها: الصورة رسالةً، والنصُّ والرابط رسالةً أخرى —
   وهو ما رآه المالك: «يرسلها لوحدها والرابط لوحده».
   والصورة المرسَلة كانت الأصل عارياً بلا عنوانٍ ولا اسم مصوّر، فلا
   تدلّ على شيء إن انفصل عنها نصُّها.

   وقد استقرّ رأي المالك قبلُ على أن «الصورة أبلغ من الكلام وبعض
   الناس لا يفتحون روابط»، فبُنيت shareCard: بطاقةٌ واحدة يُرسَم فيها
   العنوان والمصوّر والمكان والشعار داخل الصورة نفسها. فلم يبقَ للنصّ
   المنفصل عملٌ — كلُّ ما يحتاجه المتلقّي في الصورة.
   فصار الزرّ ينادي البطاقة نفسها: حمولةٌ واحدة، رسالةٌ واحدة. */
export async function promoDownload(){
  const p=state.photos.find(x=>x.id===PROMO_ID);
  if(!p){toast('الصورة غير موجودة',true);return}
  closePromo();
  shareCard(p);
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
