# LearnHub: TRAE IDE Prompt Playbook

A free online training platform built with React, Firebase and YouTube embeds. This file holds every prompt, in order, ready to paste into TRAE.

## How to use this file

1. Use **Builder mode** in TRAE so it can create files and run commands.
2. Paste prompts **one at a time**, in order. Test each step before moving on.
3. If TRAE makes a mistake, paste the error and say "fix this" instead of rewriting the prompt.
4. **Part 1** builds the core app. **Part 2** adds features, ordered by priority.

## Self-hosting note (no Firebase Hosting)

This app is a **static build** (`index.html` + JS/CSS files) that you upload to **your own server**. Firebase is used only as the backend (Auth + Firestore), called directly from the browser. Do these manual steps once:

1. In the Firebase console, go to **Authentication > Settings > Authorized domains** and add your domain (for example `learn.yourdomain.com`). Google sign-in fails without this.
2. Serve the site over **HTTPS** (Let's Encrypt is free). Google sign-in and PWA features need it.
3. In Google Cloud console > **APIs & Services > Credentials**, restrict the Firebase web API key to your domain (HTTP referrers). The key is public by design, so security comes from Firestore rules and this restriction.
4. If you use App Check later, register your domain in the reCAPTCHA settings.
5. Every deploy is: run `npm run build`, then upload the contents of the `dist/` folder to your server's web root.

---

# PART 1: Core Build

## Prompt 0: Project rules

Save this as a project rules file, or paste it first so TRAE remembers it.

```
You are building "LearnHub", a free online training platform. Stack: React + Vite + TypeScript, Tailwind CSS, React Router, Firebase (Auth and Firestore only, NO Firebase Hosting), lucide-react icons.

UX principles: modern, compact, comfortable. Mobile-first and fully responsive. Clean card layout, small-but-readable type (14-15px base), tight spacing, rounded-xl cards, soft shadows, one accent color, dark mode toggle, skeleton loaders (no blank screens), toast notifications, clear empty states, accessible (keyboard focus, aria labels).

Deployment: the app is a static build uploaded to my own web server (nginx or Apache). Use HashRouter so routes work on any static host without server rewrite rules. Use relative asset paths (Vite base: './') so it works from any folder or domain. Do not add Firebase Hosting config or Firebase Functions.

Code rules: small reusable components, clean folder structure (pages, components, hooks, lib, types), all Firebase config in .env variables, no hardcoded secrets, handle loading and error states everywhere. Explain what you created after each step, and tell me exactly what I must do manually (Firebase console steps, etc).
```

## Prompt 1: Setup and Firebase

```
Scaffold the project with Vite + React + TypeScript + Tailwind + React Router (HashRouter, Vite base './'). Set up Firebase (Auth, Firestore) using .env variables and a lib/firebase file. Create an AuthContext with a useAuth hook exposing user, isAdmin, loading. isAdmin is true if a document exists at admins/{uid} in Firestore. Create ProtectedRoute and AdminRoute components. Add the app shell: compact top navbar (logo, My Courses, Admin link only for admins, theme toggle, avatar menu with logout) and a mobile bottom nav. Routes: /login, /, /course/:id, /learn/:id, /admin. Then give me step-by-step instructions to create the Firebase project and fill the .env.
```

## Prompt 2: Login page

```
Build the /login page: a centered compact card with Google sign-in and email/password sign-in/sign-up (toggle between modes), inline validation, friendly error messages, loading states, and redirect to the page the user came from after login. Create a users/{uid} document on first login (name, email, photo, createdAt).
```

## Prompt 3: Course catalog

```
Build the home page (/): a "Continue learning" row at the top showing the user's enrolled courses with progress bars, then the course catalog below it. Include a search box and topic filter chips (topics generated from the courses data), and a responsive grid of compact course cards (thumbnail, title, topic badge, instructor, lesson count, enrolled badge). Load courses from Firestore collection "courses" with skeleton loaders and an empty state. Only show courses where published == true.
```

## Prompt 4: Course detail page

```
Build /course/:id: hero section with thumbnail, title, topic, instructor, and a prominent Enroll button (becomes "Go to course" if already enrolled). Below it: description, "What you'll learn" list, syllabus (collapsible list of lesson titles and durations, with videos locked until enrolled), and a "Credits and sources" section listing each credit with creator name, channel link, and original video link. Enrolling creates users/{uid}/enrollments/{courseId} with enrolledAt and completedLessons: [].
```

## Prompt 5: Course dashboard (learning page)

```
Build /learn/:id, accessible only to enrolled users. Layout: compact course header with a progress ring, then tabs: Overview, Videos, Timetable, Quizzes.
- Overview: description, instructor, credits, total progress.
- Videos: embedded YouTube IFrame player (use youtube-nocookie.com embed) with a lesson list sidebar (stacked below on mobile), "Mark complete" toggle saved to Firestore, auto-select the next lesson, and remember the last watched lesson.
- Timetable: weekly schedule list from course.schedule (day, time, topic, optional link), with today highlighted.
- Quizzes: list of quizzes with best score and attempts. A quiz runner shows one question at a time, a progress bar, instant feedback with explanation, a final score screen, a retry button, and saves each attempt to users/{uid}/quizAttempts.
```

## Prompt 6: Admin dashboard

```
Build /admin (admins only) with a compact sidebar (Courses, Lessons, Quizzes) that becomes tabs on mobile.
- Courses: table plus create/edit form with title, description, topic, instructor, thumbnail URL, learning outcomes list, credits list (creator name, channel URL, video URL), weekly schedule rows, published toggle. Include delete with a confirm dialog.
- Lessons: pick a course, then add lessons by pasting a YouTube URL or ID. Auto-extract the video ID, auto-show the thumbnail preview, and let me set the title and duration. Support adding many URLs at once (one per line), reordering by drag and drop, editing, and deleting.
- Quizzes: pick a course, then upload a .json file or paste JSON into a textarea. Validate it against the schema below, show clear error messages with the question number, show a preview of the parsed quiz, then save to courses/{id}/quizzes. Include a "Download sample JSON" button and a "Copy AI prompt" button that copies a ready-made prompt I can give Gemini or Claude to generate quiz JSON from a transcript.

Quiz JSON schema:
{
  "title": "string",
  "passingScore": 70,
  "questions": [
    { "question": "string", "options": ["A","B","C","D"], "answerIndex": 0, "explanation": "string" }
  ]
}
```

## Prompt 7: Security rules

```
Write firestore.rules and a minimal firebase.json that only references the Firestore rules and indexes (no hosting section). Rules: anyone signed in can read published courses; only admins (document exists in admins/{uid}) can write courses, lessons, and quizzes; lessons and quizzes are readable only by enrolled users or admins; users can read and write only their own users/{uid} data, enrollments, and quizAttempts. Then explain how to deploy the rules (either paste them in the Firebase console Rules tab, or use firebase deploy --only firestore:rules), and how to make myself admin by adding my UID to the admins collection in the console.
```

## Prompt 8: Polish and deploy

```
Review the whole app for responsive issues, accessibility, loading and error states, and dark mode consistency. Add a footer note: "Free for everyone. Video credits belong to their original creators." Fix any TypeScript errors, then give me the exact commands to build the production bundle, and sample nginx and Apache configs for serving the dist/ folder on my server (HTTPS, gzip/brotli, long cache for hashed assets, no-cache for index.html). Also add a deploy script that uploads dist/ to my server over rsync or scp, with host and path read from environment variables.
```

**Checkpoint:** Add your first course through the admin page, then test as a normal student in a second browser before starting Part 2.

---

# PART 2: Enhancements

Recommended order is shown first (E1 to E6), then everything else by theme. Each prompt assumes Part 1 is working. After any prompt that changes data shape, ask TRAE to update `firestore.rules` too.

## Recommended first six

### E1: Resume timestamp and playback controls

```
Upgrade the Videos tab to use the YouTube IFrame Player API instead of a plain iframe. Save the current playback time to users/{uid}/enrollments/{courseId} (fields: lastLessonId, lastTime) every 10 seconds and on pause, throttled so we do not exceed Firestore write limits. When the student reopens the course, resume the last lesson at the saved time. Add a compact playback speed selector (0.75x, 1x, 1.25x, 1.5x, 2x) and keyboard shortcuts: Space (play/pause), Left/Right arrows (seek 10s), N (next lesson), P (previous lesson), shortcuts disabled while typing in inputs. Show a small shortcuts help popover. Auto-mark a lesson complete when the video reaches 90% watched, with an undo toast.
```

### E2: Notes per lesson

```
Add a "Notes" panel next to the video (a tab on mobile). Students can write notes per lesson, with an "Add timestamp" button that inserts the current video time as a clickable chip that seeks the video to that moment. Autosave with debounce to users/{uid}/notes/{courseId_lessonId}. Show a saved indicator. Add an "All notes" view across the course with search, and an "Export notes as Markdown" button. Update security rules so users can only access their own notes.
```

### E3: Certificate of completion

```
Add certificates. A student is eligible when 100% of lessons are complete and every quiz in the course has a passing attempt. On the course dashboard, show a "Get certificate" button when eligible, with a progress hint when not. Create users/{uid}/certificates/{courseId} with a random public certificateId, student name, course title, and issue date. Build a clean printable certificate page at /certificate/:certificateId (public, read-only) with a "Download PDF" button (use html2canvas + jsPDF or the browser print stylesheet) and a copy-link button. Add a verification line showing the certificate ID and the app URL. Update the security rules so certificates are publicly readable by ID but only writable by the owner when eligibility conditions are met.
```

### E4: Admin analytics dashboard

```
Add an "Analytics" section to /admin with compact stat cards and charts (use recharts): total students, total enrollments, enrollments per course, completion rate per course, average quiz score per quiz, and enrollments over the last 30 days. Add a "Hardest questions" table that lists the questions most often answered wrong. To support this without expensive reads, store aggregate counters in Firestore (stats/{courseId} with enrollmentCount, completionCount) updated when students enroll or complete, and store per-question wrong-answer counts when a quiz attempt is saved. Show skeleton loaders and keep reads minimal (one document read per course).
```

### E5: Robustness (App Check, error handling, rules tests)

```
Add production robustness:
1. Wrap the app in a React ErrorBoundary with a friendly "Something went wrong" screen and a reload button, plus per-route error boundaries.
2. Integrate Sentry (free tier) for error tracking, configured via .env, enabled only in production.
3. Add Firebase App Check with reCAPTCHA v3 (debug token support for localhost) and tell me exactly which console steps to do.
4. Set up the Firebase Emulator Suite and write Firestore security rules tests (using @firebase/rules-unit-testing) covering: unauthenticated users blocked, students blocked from other users' data, non-enrolled users blocked from lessons and quizzes, non-admins blocked from writing courses, admins allowed. Add an npm script "test:rules".
```

### E6: Trust, legal and takedown

```
Add trust and legal features:
1. Pages: /privacy, /terms, and /about (placeholder text that I will edit), linked from the footer.
2. A "Report or takedown request" link on every course page and under every video that opens a small form (reason, details, reporter email) saving to a "reports" collection, plus a visible contact email from an env variable. Admins see reports in a new Reports tab with a resolved toggle.
3. A per-lesson "Source credit" line displayed directly under the video (creator name, channel link, original video link) using optional credit fields on each lesson. Add those fields to the admin lesson form.
4. An "Account deletion" option in settings that deletes the user's Firestore data (profile, enrollments, notes, attempts, certificates) and their Auth account after re-authentication and a confirm dialog.
5. Display "Free for everyone. No ads." messaging in the footer.
```

## Student comfort

### E7: Profile, password reset and email verification

```
Add account features: "Forgot password" flow on the login page, email verification after email sign-up with a dismissible banner until verified, and a /profile page where users edit display name and photo, change password (email accounts only), and see their learning stats (courses enrolled, lessons completed, quizzes passed, current streak). Keep the layout compact and consistent with the rest of the app.
```

### E8: Bookmarks, global search, streaks and badges

```
Add:
1. A bookmark (heart/bookmark icon) on course cards, stored at users/{uid}/bookmarks/{courseId}, plus a "Saved" filter on the home page.
2. A global search (Ctrl/Cmd+K command palette) that searches course titles, topics, and lesson titles. Fetch an index once, cache it in memory, and search client-side to save reads.
3. A subtle daily learning streak (a day counts when a lesson is completed or a quiz is submitted) shown in the navbar, and a small set of badges (First lesson, First quiz passed, 7-day streak, First course completed) shown on the profile page. Keep the design understated, not childish.
```

### E9: Timetable calendar links

```
In the Timetable tab, add an "Add to Google Calendar" link for each schedule entry (using the Google Calendar event URL template with title, day, time, description and link), and an "Download .ics" button that exports the whole weekly schedule as a recurring-events calendar file. Show times in the user's local timezone and let the admin set a timezone per course.
```

## Learning quality

### E10: Quiz improvements

```
Improve the quiz runner: shuffle questions and options each attempt (while mapping answerIndex correctly), optional timed mode (per-quiz timeLimitMinutes field in the JSON, with a visible timer and auto-submit), a "Review answers" screen after finishing that shows every question with the student's answer, the correct answer and the explanation, and a "Retry missed questions only" button. Keep the original JSON schema backward compatible and add optional fields: timeLimitMinutes, shuffle (default true). Update the admin validator and sample JSON accordingly.
```

### E11: Lesson mini quizzes and resources

```
Allow quizzes to be attached to a specific lesson (optional lessonId field in the quiz JSON or a dropdown in the admin quiz uploader). Show a "Quick check" card under the video for the current lesson when a mini quiz exists. Also add downloadable resources per lesson: admins can add a list of links (label, URL, type such as PDF, GitHub, cheat sheet) and students see them in a "Resources" section under the video.
```

### E12: Prerequisites and learning paths

```
Add learning paths. Courses get optional fields: level (Beginner, Intermediate, Advanced) and prerequisiteIds[]. Show a level badge on cards and a "Recommended before this course" box on the course detail page (soft recommendation, not a hard block). Add a "Learning paths" admin section where I can create a path (title, description, ordered list of courses) and a /paths page showing each path with the student's overall progress across its courses.
```

### E13: Lesson Q&A with moderation (build later)

```
Add a per-lesson discussion section under the video: enrolled students can post questions and replies, with a character limit, edit and delete for their own posts, and a Report button. Admins see a Moderation tab with reported posts, and can hide or delete posts and ban a user from commenting. Paginate comments (20 at a time) to control reads, and update the security rules accordingly.
```

## Admin tools

### E14: Student management, drafts and announcements

```
Extend the admin area:
1. Students tab: searchable, paginated list of users with their enrolled courses, progress percentage and last active date, with a "Disable commenting" and "Disable account" flag (store in users/{uid}.status and enforce in security rules and the app).
2. Course status: add draft, published and archived states, a "Preview as student" button, and a "Duplicate course" action (copying lessons and quizzes).
3. Announcements: create a message with an optional courseId and expiry date. Show a dismissible banner at the top of the app for global announcements and at the top of the course dashboard for course announcements. Remember dismissals per user.
```

### E15: Bulk course import and broken video checker

```
Add:
1. "Import full course" in the admin area: upload or paste a single JSON containing course info, credits, schedule, lessons (with YouTube URLs or IDs) and quizzes. Validate with clear errors, show a preview with counts, then save everything in one batched write. Provide a "Download sample course JSON" button and a "Copy AI prompt" button that generates this JSON from a playlist description.
2. A "Check videos" button per course that uses the YouTube oEmbed endpoint (https://www.youtube.com/oembed?url=...) for each lesson to detect deleted or non-embeddable videos, and flags them with a red badge in the lesson list. Store the last check date on each lesson.
```

## Performance and operations

### E16: Read optimization

```
Audit all Firestore reads and reduce them. Add: cached course list in memory plus sessionStorage with a short TTL, pagination or "load more" on large lists, denormalized counters (lessonCount, totalDuration on the course document, progressPercent on enrollments), and onSnapshot listeners only where real-time is needed. Remove any N+1 queries. Add a short README section explaining the data model and where reads happen, keeping us well inside the free Spark plan limits.
```

### E17: PWA

```
Make the app an installable PWA using vite-plugin-pwa: app manifest with name, icons and theme color, offline fallback page, cached app shell and static assets (never cache Firestore or authenticated data in a way that leaks between users; make sure the service worker works under a self-hosted HTTPS domain and relative base path), an "Install app" prompt button in the profile menu, and a "New version available, refresh" toast when an update is ready.
```

### E18: Environments and CI/CD

```
Set up separate dev and production Firebase projects with .firebaserc aliases and env files (.env.development, .env.production). Add a GitHub Actions workflow that on pull requests runs lint, type-check, build and the rules tests, and on merge to main builds the app, deploys Firestore rules to the production Firebase project, and uploads the dist/ folder to my own server over SSH (rsync). Tell me exactly which GitHub secrets to create (server host, user, path, SSH private key, Firebase token or service account) and how to generate them. Never deploy to Firebase Hosting. Also add an npm script to export Firestore data for manual backups, and document a monthly backup routine in the README.
```

---

# Final checklist

- [ ] Domain added to Firebase Authorized domains, HTTPS enabled
- [ ] Part 1 built and tested (Prompts 0 to 8)
- [ ] First deploy: `npm run build`, upload `dist/` to the server
- [ ] E1 Resume and playback controls
- [ ] E2 Notes
- [ ] E3 Certificates
- [ ] E4 Admin analytics
- [ ] E5 App Check, error boundary, rules tests
- [ ] E6 Legal, takedown, source credits
- [ ] Everything else once real students give feedback

## Notes on credits and copyright

- Always embed other creators' videos with the official YouTube player. Never download or re-upload them.
- Crediting does not replace permission. Ask creators for permission where you can, and keep their written replies.
- Keep the platform free and ad-free. This is general guidance, not legal advice.