/* صورة من بلدي — features/share.js
   بطاقات المشاركة */

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
export async function shareProfile(uid){
  toast('نجهّز البطاقة...');
  try{
    const r=await sb.from('profiles').select('display_name,bio,region').eq('id',uid).maybeSingle();
    const pr=r.data||{};
    const mine=state.photos.filter(x=>x.user_id===uid&&x.visibility!=='private');
    const totV=mine.reduce((s,x)=>s+(x.views||0),0);
    const fo=mine.length?(mine[0].followers_count||0):0;
    const rk=mine.length?rankOf(mine[0]):{ic:'🌱',t:'مستكشف'};
    const top=mine.slice().sort((a,b)=>(b.avg_stars||0)-(a.avg_stars||0)).slice(0,4);

    try{if(document.fonts&&document.fonts.ready)await document.fonts.ready}catch(e){}
    const W=1080,H=1350;
    const cv=document.createElement('canvas');
    cv.width=W;cv.height=H;
    const ctx=cv.getContext('2d');

    // خلفية
    ctx.fillStyle='#F7F1E3';ctx.fillRect(0,0,W,H);

    // شريط القط علوي
    const cols=['#D63A2F','#2E6FB7','#F2B33D','#2E8B57'];
    const tw=W/16;
    for(let i=0;i<16;i++){
      ctx.beginPath();
      ctx.moveTo(i*tw,54);ctx.lineTo(i*tw+tw/2,10);ctx.lineTo((i+1)*tw,54);
      ctx.closePath();
      ctx.fillStyle=cols[i%4];ctx.fill();
      ctx.strokeStyle='#241F1C';ctx.lineWidth=3;ctx.stroke();
    }

    ctx.direction='rtl';ctx.textAlign='center';

    // الاسم والرتبة
    ctx.fillStyle='#8C2F23';
    ctx.font='bold 74px Tajawal, sans-serif';
    ctx.fillText(String(pr.display_name||'مصوّر').slice(0,22),W/2,180);

    ctx.fillStyle='#6B6259';
    ctx.font='40px Tajawal, sans-serif';
    ctx.fillText(rk.ic+' '+rk.t,W/2,244);

    if(pr.region){
      ctx.font='34px Tajawal, sans-serif';
      ctx.fillText('📍 '+pr.region,W/2,300);
    }

    // الإحصائيات
    const sy=380;
    const stats=[[mine.length,'صورة'],[fo,'متابع'],[totV,'مشاهدة']];
    stats.forEach((s,i)=>{
      const x=W/2+(i-1)*300;
      ctx.fillStyle='#D63A2F';
      ctx.font='bold 62px Tajawal, sans-serif';
      ctx.fillText(String(s[0]),x,sy);
      ctx.fillStyle='#6B6259';
      ctx.font='30px Tajawal, sans-serif';
      ctx.fillText(s[1],x,sy+46);
    });

    // شبكة أفضل ٤ صور
    const gy=480, gs=250, gap=16;
    const startX=(W-(gs*2+gap))/2;
    await Promise.all(top.map((ph,i)=>new Promise(res=>{
      const img=new Image();
      img.crossOrigin='anonymous';
      const guard=setTimeout(res,6000);
      img.onload=()=>{
        clearTimeout(guard);
        const cx=startX+(i%2)*(gs+gap);
        const cy=gy+Math.floor(i/2)*(gs+gap);
        try{
          ctx.save();
          ctx.beginPath();
          if(ctx.roundRect)ctx.roundRect(cx,cy,gs,gs,20);
          else ctx.rect(cx,cy,gs,gs);
          ctx.clip();
          const rt=Math.max(gs/img.width,gs/img.height);
          const dw=img.width*rt, dh=img.height*rt;
          ctx.drawImage(img,cx+(gs-dw)/2,cy+(gs-dh)/2,dw,dh);
          ctx.restore();
        }catch(e){}
        res();
      };
      img.onerror=()=>{clearTimeout(guard);res()};
      img.src=thumbUrl(ph.image_path);
    })));

    // التذييل مع رمز QR
    const qr=await qrDataUrl('https://sowra.app',200);
    if(qr){
      const qs=150, qx=70, qy=H-215;
      ctx.fillStyle='#F7F1E3';
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(qx-10,qy-10,qs+20,qs+20,14);ctx.fill()}
      else ctx.fillRect(qx-10,qy-10,qs+20,qs+20);
      try{ctx.drawImage(qr,qx,qy,qs,qs)}catch(e){}
      ctx.fillStyle='#6B6259';
      ctx.font='22px Tajawal, sans-serif';
      ctx.textAlign='center';
      ctx.fillText('امسح للزيارة',qx+qs/2,qy+qs+34);
    }

    ctx.textAlign='center';
    ctx.fillStyle='#D63A2F';
    ctx.font='bold 56px Tajawal, sans-serif';
    ctx.fillText('صورة من بلدي',W/2+(qr?90:0),H-155);
    ctx.fillStyle='#241F1C';
    ctx.font='bold 40px Tajawal, sans-serif';
    ctx.fillText('sowra.app',W/2+(qr?90:0),H-100);
    ctx.fillStyle='#6B6259';
    ctx.font='28px Tajawal, sans-serif';
    ctx.fillText('عدسات أهل الديار',W/2+(qr?90:0),H-58);

    cv.toBlob(async function(blob){
      if(!blob){toast('تعذر إنشاء البطاقة',true);return}
      const file=new File([blob],'sowra-profile.jpg',{type:'image/jpeg'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        try{
          await navigator.share({
            files:[file],
            title:pr.display_name||'مصوّر',
            text:'عدستي في «صورة من بلدي» 📸\nشوف صور ديرتك وشارك عدستك:\nhttps://sowra.app'
          });
          return;
        }catch(e){}
      }
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='sowra-profile.jpg';
      a.click();
      try{await navigator.clipboard.writeText('عدستي في «صورة من بلدي» 📸\nhttps://sowra.app')}catch(e){}
      toast('انحفظت البطاقة — والنص بالحافظة 📋');
    },'image/jpeg',0.92);
  }catch(e){toast('تعذر التجهيز: '+(e.message||e),true)}
}

