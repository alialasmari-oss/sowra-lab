/* صورة من بلدي — features/inspect.js
   الفاحص الذكي والاقتراح */

import { currentUser, isAnon, sb } from '../core/db.js';
import { checkText, findOpt } from '../core/format.js';
import { liveLocation, readExifGPS, readExifGPS2, reverseGeo, validPos } from '../core/geo.js';
import { need } from '../core/hub.js';
import { compress, compressTo, thumbPath, thumbUrl } from '../core/media.js';
import { state, videoAllowed } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   captureVideoFrame ← features/camera.js
   checkRaceProgress ← features/visits.js
   checkRate ← features/limits.js
   fillAddCities ← features/feed.js
   loadPhotos ← features/feed.js
   logRate ← features/limits.js
   openAcc ← features/account.js
   pushNotify ← features/notify.js
*/
const captureVideoFrame = need('captureVideoFrame');
const checkRaceProgress = need('checkRaceProgress');
const checkRate = need('checkRate');
const fillAddCities = need('fillAddCities');
const loadPhotos = need('loadPhotos');
const logRate = need('logRate');
const openAcc = need('openAcc');
const pushNotify = need('pushNotify');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');
const maybeAskNotifs = need('maybeAskNotifs');
/* ═══ عبر الحاجز ═══
   descCount ← features/upload.js
*/
const descCount = need('descCount');



/* ═══ مربع منبثق لنتيجة الفاحص ═══
   كانت النتيجة تُعرض بشريط تحت حقلي العنوان والوصف فلا يلاحظها أحد.
   هذا المربع يبني نفسه ونمطه عند أول استعمال — فلا يحتاج تعديل
   index.html ولا style.css، ويرث ألوان الهوية فيتبع الوضع الليلي. */

let _inspResolve = null;

function inspEnsure(){
  if(document.getElementById('inspModal')) return;

  const css = document.createElement('style');
  css.id = 'inspModalCss';
  css.textContent = `
  #inspModal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;
    background:rgba(36,31,28,.55);backdrop-filter:blur(3px);padding:24px}
  #inspModal.show{display:flex}
  #inspModal .ip-card{background:var(--card);border:1.5px solid var(--ink);border-radius:20px;
    padding:22px 20px 18px;max-width:360px;width:100%;text-align:center;
    box-shadow:0 10px 34px rgba(36,31,28,.28);font-family:'Tajawal',sans-serif;
    animation:ipIn .18s ease-out}
  @keyframes ipIn{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
  #inspModal .ip-ic{font-size:40px;line-height:1;margin-bottom:10px}
  #inspModal .ip-ttl{font-family:'Reem Kufi',sans-serif;font-size:19px;margin-bottom:8px;color:var(--txt)}
  #inspModal .ip-bd{font-size:13.5px;line-height:2;color:var(--txt-dim)}
  #inspModal .ip-btns{display:flex;gap:8px;margin-top:18px}
  #inspModal .ip-btn{flex:1;padding:12px;border-radius:13px;border:1px solid var(--line);
    background:var(--card2);color:var(--txt);font-family:'Tajawal';font-size:14px;font-weight:700;cursor:pointer}
  #inspModal .ip-btn.main{background:var(--sadu);border-color:var(--sadu);color:#fff}
  #inspModal.ok   .ip-ttl{color:var(--palm)}
  #inspModal.bad  .ip-ttl{color:var(--sadu)}
  #inspModal.warn .ip-ttl{color:var(--star)}
  `;
  document.head.appendChild(css);

  const el = document.createElement('div');
  el.id = 'inspModal';
  el.innerHTML = '<div class="ip-card"><div class="ip-ic"></div><div class="ip-ttl"></div>'
               + '<div class="ip-bd"></div><div class="ip-btns"></div></div>';
  document.body.appendChild(el);
}

export function inspClose(val){
  const el = document.getElementById('inspModal');
  if(el) el.classList.remove('show');
  const r = _inspResolve; _inspResolve = null;
  if(r) r(val);
}

/* tone: busy | ok | bad | warn */
export function inspPopup({ tone = 'busy', icon = '', title = '', body = '', buttons = null, autoMs = 0 } = {}){
  inspEnsure();
  const el = document.getElementById('inspModal');
  el.className = 'show ' + tone;
  el.querySelector('.ip-ic').textContent  = icon || ({busy:'🤖', ok:'✅', bad:'⛔', warn:'⚠️'})[tone] || '';
  el.querySelector('.ip-ttl').textContent = title;
  el.querySelector('.ip-bd').innerHTML    = body;

  const bw = el.querySelector('.ip-btns');
  bw.innerHTML = '';
  return new Promise(resolve => {
    _inspResolve = resolve;
    (buttons || []).forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'ip-btn' + (b.primary ? ' main' : '');
      btn.textContent = b.label;
      btn.onclick = () => inspClose(b.value);
      bw.appendChild(btn);
    });
    if(!buttons && autoMs) setTimeout(() => inspClose(true), autoMs);
    if(!buttons && !autoMs) resolve(true);      /* حالة الانتظار: لا تُغلق نفسها */
  });
}

