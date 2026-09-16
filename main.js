/* صورة من بلدي — main.js
   نقطة الدخول الوحيدة — الملف الوحيد المُدرَج بـindex.html

   المسؤوليات الثلاث:
   ١. استيراد كل الوحدات بالترتيب الصحيح (يحدّده المتصفح تلقائياً)
   ٢. تسجيل الميزات بالحاجز حتى تنادي بعضها بلا دورات
   ٣. نشر ما يناديه onclick بالنطاق العام (جسر مؤقت)
*/

import { ensureAuth, sb, session } from './core/db.js';
import { toast, installErrorWatch, $ } from './core/ui.js';
import { state } from './core/state.js';
import { provide, hubReport } from './core/hub.js';
import { expose } from './core/bridge.js';
import { loadPlaces } from './data/places.js';

import * as app_nav from './app/nav.js';
import * as app_push from './app/push.js';
import * as app_theme from './app/theme.js';
import * as features_account_media from './features/account-media.js';
import * as features_account from './features/account.js';
import * as features_banners from './features/banners.js';
import * as features_blocks from './features/blocks.js';
import * as features_camera from './features/camera.js';
import * as features_claims from './features/claims.js';
import * as features_contest from './features/contest.js';
import * as features_edit from './features/edit.js';
import * as features_exif from './features/exif.js';
import * as features_favorites from './features/favorites.js';
import * as features_feed from './features/feed.js';
import * as features_filterbar from './features/filterbar.js';
import * as features_filters from './features/filters.js';
import * as features_geopick from './features/geopick.js';
import * as features_inspect from './features/inspect.js';
import * as features_limits from './features/limits.js';
import * as features_map from './features/map.js';
import * as features_messages from './features/messages.js';
import * as features_music from './features/music.js';
import * as features_notify from './features/notify.js';
import * as features_profile from './features/profile.js';
import * as features_promo from './features/promo.js';
import * as features_quests from './features/quests.js';
import * as features_race from './features/race.js';
import * as features_rating from './features/rating.js';
import * as features_reels from './features/reels.js';
import * as features_search from './features/search.js';
import * as features_share from './features/share.js';
import * as features_sheet from './features/sheet.js';
import * as features_stats from './features/stats.js';
import * as features_translate from './features/translate.js';
import * as features_upload from './features/upload.js';
import * as features_visits from './features/visits.js';

/* ═══════════════════════════════════════════
   ١) تسجيل الميزات بالحاجز
   كل ما تصدّره الوحدات يصير متاحاً لبعضها
   ═══════════════════════════════════════════ */
const ALL = Object.assign({},
  app_nav,
  app_push,
  app_theme,
  features_account_media,
  features_account,
  features_banners,
  features_blocks,
  features_camera,
  features_claims,
  features_contest,
  features_edit,
  features_exif,
  features_favorites,
  features_feed,
  features_filterbar,
  features_filters,
  features_geopick,
  features_inspect,
  features_limits,
  features_map,
  features_messages,
  features_music,
  features_notify,
  features_profile,
  features_promo,
  features_quests,
  features_race,
  features_rating,
  features_reels,
  features_search,
  features_share,
  features_sheet,
  features_stats,
  features_translate,
  features_upload,
  features_visits
);
provide(ALL);

/* ═══════════════════════════════════════════
   ٢) الجسر — لـonclick بالـHTML
   ⚠️ مؤقت: كل ما نقلت onclick لمستمع، احذف اسمه
   ═══════════════════════════════════════════ */
expose(ALL);

/* دوال الأساس التي يناديها HTML أيضاً */
expose({ toast, $ });

/* ═══════════════════════════════════════════
   ٣) لوحة الإشراف — تحميل كسول
   ١٨٠٠ سطر لا تُحمّل إلا عند فتح الترس
   ═══════════════════════════════════════════ */
let _admLoaded = false;
export async function loadAdminModule(){
  if(_admLoaded) return true;
  try{
    const mods = await Promise.all([
      import('./admin/cleanup.js'),
      import('./admin/contest.js'),
      import('./admin/curation.js'),
      import('./admin/index.js'),
      import('./admin/misc.js'),
      import('./admin/music.js'),
      import('./admin/news.js'),
      import('./admin/places.js'),
      import('./admin/quests.js'),
      import('./admin/reports.js'),
      import('./admin/settings.js'),
      import('./admin/stats.js'),
      import('./admin/team.js')
    ]);
    const bag = Object.assign({}, ...mods);
    provide(bag);
    /* openAdmin يبقى غلافنا — لا نستبدله بالحقيقية وإلا فقدنا التحميل الكسول */
    const { openAdmin: _real, ...rest } = bag;
    expose(rest);
    window.__openAdminReal = _real;
    _admLoaded = true;
    return true;
  }catch(e){
    console.error('[admin] تعذر التحميل', e);
    toast('تعذر تحميل لوحة الإشراف', true);
    return false;
  }
}

/* openAdmin بالـHTML يمر من هنا: يحمّل اللوحة ثم يفتحها */
expose({
  openAdmin: async () => {
    const ok = await loadAdminModule();
    if(!ok) return;
    if(typeof window.__openAdminReal === 'function') window.__openAdminReal();
  },
  loadAdminModule
});

/* ═══════════════════════════════════════════
   ٤) الإقلاع
   ═══════════════════════════════════════════ */
async function boot(){
  if(window.__BOOT_FAIL) return;
  installErrorWatch();

  try{
    await ensureAuth();
  }catch(e){
    console.error('[boot] فشل المصادقة', e);
    return;
  }

  /* الأماكن أولاً — القوائم تعتمد عليها */
  try{
    await loadPlaces();
    if(typeof window.initSelects==='function') window.initSelects();
    if(typeof window.fillAddCities==='function') window.fillAddCities();
    if(typeof window.fillCities==='function') window.fillCities();
  }catch(e){ console.warn('[boot] الأماكن', e); }

  /* ثم الإقلاع المعتاد — nav.js يتولّاه */
  try{
    await app_nav.boot();
  }catch(e){
    console.error('[boot] خطأ بالإقلاع', e);
  }

  /* تشخيص بوضع التطوير */
  if(location.search.includes('debug')) hubReport();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
}else{
  boot();
}
