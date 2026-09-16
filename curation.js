/* صورة من بلدي — admin/curation.js
   اختيار المحررين */

import { currentUser, sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { imgUrl, thumbUrl } from '../core/media.js';
import { isCurator, isEditor, state } from '../core/state.js';
import { $, esc, prompt, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   admRender ← admin/index.js
   loadPhotos ← features/feed.js
   needEditor ← admin/team.js
   pushNotify ← features/notify.js
*/
const admRender = need('admRender');
const loadPhotos = need('loadPhotos');
const needEditor = need('needEditor');
const pushNotify = need('pushNotify');

export async function loadEC(){
  const el=$('admEC');if(!el)return;
  if(!isCurator()){
    el.innerHTML='<div class="empty" style="padding:26px"><span class="big">🔒</span>هذا القسم للمحررين</div>';
    return;
  }
  el.innerHTML='<div class="empty">⏳</div>';
  try{
    const r=await sb.from('ec_nominations').select('*').eq('status','open')
      .order('created_at',{ascending:false});
    const noms=r.data||[];

    // عدد المحررين
    let curators=1;
    try{
      const [cu,ad]=await Promise.all([
        sb.from('curators').select('id'),
        sb.from('admins').select('id,role')
      ]);
      const s=new Set((cu.data||[]).map(x=>x.id));
      (ad.data||[]).forEach(x=>{if(x.role==='owner'||x.role==='editor')s.add(x.id)});
      curators=s.size||1;
    }catch(e){}
    const quorum=Math.max(2,Math.ceil(curators/2));

    // الأصوات
    const votes={};
    let myVotes={};
    if(noms.length){
      try{
        const ids=noms.map(n=>n.id);
        const v=await sb.from('ec_votes').select('nom_id,voter,vote').in('nom_id',ids);
        (v.data||[]).forEach(x=>{
          votes[x.nom_id]=votes[x.nom_id]||{yes:0,no:0};
          votes[x.nom_id][x.vote]++;
          if(currentUser()&&x.voter===currentUser()?.id)myVotes[x.nom_id]=x.vote;
        });
      }catch(e){}
    }

    // أسماء المرشِّحين
    const names={};
    try{
      const uids=[...new Set(noms.map(n=>n.nominated_by))];
      if(uids.length){
        const pr=await sb.from('profiles').select('id,display_name').in('id',uids);
        (pr.data||[]).forEach(u=>{names[u.id]=u.display_name||'محرّر'});
      }
    }catch(e){}

    const head=`<div class="ec-head">
      <div class="ec-h1">🏵️ ترشيحات اختيار المحررين</div>
      <div class="ec-h2">${noms.length} مفتوحة · ${curators} محرّراً · تحتاج ${quorum} أصوات للاعتماد</div>
    </div>`;

    if(!noms.length){
      el.innerHTML=head+'<div class="empty" style="padding:24px"><span class="big">🏵️</span>ما فيه ترشيحات مفتوحة<br><span style="font-size:12px">رشّح صورة من تبويب 🗂️ الصور</span></div>';
      return;
    }

    el.innerHTML=head+noms.map(n=>{
      const p=state.admPhotos.find(x=>x.id===n.photo_id)||state.photos.find(x=>x.id===n.photo_id);
      const v=votes[n.id]||{yes:0,no:0};
      const mine=myVotes[n.id];
      const ready=v.yes>=quorum;
      return `<div class="ec-card${ready?' ready':''}">
        <div class="ec-top">
          ${p?`<img src="${thumbUrl(p.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'" onclick="openSheet(${p.id})" alt="">`:'<div class="ec-noimg">📷</div>'}
          <div class="ec-info">
            <div class="ec-title">${p?esc(p.title):'صورة #'+n.photo_id}</div>
            ${p?`<div class="ec-meta">${esc(p.photographer||'')} · ${esc(p.village||p.city||p.country||'')}</div>`:''}
            <div class="ec-by">رشّحها: ${esc(names[n.nominated_by]||'محرّر')}</div>
            ${n.reason?`<div class="ec-reason">«${esc(n.reason)}»</div>`:''}
          </div>
        </div>
        <div class="ec-votes">
          <div class="ec-bar">
            <span class="ec-yes">✓ ${v.yes}</span>
            <span class="ec-no">✕ ${v.no}</span>
            ${ready?'<span class="ec-ready">جاهزة للاعتماد</span>':`<span class="ec-need">تحتاج ${need-v.yes} أصوات</span>`}
          </div>
          <div class="ec-btns">
            <button class="ec-v yes ${mine==='yes'?'on':''}" onclick="ecVote(${n.id},'yes')">✓ أوافق</button>
            <button class="ec-v no ${mine==='no'?'on':''}" onclick="ecVote(${n.id},'no')">✕ أعترض</button>
            ${(ready&&isEditor())?`<button class="ec-approve" onclick="ecApprove(${n.id},${n.photo_id})">🏵️ اعتمدها</button>`:''}
            ${isEditor()?`<button class="ec-rej" onclick="ecReject(${n.id})">🗑️</button>`:''}
          </div>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    el.innerHTML='<div class="empty" style="padding:20px">تعذر التحميل: '+esc(e.message||'')+'</div>';
  }
}

/* ═══ ترشيح صورة ═══ */

export async function ecNominate(pid){
  if(!isCurator()){toast('🔒 الترشيح للمحررين',true);return}
  const reason=prompt('ليش تستاهل هذي الصورة؟ (اختياري)','');
  if(reason===null)return;

  const {error}=await sb.from('ec_nominations').insert({
    photo_id:pid,
    nominated_by:currentUser()?.id,
    reason:(reason||'').trim().slice(0,200)
  });
  if(error){
    if(error.code==='23505'){toast('مرشّحة أصلاً 🏵️',true);return}
    toast('تعذر الترشيح: '+error.message,true);return;
  }

  // صوت المرشِّح تلقائي
  try{
    const nn=(await sb.from('ec_nominations').select('id').eq('photo_id',pid).maybeSingle()).data;
    if(nn)await sb.from('ec_votes').insert({nom_id:nn.id,voter:currentUser()?.id,vote:'yes'});
  }catch(e){}

  // إشعار المحررين
  try{
    const [cu,ad]=await Promise.all([
      sb.from('curators').select('id'),
      sb.from('admins').select('id,role')
    ]);
    const s=new Set((cu.data||[]).map(x=>x.id));
    (ad.data||[]).forEach(x=>{if(x.role==='owner'||x.role==='editor')s.add(x.id)});
    s.delete(currentUser()?.id);
    const ids=[...s];
    if(ids.length&&typeof pushNotify==='function'){
      const p=state.admPhotos.find(x=>x.id===pid)||state.photos.find(x=>x.id===pid);
      pushNotify({
        title:'🏵️ ترشيح جديد',
        body:'صورة «'+((p&&p.title)||'')+'» تنتظر تصويتك',
        url:'/',
        user_ids:ids
      });
    }
  }catch(e){}

  toast('🏵️ انترشّحت — وصل المحررين إشعار');
  if(state.admTab==='ec')loadEC();
}

/* ═══ التصويت ═══ */

export async function ecVote(nomId,vote){
  if(!isCurator()){toast('🔒 التصويت للمحررين',true);return}
  const {error}=await sb.from('ec_votes').upsert(
    {nom_id:nomId,voter:currentUser()?.id,vote},
    {onConflict:'nom_id,voter'}
  );
  if(error){toast('تعذر التصويت: '+error.message,true);return}
  toast(vote==='yes'?'✓ سجّلنا موافقتك':'✕ سجّلنا اعتراضك');
  loadEC();
}

/* ═══ الاعتماد ═══ */

export async function ecApprove(nomId,pid){
  if(!needEditor('اعتماد الاختيار'))return;
  if(!confirm('اعتماد هذي الصورة كـ«اختيار المحررين»؟\n\nراح تنال الوسام ويوصل صاحبها إشعار.'))return;

  const u1=await sb.from('photos').update({editors_choice:true,ec_at:new Date().toISOString()}).eq('id',pid);
  if(u1.error){toast('تعذر الاعتماد: '+u1.error.message,true);return}
  await sb.from('ec_nominations').update({status:'approved',decided_at:new Date().toISOString()}).eq('id',nomId);

  // إشعار ورسالة لصاحب الصورة
  try{
    const p=(await sb.from('photos').select('user_id,title').eq('id',pid).maybeSingle()).data;
    if(p&&p.user_id){
      if(typeof pushNotify==='function')pushNotify({
        title:'🏵️ صورتك اختيار المحررين!',
        body:'«'+(p.title||'')+'» نالت وسام اختيار المحررين',
        url:'/',
        user_ids:[p.user_id]
      });
      await sb.from('feedback').insert({
        user_id:p.user_id, kind:'other', status:'done',
        body:'🏵️ مبروك! صورتك «'+(p.title||'')+'» اختارها المحررون\n\n'
          +'هيئة المحررين رشّحتها وصوّتت لها — وصارت تحمل وسام «اختيار المحررين» 🏵️\n\n'
          +'واصل عدستك، وشكراً لأنك توثّق جمال ديارنا.'
      });
    }
  }catch(e){}

  toast('🏵️ انعتمدت — وانبلّغ صاحبها');
  loadEC();
  if(typeof loadPhotos==='function')loadPhotos();
}

export async function ecReject(nomId){
  if(!needEditor('رفض الترشيح'))return;
  if(!confirm('رفض هذا الترشيح؟'))return;
  const {error}=await sb.from('ec_nominations').update({status:'rejected',decided_at:new Date().toISOString()}).eq('id',nomId);
  if(error){toast('تعذر الرفض: '+error.message,true);return}
  toast('انرفض الترشيح');
  loadEC();
}

/* ═══ سحب الوسام ═══ */

export async function ecRevoke(pid){
  if(!needEditor('سحب الوسام'))return;
  if(!confirm('سحب وسام اختيار المحررين من هذي الصورة؟'))return;
  const {error}=await sb.from('photos').update({editors_choice:false,ec_at:null}).eq('id',pid);
  if(error){toast('تعذر السحب: '+error.message,true);return}
  await sb.from('ec_nominations').delete().eq('photo_id',pid);
  toast('انسحب الوسام');
  if(typeof loadAllPhotos==='function')admRender();
  if(typeof loadPhotos==='function')loadPhotos();
}

/* ═══════════════════════════════════════════
   بنر التحديثات + الإشعار الجماعي
   ═══════════════════════════════════════════ */
