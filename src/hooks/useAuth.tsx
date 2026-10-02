import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, hasFirebaseConfig } from '../lib/firebase';

interface AuthCtx {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, isAdmin: false, loading: true });

// Simple admin check: anyone signing in with this Google account is admin.
export const ADMIN_EMAILS = ['shariqq.com@gmail.com'];
export const isAdminEmail = (email?: string | null) =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase());

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && db) {
        // ensure users/{uid} doc
        try {
          const ref = doc(db, 'users', u.uid);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            await setDoc(ref, {
              name: u.displayName ?? '',
              email: u.email ?? '',
              photo: u.photoURL ?? '',
              createdAt: serverTimestamp()
            });
          } else if ((snap.data() as any)?.status === 'disabled' && !isAdminEmail(u.email)) {
            // Enforce disabled accounts: sign out immediately.
            const { signOut } = await import('firebase/auth');
            await signOut(auth);
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
            return;
          }
          const adminSnap = await getDoc(doc(db, 'admins', u.uid));
          setIsAdmin(isAdminEmail(u.email) || adminSnap.exists());
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  return <Ctx.Provider value={{ user, isAdmin, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
