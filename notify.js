/* صورة من بلدي — features/notify.js
   الإشعارات والمفاتيح */

import { state } from '../core/state.js';
import { $ } from '../core/ui.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

export async function pushNotify(payload){
  try{
    const url=(typeof SB_URL!=='undefined'?SB_URL:'https://gquzjaxpqeggknhipmzk.supabase.co')+'/functions/v1/smart-service';
    const key=(typeof SB_KEY!=='undefined')?SB_KEY:'sb_publishable_BNp6Fg3VLXa1Pf4V6QjncQ_f496PquX';
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+key},
      body:JSON.stringify(payload)
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
    return j;
  }catch(e){
    console.warn('push failed',e);
    return null;
  }
}

/* ====== الوقت النسبي بالعربي ====== */

export function initInspect(){
  state.inspectOn=!!(state.banner.inspect_enabled);
}

export function initCommBox(){
  const el=$('commBox');if(!el)return;
  const sp=state.banner;
  el.style.display=(sp&&sp.commercial_enabled)?'block':'none';
}
