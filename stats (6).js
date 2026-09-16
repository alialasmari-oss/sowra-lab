/* صورة من بلدي — features/stats.js
   إحصائيات المستخدم */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, rankOf } from '../core/format.js';
import { need } from '../core/hub.js';
import { avatarUrl, imgUrl, thumbUrl, vidUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   openAcc ← features/account.js
   renderAccIn ← features/account.js
*/
const openAcc = need('openAcc');
const renderAccIn = need('renderAccIn');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');
const maybeAskNotifs = need('maybeAskNotifs');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const checkRaceProgress = need('checkRaceProgress');
const closeSheet = need('closeSheet');
const loadPhotos = need('loadPhotos');
const openSheet = need('openSheet');
const pushNotify = need('pushNotify');
const refreshOne = need('refreshOne');
const render = need('render');
const showJoinBox = need('showJoinBox');
export async function renderMyStats(){
  const el=$('myStats');if(!el)return;
  if(isAnon()){el.innerHTML='';return}
  el.innerHTML='<div class="loader" style="padding:14px">⏳</div>';
  try{
    const mine=state.photos.filter(x=>x.user_id===currentUser()?.id&&x.visibility!=='private');
    const ids=mine.map(x=>x.id);
    const since=new Date(Date.now()-7*86400000).toISOString();

    // نشاط الأسبوع الحقيقي — على كل صورك
    const newPhotos=mine.filter(x=>x.created_at>=since).length;
    let newRatings=0,newComments=0,newVisits=0;
    if(ids.length){
      try{
        const [r1,r2,r3]=await Promise.all([
          sb.from('ratings').select('photo_id',{count:'exact',head:true}).in('photo_id',ids).gte('created_at',since),
          sb.from('comments').select('id',{count:'exact',head:true}).in('photo_id',ids).gte('created_at',since),
          sb.from('visits').select('photo_id',{count:'exact',head:true}).in('photo_id',ids).gte('created_at',since)
        ]);
        newRatings=r1.count||0;newComments=r2.count||0;newVisits=r3.count||0;
      }catch(e){}
    }

    const S=state.statsSort;
    const sorted=mine.slice().sort((a,b)=>{
      if(S==='views')return (b.views||0)-(a.views||0);
      if(S==='comments')return (b.comments_count||0)-(a.comments_count||0);
      if(S==='new')return new Date(b.created_at)-new Date(a.created_at);
      const d=(b.avg_stars||0)-(a.avg_stars||0);
      return d!==0?d:((b.ratings_count||0)-(a.ratings_count||0));
    }).slice(0,18);

    el.innerHTML=`
      <div class="st-week">نشاطك آخر ٧ أيام</div>
      <div class="st-cards">
        <div class="st-card"><b>${newPhotos}</b><span>📸 نشرت</span></div>
        <div class="st-card"><b>${newRatings}</b><span>⭐ تقييم</span></div>
        <div class="st-card"><b>${newComments}</b><span>💬 تعليق</span></div>
        <div class="st-card"><b>${newVisits}</b><span>👣 زيارة</span></div>
      </div>

      ${(function(){
        const wk=mine.filter(x=>x.created_at>=since);
        if(!wk.length)return '<div class="st-empty">ما نشرت شيئاً هذا الأسبوع — <b onclick="go(\'add\')">انشر صورة الآن</b></div>';
        return '<div class="st-week" style="margin-top:16px">صور هذا الأسبوع</div><div class="st-grid">'+wk.map(function(p){
          const isV=p.media_type==='video';
          const src=isV?vidUrl(p.image_path):thumbUrl(p.image_path);
          return '<div class="st-item" onclick="openSheet('+p.id+')" title="'+esc(p.title)+'">'
            +'<div class="st-thumb">'
            +(isV?'<video src="'+src+'#t=0.4" muted playsinline preload="metadata"></video>':'<img src="'+src+'" loading="lazy" alt="">')
            +((p.avg_stars>0)?'<div class="st-star">★ '+Number(p.avg_stars).toFixed(1)+'</div>':'')
            +'</div><div class="st-nums"><span>👁️ '+(p.views||0)+'</span><span>⭐ '+(p.ratings_count||0)+'</span><span>💬 '+(p.comments_count||0)+'</span></div></div>';
        }).join('')+'</div>';
      })()}

      <div class="st-sortbar" style="margin-top:20px">
        <span>كل أعمالك — ترتيب حسب</span>
        <div class="st-sorts">
          <button class="st-sort${S==='stars'?' on':''}" onclick="stSetSort('stars')" title="التقييم">⭐</button>
          <button class="st-sort${S==='views'?' on':''}" onclick="stSetSort('views')" title="المشاهدات">👁️</button>
          <button class="st-sort${S==='comments'?' on':''}" onclick="stSetSort('comments')" title="التعليقات">💬</button>
          <button class="st-sort${S==='new'?' on':''}" onclick="stSetSort('new')" title="الأحدث">🕐</button>
        </div>
      </div>

      ${sorted.length?`<div class="st-grid">${sorted.map(p=>{
        const isV=p.media_type==='video';
        const src=isV?vidUrl(p.image_path):thumbUrl(p.image_path);
        return `<div class="st-item" onclick="openSheet(${p.id})" title="${esc(p.title)}">
          <div class="st-thumb">
            ${isV?`<video src="${src}#t=0.4" muted playsinline preload="metadata"></video>`
                 :`<img src="${src}" loading="lazy" alt="">`}
            ${(p.avg_stars>0)?`<div class="st-star">★ ${Number(p.avg_stars).toFixed(1)}</div>`:''}
          </div>
          <div class="st-nums">
            <span>👁️ ${p.views||0}</span>
            <span>⭐ ${p.ratings_count||0}</span>
            <span>💬 ${p.comments_count||0}</span>
          </div>
        </div>`;
      }).join('')}</div>`
      :'<div style="font-size:12.5px;color:var(--txt-dim);padding:10px;text-align:center">ما نشرت صوراً بعد</div>'}`;
  }catch(e){
    el.innerHTML='<div style="font-size:12px;color:var(--txt-dim)">تعذر تحميل الإحصائيات</div>';
  }
}
export function stSetSort(s){state.statsSort=s;renderMyStats()}

/* ====== حفظ بيانات البروفايل كاملة ====== */
