// Prerender SEO snapshots for published courses (runs after `vite build`).
//
// One-line domain change: set SITE_URL (see .env.production).
//
// Data source:
//   1. FIREBASE_SERVICE_ACCOUNT (GitHub Actions secret, full JSON) -> Firebase
//      Admin SDK. Bypasses Firestore rules, so lessons/quizzes/drafts can stay
//      private. Snapshots contain titles/durations ONLY — never video IDs.
//   2. Fallback: public Firestore REST API (local dev without a key file).
//      Only published course docs are readable; lessons will be skipped.
//
// Emits:
//   dist/course/{id}/index.html  — static snapshot (H1, syllabus, JSON-LD)
//   dist/sitemap.xml             — home + every published course (real URLs only)
//   dist/robots.txt              — references the sitemap
//   dist/index.html              — static catalog link list injected for crawlers
//
// Fails the build when Firestore errors, or when zero courses are found
// (override the latter with ALLOW_ZERO_COURSES=true for the very first deploy).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function loadEnv() {
  const env = { ...process.env };
  for (const f of ['.env.production', '.env']) {
    try {
      for (const line of readFileSync(join(root, f), 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in env)) env[m[1]] = m[2];
      }
    } catch { /* file may not exist */ }
  }
  return env;
}

function fail(msg) {
  console.error(`[prerender] ERROR: ${msg}`);
  process.exit(1);
}

// ---- Firestore value converters (REST) ----
function rval(v) {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(rval);
  if ('mapValue' in v) {
    const o = {};
    for (const [k, x] of Object.entries(v.mapValue.fields ?? {})) o[k] = rval(x);
    return o;
  }
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  return null;
}
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = (iso) => String(iso ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);