/* ====== حماية المحتوى: فلتر الكلمات وحد المعدّل ====== */
export async function shareCard(p){
  toast('نجهّز البطاقة...');
  try{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.src=imgUrl(p.image_path);
    await new Promise((res,rej)=>{img.onload=res;img.onerror=rej});

    const W=1080,H=1350,ih=1110;
    const cv=document.createElement('canvas');
    cv.width=W;cv.height=H;
    const ctx=cv.getContext('2d');

    ctx.fillStyle='#F7F1E3';ctx.fillRect(0,0,W,H);

    const ratio=Math.max(W/img.width,ih/img.height);
    const dw=img.width*ratio, dh=img.height*ratio;
    ctx.save();
    ctx.beginPath();ctx.rect(0,0,W,ih);ctx.clip();
    ctx.drawImage(img,(W-dw)/2,(ih-dh)/2,dw,dh);
    ctx.restore();

    const g=ctx.createLinearGradient(0,ih-300,0,ih);
    g.addColorStop(0,'rgba(10,8,6,0)');
    g.addColorStop(1,'rgba(10,8,6,.85)');
    ctx.fillStyle=g;ctx.fillRect(0,ih-300,W,300);

    ctx.direction='rtl';
    ctx.textAlign='right';

    ctx.fillStyle='#fff';
    ctx.font='bold 58px Tajawal, sans-serif';
    ctx.fillText(String(p.title).slice(0,28),W-60,ih-110);

    ctx.fillStyle='rgba(255,255,255,.85)';
    ctx.font='36px Tajawal, sans-serif';
    const loc=p.abroad?(p.country||p.city):((p.village?p.village+' · ':'')+p.city);
    ctx.fillText(loc+'  ·  عدسة '+p.photographer,W-60,ih-50);

    const colors=['#D63A2F','#2E6FB7','#F2B33D','#2E8B57'];
    const tw=W/16;
    for(let i=0;i<16;i++){
      ctx.beginPath();
      ctx.moveTo(i*tw,ih+42);
      ctx.lineTo(i*tw+tw/2,ih+8);
      ctx.lineTo((i+1)*tw,ih+42);
      ctx.closePath();
      ctx.fillStyle=colors[i%4];ctx.fill();
      ctx.strokeStyle='#241F1C';ctx.lineWidth=2.5;ctx.stroke();
    }

    if(p.ratings_count>0){
      ctx.textAlign='right';
      ctx.fillStyle='#E8A020';
      ctx.font='bold 40px Tajawal, sans-serif';
      ctx.fillText('★ '+Number(p.avg_stars).toFixed(1),W-60,ih+108);
    }

    const qr2=await qrDataUrl('https://sowra.app',180);
    if(qr2){
      const qs=120, qx=60, qy=ih+110;
      ctx.fillStyle='#F7F1E3';
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(qx-8,qy-8,qs+16,qs+16,12);ctx.fill()}
      else ctx.fillRect(qx-8,qy-8,qs+16,qs+16);
      try{ctx.drawImage(qr2,qx,qy,qs,qs)}catch(e){}
    }

    ctx.textAlign='center';
    const cx2=W/2+(qr2?70:0);
    ctx.fillStyle='#D63A2F';
    ctx.font='bold 50px Tajawal, sans-serif';
    ctx.fillText('صورة من بلدي',cx2,ih+165);

    ctx.fillStyle='#241F1C';
    ctx.font='bold 36px Tajawal, sans-serif';
    ctx.fillText('sowra.app',cx2,ih+212);

    ctx.fillStyle='#6B6259';
    ctx.font='26px Tajawal, sans-serif';
    ctx.fillText('عدسات أهل الديار',cx2,ih+250);

    cv.toBlob(async function(blob){
      if(!blob){toast('تعذر إنشاء البطاقة',true);return}
      const file=new File([blob],'sowra-'+p.id+'.jpg',{type:'image/jpeg'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        try{
          await navigator.share({
            files:[file],
            title:p.title,
            text:p.title+' — من «صورة من بلدي» 📸\nhttps://sowra.app'
          });
          return;
        }catch(e){}
      }
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='sowra-'+p.id+'.jpg';
      a.click();
      toast('انحفظت البطاقة');
    },'image/jpeg',0.92);

  }catch(e){toast('تعذر تجهيز البطاقة',true)}
}

/* ====== مناطق قليلة التغطية ====== */
export async function qrDataUrl(text,size){
  size=size||220;
  // نستخدم خدمة توليد QR مع احتياطي محلي
  return new Promise(res=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    const guard=setTimeout(()=>res(null),5000);
    img.onload=()=>{clearTimeout(guard);res(img)};
    img.onerror=()=>{clearTimeout(guard);res(null)};
    img.src='https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size
      +'&margin=0&color=241F1C&bgcolor=F7F1E3&data='+encodeURIComponent(text);
  });
}

/* ====== غلاف البروفايل وحسابي ====== */
