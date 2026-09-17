/* صورة من بلدي — features/map.js
   الخريطة والأماكن */

import { findOpt, normPlace } from '../core/format.js';
import { need } from '../core/hub.js';
import { imgUrl, thumbUrl } from '../core/media.js';
import { state } from '../core/state.js';
import { $, esc, toast } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

/* ═══ عبر الحاجز ═══
   openSponsorsPage ← features/contest.js
*/
const openSponsorsPage = need('openSponsorsPage');

/* ═══ من التنقل — عبر الحاجز ═══ */
const go = need('go');

/* ═══ من ميزات أخرى — عبر الحاجز (يمنع الدورات) ═══ */
const fillAddCities = need('fillAddCities');
const openSheet = need('openSheet');
const render = need('render');
/* فلترة الصور — مصدر واحد مشترك مع الشبكة (features/feed.js) */
const filteredPhotos = need('filteredPhotos');
const renderNearby = need('renderNearby');

/* state.map → state.map */
export function renderMap(){
  const wrap=$('mapWrap');
  wrap.style.display='block';$('feed').style.display='none';
  if(typeof L==='undefined'){wrap.innerHTML='<div class="empty">⚠️ تعذر تحميل الخريطة — تأكد من رفع leaflet.js وleaflet.css</div>';return}
  if(!state.map){
    state.map=L.map('map',{zoomControl:true,attributionControl:true}).setView([23.9,45.1],5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(state.map);
    state.marks=L.layerGroup().addTo(state.map);
    // زر العودة لموقعي
    const ZoomHome=L.Control.extend({
      options:{position:'topright'},
      onAdd:function(){
        const b=L.DomUtil.create('button','');
        b.innerHTML='📍';
        b.title='موقعي';
        b.style.cssText='width:38px;height:38px;background:#fff;border:2px solid rgba(0,0,0,.2);border-radius:8px;font-size:18px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2)';
        b.onclick=function(e){
          e.stopPropagation();
          if(window.__USER_LAT)state.map.setView([window.__USER_LAT,window.__USER_LNG],13);
          else toast('فعّل الموقع أولاً',true);
        };
        return b;
      }
    });
    state.map.addControl(new ZoomHome());
    // زر المناطق قليلة التغطية
    const GapBtn=L.Control.extend({
      options:{position:'topright'},
      onAdd:function(){
        const b=L.DomUtil.create('button','');
        b.id='gapBtn';
        b.innerHTML='🔍';
        b.title='مناطق قليلة التغطية';
        b.style.cssText='width:38px;height:38px;background:#fff;border:2px solid rgba(0,0,0,.2);border-radius:8px;font-size:17px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2);margin-top:6px';
        b.onclick=function(e){e.stopPropagation();toggleGaps();};
        return b;
      }
    });
    state.map.addControl(new GapBtn());
  }
  state.marks.clearLayers();
  /* نفس فلترة الشبكة حرفياً — المنطقة والمدينة والوسوم و«ديرتي/مسافر»
     واختيار المحررين والسبق. سابقاً كانت الخريطة تطبّق ٣ شروط فقط،
     فتعرض كل الصور وتخلط المحلي بعدسة مسافر. */
  const list=(filteredPhotos()||[]).filter(p=>p.lat&&p.lng);
  const pts=[];
  list.forEach(p=>{
    const cl=(typeof state.claimMap!=='undefined'&&state.claimMap)?state.claimMap[p.id]:null;
    const clCls=cl?(' claim-'+cl.state):'';
    const clDot=cl?('<span class="pmark-claim">'+(cl.state==='doubted'?'❓':'🏅')+'</span>'):'';
    const ic=L.divIcon({className:'',html:`<div class="pmark${clCls}"><img src="${thumbUrl(p.image_path)}" onerror="this.onerror=null;this.src='${imgUrl(p.image_path)}'">${clDot}</div>`,iconSize:[46,46],iconAnchor:[23,23]});
    L.marker([p.lat,p.lng],{icon:ic}).addTo(state.marks).on('click',()=>openSheet(p.id));
    pts.push([p.lat,p.lng]);
  });
 // التمركز الذكي: موقع المستخدم أولاً، وإلا كل الصور
  if(window.__USER_LAT && !state.map._userCentered){
    state.map.setView([window.__USER_LAT,window.__USER_LNG],11);
    state.map._userCentered=true;
  } else if(pts.length && !state.map._userCentered){
    state.map.fitBounds(pts,{padding:[46,46],maxZoom:12});
  }
  // دبوس الراعي
  const spd=state.banner;
  if(spd&&spd.active&&spd.image_path&&spd.sponsor_lat&&spd.sponsor_lng){
    const sic=L.divIcon({className:'',html:`<div class="pmark sp-pin"><img src="${thumbUrl(spd.image_path)}"><div class="sp-pin-label">${esc(spd.sponsor_name||'راعي')}</div></div>`,iconSize:[54,66],iconAnchor:[27,66]});
    L.marker([spd.sponsor_lat,spd.sponsor_lng],{icon:sic,zIndexOffset:1000}).addTo(state.marks).on('click',()=>openSponsorsPage());
  }
  setTimeout(()=>{state.map.invalidateSize();if(window.__USER_LAT)addUserPin(window.__USER_LAT,window.__USER_LNG);},120);
  const sp=state.banner;
  $('mapSponsor').innerHTML=(sp&&sp.active&&sp.image_path)
    ?((sp.link_url?`<a href="${esc(sp.link_url)}" target="_blank" rel="noopener">`:'')+`<img src="${imgUrl(spd.image_path)}" alt="راعي المنصة">`+(sp.link_url?'</a>':''))
    :'';
}

/* ====== دبوس موقع المستخدم بالخريطة ====== */

export let _userPin=null;

export function addUserPin(lat,lng){
  if(!state.map||typeof L==='undefined')return;
  if(_userPin)_userPin.remove();
  const ic=L.divIcon({className:'',html:'<div class="user-pin">📍<div class="user-pin-label">موقعي</div></div>',iconSize:[40,52],iconAnchor:[20,52]});
  _userPin=L.marker([lat,lng],{icon:ic,zIndexOffset:2000}).addTo(state.map);
}

/* ====== تبديل العرض مع حفظ الحالة ====== */

export function setView(v){
  state.viewMode=v;
  $('vtGrid').classList.toggle('on',v==='grid');
  $('vtMap').classList.toggle('on',v==='map');
  const feed=$('feed');
  const map=$('mapWrap');
  const nearby=$('nearbyWrap');
  if(v==='map'){
    if(feed)feed.style.display='none';
    if(nearby)nearby.style.display='none';
    if(map)map.style.display='block';
    renderMap();
  } else {
    if(map)map.style.display='none';
    if(feed)feed.style.display='';
    /* متماثل مع الإخفاء أعلاه — renderNearby تقرّر بنفسها
       أتظهر أم لا حسب الموقع والصور القريبة. */
    if(typeof renderNearby==='function')renderNearby();
    render();
  }
}
/* ====== حذف الصورة لصاحبها ====== */

export let GAP_LAYERS=[];
state.gapsOn=false;

export function drawCoverageGaps(){
  if(!state.map||typeof L==='undefined')return;
  GAP_LAYERS.forEach(l=>{try{state.map.removeLayer(l)}catch(e){}});
  GAP_LAYERS=[];
  if(!state.gapsOn)return;

  const LAT_MIN=16.5, LAT_MAX=32.0, LNG_MIN=34.5, LNG_MAX=55.5;
  const STEP=0.75;

  const geoPts=state.photos.filter(p=>p.lat&&p.lng&&!p.abroad);
  const filled=new Set();
  geoPts.forEach(p=>{
    const gy=Math.floor((p.lat-LAT_MIN)/STEP);
    const gx=Math.floor((p.lng-LNG_MIN)/STEP);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)filled.add((gy+dy)+'_'+(gx+dx));
  });

  const rows=Math.ceil((LAT_MAX-LAT_MIN)/STEP);
  const cols=Math.ceil((LNG_MAX-LNG_MIN)/STEP);
  let count=0;

  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(filled.has(y+'_'+x))continue;
      const clat=LAT_MIN+y*STEP+STEP/2;
      const clng=LNG_MIN+x*STEP+STEP/2;
      if(clng<36.5&&clat>28)continue;
      if(clng>51.5&&clat>26.5)continue;

      const c=L.circle([clat,clng],{
        radius:38000,
        color:'#8A7B6A',weight:1.5,dashArray:'6,6',
        fillColor:'#8A7B6A',fillOpacity:.12
      }).addTo(state.map);
      c.bindPopup('<div style="font-family:Tajawal;text-align:center;min-width:170px">'+
        '<div style="font-weight:700;font-size:14px;color:#8C2F23;margin-bottom:4px">📍 منطقة قليلة التغطية</div>'+
        '<div style="font-size:12px;color:#666;line-height:1.8">ما فيها صور بعد — كن أول من يوثّق جمالها 📸</div></div>');
      GAP_LAYERS.push(c);
      count++;
    }
  }
  if(count)toast(count+' منطقة تنتظر عدستك 📸');
}

