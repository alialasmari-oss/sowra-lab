/* صورة من بلدي — فحص سلامة المشروع
   التشغيل:  node check.mjs
   يفحص: التكرار · الدورات · المراجع المفقودة · الأحجام · onclick */

import fs from 'fs';
import path from 'path';

const JS = './js';
const files = [];
(function walk(d){
  for(const e of fs.readdirSync(d, {withFileTypes:true})){
    const p = path.join(d, e.name);
    if(e.isDirectory()) walk(p);
    else if(e.name.endsWith('.js')) files.push(p.replace(/\\/g,'/').replace(/^\.?\/?js\//,''));
  }
})(JS);
files.sort();

const read = f => fs.readFileSync(path.join(JS, f), 'utf8');

/* ═══ ١) الصادرات ═══ */
const exports = {};       // اسم → ملف
const dupes = {};
for(const f of files){
  const s = read(f);
  const names = [
    ...s.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm),
    ...s.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)
  ].map(m => m[1]);
  for(const n of names){
    if(exports[n]) (dupes[n] = dupes[n] || [exports[n]]).push(f);
    else exports[n] = f;
  }
}

/* ═══ ٢) الدورات ═══ */
const imports = {};
for(const f of files){
  const s = read(f);
  const base = f.includes('/') ? f.slice(0, f.lastIndexOf('/')+1) : '';
  imports[f] = new Set();
  for(const m of s.matchAll(/from\s*'(\.\.?\/[^']+)'/g)){
    const p = m[1];
    imports[f].add(p.startsWith('../') ? p.slice(3) : (p.startsWith('./') ? base + p.slice(2) : p));
  }
}
const cycles = new Set();
function dfs(n, pathArr){
  for(const m of imports[n] || []){
    if(pathArr.includes(m)) cycles.add([...pathArr.slice(pathArr.indexOf(m)), m].join(' → '));
    else if(pathArr.length < 9) dfs(m, [...pathArr, m]);
  }
}
for(const f of files) dfs(f, [f]);

