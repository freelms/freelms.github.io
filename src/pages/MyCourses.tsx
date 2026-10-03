import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import type { Course, Enrollment, Lesson } from '../types';
import { CourseCard } from '../components/CourseCard';
import { ProgressRing, EmptyState } from '../components/ui';
import { resolveThumb } from '../lib/thumb';
import { BookOpen, CheckCircle2, Clock, ArrowRight, Filter, X } from 'lucide-react';

type FilterTab = 'all' | 'in-progress' | 'completed' | 'not-started';

interface EnrollmentWithCourse extends Enrollment {
  id?: string;
  course: Course;
  lessons: Lesson[];
  totalLessons: number;
  completedCount: number;
  progress: number;
}

export default function MyCourses({ lessonsByCourse }: { lessonsByCourse: Record<string, Lesson[]> }) {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!db || !user) { setLoading(false); return; }
    (async () => {
      try {
        const [eSnap, cSnap] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'enrollments')),
          getDocs(collection(db, 'courses'))
        ]);
        const enrollmentsData = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const coursesData = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEnrollments(enrollmentsData);
        setCourses(coursesData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const enriched = useMemo(() => {
    return enrollments
      .map(e => {
        const course = courses.find(c => c.id === e.id);
        const lessons = lessonsByCourse[e.id] || [];
        const total = lessons.length || course?.lessonCount || 1;
        const completed = e.completedLessons?.length || 0;
        return {
          ...e,
          course,
          lessons,
          totalLessons: total,
          completedCount: completed,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0
        } as EnrollmentWithCourse;
      })
      .filter(e => e.course); // only enrolled courses that exist
  }, [enrollments, courses, lessonsByCourse]);

  const filtered = enriched
    .filter(e => {
      if (filter === 'in-progress') return e.progress > 0 && e.progress < 100;
      if (filter === 'completed') return e.progress >= 100;
      if (filter === 'not-started') return e.progress === 0;
      return true;
    })
    .filter(e => !search || e.course.title.toLowerCase().includes(search.toLowerCase()) || e.course.topic?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // Sort: in-progress first (by last active), then not-started, then completed
      const order = (e: EnrollmentWithCourse) => {
        if (e.progress > 0 && e.progress < 100) return 0;
        if (e.progress === 0) return 1;
        return 2;
      };
      return order(a) - order(b) || (b.lastActiveAt?.toMillis?.() || 0) - (a.lastActiveAt?.toMillis?.() || 0);
    });

  const stats = useMemo(() => ({
    total: enriched.length,
    inProgress: enriched.filter(e => e.progress > 0 && e.progress < 100).length,
    completed: enriched.filter(e => e.progress >= 100).length,
    notStarted: enriched.filter(e => e.progress === 0).length,
    totalLessons: enriched.reduce((s, e) => s + e.completedCount, 0),
    totalProgress: enriched.length ? Math.round(enriched.reduce((s, e) => s + e.progress, 0) / enriched.length) : 0
  }), [enriched]);

  if (!filter && enriched.length) {
    // Redirect to first filter if no filter selected but we have courses
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="card p-6">
              <div className="skeleton h-32 w-full mb-4" />
              <div className="skeleton h-4 w-3/4 mb-2" />
              <div className="skeleton h-3 w-1/2 mb-4" />
              <div className="skeleton h-4 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!enriched.length) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-12 text-center">
        <EmptyState title="No courses yet" hint="Browse the catalog and enroll in your first course to get started!" />
        <Link to="/" className="mt-4 btn-primary inline-block">Browse Catalog</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Courses</h1>
            <p className="text-sm text-slate-500 mt-1">{stats.total} course{stats.total !== 1 ? 's' : ''} enrolled</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="btn-ghost"><Filter size={16} className="mr-1" /> All Courses</Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{stats.inProgress}</p>
            <p className="text-xs text-slate-500">In Progress</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-slate-500">Completed</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-500">{stats.notStarted}</p>
            <p className="text-xs text-slate-500">Not Started</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{stats.totalLessons}</p>
            <p className="text-xs text-slate-500">Lessons Done</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search my courses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-10"
            aria-label="Search my courses"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'in-progress', 'completed', 'not-started'] as FilterTab[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`chip ${filter === f ? 'bg-indigo-600 text-white' : ''} flex items-center gap-1`}
            >
              {f === 'all' && <BookOpen size={14} />}
              {f === 'in-progress' && <Clock size={14} />}
              {f === 'completed' && <CheckCircle2 size={14} />}
              {f === 'not-started' && <Clock size={14} className="opacity-50" />}
              {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
            </button>
          ))}
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="chip flex items-center gap-1 text-red-600">
              <X size={14} /> Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(e => {
          const course = e.course;
          const isCompleted = e.progress >= 100;
          const isInProgress = e.progress > 0 && e.progress < 100;
          const nextLesson = e.lessons.find(l => !e.completedLessons?.includes(l.id)) || e.lessons[0];

          return (
            <Link key={e.courseId || e.id} to={`/learn/${e.courseId || e.id}`} className="card overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="relative">
                {course.thumbnail ? (
                  <img src={resolveThumb(course.thumbnail)} alt="" className="h-[208px] w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                ) : (
                  <div className="h-[208px] w-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white">
                    <span className="text-xl font-bold">{course.title.charAt(0)}</span>
                  </div>
                )}
                {/* Progress overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ProgressRing pct={e.progress} />
                      <span className="text-white font-semibold text-sm">{e.progress}%</span>
                    </div>
                    <span className="text-white/80 text-xs">
                      {e.completedCount}/{e.totalLessons} lessons
                    </span>
                  </div>
                </div>
                {/* Status badge */}
                <div className="absolute top-2 right-2">
                  {isCompleted ? (
                    <span className="chip bg-green-500 text-white"><CheckCircle2 size={12} className="mr-1" /> Completed</span>
                  ) : e.progress > 0 ? (
                    <span className="chip bg-amber-500 text-white"><Clock size={12} className="mr-1" /> In Progress</span>
                  ) : (
                    <span className="chip bg-slate-500 text-white">Not Started</span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">{course.title}</h3>
                <p className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                  <span className="flex items-center gap-1"><BookOpen size={12} /> {e.totalLessons} lessons</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {e.completedCount} done</span>
                </p>
                <p className="mt-2 text-xs text-slate-400">{course.topic || 'General'}</p>
                {e.lastActiveAt && (
                  <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={12} /> Last: {new Date(e.lastActiveAt.toMillis?.() || e.lastActiveAt).toLocaleDateString()}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    {isCompleted ? 'Review course' : e.progress > 0 ? 'Continue learning' : 'Start course'}
                  </span>
                  <ArrowRight size={16} className="text-indigo-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState title="No courses match your filter" hint="Try changing your filter or search term." />
      )}
    </div>
  );
}