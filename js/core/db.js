/* صورة من بلدي — core/db.js
   عميل القاعدة والمصادقة — الأساس الذي يعتمد عليه كل شيء */

const SB_URL = "https://gquzjaxpqeggknhipmzk.supabase.co";
const SB_KEY = "sb_publishable_BNp6Fg3VLXa1Pf4V6QjncQ_f496PquX";

if(typeof supabase==='undefined'){
  document.body.innerHTML='<div style="padding:60px 30px;text-align:center;font-family:Tajawal,sans-serif;color:#241F1C"><div style="font-size:40px">⚠️</div><h2>تعذر تحميل مكتبة الاتصال</h2><p>تأكد من اتصالك بالإنترنت ثم حدّث الصفحة</p></div>';
  window.__BOOT_FAIL=true;
  throw new Error('supabase library missing');
}

export const sb = supabase.createClient(SB_URL, SB_KEY);

/* المستخدم الحالي — كائن قابل للتحديث بدل متغير مباشر */
export const session = { user: null };

/* ═══ مزامنة تلقائية للجلسة ═══
   مصدر واحد للحقيقة. كل مسار دخول (إيميل · جوجل · مجهول · استعادة
   جلسة محفوظة · تجديد الرمز) يمرّ من هنا، فلا يحتاج أي ملف أن يُسند
   session.user بنفسه — وهذا ما كان يُنسى أو يُكتب على متغير محلي
   فيبقى التطبيق يرى مستخدماً مجهولاً رغم وجود جلسة صحيحة. */
sb.auth.onAuthStateChange((_event, s) => {
  session.user = (s && s.user) || null;
});

/* اختصار للقراءة السريعة */
export function currentUser(){ return session.user; }

export async function ensureAuth(){
  const { data:{ session:s } } = await sb.auth.getSession();
  if(s){ session.user = s.user; return s.user; }

  /* قد لا تكون استعادة الجلسة المحفوظة قد اكتملت بعد، فنتأكد من
     الخادم قبل أن نلجأ لدخول مجهول يدهس هوية المستخدم الحقيقية. */
  try{
    const { data:{ user:u } } = await sb.auth.getUser();
    if(u){ session.user = u; return u; }
  }catch(e){}

  const { data, error } = await sb.auth.signInAnonymously();
  if(error){
    const { toast } = await import('./ui.js');
    toast('تعذر الاتصال بالحساب — تأكد من تفعيل Anonymous Sign-ins', true);
    throw error;
  }
  session.user = data.user;
  return data.user;
}

export async function saveName(name){
  if(!name || !session.user) return;
  await sb.from('profiles').update({ display_name: name }).eq('id', session.user.id);
}

export function isAnon(){
  return !session.user || session.user.is_anonymous;
}
