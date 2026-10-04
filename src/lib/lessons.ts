import type { Lesson } from '../types';

/** Leading "#N" number in a lesson title, if present. */
function leadingNumber(title: string): number | null {
  const m = String(title ?? '').trim().match(/^#(\d+)\b/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Student-facing lesson order: numbered lessons (#1, #2, …) first in numeric
 * ascending order, then everything else alphabetically (case-insensitive).
 */
export function sortLessons<T extends Pick<Lesson, 'title'>>(lessons: T[]): T[] {
  return [...lessons].sort((a, b) => {
    const na = leadingNumber(a.title);
    const nb = leadingNumber(b.title);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return -1;
    if (nb !== null) return 1;
    return String(a.title ?? '').localeCompare(String(b.title ?? ''), undefined, { sensitivity: 'base' });
  });
}