export function toggleGaps(){
  state.gapsOn=!state.gapsOn;
  const b=$('gapBtn');
  if(b){b.style.background=state.gapsOn?'#8C2F23':'#fff';b.style.color=state.gapsOn?'#fff':'#000';}
  drawCoverageGaps();
  if(!state.gapsOn)toast('اختفت المناطق الفارغة');
}

/* ====== كنوز الديرة — رحلات الاكتشاف ====== */

export const ALL_REGIONS=['الرياض','مكة المكرمة','المدينة المنورة','القصيم','الشرقية','عسير',
  'تبوك','حائل','الحدود الشمالية','جازان','نجران','الباحة','الجوف'];

export function openWaiting(){
  go('waiting');
  renderWaiting();
}

export function renderWaiting(){
  const el=$('waitingBody');if(!el)return;
  const local=state.photos.filter(p=>!p.abroad&&p.visibility!=='private');

  // ═══ المناطق ═══
  const byReg={};
  ALL_REGIONS.forEach(r=>byReg[r]={n:0,ph:[],cities:new Set()});
  local.forEach(p=>{
    if(byReg[p.region]){
      byReg[p.region].n++;
      byReg[p.region].ph.push(p);
      if(p.city)byReg[p.region].cities.add(p.city);
    }
  });
  const regs=ALL_REGIONS.map(r=>({r,...byReg[r]})).sort((a,b)=>a.n-b.n);

  // ═══ المدن الأفقر (لها صورة أو صورتان) ═══
  const byCity={};
  local.forEach(p=>{
    if(!p.city)return;
    const k=p.region+'|'+p.city;
    byCity[k]=byCity[k]||{city:p.city,region:p.region,n:0};
    byCity[k].n++;
  });
  const thinCities=Object.values(byCity).filter(c=>c.n<=2).sort((a,b)=>a.n-b.n).slice(0,12);

  const empty=regs.filter(x=>x.n===0);
  const thin=regs.filter(x=>x.n>0&&x.n<5);

  el.innerHTML=`
    ${empty.length?`
      <div class="wt-lead">🏜️ ما فيها ولا صورة</div>
      <div class="wt-grid">
        ${empty.map(x=>`
          <div class="wt-card empty" onclick="shootThere('${esc(x.r)}')">
            <div class="wt-name">${esc(x.r)}</div>
            <div class="wt-badge">أول صورة!</div>
            <button class="wt-go">📷 صوّرها</button>
          </div>`).join('')}
      </div>`:''}

    ${thin.length?`
      <div class="wt-lead" style="margin-top:20px">🌱 تحتاج مزيداً</div>
      <div class="wt-grid">
        ${thin.map(x=>`
          <div class="wt-card thin" onclick="shootThere('${esc(x.r)}')">
            <div class="wt-name">${esc(x.r)}</div>
            <div class="wt-count">${x.n} ${x.n===1?'صورة':x.n<11?'صور':'صورة'} · ${x.cities.size} ${x.cities.size===1?'مدينة':'مدن'}</div>
            <button class="wt-go">📷 صوّرها</button>
          </div>`).join('')}
      </div>`:''}

    ${thinCities.length?`
      <div class="wt-lead" style="margin-top:20px">📍 مدن وقرى بصورة أو صورتين</div>
      <div class="wt-cities">
        ${thinCities.map(c=>`
          <div class="wt-city" onclick="shootThere('${esc(c.region)}','${esc(c.city)}')">
            <span class="wc-name">${esc(c.city)}</span>
            <span class="wc-reg">${esc(c.region)}</span>
            <span class="wc-n">${c.n}</span>
          </div>`).join('')}
      </div>`:''}

    ${(!empty.length&&!thin.length&&!thinCities.length)?`
      <div class="empty" style="padding:30px">
        <span class="big">🎉</span>
        كل المناطق موثّقة!<br>واصل التوثيق وكثّف صور ديرتك
      </div>`:''}

    <div class="wt-note">
      💡 كل صورة من مكان جديد ترفع ترتيب منطقتك بسباق الديار — والمصوّر الأول يكسب سبق الموقع 🏅
    </div>`;
}

