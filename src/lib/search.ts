/** Typo-tolerant, synonym-aware matching for small catalogs (client-side). */

const SYNONYMS: Record<string, string[]> = {
  js: ['javascript'],
  javascript: ['js'],
  py: ['python'],
  python: ['py'],
  ai: ['artificial intelligence', 'machine learning', 'ml'],
  ml: ['machine learning', 'ai'],
  web: ['website', 'web development', 'frontend'],
  excel: ['spreadsheet', 'sheets'],
  sql: ['database', 'mysql'],
  programming: ['coding', 'development'],
  coding: ['programming'],
  design: ['ui', 'ux', 'figma'],
  video: ['editing', 'premiere'],
  marketing: ['seo', 'digital marketing'],
  freelance: ['freelancing', 'upwork', 'fiverr'],
  english: ['spoken english', 'language'],
};

const norm = (s: string) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Levenshtein distance, capped early for speed. */
function dist(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const c = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(c);
      rowMin = Math.min(rowMin, c);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

function wordMatch(qw: string, text: string): number {
  if (!qw) return 0;
  if (text.includes(qw)) return qw.length >= 4 ? 3 : 2;
  if (text.split(/[^a-z0-9]+/).some((w) => w.startsWith(qw) && qw.length >= 2)) return 2;
  if (qw.length >= 4 && text.split(/[^a-z0-9]+/).some((w) => w.length >= 4 && dist(qw, w) <= (qw.length >= 6 ? 2 : 1))) return 1;
  return 0;
}

/** Score a haystack against query words (with synonym expansion). Higher = better. */
export function searchScore(query: string, haystack: string): number {
  const words = norm(query).split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return 0;
  const text = norm(haystack);
  let score = 0;
  for (const w of words) {
    let best = wordMatch(w, text);
    for (const syn of SYNONYMS[w] ?? []) {
      best = Math.max(best, wordMatch(norm(syn), text));
    }
    if (best === 0) return 0; // every word must match something (AND)
    score += best;
  }
  return score;
}

/** Filter + rank items by a haystack getter. Returns items sorted best-first. */
export function searchRank<T>(query: string, items: T[], hay: (item: T) => string): T[] {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, s: searchScore(query, hay(item)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.item);
}
