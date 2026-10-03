/** Generate a URL-friendly slug from a string. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Generate a slug with a random suffix for uniqueness. */
export function slugifyUnique(s: string, existing: string[] = []): string {
  let base = slugify(s);
  let slug = base;
  let counter = 1;
  while (existing.includes(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}