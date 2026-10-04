import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import { Navbar, Footer } from './components/Shell';
import { ProtectedRoute, AdminRoute } from './components/Routes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SearchPalette } from './components/SearchPalette';
import { AnnouncementBanner } from './components/Banner';
import { initSentry } from './lib/sentry';
import { initAppCheck } from './lib/appcheck';
import { useSWUpdate } from './hooks/useSWUpdate';
import { useVersionCheck } from './hooks/useVersionCheck';
import type { Course, Lesson } from './types';
import Login from './pages/Login';
import Home from './pages/Home';
import CourseDetail from './pages/CourseDetail';
import Learn from './pages/Learn';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Paths from './pages/Paths';
import Metrics from './pages/Metrics';
import MyCourses from './pages/MyCourses';
import TagPage from './pages/TagPage';
import { StaticPage } from './pages/Static';

initSentry();

export default function App() {
  const [palette, setPalette] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  useSWUpdate();
  useVersionCheck();

  useEffect(() => { initAppCheck(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <HashRouter>
            <ErrorBoundary>
              <Navbar onSearch={() => setPalette(true)} />
              <AnnouncementBanner />
              <main className="min-h-[70vh]">
                <Routes>
                  <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
                  <Route path="/" element={<ErrorBoundary><Home lessonsByCourse={lessons as Record<string, Lesson[]>} setLessons={setLessons} /></ErrorBoundary>} />
                  <Route path="/course/:id" element={<ErrorBoundary><CourseDetail /></ErrorBoundary>} />
                  <Route path="/learn/:id" element={<ErrorBoundary><ProtectedRoute><Learn /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/admin" element={<ErrorBoundary><AdminRoute><Admin /></AdminRoute></ErrorBoundary>} />
                  <Route path="/profile" element={<ErrorBoundary><ProtectedRoute><Profile /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/metrics" element={<ErrorBoundary><ProtectedRoute><Metrics /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/my-courses" element={<ErrorBoundary><ProtectedRoute><MyCourses lessonsByCourse={lessons} /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/tag/:slug" element={<ErrorBoundary><TagPage /></ErrorBoundary>} />
                  <Route path="/paths" element={<ErrorBoundary><Paths /></ErrorBoundary>} />
                  <Route path="/privacy" element={<StaticPage kind="privacy" />} />
                  <Route path="/terms" element={<StaticPage kind="terms" />} />
                  <Route path="/disclaimer" element={<StaticPage kind="disclaimer" />} />
                  <Route path="/about" element={<StaticPage kind="about" />} />
                </Routes>
              </main>
              <Footer />
              <SearchPalette open={palette} close={() => setPalette(false)} courses={courses} lessonsByCourse={lessons} />
              {/* keep palette index fresh from Home via event */}
              <PaletteSync setCourses={setCourses} />
            </ErrorBoundary>
          </HashRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
function PaletteSync({ setCourses }: { setCourses: (c: Course[]) => void }) {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lh-courses');
      if (raw) setCourses(JSON.parse(raw).data ?? []);
    } catch { /* ignore */ }
    const t = setInterval(() => {
      try {
        const r = sessionStorage.getItem('lh-courses');
        if (r) setCourses(JSON.parse(r).data ?? []);
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(t);
  }, [setCourses]);
  return null;
}

function PwaUpdater() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFn, setUpdateFn] = useState<(() => void) | null>(null);
  useEffect(() => {
    import('virtual:pwa-register').then((m) => {
      m.registerSW({
        onNeedRefresh() { setNeedRefresh(true); },
        onRegisteredSW(_url: string, r?: ServiceWorkerRegistration) {
          setUpdateFn(() => () => r?.update?.());
          // check hourly
          setInterval(() => r?.update?.(), 3600_000);
        }
      });
    }).catch(() => {});
  }, []);
  if (!needRefresh) return null;
  return (
    <div className="fixed bottom-16 md:bottom-6 left-4 z-50 card px-4 py-2 text-sm shadow-lg flex items-center gap-2">
      <span>New version available.</span>
      <button className="btn-primary !py-1" onClick={() => { updateFn?.(); location.reload(); }}>Refresh</button>
    </div>
  );
}
