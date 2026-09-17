/* صورة من بلدي — sw.js
   عامل الخدمة (Service Worker) — الإشعارات فقط، بدون أي تخزين مؤقت للملفات
   ملاحظة مهمة: لا نضيف cache هنا أبداً — الملفات تُحدَّث بـ?x= من index.html،
   وأي تخزين مؤقت هنا معناه أن التعديلات ما تظهر للناس.
   V1.0
*/

const SB_URL   = 'https://gquzjaxpqeggknhipmzk.supabase.co';
const SB_KEY   = 'sb_publishable_BNp6Fg3VLXa1Pf4V6QjncQ_f496PquX';
const VAPID_PUB = 'BCeGpOtX3WqUv7u0B8hoOJDdrp8PKUXG1pow2wWyM8sS7bnLJ3v8mzqczz-SmiQJgNeZXz1Z4VouYB9LAwsXe94';

/* ═══ التنصيب والتفعيل — فوري بلا انتظار ═══ */

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  /* العامل القديم بالإنتاج كان يخزّن الملفات بذاكرة اسمها sowra-v1، وفيها
     نسخة من index.html القديم الذي يستدعي الملفات المسطّحة (photos.js…).
     بعد التبديل تختفي تلك الملفات، فلو بقيت الذاكرة وسُحبت منها صفحة
     عند تعثّر الشبكة لظهر للمستخدم تطبيق ميّت. نمسحها كلها. */
  e.waitUntil((async () => {
    try{
      const ks = await caches.keys();
      await Promise.all(ks.map(k => caches.delete(k)));
    }catch(err){}
    await self.clients.claim();
  })());
});

/* ═══ استقبال الإشعار ═══
   الحمولة من وظيفة smart-service: { title, body, url }
   نقرأها بمرونة تحسباً لأي شكل آخر */

function parsePayload(event){
  const fallback = { title:'صورة من بلدي 🇸🇦', body:'فيه جديد بالتطبيق', url:'/' };
  if(!event.data) return fallback;

  let d = null;
  try{ d = event.data.json(); }
  catch(e){
    try{ return { ...fallback, body: event.data.text() || fallback.body }; }
    catch(e2){ return fallback; }
  }
  if(!d || typeof d !== 'object') return fallback;

  /* بعض الخوادم تلفّ المحتوى داخل notification */
  const n = (d.notification && typeof d.notification === 'object') ? d.notification : d;

  return {
    title: n.title || d.title || fallback.title,
    body:  n.body  || d.body  || d.message || fallback.body,
    url:   n.url   || d.url   || (d.data && d.data.url) || fallback.url,
    tag:   n.tag   || d.tag   || undefined
  };
}

self.addEventListener('push', event => {
  const p = parsePayload(event);

  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: p.tag,
      renotify: !!p.tag,
      vibrate: [60, 40, 60],
      data: { url: p.url }
    })
  );
});

/* ═══ الضغط على الإشعار ═══
   نركّز نافذة مفتوحة إن وُجدت، وإلا نفتح جديدة */

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for(const c of all){
      if('focus' in c){
        try{ if('navigate' in c && target && target !== '/') await c.navigate(target); }catch(e){}
        return c.focus();
      }
    }
    if(self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

/* ═══ تجديد الاشتراك تلقائياً ═══
   المتصفح أحياناً يغيّر عنوان الاشتراك — بدون هذا تموت إشعارات الجهاز بصمت.
   محاولة صامتة: نحدّث نفس السطر بجدول push_subs بالعنوان الجديد. */

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try{
      const oldEp = event.oldSubscription && event.oldSubscription.endpoint;
      const sub = event.newSubscription || await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(VAPID_PUB)
      });
      if(!sub || !oldEp) return;
      const j = sub.toJSON();
      await fetch(SB_URL + '/rest/v1/push_subs?endpoint=eq.' + encodeURIComponent(oldEp), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + SB_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: j.keys.p256dh,
          auth: j.keys.auth
        })
      });
    }catch(e){ /* صامت — لا نزعج المستخدم */ }
  })());
});

function urlB64ToUint8(b64){
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  const arr = new Uint8Array(raw.length);
  for(let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