export async function inspectPhoto(blob){
  // سفاري: نصغّر أولاً لتفادي فشل التحويل
  try{
    if(blob&&blob.size>900*1024&&typeof compressTo==='function'){
      blob=await compressTo(blob,640,0.55);
    }
  }catch(e){}
  try{
    // تصغير للفحص (توفير تكلفة وسرعة)
    const dataUrl=await new Promise((res,rej)=>{
      const img=new Image();
      img.onload=()=>{
        try{
          const s=Math.min(1,640/Math.max(img.width,img.height));
          const cv=document.createElement('canvas');
          cv.width=Math.round(img.width*s);cv.height=Math.round(img.height*s);
          cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
          URL.revokeObjectURL(img.src);
          res(cv.toDataURL('image/jpeg',0.7));
        }catch(e){rej(e)}
      };
      img.onerror=rej;
      img.src=URL.createObjectURL(blob);
    });

    let data=null,err=null;
    try{
      const _gp=state.geoPlace||{};
      const _pl={
        region:($('aRegion')&&$('aRegion').value)||_gp.region||'',
        city:($('aCity')&&$('aCity').value)||_gp.city||'',
        village:($('aVillage')&&$('aVillage').value)||_gp.village||''
      };
      const r=await sb.functions.invoke('translate',{body:{action:'inspect',image:dataUrl,..._pl}});
      data=r.data;err=r.error;
    }catch(e){err=e}

    if(!data||err){
      const sess=await sb.auth.getSession();
      const tok=sess?.data?.session?.access_token;
      const r=await fetch('https://gquzjaxpqeggknhipmzk.supabase.co/functions/v1/translate',{
        method:'POST',
        headers:Object.assign(
          {'Content-Type':'application/json','apikey':'sb_publishable_BNp6Fg3VLXa1Pf4V6QjncQ_f496PquX'},
          tok?{'Authorization':'Bearer '+tok}:{}
        ),
        body:JSON.stringify(Object.assign({action:'inspect',image:dataUrl},{
          region:($('aRegion')&&$('aRegion').value)||(state.geoPlace&&state.geoPlace.region)||'',
          city:($('aCity')&&$('aCity').value)||(state.geoPlace&&state.geoPlace.city)||'',
          village:($('aVillage')&&$('aVillage').value)||(state.geoPlace&&state.geoPlace.village)||''
        }))
      });
      if(!r.ok){
        let t='';try{t=await r.text()}catch(e){}
        console.warn('inspect HTTP',r.status,t);
        state.inspErr='HTTP '+r.status+' '+t.slice(0,120);
        return null;
      }
      data=await r.json();
    }
    if(data&&data.error){
      console.warn('inspect error',data.error);
      state.inspErr=String(data.error).slice(0,140);
      return null;
    }
    state.inspErr='';
    return data||null;
  }catch(e){
    console.warn('inspect exception',e);
    state.inspErr=(e&&e.message)||'استثناء';
    return null;
  }
}

/* يرجع true إذا يُسمح بالمتابعة */
export async function runInspection(blob){
  inspPopup({ tone:'busy', title:'نفحص الصورة…', body:'لحظات من فضلك' });
  const res=state.earlyRes||await inspectPhoto(blob);
  if(!res){
    if(state.inspErr){
      await inspPopup({ tone:'warn', title:'تعذر الفحص',
        body:'<span style="direction:ltr;display:inline-block;font-size:11.5px">'+esc(state.inspErr)+'</span>',
        buttons:[{label:'أكمل النشر', value:true, primary:true}] });
    }else inspClose();
    return true;
  }

  // منع صريح
  if(res.nsfw||res.violence){
    await inspPopup({ tone:'bad', title:'الصورة مرفوضة',
      body:'فيها محتوى مخالف لإرشادات النشر — اختر صورة أخرى',
      buttons:[{label:'حسناً', value:false, primary:true}] });
    return false;
  }

  // تحذيرات
  const warns=[];
  if(res.face)warns.push('👤 فيها وجه واضح — تأكد من إذن صاحبه');
  if(res.plate)warns.push('🚗 فيها لوحة مركبة مقروءة');
  if(res.indoor_private)warns.push('🏠 تبدو من داخل منزل خاص');
  if(res.military)warns.push('🚫 قد تكون منشأة عسكرية أو أمنية — تصويرها محظور نظاماً');

  if(warns.length){
    return await inspPopup({ tone:'warn', title:'تنبيه قبل النشر',
      body: warns.join('<br>'),
      buttons:[{label:'أكمل النشر', value:true, primary:true},
               {label:'تراجع',      value:false}] });
  }

  // نظيفة — نقترح التصنيف
  inspPopup({ tone:'ok', title:'الصورة سليمة', body:'تمام — كمّل نشرك', autoMs:1800 });
  if(res.category&&$('aCat')){
    const opt=Array.from($('aCat').options).find(o=>o.value===res.category);
    if(opt)$('aCat').value=res.category;
  }
  showSuggestions(res);
  return true;
}

