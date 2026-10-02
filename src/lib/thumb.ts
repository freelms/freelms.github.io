/** Resolve a course thumbnail to a loadable URL.
 * Accepts: full https:// URLs (Firebase Storage, image hosts), or repo-asset
 * paths like `thumbs/intro.jpg` (files committed under public/thumbs/).
 * Relative paths are resolved against VITE_APP_URL so the same Firestore
 * value works on localhost, GitHub Pages, and prerendered static pages.
 */
export function resolveThumb(src?: string): string {
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  const base = (import.meta.env.VITE_APP_URL ?? './').replace(/\/?$/, '/');
  return base + src.replace(/^\.\//, '').replace(/^\//, '');
}
