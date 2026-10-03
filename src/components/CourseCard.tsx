import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, PlayCircle } from 'lucide-react';
import type { Course } from '../types';
import { resolveThumb } from '../lib/thumb';

export function CourseCard({ c, enrolled, progress, bookmarked, onBookmark }: {
  c: Course; enrolled?: boolean; progress?: number; bookmarked?: boolean; onBookmark?: () => void;
}) {
  const displayTags = c.tags?.slice(0, 2) || [];
  return (
    <div className="card group overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link to={`/course/${c.id}`} aria-label={c.title} className="relative block overflow-hidden">
        {c.thumbnail
          ? <img src={resolveThumb(c.thumbnail)} alt="" className="h-[166px] w-full object-cover transition duration-500 group-hover:scale-[1.04]" loading="lazy" />
          : <div className="grid h-[166px] w-full place-items-center bg-gradient-to-br from-indigo-600 to-violet-700 text-2xl font-extrabold text-white">FreeLMS</div>}
        <span className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" aria-hidden />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          <PlayCircle size={13} /> {enrolled ? 'Continue' : 'Preview'}
        </span>
        {enrolled && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow">Enrolled</span>
        )}
      </Link>
      <div className="p-3.5">
        <div className="flex items-center gap-1.5">
          {displayTags.map((t) => (
            <span key={t.slug} className="chip !py-0.5 !text-[11px] font-semibold" style={t.color ? { backgroundColor: `${t.color}1f`, color: t.color } : undefined}>
              {t.name}
            </span>
          ))}
          {c.level && <span className="chip !py-0.5 !text-[11px]">{c.level}</span>}
          <button onClick={onBookmark} aria-label="Bookmark" className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800">
            {bookmarked ? <BookmarkCheck size={16} className="text-indigo-600" /> : <Bookmark size={16} />}
          </button>
        </div>
        <Link to={`/course/${c.id}`} className="mt-2 block text-[15px] font-bold leading-snug tracking-tight transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">{c.title}</Link>
        <p className="mt-1 text-xs text-slate-500">{c.instructor} · {c.lessonCount ?? 0} lessons</p>
        {typeof progress === 'number' && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[11px] font-medium">
              <span className="text-slate-500">{progress === 100 ? 'Completed' : 'In progress'}</span>
              <span className="text-indigo-600 dark:text-indigo-400">{progress}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
