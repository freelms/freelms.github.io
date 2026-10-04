import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Course, Tag } from '../types';
import { resolveThumb } from '../lib/thumb';
import { EmptyState, SkeletonCard } from '../components/ui';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

type SortKey = 'title' | 'lessons' | 'newest';

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tag, setTag] = useState<Tag | null>(null);
  const [tagMissing, setTagMissing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(searchParams.get('level') ?? '');
  const [sort, setSort] = useState<SortKey>((searchParams.get('sort') as SortKey) || 'title');
  const [children, setChildren] = useState<Tag[]>([]);

  useEffect(() => {
    if (!db || !slug) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'tags', slug));
        if (cancelled) return;
        if (snap.exists()) setTag({ id: snap.id, ...(snap.data() as any) } as Tag);
        else setTagMissing(true);
      } catch {
        if (!cancelled) setTagMissing(true);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!db || !slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, 'courses'),
            where('tagSlugs', 'array-contains', slug),
            where('status', '==', 'published')
          )
        );
        if (!cancelled) setCourses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Course[]);
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'tags'), where('parentSlug', '==', slug)));
        if (!cancelled) {
          setChildren(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as any) })) as Tag[]
          );
        }
      } catch {
        if (!cancelled) setChildren([]);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    document.title = tag ? `${tag.seoTitle || tag.name} | FreeLMS GitHub` : 'Category | FreeLMS GitHub';
  }, [tag]);

  const related = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const c of courses) {
      for (const s of c.tagSlugs ?? []) {
        if (s === slug) continue;
        const label = (c.tags ?? []).find((t) => t.slug === s)?.name ?? s;
        const cur = counts.get(s) ?? { name: label, n: 0 };
        cur.n += 1;
        counts.set(s, cur);
      }
    }
    return [...counts.entries()]
      .map(([s, v]) => ({ slug: s, ...v }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [courses, slug]);

  const visible = useMemo(() => {
    const list = level ? courses.filter((c) => c.level === level) : [...courses];
    switch (sort) {
      case 'lessons':
        return list.sort((a, b) => (b.lessonCount ?? 0) - (a.lessonCount ?? 0));
      case 'newest':
        return list.sort((a, b) => String(b.createdAt ?? '') > String(a.createdAt ?? '') ? 1 : -1);
      default:
        return list.sort((a, b) => a.title.localeCompare(b.title));
    }
  }, [courses, level, sort]);

  const applyFilter = (nextLevel: string, nextSort: SortKey) => {
    setLevel(nextLevel);
    setSort(nextSort);
    const p = new URLSearchParams();
    if (nextLevel) p.set('level', nextLevel);
    if (nextSort !== 'title') p.set('sort', nextSort);
    setSearchParams(p);
  };

  if (tagMissing) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-12 text-center">
        <EmptyState title="Category not found" hint="This category does not exist or was removed." />
        <Link to="/" className="btn-primary mt-4 inline-block">Browse all courses</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link to="/" className="hover:underline">Home</Link>
        <span>/</span>
        <span className="font-medium text-slate-700 dark:text-slate-200">{tag?.name ?? 'Category'}</span>
      </nav>

      <header className="card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white"
            style={{ backgroundColor: tag?.color ?? '#4f46e5' }}
            aria-hidden
          >
            {(tag?.name ?? '?').charAt(0)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{tag?.name ?? 'Loading…'}</h1>
            <p className="text-xs text-slate-500">
              {courses.length} course{courses.length === 1 ? '' : 's'}
              {tag?.description ? ` · ${tag.description}` : ''}
            </p>
          </div>
        </div>
        {tag?.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{tag.description}</p>}
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          className="input max-w-[180px]"
          value={level}
          onChange={(e) => applyFilter(e.target.value, sort)}
          aria-label="Filter by level"
        >
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select
          className="input max-w-[180px]"
          value={sort}
          onChange={(e) => applyFilter(level, e.target.value as SortKey)}
          aria-label="Sort courses"
        >
          <option value="title">Sort: Title</option>
          <option value="lessons">Sort: Most lessons</option>
          <option value="newest">Sort: Newest</option>
        </select>
      </div>

      {children.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Subcategories:</span>
          {children.map((c) => (
            <Link key={c.id} to={`/tag/${c.slug}`} className="chip hover:bg-slate-200 dark:hover:bg-slate-700">
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Related:</span>
          {related.map((r) => (
            <Link key={r.slug} to={`/tag/${r.slug}`} className="chip hover:bg-slate-200 dark:hover:bg-slate-700">
              {r.name} · {r.n}
            </Link>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No courses here yet" hint="Try clearing the level filter, or check back later." />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <Link key={c.id} to={`/course/${c.id}`} className="card overflow-hidden hover:shadow-md">
              {c.thumbnail ? (
                <img src={resolveThumb(c.thumbnail)} alt="" className="h-[166px] w-full object-cover" loading="lazy" />
              ) : (
                <div className="grid h-[166px] w-full place-items-center bg-indigo-50 text-indigo-600 dark:bg-slate-800">
                  FreeLMS
                </div>
              )}
              <div className="p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(c.tags ?? []).slice(0, 2).map((t) => (
                    <span key={t.slug} className="chip" style={t.color ? { backgroundColor: `${t.color}20`, color: t.color } : undefined}>
                      {t.name}
                    </span>
                  ))}
                  {c.level && <span className="chip">{c.level}</span>}
                </div>
                <p className="mt-1.5 text-sm font-semibold leading-snug">{c.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.instructor} · {c.lessonCount ?? 0} lessons
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
