/* صورة من بلدي — core/media.js
   روابط التخزين وضغط الصور */

import { sb } from './db.js';

export function imgUrl(path){
  return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

export function vidUrl(path){
  return sb.storage.from('videos').getPublicUrl(path).data.publicUrl;
}

export function avatarUrl(path){
  return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export const thumbPath = p => String(p||'').replace(/\.jpg$/i, '_t.jpg');

/* النسخة عالية الدقة — أرشيف عمل المصوّر
   العرض يستعمل النسخة العادية (١١٠٠) لأنها أخف؛ وهذه تُحفظ للطباعة
   والخلفيات وأي استعمال قادم يحتاج بكسلات حقيقية. */
export const hiPath = p => String(p||'').replace(/\.jpg$/i, '_h.jpg');

export function thumbUrl(p){
  return imgUrl(thumbPath(p));
}

export function hiUrl(p){
  return imgUrl(hiPath(p));
}

/* ═══ كل ملفات الصورة الواحدة ═══
   مصدر واحد يعرف ما يخصّ الصورة من ملفات. كل موضع يحذف صورةً يناديه،
   فإضافة نوع ملف جديد غداً لا تترك ملفات يتيمة بمواضع نسيها أحدهم.
   كانت ثلاثة مواضع تحسب مسار المصغّرة بنفسها بـreplace خام. */
export const allPaths = p => [p, thumbPath(p), hiPath(p)];

/* احتياطي: لو أخفقت المصغّرة، نجلب الأصل */
export function imgFallback(path){
  return `this.onerror=null;this.src='${imgUrl(path)}'`;
}

/* ====== ضغط الصور ====== */
export function compressTo(file, maxW, quality){
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(b => resolve(b || file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/* القياسات المعتمدة — مكان واحد للتعديل */
export const SIZES = {
  full:  { w: 1100, q: 0.74 },
  hi:    { w: 2400, q: 0.82 },   /* الأرشيف — يكفي خلفية جوال وطباعة صغيرة */
  thumb: { w: 380,  q: 0.72 },
  probe: { w: 640,  q: 0.55 }
};

/* أقل ضلع طويل يستحق نسخة أرشيف. ما دون ذلك تكون النسخة العادية
   قريبة منه فلا معنى لتخزين ملف ثانٍ. */
export const HI_MIN = 1400;

export const compress = file => compressTo(file, SIZES.full.w, SIZES.full.q);
export const makeThumb = file => compressTo(file, SIZES.thumb.w, SIZES.thumb.q);
export const makeHi = file => compressTo(file, SIZES.hi.w, SIZES.hi.q);

/* مقاس الصورة الأصلية قبل أي ضغط — لنقرّر أتستحق نسخة أرشيف أم لا */
export function imgSize(file){
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
