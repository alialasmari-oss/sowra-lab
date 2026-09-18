/* صورة من بلدي — tools/gen-pages.mjs
   مولّد صفحة لكل صورة + خريطة الموقع

   لماذا هذا الملف؟
   التطبيق صفحة واحدة: أيّاً كان ما يفتحه الزائر يرجع index.html نفسه
   بالعنوان نفسه. فقوقل يرى رابطاً واحداً اسمه «صورة من بلدي» مهما بلغ
   عدد الصور، وواتساب يعرض المعاينة نفسها لكل رابط يُرسل — لأن تطبيقات
   المحادثة لا تشغّل الجافاسكربت إطلاقاً، تقرأ وسوم og: من HTML الخام.

   الحل على استضافة ساكنة: نولّد الصفحات مسبقاً. هذا الملف يقرأ الصور
   من Supabase ويكتب p/<id>.html لكل صورة، وsitemap.xml يجمعها.
   تشغّله شغلة GitHub Actions دورياً.

   التشغيل:  node tools/gen-pages.mjs
   المتغيرات: SITE (أصل الموقع)  ·  SB_URL  ·  SB_KEY  ·  DRY (لا يكتب)
*/

import fs from 'node:fs';
import path from 'node:path';

const SITE   = (process.env.SITE || 'https://sowra.app').replace(/\/+$/, '');
const SB_URL = process.env.SB_URL || 'https://gquzjaxpqeggknhipmzk.supabase.co';
const SB_KEY = process.env.SB_KEY || 'sb_publishable_BNp6Fg3VLXa1Pf4V6QjncQ_f496PquX';
const OUT    = process.env.OUT || 'p';
const DRY    = process.env.DRY === '1';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const imgUrl = p => `${SB_URL}/storage/v1/object/public/photos/${String(p || '').split('/').map(encodeURIComponent).join('/')}`;

