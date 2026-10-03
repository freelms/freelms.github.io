import { collection, doc, getDocs, query, setDoc, updateDoc, where, writeBatch, increment } from 'firebase/firestore';
import type { Tag } from '../types';

/** Recompute every tag's courseCount from published courses (batched). */
export async function recalcTagCounts(db: any): Promise<Record<string, number>> {
  const snap = await getDocs(query(collection(db, 'courses'), where('status', '==', 'published')));
  const counts: Record<string, number> = {};
  snap.docs.forEach((d) => {
    for (const slug of ((d.data() as any).tagSlugs ?? []) as string[]) {
      counts[slug] = (counts[slug] ?? 0) + 1;
    }
  });
  const tags = await getDocs(collection(db, 'tags'));
  const batch = writeBatch(db);
  let n = 0;
  for (const t of tags.docs) {
    const want = counts[(t.data() as any).slug ?? t.id] ?? 0;
    if (want !== ((t.data() as any).courseCount ?? 0)) {
      batch.update(doc(db, 'tags', t.id), { courseCount: want });
      n++;
    }
  }
  if (n) await batch.commit();
  return counts;
}

const counted = (status: unknown, slugs: unknown): string[] =>
  status === 'published' && Array.isArray(slugs) ? (slugs as string[]).slice(0, 8) : [];

/** Incrementally sync tag counters on course create/update/delete (one batched write). */
export async function syncTagCounters(
  db: any,
  before: { status?: unknown; tagSlugs?: unknown } | null,
  after: { status?: unknown; tagSlugs?: unknown } | null
) {
  const b = new Set(counted(before?.status, before?.tagSlugs));
  const a = new Set(counted(after?.status, after?.tagSlugs));
  const delta = new Map<string, number>();
  for (const s of a) if (!b.has(s)) delta.set(s, (delta.get(s) ?? 0) + 1);
  for (const s of b) if (!a.has(s)) delta.set(s, (delta.get(s) ?? 0) - 1);
  if (!delta.size) return;
  const batch = writeBatch(db);
  for (const [slug, d] of delta) {
    batch.set(doc(db, 'tags', slug), { courseCount: increment(d) }, { merge: true });
  }
  await batch.commit();
}

/** Remove a tag slug from all courses carrying it (batched, chunked). */
export async function removeTagFromCourses(db: any, slug: string): Promise<number> {
  const snap = await getDocs(query(collection(db, 'courses'), where('tagSlugs', 'array-contains', slug)));
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + 400)) {
      const cur = ((d.data() as any).tagSlugs ?? []) as string[];
      const next = cur.filter((s) => s !== slug);
      batch.update(doc(db, 'courses', d.id), {
        tagSlugs: next,
        tags: ((d.data() as any).tags ?? []).filter((t: any) => t.slug !== slug)
      });
      n++;
    }
    await batch.commit();
  }
  return n;
}

/** Merge source tag into target: move all courses, delete source, recount both. */
export async function mergeTags(db: any, sourceSlug: string, targetSlug: string): Promise<number> {
  const snap = await getDocs(query(collection(db, 'courses'), where('tagSlugs', 'array-contains', sourceSlug)));
  const targetSnap = await getDocs(query(collection(db, 'tags'), where('slug', '==', targetSlug)));
  const target = targetSnap.docs[0]?.data() as any;
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + 400)) {
      const cur = ((d.data() as any).tagSlugs ?? []) as string[];
      const next = cur.filter((s) => s !== sourceSlug);
      const tags = ((d.data() as any).tags ?? []).filter((t: any) => t.slug !== sourceSlug);
      if (target && !next.includes(targetSlug)) next.push(targetSlug);
      if (target && !tags.some((t: any) => t.slug === targetSlug)) {
        tags.push({ slug: targetSlug, name: target.name, color: target.color });
      }
      batch.update(doc(db, 'courses', d.id), { tagSlugs: next.slice(0, 8), tags: tags.slice(0, 8) });
      n++;
    }
    await batch.commit();
  }
  return n;
}

/** Denormalized [{slug,name,color}] for a slug list, from a tag cache. */
export function denormalizeTags(slugs: string[], cache: Tag[]) {
  const bySlug = new Map(cache.map((t) => [t.slug ?? t.id, t]));
  return slugs.slice(0, 8).map((s) => {
    const t = bySlug.get(s);
    return { slug: s, name: t?.name ?? s, color: t?.color };
  });
}
