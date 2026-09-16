/* صورة من بلدي — core/bridge.js
   جسر مؤقت: ينشر الدوال التي يناديها onclick بـHTML

   ⚠️ هذا حل انتقالي. كل ما نقلت onclick لمستمع أحداث،
   احذف اسمها من القائمة أدناه. الهدف إفراغه تماماً.

   القاعدة: لا تنشر شيئاً هنا إلا إن كان مستدعى من HTML فعلاً. */

export function expose(obj){
  Object.entries(obj).forEach(([k, v]) => {
    if(typeof v === 'function' || v !== undefined) window[k] = v;
  });
}

/* للتشخيص: يعرض ما نُشر */
export function bridgeReport(){
  const keys = Object.keys(window).filter(k => typeof window[k] === 'function' && !k.startsWith('webkit'));
  console.info('[bridge] المنشور:', keys.length);
  return keys;
}
