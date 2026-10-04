import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, Moon, Sun, Home, BookOpen, ShieldCheck, User as UserIcon, LogOut, Flame, Search, BarChart2, Menu, X, FileText } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { streakCount } from './streak';
import { TagNavigation, FooterCategories } from './TagNavigation';
import { fetchMenuTags } from '../lib/tags';

export function Navbar({ onSearch }: { onSearch: () => void }) {
  const { user, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
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
    <>
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur dark:bg-slate-950/90 dark:border-slate-800">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3">
        <button className="btn-ghost !px-2.5 md:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
          <Menu size={18} />
        </button>
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
                  <Link to="/disclaimer" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><FileText size={15} /> Disclaimer</Link>
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
    <MobileDrawer open={drawer} close={() => setDrawer(false)} />
    </>
  );
}

function DrawerCategories({ close }: { close: () => void }) {
  const [cats, setCats] = useState<{ slug: string; name: string; courseCount?: number }[]>([]);
  useEffect(() => {
    fetchMenuTags(db)
      .then((list) => setCats(list.filter((t) => !t.parentSlug).map((t) => ({ slug: t.slug, name: t.name, courseCount: t.courseCount }))))
      .catch(() => {});
  }, []);
  if (!cats.length) return null;
  return (
    <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Categories</p>
      {cats.slice(0, 8).map((c) => (
        <Link
          key={c.slug}
          to={`/tag/${c.slug}`}
          onClick={close}
          className="flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <span>{c.name}</span>
          <span className="text-xs text-slate-400">{c.courseCount ?? 0}</span>
        </Link>
      ))}
    </div>
  );
}

export function MobileDrawer({ open, close }: { open: boolean; close: () => void }) {
  const { user, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (open) {
      window.addEventListener('keydown', h);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  const links = [
    { to: '/', label: 'Catalog', icon: Home, show: true },
    { to: '/my-courses', label: 'My Courses', icon: BookOpen, show: !!user },
    { to: '/metrics', label: 'Metrics', icon: BarChart2, show: !!user },
    { to: '/paths', label: 'Paths', icon: Flame, show: true },
    { to: '/disclaimer', label: 'Disclaimer', icon: FileText, show: true },
    { to: '/admin', label: 'Admin', icon: ShieldCheck, show: isAdmin },
    { to: '/profile', label: 'Profile', icon: UserIcon, show: !!user }
  ].filter((l) => l.show);

  return (
    <div className={`fixed inset-0 z-50 md:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />
      <aside
        role="dialog"
        aria-label="Menu"
        className={`absolute left-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-300 dark:bg-slate-950 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-slate-800">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white"><GraduationCap size={18} /></span>
          <span className="font-bold">FreeLMS</span>
          <button className="ml-auto rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={close} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        {user && (
          <div className="flex items-center gap-2.5 border-b border-slate-200 p-4 dark:border-slate-800">
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full" />
              : <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 dark:bg-slate-800"><UserIcon size={17} /></span>}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.displayName ?? user.email}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Mobile">
          {links.map((l) => {
            const active = loc.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                onClick={close}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                aria-current={active ? 'page' : undefined}
              >
                <l.icon size={18} /> {l.label}
              </Link>
            );
          })}
          {!user && (
            <Link to="/login" onClick={close} className="btn-primary mt-2 w-full">Sign in</Link>
          )}
          <DrawerCategories close={close} />
        </nav>
        <div className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
          <button onClick={toggle} className="btn-ghost flex-1 !py-2 text-sm" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {user && (
            <button
              className="btn-ghost flex-1 !py-2 text-sm"
              onClick={async () => { if (auth) await signOut(auth); close(); nav('/'); }}
            >
              <LogOut size={16} /> Logout
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="no-print mx-auto max-w-6xl px-3 pb-10 pt-8 text-center text-xs text-slate-500">
      <p><strong>FreeLMS GitHub</strong> — free for everyone. No ads. Video credits belong to their original creators.</p>
      <FooterCategories />
      <p className="mt-1 flex flex-wrap justify-center gap-3">
        <Link to="/about" className="underline">About</Link>
        <Link to="/disclaimer" className="underline">Disclaimer</Link>
        <Link to="/privacy" className="underline">Privacy</Link>
        <Link to="/terms" className="underline">Terms</Link>
      </p>
    </footer>
  );
}