/** Absolute URL for a thumbnail/share image (repo thumbs/ paths resolve against site). */
function absImg(src, site) {
  if (!src) return '';
  if (/^(https?:|data:)/i.test(src)) return src;
  return site + String(src).replace(/^\.\//, '').replace(/^\//, '');
}

// ---- Data layer: Admin SDK first, public REST fallback ----
async function fetchAdmin(saJson) {
  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON (paste the whole key file, unedited).');
  }
  if (!sa.project_id || !sa.private_key || !sa.client_email) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT JSON is missing project_id/private_key/client_email — re-download the key.');
  }
  let initializeApp, cert, getApps, getFirestore;
  try {
    // firebase-admin v14+ is modular: firebase-admin/app + firebase-admin/firestore
    const appMod = await import('firebase-admin/app');
    ({ getFirestore } = await import('firebase-admin/firestore'));
    ({ initializeApp, cert, getApps } = appMod);
  } catch (e) {
    throw new Error(`firebase-admin import failed: ${e?.message ?? e}`);
  }
  if (!initializeApp || !cert || !getApps || !getFirestore) {
    throw new Error('firebase-admin install looks broken (missing app/firestore entry points) — reinstall devDependencies.');
  }
  if (getApps().length === 0) {
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  const db = getFirestore();
  const snap = await db.collection('courses').get();
  const courses = [];
  for (const d of snap.docs) {
    const c = { id: d.id, ...d.data() };
    if (c.status !== 'published') continue; // drafts/archived never prerendered
    const ls = await db.collection('courses').doc(d.id).collection('lessons').get();
    // Explicit allowlist: title/duration/order only — NEVER video IDs.
    c._lessons = ls.docs
      .map((l) => {
        const x = l.data();
        return { id: l.id, title: x.title ?? 'Untitled lesson', duration: x.duration ?? '', order: x.order ?? 0 };
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    c._updated = c.updatedAt?.toDate?.()?.toISOString?.() ?? c.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
    courses.push(c);
  }
  return { courses, via: 'admin-sdk' };
}

async function fetchRest(projectId, key) {
  const get = async (path) => {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?pageSize=200&key=${key}`
    );
    if (!res.ok) throw new Error(`Firestore REST ${res.status} for ${path}`);
    const j = await res.json();
    return (j.documents ?? []).map((d) => {
      const fields = {};
      for (const [k, v] of Object.entries(d.fields ?? {})) fields[k] = rval(v);
      return { id: d.name.split('/').pop(), ...fields };
    });
  };
  const all = await get('courses');
  const courses = all.filter((c) => c.status === 'published');
  for (const c of courses) {
    try {
      const ls = await get(`courses/${c.id}/lessons`);
      c._lessons = ls
        .map((l) => ({ id: l.id, title: l.title ?? 'Untitled lesson', duration: l.duration ?? '', order: l.order ?? 0 }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch {
      console.warn(`[prerender] lessons not publicly readable for ${c.id} (expected — rules keep them private).`);
      c._lessons = [];
    }
    c._updated = c.updatedAt ?? c.createdAt ?? new Date().toISOString();
  }
  return { courses, via: 'rest' };
}

// ---- Snapshot template ----
function coursePage(c, all, site) {
  const title = c.seoTitle || c.title;
  const desc = c.seoDescription || c.description || '';
  const url = `${site}course/${c.id}/`;
  const appLink = `${site}#/course/${c.id}`;
  const img = absImg(c.shareImage || c.thumbnail, site);
  const lessons = c._lessons ?? [];
  const related = all.filter((x) => x.id !== c.id && (x.topic ?? '') === (c.topic ?? '')).slice(0, 3);
  const outcomes = (c.outcomes ?? []).map((o) => `<li>${esc(o)}</li>`).join('');
  const syllabus = lessons
    .map((l) => `<li>${esc(l.title)}${l.duration ? ` <span>(${esc(l.duration)})</span>` : ''}</li>`)
    .join('');
  // Public credits only: creator name + channel — never video IDs/URLs.
  const credits = (c.credits ?? [])
    .map((x) => `<li>${esc(x.creator)}${x.channelUrl ? ` — <a href="${esc(x.channelUrl)}">channel</a>` : ''}</li>`)
    .join('');
  const ldCourse = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    description: String(desc).slice(0, 500),
    url,
    ...(img ? { image: img } : {}),
    provider: { '@type': 'Organization', name: 'FreeLMS', sameAs: site }
  };
  const ldCrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: site },
      { '@type': 'ListItem', position: 2, name: 'Free courses', item: site },
      { '@type': 'ListItem', position: 3, name: c.title, item: url }
    ]
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} — Free Course | FreeLMS</title>
<meta name="description" content="${esc(String(desc).slice(0, 160))}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="FreeLMS" />
<meta property="og:title" content="${esc(title)} — Free Course" />
<meta property="og:description" content="${esc(String(desc).slice(0, 200))}" />
<meta property="og:url" content="${esc(url)}" />
${img ? `<meta property="og:image" content="${esc(img)}" />` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${esc(title)} — Free Course" />
<meta name="twitter:description" content="${esc(String(desc).slice(0, 200))}" />
${img ? `<meta name="twitter:image" content="${esc(img)}" />` : ''}
<script type="application/ld+json">${JSON.stringify(ldCourse)}</script>
<script type="application/ld+json">${JSON.stringify(ldCrumb)}</script>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1e293b}h1{font-size:28px}a{color:#4f46e5}.cta{display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600}img.hero{width:100%;border-radius:12px}</style>
</head>
<body>
<nav aria-label="Breadcrumb"><a href="${site}">FreeLMS</a> › <a href="${site}">Free courses</a> › ${esc(c.title)}</nav>
<h1>${esc(title)} — free online course</h1>
${img ? `<img class="hero" src="${esc(img)}" alt="${esc(c.title)}" />` : ''}
<p><strong>Topic:</strong> ${esc(c.topic ?? '')} · <strong>Instructor:</strong> ${esc(c.instructor ?? '')}${c.level ? ` · <strong>Level:</strong> ${esc(c.level)}` : ''} · <strong>Lessons:</strong> ${lessons.length}</p>
<p>${esc(desc).replace(/\n/g, '<br>')}</p>
<p><a class="cta" href="${esc(appLink)}">Start this free course</a></p>
${outcomes ? `<h2>What you'll learn</h2><ul>${outcomes}</ul>` : ''}
<h2>Syllabus (${lessons.length} lessons)</h2>
<ol>${syllabus || '<li>Lessons coming soon.</li>'}</ol>
${credits ? `<h2>Video credits</h2><ul>${credits}</ul>` : ''}
${related.length ? `<h2>Related courses</h2><ul>${related.map((r) => `<li><a href="${site}course/${r.id}/">${esc(r.title)} — free course</a></li>`).join('')}</ul>` : ''}
<p><a href="${site}">Browse all free courses</a></p>
</body>
</html>`;
}

async function main() {
  if (!existsSync(dist)) fail('dist/ missing — run vite build first.');
  const env = loadEnv();
  if (env.SKIP_PRERENDER === 'true') {
    console.warn('[prerender] SKIP_PRERENDER=true — leaving dist/ as built (local iteration only; CI always prerenders).');
    return;
  }
  const site = (env.SITE_URL || env.VITE_APP_URL || 'https://freelms.github.io/').replace(/\/?$/, '/');

  let courses = [];
  let via = '';
  try {
    const saRaw = env.FIREBASE_SERVICE_ACCOUNT || '';
    // Safe diagnostic: length + shape only, never the content.
    console.log(`[prerender] service-account secret: ${saRaw ? `present (${saRaw.length} chars, starts=${saRaw.trim().startsWith('{')})` : 'missing'}`);
    if (saRaw) {
      ({ courses, via } = await fetchAdmin(env.FIREBASE_SERVICE_ACCOUNT));
    } else if (env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_API_KEY) {
      console.warn('[prerender] No FIREBASE_SERVICE_ACCOUNT — REST fallback (lessons stay private, syllabus may be empty).');
      ({ courses, via } = await fetchRest(env.VITE_FIREBASE_PROJECT_ID, env.VITE_FIREBASE_API_KEY));
    } else {
      fail('No FIREBASE_SERVICE_ACCOUNT secret and no Firebase web config found. Set the secret (CI) or VITE_FIREBASE_* (local).');
    }
  } catch (e) {
    fail(`Firestore read failed via ${via || 'unknown source'}: ${e?.message ?? e}`);
  }

  console.log(`[prerender] ${courses.length} published course(s) via ${via}`);

  if (courses.length === 0) {
    if (env.ALLOW_ZERO_COURSES !== 'true') {
      fail('Zero published courses found. Publish a course in /admin and rebuild — or set ALLOW_ZERO_COURSES=true for the very first deploy.');
    }
    console.warn('[prerender] ALLOW_ZERO_COURSES=true — writing home-only sitemap.');
  }

  const ids = new Set(courses.map((c) => c.id));

  // Prune snapshots of unpublished/removed courses.
  const courseDir = join(dist, 'course');
  if (existsSync(courseDir)) {
    for (const entry of readdirSync(courseDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !ids.has(entry.name)) {
        rmSync(join(courseDir, entry.name), { recursive: true, force: true });
        console.log(`[prerender] removed stale snapshot: course/${entry.name}/`);
      }
    }
  }

  for (const c of courses) {
    const dir = join(courseDir, c.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), coursePage(c, courses, site));
  }

  // Sitemap: real URLs only (no hash fragments), lastmod per course.
  const urls = [
    { loc: site, lastmod: new Date().toISOString().slice(0, 10) },
    ...courses.map((c) => ({ loc: `${site}course/${c.id}/`, lastmod: day(c._updated) }))
  ];
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') +
      `\n</urlset>`
  );

  writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`);

  // Static catalog links inside the SPA shell for crawlers.
  try {
    const idx = join(dist, 'index.html');
    let html = readFileSync(idx, 'utf8');
    if (!html.includes('id="seo-catalog"') && courses.length) {
      const nav = `<nav id="seo-catalog" aria-label="All free courses"><h2>All free courses</h2><ul>` +
        courses.map((c) => `<li><a href="course/${c.id}/">${esc(c.seoTitle || c.title)} — free course</a></li>`).join('') +
        `</ul></nav>`;
      html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${nav}`);
      writeFileSync(idx, html);
    }
  } catch (e) {
    console.warn('[prerender] catalog inject skipped:', String(e).slice(0, 120));
  }

  console.log(`[prerender] done: ${courses.length} snapshot(s), sitemap (${urls.length} URLs), robots.txt`);
}

main();
