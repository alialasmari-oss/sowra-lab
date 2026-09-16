/* صورة من بلدي — features/limits.js
   حدود المعدّل */

import { currentUser, isAnon, sb } from '../core/db.js';
import { state } from '../core/state.js';
import { geo, COORDS, REGION_CENTER, nearestCity, loadPlaces, BASE_GEO } from '../data/places.js';

export const RATE_LIMITS={photo:{n:10,hours:1,label:'صور'},comment:{n:20,hours:1,label:'تعليقات'},message:{n:5,hours:24,label:'رسائل'},claim:{n:3,hours:24,label:'سبق'}};

export async function checkRate(kind){
  if(isAnon())return null;
  if(state.isAdmin)return null;
  const cfg=RATE_LIMITS[kind];
  if(!cfg)return null;
  try{
    const since=new Date(Date.now()-cfg.hours*3600000).toISOString();
    const r=await sb.from('rate_log').select('id',{count:'exact',head:true})
      .eq('user_id',currentUser()?.id).eq('kind',kind).gte('created_at',since);
    if((r.count||0)>=cfg.n){
      return cfg.hours===24
        ? ('وصلت الحد اليومي ('+cfg.n+' '+cfg.label+') — جرّب بكرة')
        : ('خذ نفسك — تقدر تنشر '+cfg.n+' '+cfg.label+' بالساعة');
    }
  }catch(e){}
  return null;
}

export async function logRate(kind){
  if(isAnon())return;
  try{await sb.from('rate_log').insert({user_id:currentUser()?.id,kind})}catch(e){}
}

/* ====== تعديل العنوان والوصف ====== */
