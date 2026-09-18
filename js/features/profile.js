/* صورة من بلدي — features/profile.js
   البروفايل والمتابعة والمصورون */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, rankOf } from '../core/format.js';
import { need } from '../core/hub.js';
import { avatarUrl, imgUrl, thumbUrl, vidUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, dbErr, esc, toast } from '../core/ui.js';
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
/* ═══ عبر الحاجز ═══
   coverUrl ← features/account-media.js
*/
const coverUrl = need('coverUrl');

export async function openProfile(uid){
  go('profile');
  state.profUid=uid;state.profTab='public';
  $('profHead').innerHTML='<div class="loader">⏳</div>';
  const r=await sb.from('profiles').select('display_name,bio,region,avatar_path,cover_path,dm_open,dm_banned').eq('id',uid).maybeSingle();
  const pr=r.data||{};
  const mine=state.photos.filter(x=>x.user_id===uid);
  const pub=mine.filter(x=>x.visibility!=='private');
  const totV=pub.reduce((s,x)=>s+(x.views||0),0);
  const rk=mine.length?rankOf(mine[0]):{ic:'🌱',t:'مستكشف',c:'bronze'};
  const fo=mine.length?(mine[0].followers_count||0):0;
  let fg=0;
  try{
    const fr=await sb.from('follows').select('followed_id',{count:'exact',head:true}).eq('follower_id',uid);
    fg=fr.count||0;
  }catch(e){}
  const isMe=!!(currentUser()&&currentUser()?.id===uid);

  // الغلاف: المرفوع من حسابي، أو الأعلى تقييماً
  let coverSrc='';
  if(pr.cover_path)coverSrc=coverUrl(pr.cover_path)+'?t='+Date.now();
  else if(pub.length){
    const top1=pub.slice().sort((a,b)=>(b.avg_stars||0)-(a.avg_stars||0))[0];
    if(top1)coverSrc=thumbUrl(top1.image_path);
  }

  const av=pr.avatar_path?(avatarUrl(pr.avatar_path)+'?t='+Date.now()):'';

  $('profHead').innerHTML=`
    <div class="pf-cover">
      ${coverSrc?`<img src="${coverSrc}" alt="">`:'<div class="pf-cover-empty">🏔️</div>'}
      ${isMe?`<button class="pf-cam" onclick="go('acc')">🖼️ غيّره من حسابي</button>`:''}
    </div>
    <div class="pf-head">
      <div class="pf-avatar-wrap">
        ${av?`<img class="pf-avatar" src="${av}" alt="">`:`<div class="pf-avatar-ph">${rk.ic}</div>`}
        ${isMe?`<button class="pf-avatar-cam" onclick="document.getElementById('avatarFile').click()" title="غيّر صورتك">📷</button>`:''}
      </div>
      <div class="pf-name">${esc(pr.display_name||'مصوّر')}</div>
      <div class="pf-meta">
        <span class="rankchip r-${rk.c}">${rk.ic} ${rk.t}</span>
        ${pr.region?' · 📍 '+esc(pr.region):''}
      </div>
      ${pr.bio?`<div class="pf-bio">${esc(pr.bio)}</div>`:''}
      <div class="pf-stats">
        <div class="pf-stat"><b>${pub.length}</b><span>صورة</span></div>
        <div class="pf-stat" onclick="showFollows('${uid}','followers')"><b>${fo}</b><span>متابع</span></div>
        <div class="pf-stat" onclick="showFollows('${uid}','following')"><b>${fg}</b><span>يتابع</span></div>
        <div class="pf-stat"><b>${totV}</b><span>مشاهدة</span></div>
      </div>
      <div class="pf-acts">
        <button class="pf-act" onclick="shareProfile('${uid}')">📤 شارك</button>
        ${(!isMe&&currentUser()&&!isAnon()&&pr.dm_open!==false&&!(state.myBlocks&&state.myBlocks.has(uid)))?`<button class="pf-act" onclick="openDmBox('${uid}','${esc(pr.display_name||'مصوّر')}')">✉️ راسله</button>`:''}
        ${(!isMe&&currentUser()&&!isAnon())?(
          (state.myBlocks&&state.myBlocks.has(uid))
            ? `<button class="pf-act" style="border-color:var(--palm);color:var(--palm)" onclick="unblockUser('${uid}','${esc(pr.display_name||'مصوّر')}')">✅ فك الحظر</button>`
            : `<button class="pf-act" style="border-color:var(--sadu);color:var(--sadu)" onclick="blockUser('${uid}','${esc(pr.display_name||'مصوّر')}')">🚫 احظره</button>`
        ):''}
      </div>
      ${(!isMe&&state.isAdmin)?`
      <div class="pf-admin">
        <div class="pa-lbl">🛡️ أدوات الإشراف</div>
        <div class="pa-row">
          ${pr.dm_banned
            ? `<button class="pa-btn ok" onclick="admProfDmBan('${uid}',false,'${esc(pr.display_name||'مصوّر').replace(/'/g,"&#39;")}')">✅ ارفع منع المراسلة</button>`
            : `<button class="pa-btn bad" onclick="admProfDmBan('${uid}',true,'${esc(pr.display_name||'مصوّر').replace(/'/g,"&#39;")}')">🚫 امنعه من المراسلة</button>`}
        </div>
        ${pr.dm_banned?'<div class="pa-note">🚫 ممنوع من إرسال الرسائل حالياً</div>':''}
      </div>`:''}
      <div style="display:none">
        ${isMe?`<button class="pf-act primary" onclick="go('acc')">⚙️ عدّل بياناتي</button>`:''}
      </div>
      <div class="pf-badges" id="profBadges"></div>
    </div>
    ${isMe?`<div class="prof-tabs" id="profTabs"></div>`:''}`;

  loadUserBadges(uid).then(bs=>{
    const be=$('profBadges');if(!be)return;
    be.innerHTML=bs.map(b=>`<span class="prof-badge">${b.badge_icon||'🏆'} ${esc(b.badge_name||b.title)}</span>`).join('');
  });

  renderProfTabs();
  renderProfFeed();
}
export function renderProfTabs(){
  const el=$('profTabs');if(!el)return;
  const mine=state.photos.filter(x=>x.user_id===state.profUid);
  const pub=mine.filter(x=>x.visibility!=='private').length;
  const prv=mine.filter(x=>x.visibility==='private').length;
  el.innerHTML=`
    <button class="prof-tab ${state.profTab==='public'?'on':''}" onclick="switchProfTab('public')">🌍 عامة (${pub})</button>
    <button class="prof-tab ${state.profTab==='private'?'on':''}" onclick="switchProfTab('private')">🔒 خزنتي (${prv})</button>`;
}
export function switchProfTab(t){
  state.profTab=t;
  renderProfTabs();
  renderProfFeed();
}
export function renderProfFeed(){
  const el=$('profFeed');if(!el)return;
  const isMe=!!(currentUser()&&currentUser()?.id===state.profUid);
  let list=state.photos.filter(x=>x.user_id===state.profUid);
  list = isMe
    ? list.filter(x=> state.profTab==='private' ? x.visibility==='private' : x.visibility!=='private')
    : list.filter(x=>x.visibility!=='private');

  if(!list.length){
    el.innerHTML=(isMe&&state.profTab==='private')
      ? '<div class="vault-empty">🔒 خزنتك فاضية<br><span style="font-size:12px">عند النشر اختر «خزنتي»</span></div>'
      : '<div class="empty">ما نشر صوراً بعد</div>';
    return;
  }
  el.innerHTML=list.map(p=>{
    const isV=p.media_type==='video';
    const src=isV?vidUrl(p.image_path):thumbUrl(p.image_path);
    return `<div class="mcard" onclick="openSheet(${p.id})">
      ${isV?`<video src="${src}#t=0.5" muted playsinline preload="metadata"></video>`
           :`<img src="${src}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'" loading="lazy" decoding="async" alt="${esc(p.title)}">`}
      ${p.visibility==='private'?'<div class="mc-lock">🔒</div>':''}
      ${isV?'<div class="mc-vid">▶</div>':''}
      <div class="mc-overlay"><div class="mc-title">${esc(p.title)}</div></div>
    </div>`;
  }).join('');
}
/* ====== نصيحة الطقس للمصور ====== */

