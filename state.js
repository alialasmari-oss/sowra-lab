/* صورة من بلدي — core/state.js
   الحالة المشتركة — مكان واحد لكل ما يتغيّر
   القاعدة: لا تستبدل الكائن، بل عدّل حقوله (وإلا يفقد المستوردون الرابط) */

export const state = {
  /* البيانات */
  photos: [],
  favSet: new Set(),
  visitCounts: {},
  claimMap: {},

  /* الصورة المفتوحة */
  curId: null,
  curPhoto: null,

  /* الفلترة والعرض */
  cat: 'all',
  sort: 'top',
  scope: 'home',
  viewMode: 'grid',
  tags: [],
  onlyClaims: false,
  onlyEc: false,

  /* البروفايل المفتوح */
  profUid: null,

  /* الصلاحيات */
  isAdmin: false,
  admRole: '',
  isCurator: false,

  /* مفاتيح الموقع من site_banner */
  banner: {},

  /* الحظر */
  myBlocks: new Set(),

  /* حالة الواجهة */
  accOpen: '',      /* القسم المفتوح بحسابي */
  statsSort: 'new', /* فرز الإحصائيات */
  dmTab: 'in',      /* تبويب الرسائل */
  uniTab: 'photos', /* تبويب البحث */
  admTab: 'rep',

  /* مسوّدة الفلتر — قبل التطبيق */
  draftCat: 'all', draftSort: 'top', draftScope: 'home',

  /* تقييمي للصورة المفتوحة · موسيقى المستخدم */
  myRating: 0, ownMusicFile: null, recFilter: 'none',    /* تبويب الإشراف */
  shSort: 'photos', /* فرز المصورين */
  geoPickMode: null,/* وضع اختيار الموقع */

  /* مسوّدة النشر */
  earlyRes: null, geoPlace: null, edGeo: null, exifTech: null,
  pickedTags: [], sugT: '', sugD: '', inspErr: '', inspectOn: false,
  recStart: null, gpMap: null,

  /* الرسائل والبحث */
  dmTo: null, dmPick: null, dmBanMap: {}, uniData: null,
  cuPick: null, tmPick: null, opened: 0,

  /* لوحة الإشراف */
  admPhotos: [],
  admMusic: [],

  /* كائنات مشتركة بين الملفات */
  map: null,          /* كائن Leaflet */
  race: [],           /* سباق الديار */
  reelsList: [],      /* قائمة الأضواء */
  viewMode: 'grid',   /* grid | map */

  /* مسوّدة النشر — يكتبها upload وcamera */
  pendingFile: null,
  pendingBlob: null,
  pendingVideo: null,
  pendingGeo: null,
  pendingVis: 'public',
  isAbroad: false,
  curFilter: 'none',
  pendingMusicName: '',
  pickedMusic: null,
  trTitle: '', trDesc: '',
  edTrTitle: '', edTrDesc: '',

  /* الكاميرا */
  recorder: null, recChunks: [], recTimer: null,
  recFacing: 'environment', audioCtx: null, musicAudio: null,

  /* الخريطة والأضواء */
  marks: null, gapsOn: false, reelObserver: null, reelsMuted: true,

  /* البروفايل والكنوز */
  profTab: 'public', myRegion: '', myBadgeSet: new Set(),
  qDone: new Set(), qStops: {}, admQs: {},

  /* المسابقة */
  weekMode: 'live', weekEntries: [], weekVotes: {}, myWeekVote: null,

  /* البلاغات */
  admReps: {}
};

/* مستمعون للتغيير — يسمح بإعادة الرسم تلقائياً لاحقاً */
const listeners = new Set();

export function onChange(fn){
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(what){
  listeners.forEach(fn => { try{ fn(what); }catch(e){} });
}

/* اختصارات للمفاتيح الشائعة */
export function banner(key, def){
  const v = state.banner?.[key];
  return v === undefined ? def : v;
}

export function videoAllowed(){
  return !!banner('video_enabled', false) && !banner('reels_soon', false);
}

export function reelsState(){
  if(!banner('video_enabled', false)) return banner('reels_soon', false) ? 'soon' : 'off';
  return banner('reels_soon', false) ? 'soon' : 'open';
}

export function isOwner(){ return state.admRole === 'owner'; }
export function isEditor(){ return state.admRole === 'owner' || state.admRole === 'editor'; }
export function isCurator(){ return isEditor() || state.isCurator; }
