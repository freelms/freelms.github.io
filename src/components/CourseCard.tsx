import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import type { Course } from '../types';
import { resolveThumb } from '../lib/thumb';

export function CourseCard({ c, enrolled, progress, bookmarked, onBookmark }: {
  c: Course; enrolled?: boolean; progress?: number; bookmarked?: boolean; onBookmark?: () => void;
}) {
  const displayTags = c.tags?.slice(0, 2) || (c.topic ? [{ slug: '', name: c.topic, color: undefined }] : []);
  return (
    <div className="card overflow-hidden">
      <Link to={`/course/${c.id}`} aria-label={c.title}>
        {c.thumbnail
          ? <img src={c.thumbnail} alt="" className="h-32 w-full object-cover" loading="lazy" />
          : <div className="grid h-32 w-full place-items-center bg-indigo-50 text-indigo-600 dark:bg-slate-800">FreeLMS</div>}
      </Link>
      <div className="p-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {displayTags.map((tag, i) => (
            <span key={i} className="chip" style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined, color: tag.color || undefined }}>
              {tag.name}
            </span>
          ))}
          {c.level && <span className="chip">{c.level}</span>}
          {enrolled && <span className="chip bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">Enrolled</span>}
          <button onClick={onBookmark} aria-label="Bookmark" className="ml-auto rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            {bookmarked ? <BookmarkCheck size={15} className="text-indigo-600" /> : <Bookmark size={15} />}
          </button>
        </div>
        <Link to={`/course/${c.id}`} className="mt-1.5 block text-sm font-semibold leading-snug hover:underline">{c.title}</Link>
        <p className="mt-0.5 text-xs text-slate-500">{c.instructor} · {c.lessonCount ?? 0} lessons</p>
        {typeof progress === 'number' && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-indigo-600" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