/* ═══ ٣) أنماط خاطئة ═══ */
const BAD_PATTERNS = [
  [/^.*(?:let|const|var)\s+state\.\w+/m, 'تعريف state.x (مستحيل)'],
  [/['"]state\.\w+/,                     'state داخل سلسلة نصية'],
  [/state\.state\./,                     'state مزدوج'],
  [/_\w+_\(\)\s*=(?!=)/,                 'إسناد لدالة get()'],
  [/\bfrom\('state\./,                   'اسم جدول خاطئ'],
  [/getElementById\('[^']*state\./,      'معرّف عنصر خاطئ'],
  /* دوال الحاجز تُطبع كقيمة داخل قالب نصّي — مثل ${need} بدل العدد،
     فتُطبع شيفرة الدالة كاملة بالواجهة. */
  [/\$\{\s*(?:need|get|provide|expose)\s*(?:[-+*/]|\})/, 'دالة الحاجز داخل قالب'],
  /* متغيرات ما قبل الوحدات — الصحيح geo.GEO و geo.VILL
     \b بالنهاية يلتقط «for(const r in GEO)» أيضاً، لا الأقواس فقط */
  [/(?<![.\w$'"])(?:GEO|VILL|USER|IS_ADMIN|ADM_ROLE|VISIT_COUNTS|CLAIM_MAP)\b(?!\s*[:=]\s)/, 'متغير عام قديم'],
];
const badHits = [];
for(const f of files){
  const s = read(f);
  for(const [re, desc] of BAD_PATTERNS){
    const g = new RegExp(re.source, re.flags.includes('m') ? 'gm' : 'g');
    for(const m of s.matchAll(g)) badHits.push([f, desc, m[0].slice(0,60).trim()]);
  }
}

/* ═══ ٤) الأحجام ═══ */
const sizes = files.map(f => [f, read(f).split('\n').length]);
const total = sizes.reduce((a,[,n]) => a+n, 0);
const big = sizes.filter(([,n]) => n > 400);

/* ═══ ٥) onclick بالـHTML ═══ */
let htmlMissing = [], htmlGlobals = [];
try{
  const html = fs.readFileSync('./index.html','utf8');
  const needed = new Set();
  for(const m of html.matchAll(/on\w+\s*=\s*"([^"]*)"/g))
    for(const c of m[1].matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) needed.add(c[1]);
  const SKIP = ['event','this','getElementById','click','focus','blur','preventDefault','stopPropagation','if'];
  htmlMissing = [...needed].filter(n => !exports[n] && !SKIP.includes(n));

  /* متغيرات ما قبل الوحدات داخل onclick بالـHTML —
     مثل openProfile(USER.id): تُرمى ReferenceError عند الضغط فقط،
     فلا يكشفها فحص ملفات js وحده. */
  const OLD = /(?<![.\w$'"])(?:GEO|VILL|USER|IS_ADMIN|ADM_ROLE|VISIT_COUNTS|CLAIM_MAP)\b/;
  for(const m of html.matchAll(/on\w+\s*=\s*"([^"]*)"/g)){
    const hit = m[1].match(OLD);
    if(hit) htmlGlobals.push(`${hit[0]} في: ${m[1].slice(0,52)}`);
  }
}catch(e){}

/* ═══ ٦) صنف الصفحة الابتدائي على body ═══
   style.css يحمل قواعد مثل body.page-feed #mainFilters{display:flex}.
   وصنف body لا يضعه إلا go()، وgo() لا تُنادى عند أول تحميل — فأي
   قاعدة معلّقة على body.page-… تسقط بصمت حتى يتنقّل المستخدم ويرجع.
   الشرط: <body> يبدأ بصنف الصفحة المفتوحة فعلاً (التي تحمل class="page on"). */
let bodyClassErr = '';
try{
  const html = fs.readFileSync('./index.html','utf8');
  if(/body\.page-[a-z]+/.test(fs.readFileSync('./style.css','utf8'))){
    const bodyTag = (html.match(/<body[^>]*>/) || [''])[0];
    const onPage  = (html.match(/<div[^>]*class="page on"[^>]*id="page-([a-z]+)"/) || [])[1];
    const onBody  = (bodyTag.match(/\bpage-([a-z]+)\b/) || [])[1];
    if(!onBody)              bodyClassErr = `<body> بلا صنف صفحة — القواعد body.page-… لا تنطبق عند أول تحميل`;
    else if(onPage && onBody !== onPage)
                             bodyClassErr = `<body class="page-${onBody}"> لا يطابق الصفحة المفتوحة page-${onPage}`;
  }
}catch(e){}

/* ═══ ٧) عناصر مستدعاة وغير موجودة ═══
   الوحدات ترسم HTML داخل قوالب نصية. لو سقط سطر <input id="x"> عند
   نقل ملف، يبقى $('x').click() قائماً ويرمي null عند الضغط فقط —
   لا يكشفه أي فحص نصي للملفات. نجمع كل المعرّفات المعرَّفة (بالـHTML
   وبقوالب الـJS) ونقابلها بكل ما يُطلب بـ$() أو getElementById. */
let ghostIds = [];
try{
  let all = fs.readFileSync('./index.html','utf8');
  for(const f of files) all += '\n' + read(f);
  const defined = new Set();
  for(const m of all.matchAll(/id\s*=\s*["']([A-Za-z_][\w-]*)["']/g)) defined.add(m[1]);
  for(const m of all.matchAll(/\.id\s*=\s*['"]([A-Za-z_][\w-]*)['"]/g)) defined.add(m[1]);
  const used = new Set();
  for(const m of all.matchAll(/(?:getElementById|\$)\(\s*'([A-Za-z_][\w-]*)'\s*\)/g)) used.add(m[1]);
  ghostIds = [...used].filter(id => !defined.has(id));
}catch(e){}

/* ═══ ٨) مسارات ملفات الصورة تُحسب بمكان واحد ═══
   لكل صورة ثلاثة ملفات: الأصل و_t و_h. كانت ثلاثة مواضع تحسب مسار
   المصغّرة بنفسها بـreplace خام، فلما أضفنا نسخة الأرشيف كاد موضعان
   ينسيانها: الحذف يترك ملفاً يتيماً للأبد، ومنظّف اليتامى يعدّ كل
   نسخ الأرشيف نفاية ويمحوها. القاعدة: لا أحد يكتب _t أو _h بيده
   خارج core/media.js — الجميع يمرّ بـthumbPath وhiPath وallPaths. */
let rawPaths = [];
try{
  for(const f of files){
    if(f === 'core/media.js') continue;
    read(f).split('\n').forEach((ln, i) => {
      if(/['"`]_[th]\.jpg['"`]|_[th]\.jpg['"`]\s*\)/.test(ln))
        rawPaths.push(`${f}:${i+1}`);
    });
  }
}catch(e){}

/* ═══ التقرير ═══ */
const ok = s => `\x1b[32m${s}\x1b[0m`, bad = s => `\x1b[31m${s}\x1b[0m`, warn = s => `\x1b[33m${s}\x1b[0m`;

console.log('\n╔═══════════════════════════════════════════╗');
console.log('║       فحص سلامة — صورة من بلدي            ║');
console.log('╚═══════════════════════════════════════════╝\n');
console.log(`  الملفات        ${files.length}`);
console.log(`  الأسطر         ${total.toLocaleString('en')}`);
console.log(`  المتوسط        ${Math.round(total/files.length)} سطراً/ملف`);
console.log(`  الصادرات       ${Object.keys(exports).length}\n`);

let fails = 0;

const line = (pass, label, extra='') =>
  console.log(`  ${pass ? ok('✅') : bad('❌')} ${label.padEnd(22)} ${extra}`);

line(!Object.keys(dupes).length, 'تعريفات مكرّرة', Object.keys(dupes).length || '');
if(Object.keys(dupes).length){ fails++; for(const [k,v] of Object.entries(dupes)) console.log(`       ${k}: ${v.join(', ')}`); }

line(!cycles.size, 'دورات مغلقة', cycles.size || '');
if(cycles.size){ fails++; [...cycles].slice(0,5).forEach(c => console.log(`       ${c}`)); }

line(!badHits.length, 'أنماط خاطئة', badHits.length || '');
if(badHits.length){ fails++; badHits.slice(0,8).forEach(([f,d,t]) => console.log(`       ${f}: ${d} — ${t}`)); }

line(!htmlMissing.length, 'onclick مفقودة', htmlMissing.length || '');
if(htmlMissing.length){
  const adm = htmlMissing.filter(n => n.startsWith('adm') || ['sendFeedback','plcFillCities'].includes(n));
  const real = htmlMissing.filter(n => !adm.includes(n));
  if(adm.length) console.log(`       ${warn('⏳')} مؤجّلة للإشراف (${adm.length}): ${adm.slice(0,6).join(', ')}`);
  if(real.length){ fails++; console.log(`       ${bad('❌')} مفقودة: ${real.join(', ')}`); }
}

line(!htmlGlobals.length, 'متغير قديم بالـHTML', htmlGlobals.length || '');
if(htmlGlobals.length){ fails++; htmlGlobals.forEach(h => console.log(`       ${h}`)); }

line(!bodyClassErr, 'صنف الصفحة على body');
if(bodyClassErr){ fails++; console.log(`       ${bodyClassErr}`); }

line(!ghostIds.length, 'عنصر مستدعى ومفقود', ghostIds.length || '');
if(ghostIds.length){ fails++; console.log(`       ${ghostIds.join(', ')}`); }

line(!rawPaths.length, 'مسار ملف محسوب يدوياً', rawPaths.length || '');
if(rawPaths.length){ fails++; console.log(`       ${rawPaths.join(' · ')} — استعمل thumbPath/hiPath/allPaths`); }

console.log(`  ${big.length ? warn('⚠️') : ok('✅')} فوق ٤٠٠ سطر${' '.repeat(10)} ${big.length || ''}`);
big.forEach(([f,n]) => console.log(`       ${f} — ${n}`));

console.log('\n  ── التوزيع ──');
for(const d of ['core','data','features','admin','app']){
  const fs_ = sizes.filter(([f]) => f.startsWith(d+'/'));
  if(fs_.length) console.log(`  ${(d+'/').padEnd(12)} ${String(fs_.length).padStart(2)} ملف · ${String(fs_.reduce((a,[,n])=>a+n,0)).padStart(5)} سطراً`);
}
const root = sizes.filter(([f]) => !f.includes('/'));
if(root.length) console.log(`  ${'(جذر)'.padEnd(12)} ${String(root.length).padStart(2)} ملف · ${String(root.reduce((a,[,n])=>a+n,0)).padStart(5)} سطراً`);

console.log(fails ? `\n  ${bad(`❌ ${fails} مشكلة تحتاج إصلاحاً`)}\n` : `\n  ${ok('✅ المشروع سليم')}\n`);
process.exit(fails ? 1 : 0);