/* ====== بطاقة الاقتراحات الذكية ====== */
export function showSuggestions(res){
  const box=$('sugBox');if(!box)return;
  const t=(res.suggested_title_ar||'').trim();
  const d=(res.suggested_desc_ar||'').trim();
  if(!t&&!d){box.style.display='none';return}

  state.sugT=t; state.sugD=d;
  box.style.display='block';
  box.innerHTML=`
    <div class="sg-head">
      <span>✨ اقتراح ذكي</span>
      <button onclick="hideSuggestions()">✕</button>
    </div>
    ${t?`<div class="sg-row">
      <div class="sg-lbl">العنوان</div>
      <div class="sg-txt">${esc(t)}</div>
      <button class="sg-use" onclick="useSug('t')">استخدمه</button>
    </div>`:''}
    ${d?`<div class="sg-row">
      <div class="sg-lbl">الوصف</div>
      <div class="sg-txt">${esc(d)}</div>
      <button class="sg-use" onclick="useSug('d')">استخدمه</button>
    </div>`:''}
    ${(t&&d)?`<button class="sg-all" onclick="useSug('all')">✓ استخدم الاثنين</button>`:''}
    <div class="sg-note">اقتراح من الذكاء الاصطناعي — عدّله كما تحب</div>`;
}
export function useSug(what){
  try{
    const ti=$('aTitle'), de=$('aDesc');
    if((what==='t'||what==='all')&&ti&&state.sugT){
      ti.value=state.sugT;
      try{ti.dispatchEvent(new Event('input',{bubbles:true}))}catch(e){}
    }
    if((what==='d'||what==='all')&&de&&state.sugD){
      de.value=state.sugD;
      try{de.dispatchEvent(new Event('input',{bubbles:true}))}catch(e){}
      if(typeof descCount==='function')descCount();
    }
    toast('انتقل للحقل ✍️');
    if(what==='all')hideSuggestions();
  }catch(e){toast('تعذر النقل',true)}
}
export function hideSuggestions(){
  const box=$('sugBox');
  if(box)box.style.display='none';
}

/* ====== سمات الصورة ====== */
export async function earlySuggest(){
  try{
    const on=!!(state.banner.inspect_enabled)||!!state.inspectOn;
    if(!on)return;
    // سفاري يحتاج مهلة أطول لاكتمال الضغط
    let tries=0;
    while(!state.pendingBlob&&!state.pendingFile&&tries<20){
      await new Promise(r=>setTimeout(r,150));
      tries++;
    }
    const blob=state.pendingBlob||state.pendingFile;
    if(!blob)return;
    await new Promise(r=>setTimeout(r,900));

    const box=$('sugBox');
    if(box){
      box.style.display='block';
      box.innerHTML='<div class="sg-head"><span>✨ نقرأ الصورة...</span></div>';
    }

    const res=await inspectPhoto(blob);
    if(!res){
      if(box){
        if(state.inspErr){
          box.innerHTML='<div class="sg-head"><span>⚠️ تعذر الاقتراح</span><button onclick="hideSuggestions()">✕</button></div>'
            +'<div style="font-size:11px;direction:ltr;color:var(--txt-dim);padding:4px 2px">'+esc(state.inspErr)+'</div>';
        }else box.style.display='none';
      }
      return;
    }
    state.earlyRes=res;
    showSuggestions(res);

    // التحذيرات مبكراً — قبل كتابة العنوان
    const warns=[];
    if(res.face)warns.push('🙂 فيها وجه واضح — تأكد من إذن صاحبه');
    if(res.plate)warns.push('🚗 لوحة مركبة مقروءة');
    if(res.indoor_private)warns.push('🏠 تبدو من داخل منزل خاص');
    if(res.military)warns.push('🚫 قد تكون منشأة عسكرية — تصويرها محظور نظاماً');
    if(res.nsfw||res.violence){
      inspPopup({ tone:'bad', title:'الصورة مرفوضة',
        body:'محتوى مخالف — اختر صورة أخرى',
        buttons:[{label:'حسناً', value:false, primary:true}] });
    }else if(warns.length){
      inspPopup({ tone:'warn', title:'تنبيه',
        body: warns.join('<br>'),
        buttons:[{label:'فهمت', value:true, primary:true}] });
    }else{
      inspPopup({ tone:'ok', title:'الصورة سليمة', body:'تمام — كمّل بياناتك', autoMs:1600 });
    }
    // التصنيف
    if(res.category&&$('aCat')){
      const opt=Array.from($('aCat').options).find(o=>o.value===res.category);
      if(opt&&!$('aCat').value)$('aCat').value=res.category;
    }
  }catch(e){}
}

/* ====== استنتاج المنطقة والمدينة من الإحداثيات ====== */
