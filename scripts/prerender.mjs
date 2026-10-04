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
//   dist/course/{id}/index.html  — static snapshot (H1, syllabus, tag chips, JSON-LD)
//   dist/tag/{slug}/index.html   — tag page (H1, description, course list, CollectionPage+ItemList LD)
//                                 only for tags with >=1 published course and 120+ char description
//   dist/sitemap.xml             — home + every published course + every tag page (real URLs only)
//   dist/robots.txt              — references the sitemap
//   dist/index.html              — static catalog + category link lists injected for crawlers
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

// ---- SEO text pipeline ----
// Timestamps like "00:35 - intro" (own lines or inline) add nothing for search.
function stripTimestamps(s) {
  let t = String(s ?? '').replace(/\r/g, '');
  t = t.split('\n').filter((l) => !/^\s*\d{1,2}:\d{2}(\s*[-–—:.]|\s|$)/.test(l)).join('\n');
  t = t.replace(/\d{1,2}:\d{2}\s*[-–—]\s*[^.\n]*?(?=\d{1,2}:\d{2}|[.\n]|$)/g, '');
  t = t.replace(/(^|[\s(])\d{1,2}:\d{2}(?=[\s).,]|$)/g, '$1');
  t = t.replace(/\.\s*\./g, '.').replace(/\s+([.,!?;:])/g, '$1');
  return t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
// Obvious engagement-bait sentences ("subscribe", "comment below") read as spam to crawlers.
function stripCta(s) {
  return String(s ?? '')
    .split(/(?<=[.!?\n])\s+/)
    .filter((sn) => !/subscrib|comment\s+(below|down)|leave\s+a\s+comment|let\s+me\s+know\s+in\s+the\s+comments|like\s+(this\s+)?video|hit\s+the\s+bell|notifications|giveaway|follow\s+me/i.test(sn))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
const cleanBody = (s) => stripCta(stripTimestamps(s));

/** Meta description: seoDescription wins; else first sentences, ≤155 chars at a boundary. */
function metaDescription(c) {
  const custom = String(c.seoDescription ?? '').trim();
  if (custom) return custom.length <= 160 ? custom : custom.slice(0, 154).replace(/\s+\S*$/, '') + '…';
  const text = cleanBody(c.description).replace(/\s+/g, ' ').trim();
  if (text.length <= 155) return text;
  const cut = text.slice(0, 155);
  const sentence = cut.match(/^(.*?[.!?])\s/);
  if (sentence && sentence[1].length > 60) return sentence[1];
  return cut.replace(/\s+\S*$/, '') + '…';
}

/** Short title: seoTitle wins; else course title cut at 55 chars, word boundary. */
function shortTitle(c) {
  const custom = String(c.seoTitle ?? '').trim();
  if (custom) return custom;
  const t = String(c.title ?? '').trim();
  if (t.length <= 55) return t;
  return t.slice(0, 55).replace(/\s+\S*$/, '');
}

/** Body paragraphs from the cleaned description. */
function bodyParas(c) {
  const parts = cleanBody(c.description).split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const fallback = cleanBody(c.description).replace(/\s+/g, ' ').trim();
  const list = parts.length ? parts : fallback ? [fallback] : [];
  return list.map((p) => `<p>${esc(p)}</p>`).join('\n');
}

/** Per-course SEO quality warnings, printed at build time and shown in /admin. */
function qualityWarnings(c) {
  const w = [];
  if (!String(c.seoTitle ?? '').trim()) w.push('no seoTitle (title auto-cut at 55 chars)');
  if (!String(c.seoDescription ?? '').trim()) w.push('no seoDescription (auto-generated)');
  const d = cleanBody(c.description).replace(/\s+/g, ' ').trim();
  if (d.length < 150) w.push(`clean description only ${d.length} chars (<150)`);
  const outcomes = c.outcomes ?? [];
  if (outcomes.length < 3) w.push(`only ${outcomes.length} learning outcome(s) (<3)`);
  const bad = (c._lessons ?? []).filter((l) => !String(l.title ?? '').trim() || /^(untitled(\s+lesson)?|full\s+lesson)$/i.test(String(l.title).trim()));
  if (bad.length) w.push(`${bad.length} lesson(s) untitled or "Full Lesson"`);
  if (!c.shareImage && !c.thumbnail) w.push('no share image/thumbnail');
  if (!(c.credits ?? []).length) w.push('no credits');
  return w;
}

/** Absolute URL for a thumbnail/share image (repo thumbs/ paths resolve against site). */
function absImg(src, site) {
  if (!src) return '';
  if (/^(https?:|data:)/i.test(src)) return src;
  return site + String(src).replace(/^\.\//, '').replace(/^\//, '');
}

// ---- Data layer: Admin SDK first, public REST fallback ----
// ---- Data layer: service-account REST (zero deps) first, public REST fallback ----

// Exchange a service-account key for a short-lived OAuth2 access token using
// only node:crypto + fetch — no firebase-admin needed (its transitive deps
// broke CI installs). The Bearer token bypasses API-key domain restrictions.
async function serviceAccountToken(saJson) {
  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON (paste the whole key file, unedited).');
  }
  if (!sa.project_id || !sa.private_key || !sa.client_email) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT JSON is missing project_id/private_key/client_email — re-download the key.');
  }
  const { createSign } = await import('node:crypto');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` })
  });
  if (!res.ok) throw new Error(`OAuth2 token exchange failed (HTTP ${res.status}) — key may be revoked; generate a fresh one.`);
  const j = await res.json();
  if (!j.access_token) throw new Error('OAuth2 token exchange returned no token.');
  return { token: j.access_token, projectId: sa.project_id };
}

async function restDocs(projectId, path, auth) {
  const headers = auth?.headers ?? { 'X-Goog-Api-Key': auth.key };
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?pageSize=200` +
    (auth?.key ? `&key=${auth.key}` : '');
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Firestore REST ${res.status} for ${path}`);
  const j = await res.json();
  return (j.documents ?? []).map((d) => {
    const fields = {};
    for (const [k, v] of Object.entries(d.fields ?? {})) fields[k] = rval(v);
    return { id: d.name.split('/').pop(), ...fields };
  });
}

async function fetchServiceAccount(saJson) {
  const { token, projectId } = await serviceAccountToken(saJson);
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const snap = await restDocs(projectId, 'courses', auth);
  const courses = [];
  for (const c of snap) {
    if (c.status !== 'published') continue; // drafts/archived never prerendered
    const ls = await restDocs(projectId, `courses/${c.id}/lessons`, auth);
    // Explicit allowlist: title/duration/order only — NEVER video IDs.
    c._lessons = ls
      .map((l) => ({ id: l.id, title: l.title ?? 'Untitled lesson', duration: l.duration ?? '', order: l.order ?? 0 }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    c._updated = c.updatedAt ?? c.createdAt ?? new Date().toISOString();
    courses.push(c);
  }
  let tags = [];
  try {
    tags = await restDocs(projectId, 'tags', auth);
  } catch {
    console.warn('[prerender] tags not readable (expected on public REST) — tag pages skipped.');
  }
  return { courses, tags, via: 'service-account' };
}

async function fetchRest(projectId, key) {
  const auth = { key };
  const all = await restDocs(projectId, 'courses', auth);
  const courses = all.filter((c) => c.status === 'published');
  for (const c of courses) {
    try {
      const ls = await restDocs(projectId, `courses/${c.id}/lessons`, auth);
      c._lessons = ls
        .map((l) => ({ id: l.id, title: l.title ?? 'Untitled lesson', duration: l.duration ?? '', order: l.order ?? 0 }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch {
      console.warn(`[prerender] lessons not publicly readable for ${c.id} (expected — rules keep them private).`);
      c._lessons = [];
    }
    c._updated = c.updatedAt ?? c.createdAt ?? new Date().toISOString();
  }
  let tags = [];
  try {
    tags = await restDocs(projectId, 'tags', auth);
  } catch {
    console.warn('[prerender] tags not publicly readable — tag pages skipped.');
  }
  return { courses, tags, via: 'rest' };
}

// ---- Snapshot template ----
function coursePage(c, all, site, catNav) {
  const title = shortTitle(c);
  const meta = metaDescription(c);
  const url = `${site}course/${c.id}/`;
  const appLink = `${site}#/course/${c.id}`;
  const img = absImg(c.shareImage || c.thumbnail, site);
  const lessons = c._lessons ?? [];
  const myTags = c.tagSlugs ?? [];
  let related = all.filter((x) => x.id !== c.id && (x.tagSlugs ?? []).some((s) => myTags.includes(s))).slice(0, 3);
  if (!related.length && c.topic) related = all.filter((x) => x.id !== c.id && (x.topic ?? '') === c.topic).slice(0, 3);
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
    description: meta,
    url,
    ...(img ? { image: img } : {}),
    ...(myTags.length ? { keywords: myTags.join(', ') } : {}),
    provider: { '@type': 'Organization', name: 'FreeLMS', sameAs: site },
    ...(lessons.length
      ? {
          hasPart: {
            '@type': 'ItemList',
            numberOfItems: lessons.length,
            itemListElement: lessons.map((l, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: l.title
            }))
          }
        }
      : {})
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
<title>${esc(title)} | FreeLMS GitHub</title>
<meta name="description" content="${esc(meta)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="FreeLMS" />
<meta property="og:title" content="${esc(title)} | FreeLMS GitHub" />
<meta property="og:description" content="${esc(meta)}" />
<meta property="og:url" content="${esc(url)}" />
${img ? `<meta property="og:image" content="${esc(img)}" />` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${esc(title)} | FreeLMS GitHub" />
<meta name="twitter:description" content="${esc(meta)}" />
${img ? `<meta name="twitter:image" content="${esc(img)}" />` : ''}
<script type="application/ld+json">${JSON.stringify(ldCourse)}</script>
<script type="application/ld+json">${JSON.stringify(ldCrumb)}</script>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1e293b}h1{font-size:28px}a{color:#4f46e5}.cta{display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600}img.hero{width:100%;border-radius:12px}</style>
</head>
<body>
<nav aria-label="Breadcrumb"><a href="${site}">FreeLMS</a> › <a href="${site}">Free courses</a> › ${esc(c.title)}</nav>
<h1>${esc(title)} — free online course</h1>
${img ? `<img class="hero" src="${esc(img)}" alt="${esc(c.title)}" />` : ''}
<p><strong>Instructor:</strong> ${esc(c.instructor ?? '')}${c.level ? ` · <strong>Level:</strong> ${esc(c.level)}` : ''} · <strong>Lessons:</strong> ${lessons.length}</p>
${(c.tags ?? []).length ? `<p>Categories: ${(c.tags ?? []).map((t) => `<a href="${site}tag/${esc(t.slug)}/">${esc(t.name)}</a>`).join(' · ')}</p>` : (c.topic ? `<p><strong>Topic:</strong> ${esc(c.topic)}</p>` : '')}
${bodyParas(c)}
<p><a class="cta" href="${esc(appLink)}">Start this free course</a></p>
${outcomes ? `<h2>What you'll learn</h2><ul>${outcomes}</ul>` : ''}
<h2>Syllabus (${lessons.length} lessons)</h2>
<ol>${syllabus || '<li>Lessons coming soon.</li>'}</ol>
${credits ? `<h2>Credits and sources</h2><ul>${credits}</ul><p>Videos are embedded from their original creators — please support them directly.</p>` : ''}
${related.length ? `<h2>Related courses</h2><ul>${related.map((r) => `<li><a href="${site}course/${r.id}/">${esc(r.title)} — free course</a></li>`).join('')}</ul>` : ''}
${catNav}
<p><a href="${site}">Browse all free courses</a></p>
</body>
</html>`;
}

/** Plain-HTML category navigation block, embedded in every prerendered page. */
function categoryNav(site, tags) {
  if (!tags.length) return '';
  return `<nav aria-label="Categories"><h2>Categories</h2><ul>` +
    tags.map((t) => `<li><a href="${site}tag/${esc(t.slug)}/">${esc(t.name)}</a></li>`).join('') +
    `</ul></nav>`;
}

// ---- Tag snapshot template ----
function tagPage(t, tCourses, related, site, catNav) {
  const title = String(t.seoTitle ?? '').trim() || `${t.name} Courses`;
  const desc = String(t.seoDescription ?? '').trim() || String(t.description ?? '').trim();
  const url = `${site}tag/${t.slug}/`;
  const img = tCourses.map((c) => absImg(c.shareImage || c.thumbnail, site)).find(Boolean) ?? '';
  const ldCollection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: desc.slice(0, 300),
    url,
    isPartOf: { '@type': 'WebSite', name: 'FreeLMS', url: site }
  };
  const ldItems = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: tCourses.length,
    itemListElement: tCourses.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.title,
      url: `${site}course/${c.id}/`
    }))
  };
  const ldCrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: site },
      { '@type': 'ListItem', position: 2, name: 'Categories', item: site },
      { '@type': 'ListItem', position: 3, name: t.name, item: url }
    ]
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} | FreeLMS GitHub</title>
<meta name="description" content="${esc(desc.slice(0, 160))}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="FreeLMS" />
<meta property="og:title" content="${esc(title)} | FreeLMS GitHub" />
<meta property="og:description" content="${esc(desc.slice(0, 200))}" />
<meta property="og:url" content="${esc(url)}" />
${img ? `<meta property="og:image" content="${esc(img)}" />` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${esc(title)} | FreeLMS GitHub" />
<meta name="twitter:description" content="${esc(desc.slice(0, 200))}" />
${img ? `<meta name="twitter:image" content="${esc(img)}" />` : ''}
<script type="application/ld+json">${JSON.stringify(ldCollection)}</script>
<script type="application/ld+json">${JSON.stringify(ldItems)}</script>
<script type="application/ld+json">${JSON.stringify(ldCrumb)}</script>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1e293b}h1{font-size:28px}a{color:#4f46e5}.cta{display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600}</style>
</head>
<body>
<nav aria-label="Breadcrumb"><a href="${site}">FreeLMS</a> › <a href="${site}">Categories</a> › ${esc(t.name)}</nav>
<h1>${esc(t.name)} — free online courses</h1>
<p>${esc(desc)}</p>
<p><strong>${tCourses.length} free course(s)</strong> · <a class="cta" href="${site}#/tag/${esc(t.slug)}">Browse in the app</a></p>
<h2>Courses in ${esc(t.name)}</h2>
<ol>${tCourses.map((c) => `<li><a href="${site}course/${c.id}/">${esc(c.title)}</a>${c.level ? ` (${esc(c.level)})` : ''} — ${c._lessons?.length ?? 0} lessons</li>`).join('')}</ol>
${related.length ? `<h2>Related categories</h2><ul>${related.map((r) => `<li><a href="${site}tag/${esc(r.slug)}/">${esc(r.name)}</a></li>`).join('')}</ul>` : ''}
${catNav}
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
  let tags = [];
  let via = '';
  try {
    const saRaw = env.FIREBASE_SERVICE_ACCOUNT || '';
    // Safe diagnostic: length + shape only, never the content.
    console.log(`[prerender] service-account secret: ${saRaw ? `present (${saRaw.length} chars, starts=${saRaw.trim().startsWith('{')})` : 'missing'}`);
    if (saRaw) {
      via = 'service-account';
      ({ courses, tags } = await fetchServiceAccount(saRaw));
    } else if (env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_API_KEY) {
      console.warn('[prerender] No FIREBASE_SERVICE_ACCOUNT — REST fallback (lessons stay private, syllabus may be empty).');
      ({ courses, tags, via } = await fetchRest(env.VITE_FIREBASE_PROJECT_ID, env.VITE_FIREBASE_API_KEY));
    } else {
      fail('No FIREBASE_SERVICE_ACCOUNT secret and no Firebase web config found. Set the secret (CI) or VITE_FIREBASE_* (local).');
    }
  } catch (e) {
    fail(`Firestore read failed via ${via || 'unknown source'}: ${e?.message ?? e}`);
  }

  console.log(`[prerender] ${courses.length} published course(s), ${tags.length} tag(s) via ${via}`);

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
    writeFileSync(join(dir, 'index.html'), coursePage(c, courses, site, ''));
    const w = qualityWarnings(c);
    console.log(`[prerender] course/${c.id}/ — ${w.length ? 'WARNINGS: ' + w.join('; ') : 'OK'}`);
  }

  // ---- Tag pages: only tags with >=1 published course AND 120+ char description.
  // Others get no page (noindex by absence) and a build warning.
  const publishedByTag = {};
  for (const c of courses) {
    for (const s of c.tagSlugs ?? []) {
      (publishedByTag[s] = publishedByTag[s] || []).push(c);
    }
  }
  const pageTags = [];
  for (const t of tags) {
    const n = (publishedByTag[t.slug] ?? []).length;
    const dlen = String(t.seoDescription || t.description || '').trim().length;
    if (n < 1) {
      console.log(`[prerender] tag/${t.slug}/ — skipped (no published courses)`);
      continue;
    }
    if (dlen < 120) {
      console.log(`[prerender] tag/${t.slug}/ — skipped (description ${dlen} chars, need 120+)`);
      continue;
    }
    pageTags.push(t);
  }
  const catNav = categoryNav(site, pageTags);
  // Re-render course snapshots WITH the category nav (needs final tag list).
  for (const c of courses) {
    writeFileSync(join(courseDir, c.id, 'index.html'), coursePage(c, courses, site, catNav));
  }
  const tagDir = join(dist, 'tag');
  const tagSlugs = new Set(pageTags.map((t) => t.slug));
  if (existsSync(tagDir)) {
    for (const entry of readdirSync(tagDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !tagSlugs.has(entry.name)) {
        rmSync(join(tagDir, entry.name), { recursive: true, force: true });
        console.log(`[prerender] removed stale snapshot: tag/${entry.name}/`);
      }
    }
  }
  for (const t of pageTags) {
    const tCourses = (publishedByTag[t.slug] ?? []).sort((a, b) => a.title.localeCompare(b.title));
    const co = {};
    for (const c of tCourses) {
      for (const s of c.tagSlugs ?? []) {
        if (s !== t.slug) co[s] = (co[s] ?? 0) + 1;
      }
    }
    const related = Object.entries(co)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([s]) => tags.find((x) => x.slug === s))
      .filter((x) => x && tagSlugs.has(x.slug));
    const dir = join(tagDir, t.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), tagPage(t, tCourses, related, site, catNav));
    console.log(`[prerender] tag/${t.slug}/ — OK (${tCourses.length} courses)`);
  }

  // ---- Static disclaimer page (same content as the in-app /disclaimer route).
  const disUrl = `${site}disclaimer/`;
  const disDir = join(dist, 'disclaimer');
  mkdirSync(disDir, { recursive: true });
  writeFileSync(join(disDir, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Content Disclaimer — How FreeLMS Uses YouTube Videos | FreeLMS GitHub</title>
<meta name="description" content="FreeLMS never re-uploads videos. Lessons play originals via YouTube embeds, giving creators views while students learn. Read the full disclaimer." />
<link rel="canonical" href="${esc(disUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="FreeLMS" />
<meta property="og:title" content="Content Disclaimer — How FreeLMS Uses YouTube Videos | FreeLMS GitHub" />
<meta property="og:description" content="We embed originals, never re-upload. Creators keep views and credit; students get structured courses." />
<meta property="og:url" content="${esc(disUrl)}" />
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1e293b}h1{font-size:28px}a{color:#4f46e5}.cta{display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600}</style>
</head>
<body>
<nav aria-label="Breadcrumb"><a href="${site}">FreeLMS</a> › Content Disclaimer</nav>
<h1>Content Disclaimer — how FreeLMS uses YouTube videos</h1>
<h2>We do not re-upload or reuse anyone's work</h2>
<p>Every lesson plays the original video through YouTube's official embedded player, streamed directly from YouTube's servers. We never download, copy, edit, mirror or claim any video, thumbnail, title or description.</p>
<h2>Embeds give creators views — good for both</h2>
<p>Watching a lesson here registers as a view on the original YouTube video, exactly as on YouTube. Watch time and engagement flow to the creator's channel, supporting their growth and revenue. Each lesson links the creator's channel and the original video so students can subscribe and explore more.</p>
<h2>What students get</h2>
<p>The same free videos, reorganized into structured courses with a syllabus, progress tracking, quizzes, timestamped notes and discussion — a scattered playlist becomes a complete course.</p>
<h2>Permission and takedown</h2>
<p>Creators: to feature, re-credit or remove a video for any reason, use the "Report or takedown request" link on any course or video. We act within 48 hours.</p>
${catNav}
<p><a class="cta" href="${site}">Browse free courses</a></p>
</body>
</html>`);
  console.log('[prerender] disclaimer/ — OK');

  // Sitemap: real URLs only (no hash fragments), lastmod per course/tag.
  const urls = [
    { loc: site, lastmod: new Date().toISOString().slice(0, 10) },
    { loc: disUrl, lastmod: new Date().toISOString().slice(0, 10) },
    ...courses.map((c) => ({ loc: `${site}course/${c.id}/`, lastmod: day(c._updated) })),
    ...pageTags.map((t) => ({ loc: `${site}tag/${t.slug}/`, lastmod: day(t.updatedAt) }))
  ];
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') +
      `\n</urlset>`
  );

  writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`);

  // Write version file for cache-busting detection
  const version = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    coursesCount: courses.length
  };
  writeFileSync(join(dist, 'version.json'), JSON.stringify(version, null, 2));

  // Static catalog + category links inside the SPA shell for crawlers (hidden from visual users).
  try {
    const idx = join(dist, 'index.html');
    let html = readFileSync(idx, 'utf8');
    if (!html.includes('id="seo-catalog"') && courses.length) {
      const nav = `<nav id="seo-catalog" aria-label="All free courses" style="display: none;"><h2>All free courses</h2><ul>` +
        courses.map((c) => `<li><a href="course/${c.id}/">${esc(c.seoTitle || c.title)} — free course</a></li>`).join('') +
        `</ul></nav>`;
      html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${nav}`);
      writeFileSync(idx, html);
    }
    if (!html.includes('id="seo-categories"') && pageTags.length) {
      const cats = `<nav id="seo-categories" aria-label="Categories" style="display: none;"><h2>Categories</h2><ul>` +
        pageTags.map((t) => `<li><a href="tag/${t.slug}/">${esc(t.name)}</a></li>`).join('') +
        `</ul></nav>`;
      html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${cats}`);
      writeFileSync(idx, html);
    }
  } catch (e) {
    console.warn('[prerender] catalog inject skipped:', String(e).slice(0, 120));
  }

  console.log(`[prerender] done: ${courses.length} snapshot(s), ${pageTags.length} tag page(s), sitemap (${urls.length} URLs), robots.txt`);
}

main();
