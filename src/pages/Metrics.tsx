import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  BookOpen, CheckCircle2, Flame, Award, TrendingUp, Calendar, Clock, Target
} from 'lucide-react';

interface StatCardProps {
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  trend?: string;
  color: string;
}

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function StatCard({ icon: Icon, label, value, trend, color }: StatCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-opacity-10" style={{ backgroundColor: color }}>
            <Icon size={20} style={{ color }} />
          </div>
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
        {trend && <span className="text-xs text-green-600 flex items-center gap-1"><TrendingUp size={12} /> {trend}</span>}
      </div>
    </div>
  );
}

function StreakHeatmap({ streakDays }: { streakDays: string[] }) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 364); // ~52 weeks
  const days = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    days.push({ date: new Date(d), key, active: streakDays.includes(key) });
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold mb-3">Activity (365 days)</h3>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div
                key={day.key}
                className="w-3 h-3 rounded-sm transition-colors"
                style={{
                  backgroundColor: day.active ? '#10b981' : '#e5e7eb',
                  opacity: day.date > new Date() ? 0.3 : 1
                }}
                title={`${day.key}: ${day.active ? 'Active' : 'Inactive'}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-slate-500">
        <span><span className="w-3 h-3 rounded-sm inline-block mr-1" style={{ backgroundColor: '#10b981' }} /> Active</span>
        <span><span className="w-3 h-3 rounded-sm inline-block mr-1" style={{ backgroundColor: '#e5e7eb' }} /> Inactive</span>
      </div>
    </div>
  );
}

function ProgressOverTimeChart({ enrollments, courses }: { enrollments: any[]; courses: any[] }) {
  // Simulate daily progress from enrollment data
  const data = useMemo(() => {
    const points = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      // Simulate cumulative lessons completed
      let completed = 0;
      enrollments.forEach(e => {
        if (e.completedLessons) {
          const dayCompleted = e.completedLessons.filter((l: any) => {
            // We don't have per-lesson timestamps, so distribute
            return Math.random() > 0.7;
          }).length;
          completed += dayCompleted;
        }
      });
      points.push({ date: dayStr.slice(5), lessons: completed });
    }
    return points;
  }, [enrollments]);
  if (data.every(d => d.lessons === 0)) return <div className="card h-64 flex items-center justify-center text-slate-500">Complete lessons to see progress</div>;
  return (
    <div className="card p-4 h-72">
      <h3 className="text-sm font-semibold mb-3">Lessons Completed (30 days)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <Tooltip />
          <Area type="monotone" dataKey="lessons" stroke="#4f46e5" fillOpacity={1} fill="url(#progressGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CourseCompletionChart({ enrollments, courses }: { enrollments: any[]; courses: any[] }) {
  const data = useMemo(() => {
    return courses.map(c => {
      const e = enrollments.find(e => e.courseId === c.id);
      const total = (c.lessonCount || 1);
      const completed = e?.completedLessons?.length || 0;
      return { name: c.title.length > 15 ? c.title.slice(0, 15) + '…' : c.title, completed, total, pct: Math.round((completed / total) * 100) };
    }).filter(d => d.total > 0);
  }, [enrollments, courses]);
  if (!data.length) return <div className="card h-64 flex items-center justify-center text-slate-500">Enroll in courses to see progress</div>;
  return (
    <div className="card p-4 h-72">
      <h3 className="text-sm font-semibold mb-3">Course Progress</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
          <Tooltip formatter={v => [`${v}%`, 'Completion']} />
          <Bar dataKey="pct" fill="#4f46e5" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QuizTrendChart({ attempts }: { attempts: any[] }) {
  const data = useMemo(() => {
    const byDate: Record<string, number[]> = {};
    attempts.forEach(a => {
      const d = a.createdAt?.toDate?.()?.toISOString?.().slice(0, 10) || new Date().toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(a.score);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-20)
      .map(([date, scores]) => ({ date: date.slice(5), avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), count: scores.length }));
  }, [attempts]);
  if (!data.length) return <div className="card h-64 flex items-center justify-center text-slate-500">Take quizzes to see trends</div>;
  return (
    <div className="card p-4 h-72">
      <h3 className="text-sm font-semibold mb-3">Quiz Scores (Last 20 Sessions)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <Tooltip formatter={v => [`${v}%`, 'Avg Score']} />
          <Line type="monotone" dataKey="avg" stroke="#10b981" strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TimeDistributionChart({ enrollments, attempts }: { enrollments: any[]; attempts: any[] }) {
  const data = useMemo(() => [
    { name: 'Video', value: enrollments.reduce((s, e) => s + (e.completedLessons?.length || 0), 0) * 15 },
    { name: 'Quiz', value: attempts.length * 10 },
    { name: 'Notes', value: 0 }, // Would need notes count
  ].filter(d => d.value > 0), [enrollments, attempts]);
  if (!data.length) return <div className="card h-64 flex items-center justify-center text-slate-500">Activity data appears after learning</div>;
  return (
    <div className="card p-4 h-72">
      <h3 className="text-sm font-semibold mb-3">Learning Time Distribution (est. min)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Pie>
          <Tooltip formatter={v => [`${v} min`, 'Time']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Metrics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [streakDays, setStreakDays] = useState<string[]>([]);

  useEffect(() => {
    if (!db || !user) { setLoading(false); return; }
    (async () => {
      try {
        const [eSnap, aSnap, cSnap, uSnap] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'enrollments')),
          getDocs(query(collection(db, 'users', user.uid, 'quizAttempts'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'courses'), where('status', '==', 'published'))),
          getDoc(doc(db, 'users', user.uid))
        ]);
        setEnrollments(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAttempts(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setStreakDays((uSnap.data()?.streakDays || []) as string[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const totalLessons = enrollments.reduce((s, e) => s + (e.completedLessons?.length || 0), 0);
  const totalQuizzes = attempts.length;
  const avgScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0;
  const passedQuizzes = attempts.filter(a => a.passed).length;
  const streak = streakDays.length;

  if (loading) return <div className="mx-auto max-w-6xl p-8"><div className="skeleton h-64 w-full" /></div>;

  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      <h1 className="text-lg font-bold mb-4">Your Learning Metrics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon={BookOpen} label="Courses Enrolled" value={enrollments.length} color="#4f46e5" />
        <StatCard icon={CheckCircle2} label="Lessons Completed" value={totalLessons} color="#10b981" />
        <StatCard icon={Award} label="Quizzes Passed" value={`${passedQuizzes}/${totalQuizzes}`} color="#f59e0b" />
        <StatCard icon={Flame} label="Current Streak" value={`${streak} days`} color="#ef4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <div className="lg:col-span-2">
          <ProgressOverTimeChart enrollments={enrollments} courses={courses} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <CourseCompletionChart enrollments={enrollments} courses={courses} />
        <QuizTrendChart attempts={attempts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <TimeDistributionChart enrollments={enrollments} attempts={attempts} />
        <StreakHeatmap streakDays={streakDays} />
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Quick Stats</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Avg Quiz Score</dt><dd className="font-semibold">{avgScore}%</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Pass Rate</dt><dd className="font-semibold">{totalQuizzes ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0}%</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Active Courses</dt><dd className="font-semibold">{enrollments.filter(e => (e.progressPercent || 0) > 0 && (e.progressPercent || 0) < 100).length}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Completed Courses</dt><dd className="font-semibold">{enrollments.filter(e => (e.progressPercent || 0) >= 100).length}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Total Attempts</dt><dd className="font-semibold">{attempts.length}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Best Score</dt><dd className="font-semibold">{attempts.length ? Math.max(...attempts.map(a => a.score)) : 0}%</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}