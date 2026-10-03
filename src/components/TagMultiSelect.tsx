import { useState, useEffect, useRef } from 'react';
import type { Tag } from '../types';

interface TagMultiSelectProps {
  value: string[];
  onChange: (tags: string[]) => void;
  allTags: Tag[];
  disabled?: boolean;
  allowCreate?: boolean;
  onTagsChanged?: () => void;
}

export function TagMultiSelect({ value, onChange, allTags, disabled, allowCreate, onTagsChanged }: TagMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredTags = allTags
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    .filter(t => !value.includes(t.slug))
    .slice(0, 10);

  const [creating, setCreating] = useState(false);

  const handleAddTag = (slug: string) => {
    if (disabled || value.includes(slug)) return;
    if (value.length >= 8) { alert('Maximum 8 tags allowed'); return; }
    onChange([...value, slug]);
    setSearch('');
  };

  const handleRemoveTag = (slug: string) => {
    onChange(value.filter(s => s !== slug));
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedTags = allTags.filter(t => value.includes(t.slug));

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex flex-wrap gap-1.5 mb-1">
        {value.map(slug => {
          const tag = allTags.find(t => t.slug === slug);
          return (
            <span key={slug} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full" style={{ backgroundColor: tag?.color ? `${tag.color}20` : 'var(--color-primary-100)', color: tag?.color || 'var(--color-primary)' }}>
              <span style={{ color: tag?.color || 'inherit' }}>{tag?.name || slug}</span>
              <button type="button" onClick={() => handleRemoveTag(slug)} className="text-current hover:opacity-70" aria-label="Remove tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={search}
          disabled={disabled || (value.length >= 8 && !showDropdown)}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          className="input flex-1 min-w-40"
          placeholder={value.length >= 8 ? 'Maximum 8 tags reached' : 'Search or create tag…'}
          aria-label="Search or add tags"
        />
      </div>
      {showDropdown && search && (
        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto card shadow-lg border border-slate-200 dark:border-slate-700">
          {filteredTags.length > 0 ? (
            filteredTags.map(tag => (
              <button
                key={tag.slug}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                onClick={() => handleAddTag(tag.slug)}
              >
                <span className="w-4 h-4 rounded" style={{ backgroundColor: tag.color || '#4f46e5' }} />
                <span>{tag.name}</span>
              </button>
            ))
          ) : search.trim() && allowCreate ? (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              disabled={creating}
              onClick={async () => {
                const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
                const { db } = await import('../lib/firebase');
                const { slugify } = await import('../lib/slug');
                const slug = slugify(search.trim());
                if (!slug || !db) return;
                if (allTags.some((t) => t.slug.toLowerCase() === slug)) { handleAddTag(slug); return; }
                setCreating(true);
                try {
                  await setDoc(doc(db, 'tags', slug), {
                    name: search.trim(), slug, color: '#4f46e5', showInMenu: true,
                    menuOrder: allTags.length, courseCount: 0,
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                  });
                  onTagsChanged?.();
                  handleAddTag(slug);
                } finally {
                  setCreating(false);
                }
              }}
            >
              + Create "{search.trim()}"{creating ? '…' : ''}
            </button>
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">
              {search ? 'No matching tags' : 'Start typing to search tags'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}