/* state.favSet → state.favSet */
export async function renderFollow(p){
  const el=$('sFollow');if(!el)return;
  const mine=currentUser()&&p.user_id===currentUser()?.id;
  let following=false;
  if(currentUser()&&!isAnon()&&!mine){
    const r=await sb.from('follows').select('follower_id').eq('follower_id',currentUser()?.id).eq('followed_id',p.user_id).maybeSingle();
    following=!!r.data;
  }
  const rk=rankOf(p);
  el.innerHTML=`<span class="rankchip r-${rk.c}" style="cursor:pointer" onclick="closeSheet();openProfile('${p.user_id}')">${rk.ic} ${rk.t}</span><span class="fcount">👥 ${p.followers_count||0} متابع</span>`
    +(mine?'':`<button class="fbtn ${following?'on':''}" onclick="toggleFollow('${p.user_id}',${following})">${following?'✓ متابَع':'＋ متابعة'}</button>`)
    +`<button class="fbtn fav ${state.favSet.has(p.id)?'on':''}" onclick="toggleFav(${p.id})">${state.favSet.has(p.id)?'❤️ بالمفضلة':'🤍 حفظ'}</button>`;
}
export async function toggleFollow(uid,isF){
  if(isAnon()){toast('سجّل أول عشان تتابع المصورين 👥');closeSheet();openAcc();return}
  if(isF){await sb.from('follows').delete().eq('follower_id',currentUser()?.id).eq('followed_id',uid);}
  else{
    const{error}=await sb.from('follows').insert({follower_id:currentUser()?.id,followed_id:uid});
    if(error){dbErr('المتابعة',error,'تعذرت المتابعة');return}
    toast('صرت متابعاً 👥');
  }
  await refreshOne();
  renderFollow(state.curPhoto);
}
export async function showFollows(uid,kind){
  const el=$('followsBox');if(!el)return;
  el.classList.add('show');
  $('fbTitle').textContent=kind==='followers'?'👥 المتابعون':'👤 يتابعهم';
  $('fbList').innerHTML='<div class="loader" style="padding:20px">⏳</div>';
  try{
    const col=kind==='followers'?'follower_id':'followed_id';
    const filt=kind==='followers'?'followed_id':'follower_id';
    const r=await sb.from('follows').select(col+',profiles!'+col+'(id,display_name,avatar_path,region)').eq(filt,uid);
    const list=(r.data||[]).map(x=>x.profiles).filter(Boolean);
    if(!list.length){
      $('fbList').innerHTML='<div style="padding:22px;text-align:center;font-size:13px;color:var(--txt-dim)">'
        +(kind==='followers'?'ما فيه متابعون بعد':'ما يتابع أحداً بعد')+'</div>';
      return;
    }
    $('fbList').innerHTML=list.map(u=>`
      <div class="fb-row" onclick="closeFollows();openProfile('${u.id}')">
        ${u.avatar_path?`<img src="${avatarUrl(u.avatar_path)}" alt="">`:'<div class="fb-ph">📷</div>'}
        <div class="fb-info">
          <div class="fb-name">${esc(u.display_name||'مصوّر')}</div>
          ${u.region?`<div class="fb-reg">📍 ${esc(u.region)}</div>`:''}
        </div>
        <span class="fb-go">←</span>
      </div>`).join('');
  }catch(e){
    $('fbList').innerHTML='<div style="padding:20px;text-align:center;font-size:12px;color:var(--txt-dim)">تعذر التحميل</div>';
  }
}
export function closeFollows(){
  const el=$('followsBox');
  if(el)el.classList.remove('show');
}

