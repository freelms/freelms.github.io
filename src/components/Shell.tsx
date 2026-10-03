import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Moon, Sun, Home, BookOpen, ShieldCheck, User as UserIcon, LogOut, Flame, Search, BarChart2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { streakCount } from './streak';
import { TagNavigation, FooterCategories } from './TagNavigation';

export function Navbar({ onSearch }: { onSearch: () => void }) {
  const { user, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const nav = useNavigate();
  useEffect(() => {
    if (!db || !user) { setStreak(0); return; }
    getDoc(doc(db, 'users', user.uid)).then((s) => {
      const days: string[] = (s.data()?.streakDays ?? []) as string[];
      setStreak(streakCount(days));
    }).catch(() => {});
  }, [user]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur dark:bg-slate-950/90 dark:border-slate-800">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3">
        <Link to="/" className="flex items-center gap-2 font-bold" aria-label="FreeLMS home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white"><GraduationCap size={18} /></span>
          <span className="hidden sm:inline">FreeLMS</span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 text-sm md:flex">
          <Link to="/" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">Catalog</Link>
          <span className="hidden md:inline"><TagNavigation /></span>
          {user && <Link to="/my-courses" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">My Courses</Link>}
          {user && <Link to="/metrics" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">Metrics</Link>}
          {isAdmin && <Link to="/admin" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">Admin</Link>}
          <Link to="/paths" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">Paths</Link>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="md:hidden"><TagNavigation mobile /></span>
          {user && streak > 0 && (
            <span className="chip" title="Daily learning streak" aria-label={`${streak} day streak`}><Flame size={13} className="text-orange-500" />{streak}</span>
          )}
          <button onClick={onSearch} className="btn-ghost !px-2.5" aria-label="Search (Ctrl+K)"><Search size={17} /></button>
          <button onClick={toggle} className="btn-ghost !px-2.5" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {user ? (
            <div className="relative">
              <button onClick={() => setOpen((o) => !o)} aria-label="Profile menu" className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                {user.photoURL
                  ? <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" />
                  : <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 dark:bg-slate-800"><UserIcon size={15} /></span>}
              </button>
              {open && (
                <div className="card absolute right-0 mt-2 w-48 p-1.5 text-sm">
                  <Link to="/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><UserIcon size={15} /> Profile</Link>
                  {isAdmin && <Link to="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ShieldCheck size={15} /> Admin</Link>}
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={async () => { if (auth) await signOut(auth); nav('/'); }}
                  ><LogOut size={15} /> Logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-primary">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const { isAdmin, user } = useAuth();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:bg-slate-950/95 dark:border-slate-800 md:hidden" aria-label="Mobile">
      <div className="grid grid-cols-5 text-[11px]">
        <Link to="/" className="flex flex-col items-center gap-0.5 py-2"><Home size={18} />Home</Link>
        {user && <Link to="/my-courses" className="flex flex-col items-center gap-0.5 py-2"><BookOpen size={18} />My Courses</Link>}
        {user && <Link to="/metrics" className="flex flex-col items-center gap-0.5 py-2"><BarChart2 size={18} />Metrics</Link>}
        <Link to="/paths" className="flex flex-col items-center gap-0.5 py-2"><Flame size={18} />Paths</Link>
        {isAdmin
          ? <Link to="/admin" className="flex flex-col items-center gap-0.5 py-2"><ShieldCheck size={18} />Admin</Link>
          : <Link to="/profile" className="flex flex-col items-center gap-0.5 py-2"><UserIcon size={18} />Profile</Link>}
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="no-print mx-auto max-w-6xl px-3 pb-24 pt-8 text-center text-xs text-slate-500 md:pb-10">
      <p>Free for everyone. No ads. Video credits belong to their original creators.</p>
      <FooterCategories />
      <p className="mt-1 flex flex-wrap justify-center gap-3">
        <Link to="/about" className="underline">About</Link>
        <Link to="/privacy" className="underline">Privacy</Link>
        <Link to="/terms" className="underline">Terms</Link>
      </p>
    </footer>
  );
}
