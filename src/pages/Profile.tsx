import { useEffect, useState } from 'react';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { streakCount } from '../components/streak';

export default function Profile() {
  const { user } = useAuth();
  const { push } = useToast();
  const [name, setName] = useState(user?.displayName ?? '');
  const [photo, setPhoto] = useState(user?.photoURL ?? '');
  const [stats, setStats] = useState({ enrolled: 0, done: 0, passed: 0, streak: 0, badges: [] as string[] });
  const [pw, setPw] = useState('');

  useEffect(() => {
    if (!db || !user) return;
    (async () => {
      const es = await getDocs(collection(db, 'users', user.uid, 'enrollments'));
      let done = 0;
      es.docs.forEach((d) => { done += ((d.data() as any).completedLessons ?? []).length; });
      const at = await getDocs(collection(db, 'users', user.uid, 'quizAttempts'));
      const passed = at.docs.filter((d) => (d.data() as any).passed).length;
      const prof = await getDoc(doc(db, 'users', user.uid));
      const days: string[] = (prof.data()?.streakDays ?? []);
      const badges: string[] = [];
      if (done >= 1) badges.push('First lesson');
      if (passed >= 1) badges.push('First quiz passed');
      if (streakCount(days) >= 7) badges.push('7-day streak');
      const completedCourses = es.docs.filter((d) => (d.data() as any).completedAt || ((d.data() as any).progressPercent ?? 0) >= 100).length;
      if (completedCourses >= 1) badges.push('First course completed');
      setStats({ enrolled: es.size, done, passed, streak: streakCount(days), badges });
    })();
  }, [user]);

  if (!user) return null;
  const emailUser = user.providerData.some((p) => p.providerId === 'password');

  return (
    <div className="mx-auto max-w-xl px-3 py-4">
      {!user.emailVerified && emailUser && <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">Please verify your email. <button className="underline" onClick={async () => { const { sendEmailVerification } = await import('firebase/auth'); await sendEmailVerification(user); push('Verification sent'); }}>Resend</button></div>}
      <div className="card p-4">
        <h1 className="font-bold">Profile</h1>
        <div className="mt-2 grid gap-2 text-sm">
          {user.photoURL && <img src={user.photoURL} alt="avatar" className="h-14 w-14 rounded-full" />}
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Display name" />
          <input className="input" value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="Photo URL" aria-label="Photo URL" />
          <button className="btn-primary" onClick={async () => { if (auth?.currentUser) { await updateProfile(auth.currentUser, { displayName: name, photoURL: photo || null }); push('Saved'); } }}>Save profile</button>
          <InstallButton />
          {emailUser && (
            <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (auth?.currentUser) { await updatePassword(auth.currentUser, pw); push('Password changed'); setPw(''); } }}>
              <input className="input" type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="New password" />
              <button className="btn-ghost">Change</button>
            </form>
          )}
        </div>
      </div>
      <div className="card mt-3 grid grid-cols-2 gap-2 p-4 text-sm">
        <div>Enrolled: <b>{stats.enrolled}</b></div>
        <div>Lessons done: <b>{stats.done}</b></div>
        <div>Quizzes passed: <b>{stats.passed}</b></div>
        <div>Streak: <b>🔥 {stats.streak}d</b></div>
        <div className="col-span-2">Badges: {stats.badges.length ? stats.badges.join(' · ') : '—'}</div>
      </div>
      <details className="card mt-3 p-4 text-sm">
        <summary className="cursor-pointer font-medium text-red-600">Delete account…</summary>
        <DeleteAccount />
      </details>
    </div>
  );
}

function InstallButton() {
  const [evt, setEvt] = useState<any>(null);
  useEffect(() => {
    const h = (e: any) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (!evt) return null;
  return <button className="btn-ghost" onClick={async () => { evt.prompt(); setEvt(null); }}>Install app</button>;
}

function DeleteAccount() {
  const { user } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  return (
    <form className="mt-2 grid gap-2" onSubmit={async (e) => {
      e.preventDefault();
      if (confirm !== 'DELETE' || !user || !auth?.currentUser || !db) return;
      try {
        if (user.providerData.some((p) => p.providerId === 'password')) {
          const cred = EmailAuthProvider.credential(user.email!, pw);
          await reauthenticateWithCredential(auth.currentUser, cred);
        }
        for (const sub of ['enrollments', 'quizAttempts', 'notes', 'bookmarks']) {
          const s = await getDocs(collection(db, 'users', user.uid, sub));
          for (const d of s.docs) await deleteDoc(d.ref);
        }
        await deleteDoc(doc(db, 'users', user.uid));
        await deleteUser(auth.currentUser);
        location.hash = '#/';
      } catch (err: any) { alert(err.message); }
    }}>
      <p className="text-slate-500">Deletes profile, enrollments, notes, attempts and your login. Type DELETE to confirm.</p>
      <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" aria-label="Confirm" />
      <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password (email accounts)" aria-label="Password" />
      <button className="btn-primary !bg-red-600">Delete everything</button>
    </form>
  );
}
