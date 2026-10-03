import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, X, Tag as TagIcon } from 'lucide-react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Tag } from '../types';

const CACHE_KEY = 'lh-tag-menu';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function useMenuTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchFresh = async () => {
      if (!db) return;
      try {
        const q = query(
          collection(db, 'tags'),
          where('showInMenu', '==', true),
          orderBy('menuOrder', 'asc'),
          orderBy('name', 'asc')
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Tag[];
        if (cancelled) return;
        setTags(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        } catch { /* ignore */ }
        setLoading(false);
      } catch (e) {
        console.error('Failed to load tag menu:', e);
        if (!cancelled) setLoading(false);
      }
    };
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setTags(data);
          setLoading(false);
          fetchFresh(); // background refresh
          return () => { cancelled = true; };
        }
      }
    } catch { /* ignore */ }
    fetchFresh();
    return () => { cancelled = true; };
  }, []);

  return { tags, loading };
}

export function TagNavigation({ mobile = false }: { mobile?: boolean }) {
  const { tags, loading } = useMenuTags();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const parents = useMemo(
    () => tags.filter((t) => !t.parentSlug && (t.courseCount || 0) > 0),
    [tags]
  );
  const childrenOf = useMemo(() => {
    const map = new Map<string, Tag[]>();
    for (const t of tags) {
      if (!t.parentSlug || (t.courseCount || 0) <= 0) continue;
      const list = map.get(t.parentSlug) ?? [];
      list.push(t);
      map.set(t.parentSlug, list);
    }
    return map;
  }, [tags]);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return parents;
    return parents.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (childrenOf.get(p.id) ?? []).some((c) => c.name.toLowerCase().includes(s))
    );
  }, [parents, childrenOf, search]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <button className="btn-ghost !px-3" disabled aria-label="Categories loading">
        <TagIcon size={17} />
        <span className="hidden sm:inline">Categories</span>
      </button>
    );
  }

  if (mobile) {
    if (!open) {
      return (
        <button className="btn-ghost !px-3" onClick={() => setOpen(true)} aria-label="Open categories">
          <TagIcon size={17} />
          <span className="hidden sm:inline">Categories</span>
        </button>
      );
    }
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col" role="dialog" aria-label="Categories">
        <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold">Categories</h2>
          <input
            type="text"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input flex-1"
            aria-label="Search categories"
          />
          <button onClick={() => setOpen(false)} className="p-2" aria-label="Close categories">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4" aria-label="Categories">
          <div className="space-y-2">
            {visible.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  className="flex w-full items-center justify-between p-3 text-left"
                  onClick={() => toggle(p.id)}
                  aria-expanded={expanded.has(p.id)}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {p.courseCount ?? 0} courses
                    <ChevronDown size={14} className={expanded.has(p.id) ? 'rotate-180' : ''} />
                  </span>
                </button>
                {expanded.has(p.id) && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                    <Link
                      to={`/tag/${p.slug}`}
                      onClick={() => setOpen(false)}
                      className="block rounded px-2 py-1.5 text-sm font-medium text-indigo-600"
                    >
                      All {p.name} ({p.courseCount ?? 0})
                    </Link>
                    {(childrenOf.get(p.id) ?? []).map((c) => (
                      <Link
                        key={c.id}
                        to={`/tag/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="block rounded px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {c.name}
                        <span className="ml-2 text-xs text-slate-400">{c.courseCount ?? 0}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {visible.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">No categories found</p>
            )}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        className="btn-ghost !px-3 flex items-center gap-1.5"
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <TagIcon size={17} />
        <span className="hidden sm:inline">Categories</span>
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[320px] card border p-2 shadow-lg">
          <input
            type="text"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input mb-2 w-full"
            aria-label="Search categories"
          />
          <div className="max-h-[380px] overflow-y-auto">
            {visible.length === 0 && (
              <p className="px-3 py-4 text-sm text-slate-500">No categories found</p>
            )}
            {visible.map((p) => (
              <div key={p.id} className="rounded-lg">
                <div className="flex items-center">
                  <Link
                    to={`/tag/${p.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded px-2 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {p.name}
                    <span className="ml-2 text-xs text-slate-400">{p.courseCount ?? 0}</span>
                  </Link>
                  {(childrenOf.get(p.id) ?? []).length > 0 && (
                    <button
                      className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => toggle(p.id)}
                      aria-label={`Expand ${p.name}`}
                      aria-expanded={expanded.has(p.id)}
                    >
                      <ChevronDown size={14} className={expanded.has(p.id) ? 'rotate-180' : ''} />
                    </button>
                  )}
                </div>
                {expanded.has(p.id) && (
                  <div className="mb-1 ml-4 border-l border-slate-200 pl-2 dark:border-slate-700">
                    {(childrenOf.get(p.id) ?? []).map((c) => (
                      <Link
                        key={c.id}
                        to={`/tag/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="block rounded px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {c.name}
                        <span className="ml-2 text-xs text-slate-400">{c.courseCount ?? 0}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FooterCategories() {
  const { tags } = useMenuTags();
  const parents = tags.filter((t) => !t.parentSlug && (t.courseCount || 0) > 0);
  if (parents.length === 0) return null;
  return (
    <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 py-3" aria-label="Footer categories">
      {parents.map((p) => (
        <Link
          key={p.id}
          to={`/tag/${p.slug}`}
          className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {p.name}
        </Link>
      ))}
    </nav>
  );
}
