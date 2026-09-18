/* صورة من بلدي — features/rating.js
   التقييم والتعليقات */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, rankOf, timeAgo } from '../core/format.js';
import { need } from '../core/hub.js';
import { imgUrl, thumbUrl, vidUrl } from '../core/media.js';
import { isOwner, state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   filterCss ← features/upload.js
   gpUpdateInfo ← features/upload.js
   openAcc ← features/account.js
*/
const filterCss = need('filterCss');
const gpUpdateInfo = need('gpUpdateInfo');
const openAcc = need('openAcc');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const bumpJoinCounter = need('bumpJoinCounter');
const checkRate = need('checkRate');
const loadPhotos = need('loadPhotos');
const logRate = need('logRate');
const moveToVault = need('moveToVault');
const publishFromVault = need('publishFromVault');
const pushNotify = need('pushNotify');
const render = need('render');
const renderClaim = need('renderClaim');
const renderFollow = need('renderFollow');
const renderProfFeed = need('renderProfFeed');
const renderProfTabs = need('renderProfTabs');
const renderVault = need('renderVault');
const renderVisits = need('renderVisits');
const setView = need('setView');
const shareCard = need('shareCard');
/* ═══ عبر الحاجز ═══
   tagName ← features/upload.js
*/
const tagName = need('tagName');

/* state.profUid → state.profUid */
/* state.reelsList → state.reelsList */
/* ═══ عبر الحاجز ═══
   closeSheet ← features/sheet.js
   state.myRating ← features/sheet.js
*/
/* ═══ عبر الحاجز ═══
   get ← core/hub.js
*/
const get = need('get');
const closeSheet = need('closeSheet');

export function drawStars(){
  $('bigStars').innerHTML=[1,2,3,4,5].map(n=>
    `<button class="${n<=state.myRating?'lit':''}" onclick="rate(${n})">★</button>`).join('');
  $('sAvg').textContent=`المتوسط ${Number(state.curPhoto.avg_stars).toFixed(1)} من 5 · ${state.curPhoto.ratings_count} تقييم`;
}

export async function rate(n){
  const prev=state.myRating;state.myRating=n;drawStars();
  const { error } = await sb.from('ratings').upsert({photo_id:state.curId,user_id:currentUser()?.id,stars:n});
  if(error){state.myRating=prev;drawStars();toast('تعذر حفظ التقييم',true);return}
  $('thanks').style.display='block';
  await refreshOne();
  notifyRating(state.curId);
}

/* إشعار صاحب الصورة عند عتبات التقييم */

export async function notifyRating(pid){
  try{
    const ph=state.photos.find(x=>x.id===pid);
    if(!ph||!ph.user_id||!currentUser()||ph.user_id===currentUser()?.id)return;
    const r=await sb.from('ratings').select('stars').eq('photo_id',pid);
    const list=(r.data||[]).map(x=>x.stars);
    const n=list.length;
    /* كانت [3,10,25,50]: صاحب الصورة لا يسمع شيئاً إن توقّف المقيّمون
       عند اثنين — وهو حال أغلب الصور بمنصة ناشئة. أول تقييم أهم
       لحظة له، فأضفنا العتبة ١. */
    if(![1,3,10,25,50].includes(n))return;
    const avg=(list.reduce((s,x)=>s+x,0)/n).toFixed(1);
    /* «1 تقييماً» ركيك، وصار يظهر الآن بأول تقييم — وهو أول ما يقرؤه المصوّر */
    const cnt = n===1?'تقييم واحد' : n===2?'تقييمان' : n<=10?n+' تقييمات' : n+' تقييماً';
    pushNotify({
      title:'⭐ صورتك نالت '+avg,
      body:'«'+ph.title+'» — '+cnt+' حتى الآن',
      url:'/',
      user_ids:[ph.user_id]
    });
  }catch(e){}
}

export function renderPoll(){
  const b=state.curPhoto.badge_counts||{};
  $('pollChips').innerHTML=BADGES.map(bd=>
    `<div class="chip ${state.myBadgeSet.has(bd.k)?'on':''}" onclick="voteBadge('${bd.k}')">${bd.label}<span class="n">${b[bd.k]||0}</span></div>`
  ).join('');
}

export async function voteBadge(k){
  if(state.myBadgeSet.has(k)){
    state.myBadgeSet.delete(k);renderPoll();
    await sb.from('badge_votes').delete().eq('photo_id',state.curId).eq('user_id',currentUser()?.id).eq('badge_key',k);
  }else{
    state.myBadgeSet.add(k);renderPoll();
    const { error } = await sb.from('badge_votes').insert({photo_id:state.curId,user_id:currentUser()?.id,badge_key:k});
    if(error){state.myBadgeSet.delete(k);renderPoll();toast('تعذر التصويت',true);return}
  }
  await refreshOne();
}

export const BADGES = [
  {k:'wall',  label:'📱 خلفية شاشة'},
  {k:'mine',  label:'❤️ بحطها خلفية جوالي'},
  {k:'global',label:'🌍 تدخل مسابقات عالمية'},
  {k:'face',  label:'🇸🇦 واجهة تشرّف السعودية'},
  {k:'print', label:'🖼️ تستاهل تنطبع لوحة'}
];

export function topBadge(p){
  const b=p.badge_counts||{};let best=null,bv=0;
  for(const bd of BADGES)if((b[bd.k]||0)>bv){bv=b[bd.k];best=bd}
  return bv>=2?best:null;
}

/* ============ الحالة ============ */

export function renderComments(){
  const list=state.curPhoto._comments||[];
  $('cCount').textContent=`(${list.length})`;
  $('cList').innerHTML=list.length
    ?list.map(c=>`<div class="comment"><b>${esc(c.profiles?.display_name||'زائر')}</b>${esc(c.body)}</div>`).join('')
    :`<div style="color:var(--txt-dim);font-size:13px;padding:6px 2px">كن أول من يعلق ✍️</div>`;
}

export async function reportPhoto(){
  if(!confirm('هل أنت متأكد أن هذه الصورة مخالفة؟ البلاغات الكيدية قد تعرّض حسابك للحظر.'))return;
  const { error } = await sb.from('reports').insert({photo_id:state.curId,user_id:currentUser()?.id});
  if(error){
    if(error.code==='23505')toast('سبق أن أبلغت عن هذه الصورة');
    else toast('تعذر إرسال البلاغ',true);
    return;
  }
  toast('وصل بلاغك، شكراً لحرصك 🙏');
}

export async function addComment(){
  if(isAnon()){toast('سجّل أول عشان تعلق ✍️');closeSheet();openAcc();return}
  const t=$('cText').value.trim();if(!t)return;
  const bad=checkText(t);
  if(bad){toast(bad,true);return}
  const lim=await checkRate('comment');
  if(lim){toast(lim,true);return}
  const { error } = await sb.from('comments').insert({photo_id:state.curId,user_id:currentUser()?.id,body:t});
  if(error){toast('تعذر إرسال التعليق',true);return}
  logRate('comment');
  $('cText').value='';
  const cm=await sb.from('comments').select('body,created_at,profiles!user_id(display_name)').eq('photo_id',state.curId).order('created_at');
  state.curPhoto._comments=cm.data||[];renderComments();

  /* ═══ إشعار صاحب الصورة ═══
     كان التعليق يُدرج ويُرسم وينتهي — فلا يعلم صاحب الصورة بتعليقٍ
     عليها إلا إن رجع إليها بنفسه. والتعليق أثمن تفاعل بالمنصة لأنه
     يفتح حواراً، فبلا إشعارٍ يموت الحوار قبل أن يبدأ.
     بالخلفية: لا ننتظره ولا نُفشل التعليق إن تعثّر. */
  try{
    const ph=state.curPhoto;
    if(ph && ph.user_id && currentUser() && ph.user_id!==currentUser()?.id){
      const nm=(await sb.from('profiles').select('display_name')
                  .eq('id',currentUser()?.id).maybeSingle()).data?.display_name || 'أحدهم';
      pushNotify({
        title:'💬 تعليق جديد على صورتك',
        body:nm+': '+t.slice(0,80)+(t.length>80?'…':''),
        url:'./?p='+ph.id,   /* نسبي — يصحّ باللاب وبالإنتاج معاً */
        user_ids:[ph.user_id]
      });
    }
  }catch(e){ console.warn('[تعليق] تعذّر الإشعار', e); }
}

/* تحديث بيانات صورة واحدة من العرض المجمّع */

export async function refreshOne(){
  const { data } = await sb.from('photos_ranked').select('*').eq('id',state.curId).single();
  if(data){
    const i=state.photos.findIndex(x=>x.id===state.curId);
    if(i>-1)state.photos[i]={...data,_comments:state.curPhoto._comments};
    state.curPhoto=state.photos[i];
    drawStars();renderPoll();render();
  }
}

/* ====== عارض الزوم ====== */
