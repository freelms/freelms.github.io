import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

function dayKey(ts: any): string {
  try {
    const d = ts?.toDate?.() ?? new Date(ts);
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function TrafficTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!db) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'pageviews'), orderBy('ts', 'desc'), limit(1000)));
        setRows(snap.docs.map((d) => d.data() as any));
        const cs = await getDocs(collection(db, 'courses'));
        const m: Record<string, string> = {};
        cs.docs.forEach((d) => { m[d.id] = (d.data() as any).title ?? d.id; });
        setTitles(m);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cutoff = useMemo(() => Date.now() - days * 864e5, [days]);
  const inRange = useMemo(
    () => rows.filter((r) => (r.ts?.toMillis?.() ?? 0) >= cutoff),
    [rows, cutoff]
  );

  const stats = useMemo(() => {
    const uids = new Set<string>();
    let anon = 0;
    const byPath = new Map<string, number>();
    const byCourse = new Map<string, number>();
    const byDay = new Map<string, number>();
    for (const r of inRange) {
      if (r.uid) uids.add(r.uid);
      else anon++;
      byPath.set(r.path, (byPath.get(r.path) ?? 0) + 1);
      if (r.courseId) byCourse.set(r.courseId, (byCourse.get(r.courseId) ?? 0) + 1);
      const k = dayKey(r.ts);
      if (k) byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
    const daysArr: { day: string; n: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const k = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      daysArr.push({ day: k.slice(5), n: byDay.get(k) ?? 0 });
    }
    return {
      views: inRange.length,
      users: uids.size,
      anon,
      byPath: [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
      byCourse: [...byCourse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
      daysArr
    };
  }, [inRange, days]);

  const [Chart, setChart] = useState<any>(null);
  useEffect(() => {
    import('recharts').then((m) =>
      setChart(() => (props: any) => (
        <m.ResponsiveContainer width="100%" height={200}>
          <m.AreaChart data={props.data}>
            <m.XAxis dataKey="day" interval={Math.max(0, Math.floor(props.data.length / 10))} tick={{ fontSize: 10 }} />
            <m.YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <m.Tooltip />
            <m.Area type="monotone" dataKey="n" stroke="#4f46e5" fill="#4f46e522" strokeWidth={2} />
          </m.AreaChart>
        </m.ResponsiveContainer>
      ))
    );
  }, []);

  if (loading) return <div className="card p-6"><div className="skeleton h-40 w-full" /></div>;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Traffic</h2>
        <select className="input !w-auto !py-1 text-xs" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Range">
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <span className="text-xs text-slate-500">from on-site beacons (1 view per page per visit)</span>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="card p-3"><p className="text-xs text-slate-500">Pageviews</p><p className="text-xl font-bold">{stats.views}</p></div>
        <div className="card p-3"><p className="text-xs text-slate-500">Signed-in users</p><p className="text-xl font-bold">{stats.users}</p></div>
        <div className="card p-3"><p className="text-xs text-slate-500">Guest views</p><p className="text-xl font-bold">{stats.anon}</p></div>
        <div className="card p-3"><p className="text-xs text-slate-500">Top course views</p><p className="text-xl font-bold">{stats.byCourse[0]?.[1] ?? 0}</p></div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold">Views per day</h3>
        {Chart ? <Chart data={stats.daysArr} /> : <div className="skeleton h-[200px] w-full" />}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="font-semibold">Top pages</h3>
          <table className="mt-2 w-full text-left">
            <thead><tr className="text-xs text-slate-500"><th>Page</th><th className="text-right">Views</th></tr></thead>
            <tbody>
              {stats.byPath.map(([p, n]) => (
                <tr key={p} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="max-w-[220px] truncate font-mono text-xs">{p}</td>
                  <td className="text-right font-bold">{n}</td>
                </tr>
              ))}
              {stats.byPath.length === 0 && <tr><td className="py-2 text-slate-500">No traffic in range yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold">Top courses</h3>
          <table className="mt-2 w-full text-left">
            <thead><tr className="text-xs text-slate-500"><th>Course</th><th className="text-right">Views</th></tr></thead>
            <tbody>
              {stats.byCourse.map(([id, n]) => (
                <tr key={id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="max-w-[220px] truncate">{titles[id] ?? id}</td>
                  <td className="text-right font-bold">{n}</td>
                </tr>
              ))}
              {stats.byCourse.length === 0 && <tr><td className="py-2 text-slate-500">No course views yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
