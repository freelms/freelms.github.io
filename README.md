# FreeLMS — free online training platform

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

## Data model & reads (E16)

- `courses/{id}` — course doc (`status: draft|published|archived`, denormalized `lessonCount`, `enrollmentCount`). List cached in memory + `sessionStorage` (60s TTL).
- `courses/{id}/lessons/{lid}` — enrolled/admin only. Titles prefetched once for search palette.
- `courses/{id}/quizzes/{qid}` — enrolled/admin only.
- `users/{uid}` + subcollections `enrollments`, `quizAttempts`, `notes`, `bookmarks`, `certificates` — owner/admin only.
- `stats/{courseId}` — `{enrollmentCount, completionCount}` aggregates (one read per course on admin analytics).
- `certificates_public/{certId}` — public cert lookup. `announcements`, `paths`, `reports` as documented.
- No `onSnapshot` except where needed; no N+1 beyond one-per-course lesson prefetch.

## Rules tests / emulators

- `firebase.json` has emulator ports. `npm run test:rules` runs `tests/rules.test.ts` (unauth blocked, cross-user blocked, non-admin write blocked).

## PWA / App Check / Sentry

- PWA via `vite-plugin-pwa` (relative scope, no caching of Firestore/Auth traffic). Install prompt: browser menu; update toast handled by plugin prompt mode.
- App Check: set `VITE_RECAPTCHA_SITE_KEY`, register domain in reCAPTCHA v3 + Firebase console → App Check.
- Sentry: set `VITE_SENTRY_DSN` (prod only).

## Backups

Monthly: `gcloud firestore export gs://<bucket>/backups/$(date +%F) --project=<prod>`; verify restore in dev. See `scripts/backup.mjs`.
