// Prerender SEO snapshots for published courses (runs after `vite build`).
//
// Why: the app is a client-rendered SPA (HashRouter) with course data in
// Firestore — crawlers see almost nothing. This script fetches published
// courses + lessons through the public Firestore REST API (no auth needed
// since `firestore.rules` allows public reads of published content) and emits:
//   dist/course/{id}/index.html  — static snapshot (H1, syllabus, JSON-LD)
//   dist/sitemap.xml             — home + about + every published course
//   dist/index.html              — static catalog link list injected for crawlers
//
// Safe to run offline / without keys: it warns and leaves dist/ untouched.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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

// Firestore REST value -> plain JS
function val(v) {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(val);
  if ('mapValue' in v) return obj(v.mapValue.fields ?? {});
  if ('nullValue' in v) return null;
  return null;
}
function obj(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields)) o[k] = val(v);
  return o;
}
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function docs(projectId, key, path, pageSize = 200) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?pageSize=${pageSize}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore REST ${res.status} for ${path}`);
  const j = await res.json();
  return (j.documents ?? []).map((d) => ({ id: d.name.split('/').pop(), ...obj(d.fields ?? {}) }));
}

function coursePage(c, lessons, appUrl) {
  const url = `${appUrl}course/${c.id}/`;
  const appLink = `../../#/course/${c.id}`;
  const desc = c.description ?? '';
  const outcomes = (c.outcomes ?? []).map((o) => `<li>${esc(o)}</li>`).join('');
  const syllabus = lessons
    .map((l, i) => `<li>${esc(l.title)}${l.duration ? ` <span>(${esc(l.duration)})</span>` : ''}</li>`)
    .join('');
  const credits = (c.credits ?? [])
    .map((x) => `<li>${esc(x.creator)}${x.videoUrl ? ` — <a href="${esc(x.videoUrl)}">original video</a>` : ''}</li>`)
    .join('');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    description: desc.slice(0, 500),
    url,
    provider: { '@type': 'Organization', name: 'FreeLMS', sameAs: appUrl },
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: `${lessons.length} lessons` }
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(c.title)} — Free Course | FreeLMS</title>
<meta name="description" content="${esc(`Learn ${c.title} free on FreeLMS. ${desc.slice(0, 140)}`)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(c.title)} — Free Course" />
<meta property="og:description" content="${esc(desc.slice(0, 200))}" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1e293b}h1{font-size:28px}a{color:#4f46e5}.cta{display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600}</style>
</head>
<body>
<p><a href="../../#/">FreeLMS</a> — free online courses for everyone</p>
<h1>${esc(c.title)} — free online course</h1>
<p><strong>Topic:</strong> ${esc(c.topic ?? '')} · <strong>Instructor:</strong> ${esc(c.instructor ?? '')}${c.level ? ` · <strong>Level:</strong> ${esc(c.level)}` : ''} · <strong>Lessons:</strong> ${lessons.length}</p>
<p>${esc(desc).replace(/\n/g, '<br>')}</p>
<p><a class="cta" href="${esc(appLink)}">Start this free course</a></p>
${outcomes ? `<h2>What you'll learn</h2><ul>${outcomes}</ul>` : ''}
<h2>Syllabus (${lessons.length} lessons)</h2>
<ol>${syllabus || '<li>Lessons coming soon.</li>'}</ol>
${credits ? `<h2>Video credits</h2><ul>${credits}</ul>` : ''}
<p><a href="../../#/">Browse all free courses</a></p>
</body>
</html>`;
}

async function main() {
  if (!existsSync(dist)) {
    console.warn('[prerender] dist/ missing — run vite build first. Skipping.');
    return;
  }
  const env = loadEnv();
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const key = env.VITE_FIREBASE_API_KEY;
  let appUrl = env.VITE_APP_URL ?? 'https://freelms.github.io/freelms/';
  if (!appUrl.endsWith('/')) appUrl += '/';
  if (!projectId || !key) {
    console.warn('[prerender] No Firebase project/key in env — skipping (dist keeps static sitemap).');
    return;
  }
  let courses;
  try {
    const all = await docs(projectId, key, 'courses');
    courses = all.filter((c) =>
      c.status === 'published' || (c.published === true && c.status !== 'draft' && c.status !== 'archived') || (!c.status && c.published !== false)
    );
  } catch (e) {
    console.warn('[prerender] Course fetch failed (rules may not be published yet):', String(e).slice(0, 200));
    return;
  }
  console.log(`[prerender] ${courses.length} published course(s)`);
  const links = [];
  for (const c of courses) {
    let lessons = [];
    try {
      lessons = (await docs(projectId, key, `courses/${c.id}/lessons`)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch { lessons = []; }
    const dir = join(dist, 'course', c.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), coursePage(c, lessons, appUrl));
    links.push({ id: c.id, title: c.title });
  }
  // sitemap with real course URLs
  const urls = [
    { loc: appUrl, freq: 'daily', pri: '1.0' },
    { loc: `${appUrl}#/paths`, freq: 'weekly', pri: '0.6' },
    { loc: `${appUrl}#/about`, freq: 'monthly', pri: '0.5' },
    ...links.map((l) => ({ loc: `${appUrl}course/${l.id}/`, freq: 'weekly', pri: '0.8' }))
  ];
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join('\n') +
      `\n</urlset>`
  );
  // inject static catalog links into the SPA shell for crawlers
  try {
    const idx = join(dist, 'index.html');
    let html = readFileSync(idx, 'utf8');
    if (!html.includes('id="seo-catalog"') && links.length) {
      const nav = `<nav id="seo-catalog" aria-label="All free courses"><h2>All free courses</h2><ul>` +
        links.map((l) => `<li><a href="course/${l.id}/">${esc(l.title)} — free course</a></li>`).join('') +
        `</ul></nav>`;
      html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${nav}`);
      writeFileSync(idx, html);
    }
  } catch (e) {
    console.warn('[prerender] catalog inject skipped:', String(e).slice(0, 120));
  }
  console.log('[prerender] done');
}

main();
