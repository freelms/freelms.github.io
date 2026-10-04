# FreeLMS GitHub — free online training platform

React + Vite + TypeScript + Tailwind + React Router (HashRouter, base `./`) + Firebase (Auth + Firestore). Static `dist/` uploaded to your own server. No Firebase Hosting.

## Quick start

1. `npm install`
2. Copy `.env.example` → `.env` and fill Firebase web config.
3. `npm run dev`

## Firebase setup (manual, once)

1. Firebase console → create project (dev + prod recommended) → add Web app → copy config into `.env` (`VITE_FIREBASE_*`).
2. **Authentication → Sign-in method**: enable Email/Password + Google.
3. **Authentication → Settings → Authorized domains**: add your domain (e.g. `learn.yourdomain.com`) + localhost is already allowed.
4. **Firestore → Create database** (production mode) → **Rules tab**: paste `firestore.rules` → Publish. Or `npx firebase-tools deploy --only firestore:rules --project <id>`.
5. Make yourself admin: **Firestore → Data → `admins` collection → add document** with ID = your UID (from Authentication → Users), e.g. `{ createdAt: now }`.
6. (Prod hardening) Google Cloud → APIs & Services → Credentials → restrict web API key to your domain (HTTP referrers).
7. Serve over HTTPS (Let's Encrypt). Google sign-in + PWA need it.

## Deploy to your server

- `npm run build` → upload `dist/*` to web root: `node scripts/deploy.mjs` (needs `DEPLOY_HOST/USER/PATH`), or rsync/scp manually.
- Samples: `nginx.conf.sample`, `apache.conf.sample` (long cache for `/assets/*`, no-cache for `index.html`).
- CI: `.github/workflows/ci.yml` — lint/type/build on PR; on `main` deploys rules + rsync. Secrets: `FIREBASE_PROJECT`, `FIREBASE_TOKEN` (`npx firebase-tools login:ci`), `DEPLOY_HOST/USER/PATH/KEY`.

## Admin guide (how to add courses)

Sign in with the admin account → open `/admin`. Only admins see this page.

**Recommended workflow for a new course:** Courses (create as `draft`) → Lessons (add videos) → Quizzes (add quiz) → back to Courses (Edit → `published` → Save). Drafts are invisible to students; `published` appears in the catalog; `archived` hides it again.

### Courses tab — the course form
- **Title / Description** — shown on the card + detail page. Write 150+ characters of description (used for Google results).
- **Topic** — becomes the filter chip on the home page (e.g. `Web Development`). Keep a short, consistent list.
- **Instructor** — display name shown under the title.
- **Thumbnail URL** — paste `thumbs/your-file.jpg` (image committed to `public/thumbs/`) or any `https://…` image. Preview appears instantly.
- **SEO title / SEO description / Share image** (optional) — override what Google + social cards show for this course. A warning appears if the SEO description is under 150 characters.
- **Status** — `draft` (hidden), `published` (live in catalog + included in sitemap/prerender), `archived` (hidden, keeps student progress).
- **Level** — Beginner / Intermediate / Advanced badge on the card.
- **Timezone** — shown next to the timetable (e.g. `Asia/Karachi`).
- **Outcomes** — one per line → "What you'll learn" list.
- **Prerequisites** — comma-separated course IDs → "Recommended before this course" box.
- **Credits JSON** — `[{creator, channelUrl, videoUrl}]` → "Credits and sources" section. Always credit video owners.
- **Schedule JSON** — `[{day, time, topic, link}]` → weekly Timetable tab with Google-Calendar + `.ics` export.
- Right column per course: **Edit**, **Preview as student** (opens the public page), **Duplicate** (copies course + its lessons + quizzes), **Delete**.

### Lessons tab — videos
1. Pick the course. 2. Type the lesson title, paste a YouTube URL or ID (thumbnail preview auto-appears). 3. Optionally set creator name, channel URL and resources JSON (`[{label, url, type}]` → "Resources" box under the video). 4. Add lesson — or paste many URLs (one per line) with **Add all**. Reorder with ↑ ↓, check all videos are still embeddable with **Check videos** (broken ones get a red badge for students too).

### Quizzes tab
Pick a course → paste quiz JSON (or **Upload .json**) → attach to a lesson for a "Quick check" under that video, or leave unattached for a full-course quiz → Save. **Download sample JSON** shows the exact schema; **Copy AI prompt** gives a prompt that makes Gemini/Claude output valid quiz JSON from a transcript.

### Other tabs
- **Analytics** — enrollments/completions per course, 30-day enrollment chart, average quiz scores, hardest-questions table (from wrong-answer counts).
- **Tags** — create/edit/delete reusable categories (slug auto-generated, immutable after creation). Fields: name, description (120+ chars needed for an SEO page), color, icon, parent (one level), menu/featured toggles, SEO fields. Merge tool moves all courses source→target. "Recalculate counts" repairs `courseCount`. Rename = display-name only; slugs never change.
- **Students** — searchable + paginated, with enrolled-course count, avg progress, last active; disable account or mute from commenting.
- **Announce** — global or per-course banner with expiry; students dismiss it (remembered per user).
- **Reports** — student takedown/error reports from course/video pages; toggle resolved.
- **Moderation** — reported discussion posts: hide, delete, dismiss, or ban the author from commenting.
- **Paths** — group course IDs into a named learning path shown on `/paths` with progress.
- **Import** — paste one full-course JSON (course + lessons + quizzes) → preview counts → one batched import. Sample + AI prompt buttons included.

### Student pages
- **`/my-courses`** — enrolled courses with progress, filters (all/in-progress/completed/not-started), search, stats.
- **`/metrics`** — personal analytics: KPI cards, lessons-over-time, per-course completion, quiz-score trend, time split, 365-day streak heatmap, recent quiz attempts.
- **`/tag/:slug`** — public category pages with level filter, sorting, related tags. Prerendered statically for SEO (see below).
- **Reviews** — enrolled students rate 1–5 + text on course pages; public average/count; cards show ★ ratings.

### Caching
- Course list: `sessionStorage` (60s TTL). Tag menu: memory + `localStorage` (5-min TTL, background refresh). Every tag/course write invalidates the menu cache. `/admin` header has a "Clear site caches" button (storage + CacheStorage + service workers) for stale-device rescue.

## Data model & reads (E16)

- `courses/{id}` — course doc (`status: draft|published|archived`, denormalized `lessonCount`, `enrollmentCount`). List cached in memory + `sessionStorage` (60s TTL).
- `courses/{id}/lessons/{lid}` — enrolled/admin only. Titles prefetched once for search palette.
- `courses/{id}/quizzes/{qid}` — enrolled/admin only.
- `users/{uid}` + subcollections `enrollments`, `quizAttempts`, `notes`, `bookmarks` — owner/admin only.
- `tags/{slug}` — public read; admin write. `courseCount` = published courses only, synced on course save/delete/merge via batched increments.
- `courses/{id}/reviews/{uid}` — public read; enrolled-owner write (rating 1–5); admin delete. Aggregates `avgRating`/`ratingCount` on the course doc.
- `stats/{courseId}` — `{enrollmentCount, completionCount}` aggregates (one read per course on admin analytics).
- `announcements`, `paths`, `reports`, `comments` as documented in the admin guide.
- **Rules ↔ query contract:** any student `list` on a rule-branched collection MUST constrain `where('status','==','published')` (or equivalent) — unconstrained lists are rejected. Split `get`/`list` where lists must stay lookup-free (Firestore caps `get()`/`exists()` per list request).
- No `onSnapshot` except where needed; no N+1 beyond one-per-course lesson prefetch.

## Rules tests / emulators

- `firebase.json` has emulator ports. `npm run test:rules` runs `tests/rules.test.ts` (unauth blocked, cross-user blocked, non-admin write blocked).

## PWA / App Check / Sentry

- PWA via `vite-plugin-pwa` (relative scope, no caching of Firestore/Auth traffic). Install prompt: browser menu; update toast handled by plugin prompt mode.
- App Check: set `VITE_RECAPTCHA_SITE_KEY`, register domain in reCAPTCHA v3 + Firebase console → App Check.
- Sentry: set `VITE_SENTRY_DSN` (prod only).

## Backups

Monthly: `gcloud firestore export gs://<bucket>/backups/$(date +%F) --project=<prod>`; verify restore in dev. See `scripts/backup.mjs`.
