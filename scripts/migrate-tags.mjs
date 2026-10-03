// One-time migration: convert legacy course.topic strings into tags.
//   FIREBASE_SERVICE_ACCOUNT='<json>' node scripts/migrate-tags.mjs [--dry-run]
//
// Safe to run twice: skips courses that already have tagSlugs, skips tag docs
// that already exist, and recounts all tag counters at the end.

import { readFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry-run');
const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
if (!saRaw) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT env var to the service-account JSON.');
  process.exit(1);
}

const slugify = (s) =>
  String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function token(sa) {
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
  if (!res.ok) throw new Error(`OAuth2 exchange failed (HTTP ${res.status})`);
  return (await res.json()).access_token;
}

function rval(v) {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(rval);
  if ('mapValue' in v) {
    const o = {};
    for (const [k, x] of Object.entries(v.mapValue.fields ?? {})) o[k] = rval(x);
    return o;
  }
  return null;
}
const enc = (s) => s.split('/').map(encodeURIComponent).join('/');

async function main() {
  const sa = JSON.parse(saRaw);
  const access = await token(sa);
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  const H = { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' };
  const list = async (path, qs = 'pageSize=300') => {
    const r = await fetch(`${base}/${path}?${qs}`, { headers: { Authorization: `Bearer ${access}` } });
    if (!r.ok) throw new Error(`GET ${path}: HTTP ${r.status}`);
    const j = await r.json();
    return (j.documents ?? []).map((d) => ({ name: d.name, id: d.name.split('/').pop(), ...(function f(o) { const x = {}; for (const [k, v] of Object.entries(o ?? {})) x[k] = rval(v); return x; })(d.fields) }));
  };
  const patch = async (path, fields) => {
    if (DRY) return;
    const qs = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const r = await fetch(`${base}/${path}?${qs}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
    if (!r.ok) throw new Error(`PATCH ${path}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  };
  const strArr = (arr) => ({ arrayValue: { values: arr.map((s) => ({ stringValue: s })) } });

  const courses = await list('courses');
  console.log(`courses: ${courses.length}`);
  const bySlug = new Map();
  let migrated = 0;
  for (const c of courses) {
    if ((c.tagSlugs ?? []).length || !c.topic?.trim()) continue;
    const slug = slugify(c.topic);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, { name: c.topic.trim(), ids: [] });
    bySlug.get(slug).ids.push(c.id);
    const tagSlugs = [...(c.tagSlugs ?? []), slug].slice(0, 8);
    const tags = [...(c.tags ?? []), { slug, name: c.topic.trim() }].slice(0, 8);
    await patch(`courses/${enc(c.id)}`, {
      tagSlugs: strArr(tagSlugs),
      tags: { arrayValue: { values: tags.map((t) => ({ mapValue: { fields: { slug: { stringValue: t.slug }, name: { stringValue: t.name } } } })) } }
    });
    migrated++;
  }
  console.log(`migrated ${migrated} course(s)${DRY ? ' (dry run — nothing written)' : ''}`);

  for (const [slug, info] of bySlug) {
    if (DRY) { console.log(`  would create tag /${slug} (${info.name})`); continue; }
    const r = await fetch(`${base}/tags/${enc(slug)}`, { headers: { Authorization: `Bearer ${access}` } });
    if (r.status === 404) {
      await fetch(`${base}/tags?documentId=${enc(slug)}`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ fields: {
          name: { stringValue: info.name }, slug: { stringValue: slug },
          color: { stringValue: '#4f46e5' }, showInMenu: { booleanValue: true },
          menuOrder: { integerValue: '0' }, courseCount: { integerValue: '0' }
        } })
      });
      console.log(`  created tag /${slug}`);
    }
  }

  if (!DRY) {
    // recount published-only counters
    const counts = {};
    for (const c of courses) {
      const fresh = (c.tagSlugs ?? []).length ? c.tagSlugs : (c.topic?.trim() ? [slugify(c.topic)] : []);
      if (c.status !== 'published') continue;
      for (const s of fresh) counts[s] = (counts[s] ?? 0) + 1;
    }
    const existing = await list('tags');
    for (const t of existing) {
      const want = counts[t.slug ?? t.id] ?? 0;
      if (want !== (t.courseCount ?? 0)) await patch(`tags/${enc(t.id)}`, { courseCount: { integerValue: String(want) } });
    }
    console.log('counters recounted');
  }
  console.log('done');
}

main().catch((e) => { console.error('migration failed:', e.message ?? e); process.exit(1); });
