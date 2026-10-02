export function SkeletonCard() {
  return <div className="card p-3"><div className="skeleton h-28 w-full" /><div className="skeleton mt-3 h-4 w-3/4" /><div className="skeleton mt-2 h-3 w-1/2" /></div>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function ProgressRing({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-12 w-12 place-items-center" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-slate-200 dark:stroke-slate-800" />
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-indigo-600"
          strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, pct)) / 100} />
      </svg>
      <span className="absolute text-[10px] font-semibold">{Math.round(pct)}%</span>
    </div>
  );
}
