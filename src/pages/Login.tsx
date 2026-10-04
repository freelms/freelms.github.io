import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification
} from 'firebase/auth';
import { auth, hasFirebaseConfig } from '../lib/firebase';
import { useToast } from '../hooks/useToast';

function friendly(e: any): string {
  const c = String(e?.code ?? '');
  if (c.includes('invalid-credential') || c.includes('wrong-password')) return 'Wrong email or password.';
  if (c.includes('email-already-in-use')) return 'Email already in use. Try signing in.';
  if (c.includes('weak-password')) return 'Password should be at least 6 characters.';
  if (c.includes('invalid-email')) return 'Enter a valid email address.';
  if (c.includes('popup-closed')) return 'Sign-in popup closed. Try again.';
  return 'Something went wrong. Please try again.';
}

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation() as any;
  const { push } = useToast();
  const from = loc.state?.from ?? '/';

  if (!hasFirebaseConfig) {
    return <div className="card mx-auto mt-10 max-w-md p-6 text-sm">Firebase is not configured. Copy <code>.env.example</code> to <code>.env</code> and fill in your Firebase web config, then restart. See README.</div>;
  }

  const done = () => nav(from, { replace: true });

  return (
    <div className="mx-auto mt-10 max-w-md px-3">
      <div className="card p-6">
        <h1 className="text-lg font-bold">Welcome to FreeLMS</h1>
        <p className="text-sm text-slate-500">Free training for everyone.</p>
        <button className="btn-ghost mt-4 w-full" disabled={busy} onClick={async () => {
          setBusy(true); setErr('');
          try {
            await signInWithPopup(auth, new GoogleAuthProvider());
            push('Signed in');
            import('../lib/analytics').then((m) => m.trackEvent('login', { method: 'google' })).catch(() => {});
            done();
          } catch (e: any) { setErr(friendly(e)); } finally { setBusy(false); }
        }}>Continue with Google</button>
        <div className="my-4 text-center text-xs text-slate-400">or with email</div>
        <div className="mb-3 flex rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
          <button className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'in' ? 'bg-white shadow dark:bg-slate-900' : ''}`} onClick={() => setMode('in')}>Sign in</button>
          <button className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'up' ? 'bg-white shadow dark:bg-slate-900' : ''}`} onClick={() => setMode('up')}>Sign up</button>
        </div>
        <form className="grid gap-2" onSubmit={async (e) => {
          e.preventDefault();
          if (!email.includes('@')) { setErr('Enter a valid email address.'); return; }
          if (pw.length < 6) { setErr('Password should be at least 6 characters.'); return; }
          setBusy(true); setErr('');
          try {
            if (mode === 'in') await signInWithEmailAndPassword(auth, email, pw);
            else {
              const cred = await createUserWithEmailAndPassword(auth, email, pw);
              await sendEmailVerification(cred.user);
              push('Verification email sent');
            }
            push('Signed in');
            import('../lib/analytics').then((m) => m.trackEvent('login', { method: 'email' })).catch(() => {});
            done();
          } catch (e: any) { setErr(friendly(e)); } finally { setBusy(false); }
        }}>
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <input className="input" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" />
          {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="mt-2 text-xs underline text-slate-500" onClick={async () => {
          if (!email) { setErr('Enter your email first.'); return; }
          await sendPasswordResetEmail(auth, email);
          push('Password reset email sent');
        }}>Forgot password?</button>
        <p className="mt-3 text-xs text-slate-500"><Link to="/" className="underline">← Back to catalog</Link></p>
      </div>
    </div>
  );
}