const arDate = iso => {
  try { return new Date(iso).toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' }); }
  catch { return ''; }
};

/* المكان بصيغة مقروءة — يُستعمل بالعنوان والوصف */
function placeOf(p){
  if(p.abroad) return [p.city, p.country].filter(Boolean).join('، ');
  return [p.village, p.city, p.region].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join('، ');
}

/* وصف الصفحة: وصف المصوّر إن كتبه، وإلا نبنيه من المكان والعدسة.
   قوقل لا يقرأ البكسلات — يقرأ الكلمات، فلا نترك الصفحة بلا نص. */
function descOf(p){
  const d = String(p.description || '').trim().replace(/\s+/g, ' ');
  if(d.length >= 40) return d.slice(0, 300);
  const place = placeOf(p);
  const who   = p.photographer ? `بعدسة ${p.photographer}` : '';
  const base  = [`${p.title}${place ? ' — ' + place : ''}`, who, 'من منصة «صورة من بلدي» — عدسات أهل الديار'].filter(Boolean).join(' · ');
  return d ? (d + ' · ' + base).slice(0, 300) : base.slice(0, 300);
}

function pageHtml(p, base){
  const place = placeOf(p);
  const title = `${p.title}${place ? ' — ' + place : ''} · صورة من بلدي`;
  const desc  = descOf(p);
  const img   = imgUrl(p.image_path);
  const url   = `${SITE}${base}/${OUT}/${p.id}.html`;
  const app   = `${base || ''}/?p=${p.id}`;
  const stars = Number(p.avg_stars || 0);

  /* بيانات منظّمة — تساعد قوقل على فهم الصفحة صورةً لمكان بعينه */
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Photograph',
    name: p.title,
    description: desc,
    image: img,
    url,
    datePublished: p.created_at,
    contentLocation: place ? { '@type': 'Place', name: place, address: { '@type':'PostalAddress', addressCountry: p.abroad ? (p.country||'') : 'SA', addressRegion: p.region || '', addressLocality: p.city || '' } } : undefined,
    creator: p.photographer ? { '@type': 'Person', name: p.photographer } : undefined,
    isPartOf: { '@type': 'WebSite', name: 'صورة من بلدي', url: SITE }
  };

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="صورة من بلدي">
<meta property="og:locale" content="ar_SA">
<meta property="og:title" content="${esc(p.title)}${place ? esc(' — ' + place) : ''}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:alt" content="${esc(p.title)}">
<meta property="og:url" content="${esc(url)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">

<link rel="icon" type="image/png" sizes="192x192" href="${esc(base)}/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@600;700&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--night:#F7F1E3;--card:#FFF;--card2:#F1E8D6;--sand:#8C2F23;--sadu:#D63A2F;--palm:#2E8B57;--line:#D9CDB4;--txt:#241F1C;--dim:#6B6259}
@media(prefers-color-scheme:dark){:root{--night:#161310;--card:#221E1A;--card2:#2C2621;--sand:#E8A89C;--sadu:#E85445;--line:#3A322B;--txt:#F2E9DA;--dim:#9A8B7A}}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Tajawal',sans-serif;background:var(--night);color:var(--txt);line-height:1.9;padding:0 16px 48px}
.strip{height:10px;margin:0 -16px 20px;background:repeating-linear-gradient(45deg,var(--sadu) 0 10px,var(--night) 10px 20px,var(--sand) 20px 30px,var(--night) 30px 40px)}
.wrap{max-width:620px;margin:0 auto}
.brand{font-family:'Reem Kufi',sans-serif;color:var(--sand);font-size:19px;text-decoration:none;display:inline-block;margin-bottom:14px}
.brand span{display:block;font-family:'Tajawal';font-size:12px;color:var(--dim);font-weight:500}
figure{background:var(--card);border:1.5px solid var(--line);border-radius:18px;overflow:hidden;margin-bottom:16px}
figure img{width:100%;display:block;background:var(--card2)}
figcaption{padding:16px 18px}
h1{font-family:'Reem Kufi',sans-serif;font-size:23px;color:var(--sand);margin-bottom:8px;line-height:1.5}
.meta{font-size:13.5px;color:var(--dim)}
.meta b{color:var(--txt);font-weight:700}
.desc{margin:12px 0 0;font-size:15px}
.cta{display:block;text-align:center;background:var(--sadu);color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:14px;margin:18px 0 10px;font-size:15px}
.more{display:block;text-align:center;color:var(--sand);text-decoration:none;font-size:13.5px;padding:8px}
footer{margin-top:26px;padding-top:16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--dim);text-align:center}
</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<div class="strip"></div>
<div class="wrap">

  <a class="brand" href="${esc(base)}/">صورة من بلدي<span>عدسات أهل الديار</span></a>

  <figure>
    <img src="${esc(img)}" alt="${esc(p.title)}${place ? esc(' — ' + place) : ''}" width="1100" loading="eager">
    <figcaption>
      <h1>${esc(p.title)}</h1>
      <div class="meta">
        ${place ? `📍 <b>${esc(place)}</b><br>` : ''}
        ${p.photographer ? `📷 بعدسة <b>${esc(p.photographer)}</b><br>` : ''}
        ${stars > 0 ? `⭐ ${stars.toFixed(1)} من ${esc(p.ratings_count || 0)} تقييم<br>` : ''}
        🗓️ ${esc(arDate(p.created_at))}
      </div>
      ${String(p.description || '').trim() ? `<p class="desc">${esc(p.description)}</p>` : ''}
    </figcaption>
  </figure>

  <a class="cta" href="${esc(app)}">افتحها بالتطبيق وقيّمها ⭐</a>
  <a class="more" href="${esc(base)}/">شوف صور ${esc(p.abroad ? 'المسافرين' : (p.region || 'المملكة'))} كلها ←</a>

  <footer>
    صورة من بلدي — منصة سعودية لتوثيق المناطق والقرى والمعالم بعدسات أهلها.<br>
    الصورة لصاحبها${p.photographer ? ' ' + esc(p.photographer) : ''}، ونشرها هنا بإذنه.
  </footer>
</div>
</body>
</html>
`;
}

function sitemapXml(rows, base){
  const urls = [
    `  <url><loc>${SITE}${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...rows.map(p => `  <url><loc>${SITE}${base}/${OUT}/${p.id}.html</loc><lastmod>${String(p.created_at||'').slice(0,10)}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`)
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/* ═══ الجلب ═══ */
export async function fetchPhotos(){
  const u = `${SB_URL}/rest/v1/photos_ranked?select=*&order=created_at.desc`;
  const r = await fetch(u, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
  if(!r.ok) throw new Error(`القاعدة ردّت ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  if(!Array.isArray(d)) throw new Error('رد غير متوقع من القاعدة');
  return d;
}

/* الصور التي تستحق صفحة: عامة، صورة لا مقطعاً، ولها عنوان وملف */
export const eligible = rows => rows.filter(p =>
  p && p.id && p.image_path && p.title &&
  p.media_type !== 'video' &&
  p.visibility !== 'private'
);

/* robots.txt — سطران يقولان للروبوت «تفضّل، وخريطتي هنا» */
const robotsTxt = base => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}${base}/sitemap.xml\n`;

export function build(rows, base = ''){
  const out = new Map();
  for(const p of rows) out.set(`${OUT}/${p.id}.html`, pageHtml(p, base));
  out.set('sitemap.xml', sitemapXml(rows, base));
  out.set('robots.txt',  robotsTxt(base));
  return out;
}

/* ═══ التشغيل ═══ */
async function main(){
  const base = process.env.BASE || '';          /* '' للنطاق الجذر · '/sowra-lab' للّاب */
  const all  = await fetchPhotos();

  /* حماية: قاعدة فارغة تعني خللاً لا حذفاً — لا نمسح ما بُني سابقاً */
  if(!all.length){ console.error('⚠️  القاعدة رجعت فاضية — أُوقف التوليد حمايةً'); process.exit(1); }

  const rows = eligible(all);
  console.log(`صفوف: ${all.length}  ·  تستحق صفحة: ${rows.length}`);
  if(!rows.length){ console.error('⚠️  لا صورة مؤهلة'); process.exit(1); }

  const files = build(rows, base);
  if(DRY){ console.log('(تجربة — بلا كتابة)'); for(const k of files.keys()) console.log('  ' + k); return; }

  fs.mkdirSync(OUT, { recursive: true });
  /* نحذف صفحات صورٍ لم تعد موجودة، حتى لا تبقى روابط ميتة بخريطة الموقع */
  const live = new Set(rows.map(p => `${p.id}.html`));
  let removed = 0;
  for(const f of (fs.existsSync(OUT) ? fs.readdirSync(OUT) : [])){
    if(f.endsWith('.html') && !live.has(f)){ fs.unlinkSync(path.join(OUT, f)); removed++; }
  }
  for(const [name, html] of files) fs.writeFileSync(name, html, 'utf8');
  console.log(`كُتبت ${files.size - 2} صفحة + sitemap.xml${removed ? `  ·  حُذفت ${removed} صفحة لصور مزالة` : ''}`);
}

if(import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error('✖', e.message); process.exit(1); });
