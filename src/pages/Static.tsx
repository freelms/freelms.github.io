const COPY: Record<string, { title: string; body: string }> = {
  privacy: { title: 'Privacy', body: 'EDIT ME: explain what data you store (account, progress, notes), that videos are embedded from YouTube (Google privacy policy applies), and how to request deletion (Profile → Delete account).' },
  terms: { title: 'Terms', body: 'EDIT ME: free for personal learning, embedded videos belong to their creators, do not re-upload, takedown contact below.' },
  about: { title: 'About LearnHub', body: 'LearnHub is a free, ad-free training platform. Videos are embedded from their original creators — please support them directly.' }
};

export function StaticPage({ kind }: { kind: 'privacy' | 'terms' | 'about' }) {
  const c = COPY[kind];
  return (
    <div className="mx-auto max-w-2xl px-3 py-6">
      <div className="card p-6"><h1 className="font-bold">{c.title}</h1><p className="mt-2 text-sm whitespace-pre-wrap">{c.body}</p>
      <p className="mt-2 text-sm">Contact: {import.meta.env.VITE_CONTACT_EMAIL}</p></div>
    </div>
  );
}
