import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../hooks/useToast';
import { AsyncButton } from './AsyncButton';

const OWNER = 'freelms';
const REPO = 'freelms.github.io';
const WORKFLOW = 'pages.yml';

interface SiteStatus {
  timestamp?: string;
  coursesCount?: number;
}

/**
 * Admin maintenance: shows last site build (from version.json) and triggers
 * a full Pages rebuild (vite + prerender + sitemap) via workflow_dispatch.
 * Needs a one-time GitHub token (repo → Settings → Developer settings →
 * Personal access tokens → Tokens (classic) with `repo` + `workflow` scopes)
 * saved below — stored in admin-only Firestore config, never in code.
 */
export function RebuildSite() {
  const { push } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!db) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'deploy'));
        if (snap.exists()) setToken((snap.data() as any).githubToken ?? null);
      } catch {
        /* config may not exist yet */
      } finally {
        setLoaded(true);
      }
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?v=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) setStatus(await res.json());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const saveToken = async () => {
    if (!db || !input.trim()) return;
    await setDoc(doc(db, 'config', 'deploy'), { githubToken: input.trim(), updatedAt: new Date() }, { merge: true });
    setToken(input.trim());
    setInput('');
    push('Deploy token saved');
  };

  const rebuild = async () => {
    if (!token) return;
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref: 'main' })
      }
    );
    if (res.status === 204) {
      push('Rebuild started — sitemap + snapshots live in ~2–3 min');
    } else if (res.status === 401 || res.status === 403) {
      push('Token rejected — check scopes (repo + workflow) and expiry');
    } else {
      push(`Rebuild failed (HTTP ${res.status})`);
    }
  };

  if (!loaded) return null;

  return (
    <div className="card mt-2 flex flex-wrap items-center gap-2 p-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Site build (SEO snapshots + sitemap)</p>
        <p className="text-xs text-slate-500">
          {status?.timestamp
            ? `Last build ${new Date(status.timestamp).toLocaleString()} · ${status.coursesCount ?? '?'} courses prerendered`
            : 'Last build unknown — rebuild once to stamp it'}
        </p>
      </div>
      {token ? (
        <AsyncButton className="btn-primary !py-1.5 text-xs" onPress={rebuild}>
          🚀 Rebuild site now
        </AsyncButton>
      ) : (
        <div className="flex w-full gap-2">
          <input
            className="input"
            type="password"
            placeholder="Paste GitHub token (repo + workflow scopes), one-time setup"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="GitHub deploy token"
          />
          <AsyncButton className="btn-primary shrink-0 !py-1.5 text-xs" onPress={saveToken}>
            Save token
          </AsyncButton>
        </div>
      )}
    </div>
  );
}
