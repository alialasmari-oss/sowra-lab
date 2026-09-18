/* صورة من بلدي — core/ui.js
   أدوات الواجهة الأساسية — تُستدعى ٥٥٠+ مرة عبر المشروع */

export const $ = id => document.getElementById(id);

/* تعقيم النصوص — يمنع حقن أي كود في الصفحة */
export const esc = s => String(s??'').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const starsTxt = v => {
  const f = Math.round(v);
  return "★".repeat(f) + "☆".repeat(5-f);
};

let _toastTimer = null;
export function toast(m, err){
  const t = $('toast');
  if(!t) return;
  t.textContent = m;
  t.className = 'toast' + (err ? ' err' : '');
  t.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2600);
}

/* ═══ خطأ قاعدة البيانات — يُعرَض ولا يُطمَس ═══
   كانت تسعة مواضع بلوحة الإشراف تقول «فشلت العملية» وترمي رسالة
   سوبابيز الحقيقية. فمن رأى «فشلت العملية» لا يعرف: صلاحية RLS؟
   عمود ناقص؟ قيد تكرار؟ انقطاع شبكة؟ ولا أنا أعرف من وصفه.
   الرسالة الحقيقية قصيرة وتُسمّي السبب — فلتظهر.
   والزائر لا يُقرأ عليه كلام سوبابيز الإنجليزي — فله الوسيط الثالث:
   رسالة عربية مفهومة تظهر له، والسبب الحقيقي يذهب لسجلّ المتصفح
   كاملاً. فلا عطلَ بلا دليل، ولا زائرَ يُفزعه كلامٌ ليس له. */
export function dbErr(what, error, friendly){
  const e = error || {};
  const msg = e.message || e.hint || e.details || 'سبب غير معروف';
  const code = e.code ? ' ['+e.code+']' : '';
  console.error('[قاعدة] '+what+' — '+msg+code, e);
  toast(friendly || ('⚠️ '+what+': '+msg+code), true);
}

/* مراقب الأخطاء — يعرض أي خطأ تشغيلي بدل الموت الصامت */
export function installErrorWatch(){
  window.addEventListener('error', e => {
    toast('⚠️ خطأ: ' + (e.message || 'غير معروف'), true);
  });
  window.addEventListener('unhandledrejection', e => {
    toast('⚠️ خطأ: ' + (e.reason?.message || e.reason || 'غير معروف'), true);
  });
}

/* تأكيد موحّد — يسهّل استبداله بنافذة مخصّصة لاحقاً */
export function ask(msg){
  return window.confirm(msg);
}

export function prompt(msg, def){
  return window.prompt(msg, def ?? '');
}
