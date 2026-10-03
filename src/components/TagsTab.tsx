import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../hooks/useToast';
import type { Tag, Course } from '../types';
import { slugify } from '../lib/slug';

export async function recalcCounts(db: any, tags: Tag[], push: (msg: string) => void) {
  if (!db || !confirm('Recalculate all tag counts from published courses?')) return;
  try {
    const coursesSnap = await getDocs(query(collection(db, 'courses'), where('status', '==', 'published')));
    const counts: Record<string, number> = {};
    coursesSnap.docs.forEach(d => {
      const c = d.data() as any;
      (c.tagSlugs || []).forEach((slug: string) => {
        counts[slug] = (counts[slug] || 0) + 1;
      });
    });
    const batch = writeBatch(db);
    for (const tag of tags) {
      if (counts[tag.slug] !== undefined && counts[tag.slug] !== (tag.courseCount || 0)) {
        batch.update(doc(db, 'tags', tag.id), { courseCount: counts[tag.slug] });
      }
    }
    await batch.commit();
  } catch (e: any) {
    throw new Error('Recalc failed: ' + e.message);
  }
}

export function TagsTab() {
  const { push } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<Partial<Tag>>({
    name: '', description: '', color: '#4f46e5', icon: 'book-open',
    parentSlug: '', showInMenu: false, featured: false,
    seoTitle: '', seoDescription: ''
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const reload = async () => {
    if (!db) return;
    const s = await getDocs(collection(db, 'tags'));
    setTags(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Tag[]);
  };
  useEffect(() => { reload(); }, []);

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const save = async () => {
    if (!db || !form.name) { push('Name required'); return; }
    const slug = editing ? editing : slugify(form.name);
    const exists = tags.some(t => t.slug === slug && t.id !== editing);
    if (exists) { push('Slug already exists'); return; }
    const payload = {
      ...form,
      slug,
      name: form.name,
      slugHistory: editing && tags.find(t => t.id === editing)?.slug !== slug
        ? [...(tags.find(t => t.id === editing)?.slugHistory || []), tags.find(t => t.id === editing)!.slug]
        : (tags.find(t => t.id === editing)?.slugHistory || []),
      updatedAt: new Date()
    };
    if (editing) await updateDoc(doc(db, 'tags', editing), payload as any);
    else await addDoc(collection(db, 'tags'), { ...payload, createdAt: new Date(), courseCount: 0 });
    setForm({ name: '', description: '', color: '#4f46e5', icon: 'book-open', parentSlug: '', showInMenu: false, featured: false, seoTitle: '', seoDescription: '' });
    setEditing(null); reload(); push('Saved');
  };

  const del = async (id: string) => {
    if (!confirm('Delete tag? This will remove it from all courses.')) return;
    await deleteDoc(doc(db, 'tags', id));
    push('Deleted');
  };

  const parentOptions = (editing ? tags.filter(t => !t.parentSlug && t.id !== editing) : tags.filter(t => !t.parentSlug)).map(t => ({ id: t.id, name: t.name }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="card p-4 text-sm">
        <h2 className="font-semibold">{editing ? 'Edit tag' : 'New tag'}</h2>
        <div className="mt-2 grid gap-2">
          <input className="input" placeholder="Name" value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <textarea className="input" placeholder="Description" value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="color" value={form.color ?? '#4f46e5'} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} aria-label="Color" />
            <input className="input" placeholder="Lucide icon name (e.g., book-open)" value={form.icon ?? 'book-open'} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
          </div>
          <select className="input" value={form.parentSlug ?? ''} onChange={(e) => setForm((f) => ({ ...f, parentSlug: e.target.value }))} aria-label="Parent tag">
            <option value="">None (top level)</option>
            {tags.filter(t => !t.parentSlug && t.id !== (editing || '')).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.showInMenu} onChange={(e) => setForm((f) => ({ ...f, showInMenu: e.target.checked }))} /> Show in menu</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} /> Featured</label>
          </div>
          <input className="input" placeholder="SEO title (optional)" value={form.seoTitle ?? ''} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))} aria-label="SEO title" />
          <textarea className="input" placeholder="SEO description (optional)" value={form.seoDescription ?? ''} onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))} aria-label="SEO description" />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            {editing && <button className="btn-ghost" onClick={() => { setEditing(null); setForm({ name: '', description: '', color: '#4f46e5', icon: 'book-open', parentSlug: '', showInMenu: false, featured: false, seoTitle: '', seoDescription: '' }); }}>Cancel</button>}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex gap-2 mb-2">
          <input className="input max-w-xs" placeholder="Search tags…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tags" />
          <button className="btn-ghost" onClick={() => { if (confirm('Recalculate all tag counts from published courses?')) { recalcCounts(db, tags, push); } }}>Recalculate counts</button>
        </div>
        {tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).map((t) => (
          <div key={t.id} className="card flex items-center gap-2 p-3 text-sm">
            <span className="flex-1">
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-slate-500">slug: {t.slug} · {t.courseCount ?? 0} courses {t.parentSlug && `· parent: ${tags.find(p => p.id === t.parentSlug)?.name}`}</p>
              {t.seoTitle && <p className="text-xs text-slate-500">SEO: {t.seoTitle}</p>}
            </span>
            <button className="btn-ghost !py-1 text-xs" onClick={() => { setEditing(t.id); setForm({ ...t }); }}>Edit</button>
            <button className="btn-ghost !py-1 text-xs !text-red-600" onClick={() => { if (confirm('Delete tag? This will remove it from all courses.')) { deleteDoc(doc(db, 'tags', t.id)); push('Deleted'); } }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}