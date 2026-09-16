/* صورة من بلدي — core/hub.js
   حاجز يمنع الدورات المغلقة بين الميزات

   المشكلة: feed يحتاج map، وmap يحتاج feed — استيراد متبادل مباشر
   يجعل المتصفح يحتار أيهما يحمّل أولاً فينهار كل شيء.

   الحل: كل ميزة تسجّل ما تصدّره هنا، وتطلب ما تحتاجه عبر hub
   لحظة الاستدعاء لا لحظة التحميل. */

const registry = Object.create(null);

/* تسجيل ما تصدّره الميزة */
export function provide(obj){
  Object.assign(registry, obj);
}

/* طلب دالة — تُقرأ عند النداء لا عند الاستيراد */
export function need(name){
  return (...args) => {
    const fn = registry[name];
    if(typeof fn !== 'function'){
      console.warn('[hub] مفقود:', name);
      return undefined;
    }
    return fn(...args);
  };
}

/* طلب قيمة (لا دالة) */
export function get(name, def){
  const v = registry[name];
  return v === undefined ? def : v;
}

export function has(name){
  return name in registry;
}

/* للتشخيص */
export function hubReport(){
  const keys = Object.keys(registry).sort();
  console.info('[hub] مسجّل:', keys.length, keys);
  return keys;
}
