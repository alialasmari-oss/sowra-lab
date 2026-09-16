/* صورة من بلدي — features/search.js
   البحث الموحّد */

import { currentUser, sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { avatarUrl, imgUrl, thumbUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, esc } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const render = need('render');

export let _uSearchT=null;

export function openUserSearch(){
  const el=$('userSearchBox');if(!el)return;
  el.classList.add('show');
  $('usInput').value='';
  $('usResults').innerHTML='<div class="us-hint">اكتب اسم المصوّر أو جزءاً منه</div>';
  setTimeout(()=>{const i=$('usInput');if(i)i.focus()},220);
}

export function closeUserSearch(){
  const el=$('userSearchBox');
  if(el)el.classList.remove('show');
  clearTimeout(_uSearchT);
}

export function onUserSearchInput(){
  clearTimeout(_uSearchT);
  _uSearchT=setTimeout(runUserSearch,420);
}

export async function runUserSearch(){
  const q=($('usInput').value||'').trim();
  const box=$('usResults');if(!box)return;

  if(q.length<2){
    box.innerHTML='<div class="us-hint">اكتب حرفين على الأقل</div>';
    return;
  }
  box.innerHTML='<div class="loader" style="padding:18px">⏳</div>';

  try{
    const r=await sb.from('profiles')
      .select('id,display_name,region,avatar_path,bio')
      .ilike('display_name','%'+q+'%')
      .limit(24);
    let list=r.data||[];
    if(currentUser())list=list.filter(u=>u.id!==currentUser()?.id);

    if(!list.length){
      box.innerHTML='<div class="us-hint">ما لقينا أحداً بهذا الاسم</div>';
      return;
    }

    // عدد صور كل واحد
    const ids=list.map(u=>u.id);
    const counts={};
    try{
      state.photos.forEach(p=>{
        if(ids.includes(p.user_id))counts[p.user_id]=(counts[p.user_id]||0)+1;
      });
    }catch(e){}

    box.innerHTML=list.map(u=>{
      const n=counts[u.id]||0;
      return `<div class="us-row" onclick="closeUserSearch();openProfile('${u.id}')">
        ${u.avatar_path?`<img src="${avatarUrl(u.avatar_path)}" alt="">`:'<div class="us-ph">📷</div>'}
        <div class="us-info">
          <div class="us-name">${esc(u.display_name||'مصوّر')}</div>
          <div class="us-meta">${u.region?'📍 '+esc(u.region)+' · ':''}${n} ${n===1?'صورة':n<11?'صور':'صورة'}</div>
        </div>
        <span class="us-go">←</span>
      </div>`;
    }).join('');
  }catch(e){
    box.innerHTML='<div class="us-hint">تعذر البحث</div>';
  }
}

/* ====== التنقل من الفلتر ====== */

export let _uniT=null;

export function onUniSearch(){
  clearTimeout(_uniT);
  _uniT=setTimeout(runUniSearch,350);
}

export function setUniTab(t){
  state.uniTab=t;
  ['P','U','L'].forEach(x=>{
    const e=document.getElementById('urTab'+x);
    if(e)e.classList.remove('on');
  });
  const map={photos:'P',users:'U',places:'L'};
  const b=document.getElementById('urTab'+map[t]);
  if(b)b.classList.add('on');
  renderUniBody();
}

export async function runUniSearch(){
  const q=($('q').value||'').trim();
  const box=$('uniResults');
  if(!box)return;

  if(q.length<2){
    box.style.display='none';
    render();
    return;
  }

  // ═══ الصور ═══
  const ph=state.photos.filter(p=>
    p.media_type!=='video'&&p.visibility!=='private'&&(
      (p.title||'').includes(q)||
      (p.village||'').includes(q)||
      (p.city||'').includes(q)||
      (p.region||'').includes(q)||
      (p.country||'').includes(q)||
      (p.photographer||'').includes(q)
    )
  ).slice(0,30);

  // ═══ الأماكن ═══
  const pl={};
  state.photos.forEach(p=>{
    [p.village,p.city].forEach(nm=>{
      if(nm&&nm.includes(q)){
        const k=nm+'|'+(p.region||p.country||'');
        pl[k]=pl[k]||{name:nm,area:p.region||p.country||'',n:0,lat:p.lat,lng:p.lng};
        pl[k].n++;
      }
    });
  });
  const places=Object.values(pl).sort((a,b)=>b.n-a.n).slice(0,20);

  // ═══ المصورون ═══
  let users=[];
  try{
    const r=await sb.from('profiles').select('id,display_name,region,avatar_path')
      .ilike('display_name','%'+q+'%').limit(20);
    users=(r.data||[]);
    if(currentUser())users=users.filter(u=>u.id!==currentUser()?.id);
  }catch(e){}

  state.uniData={photos:ph,users,places};
  $('urNP').textContent=ph.length;
  $('urNU').textContent=users.length;
  $('urNL').textContent=places.length;

  // نفتح التبويب الذي فيه نتائج
  if(!ph.length&&users.length)state.uniTab='users';
  else if(!ph.length&&!users.length&&places.length)state.uniTab='places';
  setUniTab(state.uniTab);
  box.style.display='block';
}

export function renderUniBody(){
  const el=$('urBody');if(!el)return;
  const d=state.uniData||{photos:[],users:[],places:[]};
  const t=state.uniTab;

  if(t==='photos'){
    if(!d.photos.length){el.innerHTML='<div class="ur-empty">ما لقينا صوراً</div>';return}
    el.innerHTML='<div class="ur-grid">'+d.photos.map(p=>`
      <div class="ur-ph" onclick="closeUni();openSheet(${p.id})">
        <img src="${thumbUrl(p.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'" loading="lazy" alt="">
        <div class="ur-ph-t">${esc(p.title)}</div>
      </div>`).join('')+'</div>';

  }else if(t==='users'){
    if(!d.users.length){el.innerHTML='<div class="ur-empty">ما لقينا مصوّرين</div>';return}
    const counts={};
    state.photos.forEach(p=>{counts[p.user_id]=(counts[p.user_id]||0)+1});
    el.innerHTML=d.users.map(u=>{
      const n=counts[u.id]||0;
      return `<div class="ur-row" onclick="closeUni();openProfile('${u.id}')">
        ${u.avatar_path?`<img src="${avatarUrl(u.avatar_path)}" alt="">`:'<div class="ur-ph-ic">📷</div>'}
        <div class="ur-info">
          <div class="ur-name">${esc(u.display_name||'مصوّر')}</div>
          <div class="ur-meta">${u.region?'📍 '+esc(u.region)+' · ':''}${n} ${n===1?'صورة':n<11?'صور':'صورة'}</div>
        </div>
        <span class="ur-go">←</span>
      </div>`;
    }).join('');

  }else{
    if(!d.places.length){el.innerHTML='<div class="ur-empty">ما لقينا أماكن</div>';return}
    el.innerHTML=d.places.map(p=>`
      <div class="ur-row" onclick="closeUni();jumpToPlace('${esc(p.name).replace(/'/g,"&#39;")}')">
        <div class="ur-ph-ic">📍</div>
        <div class="ur-info">
          <div class="ur-name">${esc(p.name)}</div>
          <div class="ur-meta">${esc(p.area)} · ${p.n} ${p.n===1?'صورة':p.n<11?'صور':'صورة'}</div>
        </div>
        <span class="ur-go">←</span>
      </div>`).join('');
  }
}

export function closeUni(){
  const b=$('uniResults');
  if(b)b.style.display='none';
}

export function jumpToPlace(name){
  const inp=$('q');
  if(inp)inp.value=name;
  closeUni();
  render();
}

/* ====== صفحة المصوّرين ====== */
state.shSort='photos';
