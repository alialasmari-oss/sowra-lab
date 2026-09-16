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
