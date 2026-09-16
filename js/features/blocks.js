/* صورة من بلدي — features/blocks.js
   الحظر والمنع */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, timeAgo } from '../core/format.js';
import { need } from '../core/hub.js';
import { isEditor, state } from '../core/state.js';
import { $, esc, prompt, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   notifyDmBan ← admin/reports.js
*/
const notifyDmBan = need('notifyDmBan');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const openProfile = need('openProfile');
const pushNotify = need('pushNotify');
const showJoinBox = need('showJoinBox');
/* ═══ عبر الحاجز (نُقل للهيدر) ═══
*/
const closeDmBox = need('closeDmBox');
const dmUnreadCount = need('dmUnreadCount');
const renderInbox = need('renderInbox');
export async function loadMyBlocks(){
  try{
    if(isAnon()){state.myBlocks=new Set();return}
    const r=await sb.from('dm_blocks').select('blocked').eq('blocker',currentUser()?.id);
    state.myBlocks=new Set((r.data||[]).map(x=>x.blocked));
  }catch(e){}
}

/* هل أحدنا حاظر الآخر؟ */

export async function isBlockedWith(uid){
  try{
    if(isAnon())return false;
    const r=await sb.from('dm_blocks').select('blocker,blocked')
      .or('and(blocker.eq.'+currentUser()?.id+',blocked.eq.'+uid+'),and(blocker.eq.'+uid+',blocked.eq.'+currentUser()?.id+')');
    return !!(r.data&&r.data.length);
  }catch(e){return false}
}

export async function blockUser(uid,name){
  if(isAnon()){toast('❤️ سجّل مجاناً وتحفظ مفضلتك',true);showJoinBox();return}
  if(!confirm('حظر '+(name||'هذا العضو')+'؟\n\n· ما يقدر يراسلك\n· ما تقدر تراسله\n· رسائله تختفي من صندوقك'))return;
  const {error}=await sb.from('dm_blocks').insert({blocker:currentUser()?.id,blocked:uid});
  if(error&&error.code!=='23505'){toast('تعذر الحظر: '+error.message,true);return}
  state.myBlocks.add(uid);
  toast('🚫 انحظر — ما راح يوصلك منه شيء');
  if(typeof closeDmBox==='function')closeDmBox();
  await loadMyBlocks();
  if(typeof renderInbox==='function')renderInbox();
  if(typeof renderBlockList==='function')renderBlockList();
  if(typeof dmUnreadCount==='function')dmUnreadCount();
  if(typeof state.profUid!=='undefined'&&state.profUid===uid&&typeof openProfile==='function')openProfile(uid);
}

export async function unblockUser(uid,name){
  if(!confirm('فك الحظر عن '+(name||'هذا العضو')+'؟'))return;
  const {error}=await sb.from('dm_blocks').delete()
    .eq('blocker',currentUser()?.id).eq('blocked',uid);
  if(error){toast('تعذر الفك: '+error.message,true);return}
  state.myBlocks.delete(uid);
  toast('✅ انفك الحظر');
  await loadMyBlocks();
  renderBlockList();
  if(typeof renderInbox==='function')renderInbox();
  if(typeof state.profUid!=='undefined'&&state.profUid===uid&&typeof openProfile==='function')openProfile(uid);
}

/* قائمة المحظورين */

export async function renderBlockList(){
  const el=$('blockList');if(!el)return;
  if(isAnon()){el.innerHTML='';return}
  el.innerHTML='<div class="loader" style="padding:14px">⏳</div>';
  try{
    const r=await sb.from('dm_blocks').select('blocked,created_at')
      .eq('blocker',currentUser()?.id).order('created_at',{ascending:false});
    const list=r.data||[];
    if(!list.length){
      el.innerHTML='<div class="bl-empty">ما حظرت أحداً</div>';
      return;
    }
    const names={};
    try{
      const ids=list.map(x=>x.blocked);
      const pr=await sb.from('profiles').select('id,display_name').in('id',ids);
      (pr.data||[]).forEach(u=>{names[u.id]=u.display_name||'مصوّر'});
    }catch(e){}

    el.innerHTML='<div class="bl-lbl">🚫 المحظورون ('+list.length+')</div>'
      +list.map(b=>{
        const nm=names[b.blocked]||'مصوّر';
        return `<div class="bl-row">
          <span>${esc(nm)}</span>
          <button onclick="unblockUser('${b.blocked}','${esc(nm).replace(/'/g,"&#39;")}')">فك الحظر</button>
        </div>`;
      }).join('');
  }catch(e){el.innerHTML='<div class="bl-empty">تعذر التحميل</div>'}
}

/* ====== منع المراسلة من البروفايل (للإشراف) ====== */

export async function admProfDmBan(uid,ban,name){
  if(!state.isAdmin){toast('للمشرفين فقط',true);return}
  if(typeof isEditor==='function'&&!isEditor()){toast('🔒 يحتاج صلاحية أعلى',true);return}

  if(!ban&&!confirm('رفع المنع عن '+(name||'هذا العضو')+'؟'))return;

  let reason='';
  if(ban){
    reason=prompt('سبب المنع (يصل العضو):','إساءة استخدام الرسائل الخاصة');
    if(reason===null)return;
    reason=(reason||'').trim()||'إساءة استخدام الرسائل الخاصة';
  }

  const {error}=await sb.from('profiles').update({dm_banned:ban}).eq('id',uid);
  if(error){toast('تعذرت العملية: '+error.message,true);return}

  if(typeof notifyDmBan==='function')await notifyDmBan(uid,ban,reason);
  toast(ban?'🚫 انمنع — وانبلّغ بالسبب':'✅ انرفع المنع — وانبلّغ');
  if(typeof openProfile==='function')openProfile(uid);
}

/* ====== البحث الموحّد ====== */
state.uniTab='photos';
