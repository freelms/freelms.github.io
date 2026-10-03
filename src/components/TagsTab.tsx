import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../hooks/useToast';
import type { Tag } from '../types';
import { slugify } from '../lib/slug';
import { mergeTags, recalcTagCounts, removeTagFromCourses } from '../lib/tags';

const EMPTY: Partial<Tag> = {
  name: '', description: '', color: '#4f46e5', icon: 'book-open',
  parentSlug: '', showInMenu: false, featured: false, seoTitle: '', seoDescription: ''
};

export async function recalcCounts(db: any, _tags: Tag[], push: (msg: string) => void) {
  try {
    await recalcTagCounts(db);
    push('Tag counts recalculated');
  } catch (e: any) {
    push('Recalc failed: ' + (e?.message ?? e));
  }
}

export function TagsTab() {
  const { push } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<Partial<Tag>>({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [mergeFrom, setMergeFrom] = useState('');
  const [mergeTo, setMergeTo] = useState('');

  const reload = async () => {
    if (!db) return;
    const s = await getDocs(collection(db, 'tags'));
    const list = s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Tag[];
    setTags(list);
    // live usage counts (published courses per slug)
    try {
      const cs = await getDocs(query(collection(db, 'courses'), where('status', '==', 'published')));
      const m: Record<string, number> = {};
      cs.docs.forEach((d) => {
        for (const slug of ((d.data() as any).tagSlugs ?? []) as string[]) m[slug] = (m[slug] ?? 0) + 1;
      });
      setUsage(m);
    } catch { /* ignore */ }
  };
  useEffect(() => { reload(); }, []);

  const save = async () => {
    if (!db || !form.name?.trim()) { push('Name required'); return; }
    if (editing) {
      // slugs are immutable: only the display fields change
      const { slug: _s, slugHistory: _h, ...rest } = form as any;
      await updateDoc(doc(db, 'tags', editing), { ...rest, updatedAt: serverTimestamp() });
    } else {
      const slug = slugify(form.name);
      if (!slug) { push('Name must contain letters or numbers'); return; }
      const clash = tags.some((t) => t.slug.toLowerCase() === slug || t.id.toLowerCase() === slug);
      if (clash) { push('Slug already exists (slugs are unique, case-insensitive)'); return; }
      await setDoc(doc(db, 'tags', slug), {
        ...form, name: form.name.trim(), slug, menuOrder: tags.length,
        courseCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    }
    setForm({ ...EMPTY }); setEditing(null); reload(); push('Saved');
  };

  const del = async (t: Tag) => {
    if (!db) return;
    const n = usage[t.slug] ?? 0;
    if (n > 0 && !confirm(`"${t.name}" is used by ${n} published course(s). Delete anyway and remove it from all courses?`)) return;
    if (n === 0 && !confirm(`Delete tag "${t.name}"?`)) return;
    if (n > 0) await removeTagFromCourses(db, t.slug);
    await deleteDoc(doc(db, 'tags', t.id));
    await recalcTagCounts(db);
    reload(); push('Deleted');
  };

  const doMerge = async () => {
    if (!db || !mergeFrom || !mergeTo || mergeFrom === mergeTo) { push('Pick two different tags'); return; }
    if (!confirm(`Move all courses from "${mergeFrom}" to "${mergeTo}" and delete "${mergeFrom}"?`)) return;
    const n = await mergeTags(db, mergeFrom, mergeTo);
    await deleteDoc(doc(db, 'tags', mergeFrom));
    await recalcTagCounts(db);
    setMergeFrom(''); setMergeTo(''); reload();
    push(`Merged ${n} course(s) into ${mergeTo}`);
  };

  const moveOrder = async (t: Tag, dir: -1 | 1) => {
    if (!db) return;
    const siblings = tags
      .filter((x) => (x.parentSlug ?? '') === (t.parentSlug ?? ''))
      .sort((a, b) => (a.menuOrder ?? 0) - (b.menuOrder ?? 0));
    const i = siblings.findIndex((x) => x.id === t.id);
    const j = siblings[i + dir];
    if (!j) return;
    await updateDoc(doc(db, 'tags', t.id), { menuOrder: j.menuOrder ?? 0 });
    await updateDoc(doc(db, 'tags', j.id), { menuOrder: t.menuOrder ?? 0 });
    reload();
  };

  const setParent = async (t: Tag, parentSlug: string) => {
    if (!db) return;
    if (parentSlug && tags.find((x) => x.id === parentSlug)?.parentSlug) {
      push('Only one level of nesting allowed');
      return;
    }
    await updateDoc(doc(db, 'tags', t.id), { parentSlug, updatedAt: serverTimestamp() });
    reload();
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="card p-4 text-sm">
          <h2 className="font-semibold">{editing ? 'Edit tag (slug is immutable)' : 'New tag'}</h2>
          <div className="mt-2 grid gap-2">
            <input className="input" placeholder="Name" value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            {editing && <p className="text-xs text-slate-500">Slug: <code>{editing}</code> (renaming changes display name only)</p>}
            <textarea className="input" placeholder="Description (required for SEO pages, 120+ chars)" value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            {(form.description ?? '').trim().length > 0 && (form.description ?? '').trim().length < 120 && (
              <p className="text-xs text-amber-600">⚠ Under 120 chars — tag page will be noindexed until fixed.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="color" value={form.color ?? '#4f46e5'} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} aria-label="Color" />
              <input className="input" placeholder="Lucide icon name (e.g., book-open)" value={form.icon ?? 'book-open'} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
            </div>
            <select className="input" value={form.parentSlug ?? ''} onChange={(e) => setForm((f) => ({ ...f, parentSlug: e.target.value }))} aria-label="Parent tag">
              <option value="">None (top level)</option>
              {tags.filter((t) => !t.parentSlug && t.id !== editing).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!form.showInMenu} onChange={(e) => setForm((f) => ({ ...f, showInMenu: e.target.checked }))} /> Show in menu</label>
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} /> Featured</label>
            </div>
            <input className="input" placeholder="SEO title (optional)" value={form.seoTitle ?? ''} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))} aria-label="SEO title" />
            <textarea className="input" placeholder="SEO description (optional)" value={form.seoDescription ?? ''} onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))} aria-label="SEO description" />
            <div className="flex gap-2">
              <button className="btn-primary" onClick={save}>Save</button>
              {editing && <button className="btn-ghost" onClick={() => { setEditing(null); setForm({ ...EMPTY }); }}>Cancel</button>}
            </div>
          </div>
        </div>

        <div className="card p-4 text-sm">
          <h2 className="font-semibold">Merge tags</h2>
          <p className="mt-1 text-xs text-slate-500">Move all courses from source to target, then delete the source.</p>
          <div className="mt-2 grid gap-2">
            <select className="input" value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)} aria-label="Source tag">
              <option value="">Source tag…</option>
              {tags.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
            </select>
            <select className="input" value={mergeTo} onChange={(e) => setMergeTo(e.target.value)} aria-label="Target tag">
              <option value="">Target tag…</option>
              {tags.filter((t) => t.slug !== mergeFrom).map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
            </select>
            <button className="btn-ghost" onClick={doMerge}>Merge</button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input className="input max-w-xs" placeholder="Search tags…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tags" />
          <button className="btn-ghost" onClick={async () => { if (db) { await recalcTagCounts(db); reload(); push('Counts recalculated'); } }}>Recalculate counts</button>
        </div>
        {tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())).map((t) => {
          const n = usage[t.slug] ?? t.courseCount ?? 0;
          return (
            <div key={t.id} className="card p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color ?? '#4f46e5' }} />
                <span className="flex-1">
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-xs text-slate-500">/{t.slug} · {n} course(s){t.parentSlug ? ` · child of ${t.parentSlug}` : ''}</span>
                </span>
                {t.featured && <span className="chip">featured</span>}
                {t.showInMenu && <span className="chip">menu</span>}
              </div>
              {(!t.description?.trim() || (t.description?.trim().length ?? 0) < 120) && (
                <p className="mt-1 text-xs text-amber-600">⚠ Needs a 120+ char description for its SEO page.</p>
              )}
              {n === 0 && <p className="mt-1 text-xs text-slate-500">No published courses use this tag.</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button className="btn-ghost !py-1 text-xs" onClick={() => { setEditing(t.id); setForm({ ...t }); }}>Edit</button>
                <button className="btn-ghost !py-1 text-xs" onClick={() => moveOrder(t, -1)} aria-label="Move up">↑</button>
                <button className="btn-ghost !py-1 text-xs" onClick={() => moveOrder(t, 1)} aria-label="Move down">↓</button>
                <select className="input !w-auto !py-1 text-xs" value={t.parentSlug ?? ''} onChange={(e) => setParent(t, e.target.value)} aria-label="Parent">
                  <option value="">Top level</option>
                  {tags.filter((x) => !x.parentSlug && x.id !== t.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <button className="text-xs text-red-600 underline" onClick={() => del(t)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