/* ====== نشر المشرف بالسوشال ====== */
export async function loadUserBadges(uid){
  try{
    const c=await sb.from('quest_completions').select('quest_id').eq('user_id',uid);
    const ids=(c.data||[]).map(x=>x.quest_id);
    if(!ids.length)return [];
    const q=await sb.from('quests').select('id,badge_icon,badge_name,title').in('id',ids);
    return q.data||[];
  }catch(e){return []}
}

/* ====== تفعيل الفيديو ====== */
export function openShooters(){
  go('shooters');
  renderShooters();
}
export function shSetSort(s){
  state.shSort=s;
  renderShooters();
}
export async function renderShooters(){
  const el=$('shootersBody');if(!el)return;
  el.innerHTML='<div class="loader" style="padding:20px">⏳</div>';

  // شريط الفرز
  const sb_=$('shSort');
  const S=state.shSort;
  if(sb_){
    sb_.innerHTML=[
      ['photos','📷 الأكثر نشراً'],
      ['stars','⭐ الأعلى تقييماً'],
      ['visits','👣 الأكثر زيارة'],
      ['new','🕐 الأحدث']
    ].map(x=>`<button class="${S===x[0]?'on':''}" onclick="shSetSort('${x[0]}')">${x[1]}</button>`).join('');
  }

  try{
    // نجمّع من الصور المنشورة
    const agg={};
    state.photos.filter(p=>p.visibility!=='private').forEach(p=>{
      if(!p.user_id)return;
      const a=agg[p.user_id]=agg[p.user_id]||{
        uid:p.user_id, name:p.photographer||'مصوّر',
        n:0, stars:0, rated:0, visits:0, last:p.created_at, region:p.region||''
      };
      a.n++;
      if(p.avg_stars>0){a.stars+=Number(p.avg_stars);a.rated++}
      a.visits+=(state.visitCounts[p.id]||0);
      if(p.created_at>a.last)a.last=p.created_at;
      if(!a.region&&p.region)a.region=p.region;
    });

    let list=Object.values(agg);
    if(!list.length){
      el.innerHTML='<div class="empty" style="padding:26px"><span class="big">📷</span>ما فيه مصوّرون بعد</div>';
      return;
    }

    list.forEach(a=>{a.avg=a.rated?(a.stars/a.rated):0});

    // الفرز
    if(S==='stars')list.sort((x,y)=>(y.avg-x.avg)||(y.n-x.n));
    else if(S==='visits')list.sort((x,y)=>(y.visits-x.visits)||(y.n-x.n));
    else if(S==='new')list.sort((x,y)=>new Date(y.last)-new Date(x.last));
    else list.sort((x,y)=>(y.n-x.n)||(y.avg-x.avg));

    // الصور الشخصية
    const avatars={};
    try{
      const ids=list.slice(0,60).map(a=>a.uid);
      const pr=await sb.from('profiles').select('id,avatar_path,region').in('id',ids);
      (pr.data||[]).forEach(u=>{avatars[u.id]={av:u.avatar_path,rg:u.region}});
    }catch(e){}

    el.innerHTML=list.slice(0,60).map((a,i)=>{
      const inf=avatars[a.uid]||{};
      const rg=inf.rg||a.region;
      const medal=(i<3&&S!=='new')?['🥇','🥈','🥉'][i]:'';
      const rk=(typeof rankOf==='function')?rankOf({photographer_photos:a.n}):{ic:'🌱'};
      return `<div class="sh-card" onclick="openProfile('${a.uid}')">
        ${medal?`<div class="sh-medal">${medal}</div>`:''}
        ${inf.av?`<img class="sh-av" src="${avatarUrl(inf.av)}" alt="">`:'<div class="sh-av sh-ph">📷</div>'}
        <div class="sh-info">
          <div class="sh-name">${rk.ic} ${esc(a.name)}</div>
          ${rg?`<div class="sh-reg">📍 ${esc(rg)}</div>`:''}
          <div class="sh-stats">
            <span>📷 ${a.n}</span>
            ${a.avg>0?`<span>⭐ ${a.avg.toFixed(1)}</span>`:''}
            ${a.visits>0?`<span>👣 ${a.visits}</span>`:''}
          </div>
        </div>
        <span class="sh-go">←</span>
      </div>`;
    }).join('');
  }catch(e){
    el.innerHTML='<div class="empty" style="padding:20px">تعذر التحميل</div>';
  }
}

/* ====== فلتر اختيار المحررين ====== */
state.onlyEc=false;

/* بروفايلي — بديل openProfile بمعرّف المستخدم العام القديم */
export function openMyProfile(){
  const u = currentUser();
  if(!u || isAnon()){ toast('سجّل أول عشان يكون لك بروفايل 👤', true); return; }
  openProfile(u.id);
}
