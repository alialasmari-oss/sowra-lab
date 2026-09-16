/* صورة من بلدي — core/format.js
   التنسيق والرتب وفلترة النصوص */

/* ====== الوقت النسبي ====== */
export function timeAgo(iso){
  if(!iso) return { txt:'', full:'' };
  const d = new Date(iso), now = new Date();
  const s = Math.floor((now - d) / 1000);
  const full = d.toLocaleDateString('ar-SA',{year:'numeric',month:'long',day:'numeric'});
  let txt;
  if(s<60) txt='قبل لحظات';
  else if(s<3600){ const m=Math.floor(s/60); txt='قبل '+(m===1?'دقيقة':m===2?'دقيقتين':m<11?m+' دقائق':m+' دقيقة'); }
  else if(s<86400){ const h=Math.floor(s/3600); txt='قبل '+(h===1?'ساعة':h===2?'ساعتين':h<11?h+' ساعات':h+' ساعة'); }
  else if(s<604800){ const dd=Math.floor(s/86400); txt='قبل '+(dd===1?'يوم':dd===2?'يومين':dd+' أيام'); }
  else if(s<2592000){ const w=Math.floor(s/604800); txt='قبل '+(w===1?'أسبوع':w===2?'أسبوعين':w+' أسابيع'); }
  else if(s<31536000){ const mo=Math.floor(s/2592000); txt='قبل '+(mo===1?'شهر':mo===2?'شهرين':mo<11?mo+' أشهر':mo+' شهر'); }
  else { const y=Math.floor(s/31536000); txt='قبل '+(y===1?'سنة':y===2?'سنتين':y+' سنوات'); }
  return { txt, full };
}

/* اختصار للنص وحده — يتفادى خطأ [object Object] */
export const timeAgoTxt = iso => timeAgo(iso).txt;

/* ====== رتبة المصوّر ====== */
export function rankOf(p){
  const ph = p?.photographer_photos || 0;
  const fo = p?.followers_count || 0;
  if(ph>=15 && fo>=10) return { ic:'🏆', t:'عين الديرة', c:'gold' };
  if(ph>=5  || fo>=5 ) return { ic:'📸', t:'عدسة الديرة', c:'silver' };
  return { ic:'🌱', t:'مستكشف', c:'bronze' };
}

/* ====== فلترة النصوص ====== */
const BAD_WORDS = ['قحب','شرموط','منيوك','عرص','خرا','طيز','نيك','fuck','bitch','asshole','bastard'];

export function hasBadWord(t){
  if(!t) return false;
  const s = String(t).toLowerCase().replace(/[\u064B-\u0652]/g,'');
  return BAD_WORDS.some(w => s.includes(w));
}

export function hasLink(t){
  if(!t) return false;
  return /(https?:\/\/|www\.|\.com|\.net|\.org|\.sa\b|t\.me\/|wa\.me\/|@[a-z0-9_]{4,})/i.test(String(t));
}

export function hasRepeat(t){
  if(!t) return false;
  return /(.)\1{7,}/.test(String(t));
}

/* يرجع رسالة الخطأ أو null إذا النص سليم */
export function checkText(t, { allowLink=false } = {}){
  if(!t || !String(t).trim()) return null;
  if(hasBadWord(t)) return 'فيه ألفاظ غير لائقة — عدّل النص من فضلك';
  if(!allowLink && hasLink(t)) return 'الروابط ومعرّفات الحسابات غير مسموحة';
  if(hasRepeat(t)) return 'فيه تكرار غير طبيعي بالأحرف';
  return null;
}

/* ====== تطبيع أسماء الأماكن ====== */
export function normPlace(s){
  return String(s||'')
    .replace(/[\u064B-\u0652\u0640]/g,'')
    .replace(/[أإآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه')
    .replace(/منطقة|محافظة|امارة|مدينة/g,'')
    .replace(/\s+/g,'').trim();
}

/* يجد الخيار المطابق بقائمة منسدلة — مطابقة مرنة */
export function findOpt(sel, want){
  if(!sel || !want) return null;
  const w = normPlace(want);
  if(!w) return null;
  const opts = Array.from(sel.options);
  return opts.find(o => normPlace(o.value)===w || normPlace(o.textContent)===w)
      || opts.find(o => {
           const t = normPlace(o.textContent);
           return t && (t.includes(w) || w.includes(t));
         })
      || null;
}

/* صيغة الجمع العربي للأعداد */
export function plural(n, one, two, few, many){
  if(n===1) return one;
  if(n===2) return two;
  if(n<11) return n+' '+few;
  return n+' '+many;
}