/* الانتقال للنشر مع تعبئة الموقع */

export function shootThere(region,city){
  go('add');
  window.__pendingPlace={region:region||'',city:city||''};
  setTimeout(()=>applyPendingPlace(0),200);
  toast('📍 '+(city||region)+' — صوّرها وكن أول من يوثّقها');
}

/* تطبيع الاسم للمطابقة المرنة */

export function applyPendingPlace(tries){
  const pp=window.__pendingPlace;
  if(!pp)return;
  if(tries>22){window.__pendingPlace=null;return}

  const rs=$('aRegion');
  if(!rs||!rs.options.length){
    setTimeout(()=>applyPendingPlace(tries+1),120);
    return;
  }

  // المنطقة
  if(pp.region&&normPlace(rs.value)!==normPlace(pp.region)){
    const o=findOpt(rs,pp.region);
    if(o){
      rs.value=o.value;
      rs.dispatchEvent(new Event('change',{bubbles:true}));
      if(typeof fillAddCities==='function')fillAddCities();
    }else if(tries>6){
      window.__pendingPlace=null;
      if(typeof toast==='function')toast('اختر المنطقة يدوياً',true);
      return;
    }
  }

  // المدينة
  if(!pp.city){
    if(pp.region&&normPlace(rs.value)===normPlace(pp.region)){window.__pendingPlace=null;return}
    setTimeout(()=>applyPendingPlace(tries+1),140);
    return;
  }

  const cs=$('aCity');
  if(cs&&cs.options.length>1){
    const c=findOpt(cs,pp.city);
    if(c){
      cs.value=c.value;
      cs.dispatchEvent(new Event('change',{bubbles:true}));
      window.__pendingPlace=null;
      return;
    }
  }
  setTimeout(()=>applyPendingPlace(tries+1),140);
}

/* ====== عرض بيانات التصوير بنافذة الصورة ====== */
