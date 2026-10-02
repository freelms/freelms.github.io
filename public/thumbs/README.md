# Course thumbnails (free, no Firebase Storage needed)

Drop optimized course images in THIS folder, then use them as thumbnail URLs.

## How
1. Compress first: JPG/WebP, ~1280×720, under ~200KB (use squoosh.app or similar).
2. Copy the file here, e.g. `web-dev-intro.jpg` (lowercase, dashes, no spaces).
3. Commit + push. Pages redeploys automatically.
4. In Admin → Courses, paste either:
   - just the filename: `thumbs/web-dev-intro.jpg` (recommended — works on localhost AND live site), or
   - the full URL: `https://freelms.github.io/freelms/thumbs/web-dev-intro.jpg`

The app resolves bare filenames/relative paths against the site URL, so the
same Firestore value works everywhere. External `https://…` URLs still work too.
