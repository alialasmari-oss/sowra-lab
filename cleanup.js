/* صورة من بلدي — admin/cleanup.js
   التنظيف والصيانة */

import { sb } from '../core/db.js';
import { need } from '../core/hub.js';
import { compressTo } from '../core/media.js';
import { isOwner, reelsState, state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   initVideoUpload ← features/reels.js
   listBucketAll ← admin/misc.js
   loadAdmWeek ← admin/index.js
   loadPhotos ← features/feed.js
   loadSponsor ← features/contest.js
   needOwner ← admin/team.js
   pushNotify ← features/notify.js
*/
const initVideoUpload = need('initVideoUpload');
const listBucketAll = need('listBucketAll');
const loadAdmWeek = need('loadAdmWeek');
const loadPhotos = need('loadPhotos');
const loadSponsor = need('loadSponsor');
const needOwner = need('needOwner');
const pushNotify = need('pushNotify');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');
export let ORPHANS={v:[],p:[]};

export function admCleanupBlock(){
  return `<div style="background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:14px;margin-top:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">🧹 تنظيف التخزين</div>
    <div style="font-size:11.5px;color:var(--txt-dim);margin-bottom:10px">الملفات اليتيمة: موجودة بالتخزين وما لها صف بالقاعدة.</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button class="btn" style="flex:1;font-size:12px;padding:9px;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="admScanOrphans('videos')">🎬 فحص الفيديو</button>
      <button class="btn" style="flex:1;font-size:12px;padding:9px;background:var(--card2);border:1px solid var(--line);color:var(--txt)" onclick="admScanOrphans('photos')">🖼️ فحص الصور</button>
    </div>
    <button class="btn" style="width:100%;font-size:12px;padding:9px;background:var(--qblue)" onclick="admScanOrphans('all')">🔍 فحص الكل</button>
    <div id="cleanResult" style="font-size:12px;color:var(--txt-dim);margin-top:10px;line-height:1.9"></div>
  <button class="btn" style="width:100%;margin-top:9px;background:var(--card2);border:1px solid var(--qblue);color:var(--qblue);font-size:12.5px;padding:10px" onclick="admFixAbroadGeo()">🌍 افحص مواقع صور المسافر</button><button class="btn" style="width:100%;margin-top:9px;background:var(--card2);border:1px solid var(--qteal);color:var(--qteal);font-size:12.5px;padding:10px" onclick="admRebuildThumbs()">🖼️ حسّن دقة المصغّرات</button>
    <div id="rtStatus" style="font-size:11.5px;color:var(--txt-dim);margin-top:8px;line-height:1.8;text-align:center"></div></div>`;
}

export async function admScanOrphans(mode){
  const box=$('cleanResult');
  if(box)box.innerHTML='⏳ نفحص...';
  ORPHANS={v:[],p:[]};
  try{
    const r=await sb.from('photos').select('image_path,media_type');
    if(r.error){if(box)box.innerHTML='⚠️ تعذر قراءة القاعدة: '+r.error.message;return}
    const rows=r.data||[];
    // حماية: لا نفحص لو القاعدة رجعت فاضية (خطر حذف كل شيء)
    if(!rows.length){if(box)box.innerHTML='⚠️ القاعدة رجعت فاضية — أُوقف الفحص حمايةً للملفات';return}
    const keepVid=new Set(rows.filter(x=>x.media_type==='video').map(x=>x.image_path));
    const keepImg=new Set();
    rows.filter(x=>x.media_type!=='video').forEach(x=>{
      keepImg.add(x.image_path);
      keepImg.add(x.image_path.replace('.jpg','_t.jpg'));
    });
    // بنر الراعي وملفات الإدارة — مسجّلة بجداول أخرى
    try{
      const sbn=await sb.from('site_banner').select('image_path').eq('id',1).maybeSingle();
      if(sbn.data&&sbn.data.image_path)keepImg.add(sbn.data.image_path);
    }catch(e){}

    if(mode==='videos'||mode==='all'){
      const uv=await listBucketAll('videos');
      ORPHANS.v=uv.filter(p=>!keepVid.has(p));
    }
    if(mode==='photos'||mode==='all'){
      const up=await listBucketAll('photos');
      ORPHANS.p=up.filter(p=>!keepImg.has(p)&&!p.startsWith('banners/')&&!p.startsWith('admin/'));
    }

    const tv=ORPHANS.v.length, tp=ORPHANS.p.length, tot=tv+tp;
    if(!tot){if(box)box.innerHTML='✅ نظيف — ما فيه ملفات يتيمة';return}

    let html=(tp>keepImg.size?'<div style="background:#FFF4D6;border:1px solid var(--star);border-radius:8px;padding:8px 11px;margin-bottom:8px;font-size:11.5px;line-height:1.8">⚠️ العدد أكبر من المسجّل — راجع القائمة بعناية قبل الحذف</div>':'')
      +'<div style="font-weight:700;color:var(--sadu);margin-bottom:6px">لقينا '+tot+' ملفاً يتيماً:</div>'
      +'<div style="font-size:11px;color:var(--txt-dim);margin-bottom:8px">(قُرئ '+rows.length+' صفاً من القاعدة · '+keepVid.size+' فيديو · '+keepImg.size+' مسار صورة)</div>';
    if(tv){
      html+='<div style="margin-bottom:6px"><b>🎬 فيديو ('+tv+'):</b></div>';
      html+=ORPHANS.v.map(x=>'<div style="background:var(--card2);border-radius:8px;padding:5px 9px;margin-bottom:4px;font-size:11px;direction:ltr;text-align:left;word-break:break-all">'+esc(x)+'</div>').join('');
      html+='<button class="btn" style="width:100%;font-size:12px;padding:8px;margin:6px 0;background:var(--sadu)" onclick="admDelOrphans(\'v\')">🗑️ احذف الفيديوهات اليتيمة ('+tv+')</button>';
    }
    if(tp){
      html+='<div style="margin:8px 0 6px"><b>🖼️ صور ('+tp+'):</b></div>';
      html+=ORPHANS.p.map(x=>'<div style="background:var(--card2);border-radius:8px;padding:5px 9px;margin-bottom:4px;font-size:11px;direction:ltr;text-align:left;word-break:break-all">'+esc(x)+'</div>').join('');
      html+='<button class="btn" style="width:100%;font-size:12px;padding:8px;margin:6px 0;background:var(--sadu)" onclick="admDelOrphans(\'p\')">🗑️ احذف الصور اليتيمة ('+tp+')</button>';
    }
    html+='<div style="font-size:11px;color:var(--txt-dim);margin-top:6px">⚠️ راجع القائمة قبل الحذف — العملية نهائية</div>';
    if(box)box.innerHTML=html;
  }catch(e){
    if(box)box.innerHTML='⚠️ تعذر الفحص: '+(e.message||'');
  }
}

export async function admDelOrphans(kind){
  const list=kind==='v'?ORPHANS.v:ORPHANS.p;
  const bucket=kind==='v'?'videos':'photos';
  if(!list.length)return;
  if(!confirm('حذف '+list.length+' ملفاً نهائياً من دلو '+bucket+'؟'))return;
  const box=$('cleanResult');
  if(box)box.innerHTML='⏳ نحذف...';
  let done=0;
  try{
    for(let i=0;i<list.length;i+=50){
      const chunk=list.slice(i,i+50);
      const {error}=await sb.storage.from(bucket).remove(chunk);
      if(error)throw error;
      done+=chunk.length;
    }
    if(kind==='v')ORPHANS.v=[];else ORPHANS.p=[];
    if(box)box.innerHTML='✅ انحذف '+done+' ملفاً';
    toast('انتهى التنظيف 🧹');
  }catch(e){
    if(box)box.innerHTML='⚠️ انحذف '+done+' — توقف: '+(e.message||'');
  }
}

/* سرد كل ملفات دلو (يمشي على مجلدات المستخدمين) */

export async function admFixAbroadGeo(){
  if(!needOwner('إصلاح المواقع'))return;
  try{
    const r=await sb.from('photos').select('id,title,lat,lng,country')
      .eq('abroad',true).not('lat','is',null);
    const list=r.data||[];

    // حدود المملكة تقريباً
    const inSA=p=>(p.lat>=16&&p.lat<=32.2&&p.lng>=34.5&&p.lng<=55.7);
    const bad=list.filter(inSA);

    if(!bad.length){toast('✅ ما فيه صور مسافر بإحداثيات محلية');return}
    if(!confirm('لقينا '+bad.length+' صورة «عدسة مسافر» بإحداثيات داخل المملكة.\n\nنمسح إحداثياتها؟ (تبقى بالمنصة — لكن تختفي من الخريطة والأقرب إليك)'))return;

    const ids=bad.map(p=>p.id);
    const {error}=await sb.from('photos').update({lat:null,lng:null}).in('id',ids);
    if(error){toast('تعذر الإصلاح: '+error.message,true);return}
    toast('✅ انصلحت '+bad.length+' صورة');
    if(typeof loadPhotos==='function')loadPhotos();
  }catch(e){toast('تعذر الفحص: '+((e&&e.message)||''),true)}
}

/* ═══ إعادة توليد المصغّرات بدقة أعلى ═══ */

export async function admRebuildThumbs(){
  if(!needOwner('إعادة توليد المصغّرات'))return;
  if(!confirm('إعادة توليد مصغّرات كل الصور بدقة أعلى (380px)؟\n\nقد تستغرق دقائق — لا تغلق الصفحة.'))return;

  const box=$('rtStatus');
  const setSt=t=>{if(box)box.innerHTML=t};
  try{
    const r=await sb.from('photos').select('id,image_path')
      .eq('media_type','image').not('image_path','is',null);
    const list=r.data||[];
    if(!list.length){toast('ما فيه صور',true);return}

    let ok=0,fail=0,lastErr='';
    for(let i=0;i<list.length;i++){
      const p=list[i];
      setSt(`⏳ ${i+1} / ${list.length} — نجح ${ok} · أخفق ${fail}`);
      try{
        // نجلب الأصل من التخزين مباشرة (يتفادى CORS)
        const dl=await sb.storage.from('photos').download(p.image_path);
        if(dl.error||!dl.data){
          lastErr=(dl.error&&dl.error.message)||'تعذر التنزيل';
          fail++;continue;
        }

        const thumb=await compressTo(dl.data,380,0.72);
        if(!thumb){lastErr='تعذر الضغط';fail++;continue}

        const tp=p.image_path.replace(/\.jpg$/i,'_t.jpg');
        const up=await sb.storage.from('photos').upload(tp,thumb,{
          contentType:'image/jpeg', cacheControl:'31536000', upsert:true
        });
        if(up.error){lastErr=up.error.message;fail++;continue}
        ok++;
      }catch(e){lastErr=(e&&e.message)||'استثناء';fail++}
      // مهلة قصيرة تفادياً للضغط
      await new Promise(r=>setTimeout(r,120));
    }
    setSt(`${ok?'✅':'⚠️'} اكتمل — نجح ${ok} · أخفق ${fail}`
      +(lastErr?`<br><span style="font-size:11px;direction:ltr;display:inline-block;color:var(--sadu)">${esc(lastErr)}</span>`:'')
      +(ok?'<br><span style="font-size:11px">حدّث الصفحة لتشوف الفرق</span>':''));
    toast('✅ انتهت إعادة التوليد');
  }catch(e){
    setSt('⚠️ '+((e&&e.message)||'تعذرت العملية'));
  }
}

/* ═══ أضواء الديرة — مفتاح موحّد بثلاث حالات ═══ */
