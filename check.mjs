/* صورة من بلدي — فحص سلامة المشروع
   التشغيل:  node check.mjs
   يفحص: التكرار · الدورات · المراجع المفقودة · الأحجام · onclick */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

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

/* ═══ خطأ قاعدة مطموس ═══
   «لقطة الأسبوع عند تفعيلها للجمهور تظهر رسالة خطأ» — وما كان بوسع
   أحد أن يعرف أيّ خطأ، لأن السطر كان: if(error){toast('فشلت العملية')}
   فيرمي رسالة سوبابيز التي تسمّي السبب بالحرف. تسعة مواضع كانت كذلك.
   القاعدة: كل فرع يفحص error لازم يذكره — dbErr(…, error) أو
   error.message — وإلا فالعطل بلا دليل. */
let mutedErrs = [];
try{
  for(const f of files){
    read(f).split('\n').forEach((ln, i) => {
      if(!/\bif\s*\(\s*(error|up\.error|r\.error)\b/.test(ln)) return;
      if(!/toast\s*\(/.test(ln)) return;
      /* فرعٌ يفحص رمزاً بعينه (23505 مثلاً) رسالته الودّية مقصودة،
         والسبب معروف سلفاً من الرمز — فليس طمساً */
      if(/\berror\.code\s*===/.test(ln)) return;
      if(/\berror(\.message|\.code|\.hint|\.details)|dbErr\s*\(/.test(ln.replace(/\bif\s*\(\s*[^)]*\)/, ''))) return;
      mutedErrs.push(`${f}:${i+1}`);
    });
  }
}catch(e){}

/* ═══ إظهارٌ يفرض display على عنصرٍ له تخطيط بالأنماط ═══
   قائمة الإشراف جُعلت شبكةً بالأنماط فبقيت بطاقةً واحدة بالسطر على
   سطح المكتب — لأن admSetTab كتب style.display='block' سطرياً، والنمط
   السطريّ يغلب الورقة كلها. أي أن «أظهِر العنصر» محا «رتّبه شبكةً».
   القاعدة: الإظهار يُعاد بـ'' لا بـ'block' — فالفراغ يرجع العنصر لما
   تقوله الورقة، و'block' يفرض رأياً لا يملكه. */
let forcedDisp = [];
try{
  const css = fs.readFileSync('./style.css', 'utf8');
  const laidOut = new Set();     /* معرّفات تقول عنها الورقة grid أو flex */
  for(const m of css.matchAll(/#([A-Za-z][\w-]*)[^{}]*\{([^}]*)\}/g))
    if(/display\s*:\s*(grid|flex|inline-flex|inline-grid)/.test(m[2])) laidOut.add(m[1]);
  for(const f of files){
    read(f).split('\n').forEach((ln, i) => {
      for(const m of ln.matchAll(/\$\(\s*'([^']+)'\s*\)\s*\.style\.display\s*=[^;]*'block'/g))
        if(laidOut.has(m[1])) forcedDisp.push(`${f}:${i+1} — #${m[1]}`);
      for(const m of ln.matchAll(/getElementById\(\s*'([^']+)'\s*\)[^;]*\.style\.display\s*=\s*'block'/g))
        if(laidOut.has(m[1])) forcedDisp.push(`${f}:${i+1} — #${m[1]}`);
    });
  }
}catch(e){}

/* ═══ بنية ملف الأنماط ═══
   الفاحص كان يُعرب الجافاسكربت ولا يمسّ style.css — وهو ١١٢ كيلوبايت
   في ملفٍ واحد يُرفع بالنسخ واللصق. وأكثر ما يصيب ملفاً كهذا: قوسٌ
   ناقص، أو تعليقة لم تُغلق، أو نسخٌ مبتور في آخره. وكلها صامتة:
   المتصفح يتجاهل ما بعد الكسر فتختفي أنماطٌ بلا رسالة خطأ واحدة. */
let cssErrs = [];
try{
  const css = fs.readFileSync('./style.css', 'utf8');
  const lineAt = i => css.slice(0, i).split('\n').length;
  /* تعليقات غير مغلقة */
  for(let i = css.indexOf('/*'); i > -1; i = css.indexOf('/*', i + 2)){
    const end = css.indexOf('*/', i + 2);
    if(end === -1){ cssErrs.push(`سطر ${lineAt(i)} — تعليقة لم تُغلق`); break; }
    i = end;
  }
  /* توازن الأقواس */
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let depth = 0, opened = [];
  for(let i = 0; i < bare.length; i++){
    if(bare[i] === '{'){ depth++; opened.push(i); }
    else if(bare[i] === '}'){
      depth--; opened.pop();
      if(depth < 0){ cssErrs.push(`سطر ${lineAt(i)} — قوس إغلاق زائد`); depth = 0; }
    }
  }
  if(depth > 0) cssErrs.push(`سطر ${lineAt(opened[0])} — قوس فتح بلا إغلاق (الملف مبتور؟)`);
  /* آخر الملف: لازم ينتهي بإغلاق لا بنصف قاعدة */
  const tail = bare.trimEnd();
  if(tail && !/[}\/]$/.test(tail))
    cssErrs.push(`سطر ${lineAt(bare.trimEnd().length)} — الملف ينتهي بنصف قاعدة`);
}catch(e){ cssErrs.push('تعذّر قراءة style.css — '+((e&&e.message)||e)); }

/* ═══ خلفية فاتحة مثبّتة بلا غطاء ليلي ═══
   بنر لقطة الأسبوع كان خلفيته #FFF3CF مثبّتةً بالحجر ونصّه var(--txt).
   نهاراً: أسودُ على كريمي. ليلاً: --txt يصير #F0E8DA فيصبح أبيضَ على
   كريمي — تباينٌ 1.05:1، أي نصٌّ غير موجود. ولا يكشفه أحد إلا زائرٌ
   يفتح الوضع الليلي ويخبرنا.
   القاعدة: كل قاعدة خلفيتها لونٌ فاتح مكتوبٌ بالحجر ونصُّها متغيّر
   أو موروث، لازم لها قاعدة body.dark تقابلها. */
let lightBg = [];
try{
  const css = fs.readFileSync('./style.css', 'utf8');
  const covered = new Set();
  for(const m of css.matchAll(/body\.dark\s*([^{]*)\{/g))
    for(const s of m[1].split(','))
      { const t = s.replace(/^\s*body\.dark\s*/,'').trim(); if(t) covered.add(t); }
  const lum = h => {
    h = h.replace('#',''); if(h.length===3) h = [...h].map(c=>c+c).join('');
    const v = [0,2,4].map(i => parseInt(h.slice(i,i+2),16)/255)
                     .map(c => c<=0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4);
    return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
  };
  /* ماسحٌ بعدّ الأقواس لا بتعبير نمطي: جرّبنا النمطي أولاً فابتلع
     قاعدة .week-strip نفسها — أي أن القاعدة التي كُتبت لهذا العطل
     بالذات لم تكن تراه. فاحصٌ يمرّ على عطله أسوأ من لا فاحص. */
  const rules = [];
  for(let i = 0, depth = 0, start = 0, selStart = 0; i < css.length; i++){
    if(css[i] === '{'){
      if(depth === 0){ selStart = start; start = i + 1; }
      depth++;
    } else if(css[i] === '}'){
      depth--;
      if(depth === 0){
        rules.push([css.slice(selStart, start - 1), css.slice(start, i)]);
        start = i + 1;
      }
    }
  }
  for(const [rawSel, body] of rules){
    const sel = rawSel.replace(/\/\*[\s\S]*?\*\//g, '').trim().split('\n').pop().trim();
    if(!sel || /^(body\.dark|@|:root)/.test(sel)) continue;
    const bg = [...body.matchAll(/(?:^|;)\s*background(?:-color|-image)?\s*:([^;]*)/g)];
    const light = bg.flatMap(d => [...d[1].matchAll(/#[0-9A-Fa-f]{3,6}\b/g)].map(x=>x[0]))
                    .filter(h => lum(h) > 0.75);
    if(!light.length) continue;
    const col = (body.match(/(?:^|;)\s*color\s*:([^;]*)/) || [,''])[1].trim();
    if(col && !/var\(--(txt|ink)/.test(col)) continue;   /* نصٌّ فاتح صريح — مقصود */
    if(sel.split(',').some(p => covered.has(p.trim()))) continue;
    lightBg.push(`${sel.slice(0,40)} (${light[0]})`);
  }
}catch(e){}

/* ═══ قيمة متغيّرة تُقرأ من الحاجز ═══
   main.js يسجّل الميزات بـObject.assign — وهذا ينسخ قيمة الارتباط
   لحظة التسجيل لا الارتباط نفسه. فكل `export let` يُقرأ بـget() من
   وحدة أخرى يظلّ على قيمته الأولى للأبد ولو أُسند بعدها ألف مرة.
   هكذا بقيت CW=null شهوراً فانهار كل زر بمسابقة لقطة الأسبوع.
   القاعدة: القيم الثابتة (const) تمرّ بـget، والمتغيّرة تمرّ بدالة
   قارئة: `export const getX = () => X` ثم need('getX'). */
let staleGets = [];
try{
  const mutable = new Set();
  for(const f of files)
    for(const m of read(f).matchAll(/^export\s+let\s+([A-Za-z_$][\w$]*)/gm))
      mutable.add(m[1]);
  /* التعليقات تُفرَّغ ويُحفظ عدد أسطرها — وإلا فشرحُ العطل يُحسب عطلاً */
  const strip = s => s
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (m, p) => p);
  for(const f of files){
    strip(read(f)).split('\n').forEach((ln, i) => {
      for(const m of ln.matchAll(/(?<![.\w$])get\(\s*['"]([A-Za-z_$][\w$]*)['"]/g))
        if(mutable.has(m[1])) staleGets.push(`${f}:${i+1} — ${m[1]}`);
    });
  }
}catch(e){}

/* ═══ خطأ إعرابي — أول الفحوص وأهمّها ═══
   هذا الفاحص فحص ثمانية أشياء ذكية شهوراً ولم يفحص أبسطها: هل الملف
   جافاسكربت صحيح؟ فمرّت عليه تعليقةٌ أُغلقت مرتين، وقبلها دالةٌ
   قُطع ذيلها — كلاهما «سليم» بشهادته، وكلاهما يوقف التطبيق كله.
   وأخبث ما في الباب أن `node --check` على ملف .js يرجع صفراً
   لملفٍ فيه export ولو كان محشوّاً بالحشو — جرّبناه: «this is not
   valid js at all» يمرّ. ولا يعرب إلا بلاحقة .mjs. فننسخ كل ملف
   بلاحقتها ثم نُعربه — إعراباً حقيقياً بمحرّك V8 لا بالتخمين. */
let syntax = [];
try{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sowra-parse-'));
  for(const f of files){
    const p = path.join(tmp, f.replace(/[\/]/g, '__').replace(/\.js$/, '.mjs'));
    fs.writeFileSync(p, read(f));
    try{ execFileSync(process.execPath, ['--check', p], { stdio:'pipe' }); }
    catch(e){
      const err = String(e.stderr || '').split('\n').find(l => /Error/.test(l)) || 'خطأ إعرابي';
      const ln  = (String(e.stderr || '').match(/\.mjs:(\d+)/) || [,'?'])[1];
      syntax.push(`${f}:${ln} — ${err.trim()}`);
    }
  }
  fs.rmSync(tmp, { recursive:true, force:true });
}catch(e){ syntax.push('تعذّر الإعراب — '+((e&&e.message)||e)); }

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

line(!syntax.length, 'إعراب الملفات', syntax.length || '');
if(syntax.length){ fails++; syntax.forEach(s => console.log(`       ${s}`)); }

line(!Object.keys(dupes).length, 'تعريفات مكرّرة', Object.keys(dupes).length || '');
if(Object.keys(dupes).length){ fails++; for(const [k,v] of Object.entries(dupes)) console.log(`       ${k}: ${v.join(', ')}`); }

line(!cycles.size, 'دورات مغلقة', cycles.size || '');
if(cycles.size){ fails++; [...cycles].slice(0,5).forEach(c => console.log(`       ${c}`)); }

line(!badHits.length, 'أنماط خاطئة', badHits.length || '');
if(badHits.length){ fails++; badHits.slice(0,8).forEach(([f,d,t]) => console.log(`       ${f}: ${d} — ${t}`)); }

line(!htmlMissing.length, 'onclick مفقودة', htmlMissing.length || '');
if(htmlMissing.length){
  /* «مؤجّلة للإشراف» تعني: زرّها داخل لوحة الإشراف، فلا يضرّ أن
     تتأخّر مع وحدتها الكسولة. والمعيار موضع الزر لا اسم الملف.
     كان sendFeedback مستثناةً هنا وهي بصفحة «رسائلي» التي يفتحها كل
     زائر — فأخفى الاستثناءُ عطلاً حقيقياً شهوراً. لا يُضاف اسم لهذه
     القائمة إلا بعد التأكد أن زرّه لا يظهر إلا للمشرف. */
  const adm = htmlMissing.filter(n => n.startsWith('adm') || ['plcFillCities'].includes(n));
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

line(!mutedErrs.length, 'خطأ قاعدة مطموس', mutedErrs.length || '');
if(mutedErrs.length){ fails++; console.log(`       ${mutedErrs.join(' · ')} — استعمل dbErr(الإجراء, error)`); }

line(!forcedDisp.length, 'إظهار يمحو تخطيط الأنماط', forcedDisp.length || '');
if(forcedDisp.length){ fails++; forcedDisp.forEach(s => console.log(`       ${s} — أظهِر بـ'' لا بـ'block'`)); }

line(!cssErrs.length, 'بنية ملف الأنماط', cssErrs.length || '');
if(cssErrs.length){ fails++; cssErrs.forEach(s => console.log(`       ${s}`)); }

line(!lightBg.length, 'خلفية فاتحة بلا وضع ليلي', lightBg.length || '');
if(lightBg.length){ fails++; lightBg.forEach(s => console.log(`       ${s} — أضف قاعدة body.dark`)); }

line(!staleGets.length, 'قيمة متغيّرة من الحاجز', staleGets.length || '');
if(staleGets.length){ fails++; staleGets.forEach(s => console.log(`       ${s} — صدّر دالة قارئة واستعمل need`)); }

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
