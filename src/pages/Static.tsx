import { useEffect } from 'react';

const COPY: Record<string, { title: string; body: string }> = {
  privacy: { title: 'Privacy', body: 'EDIT ME: explain what data you store (account, progress, notes), that videos are embedded from YouTube (Google privacy policy applies), and how to request deletion (Profile → Delete account).' },
  terms: { title: 'Terms', body: 'EDIT ME: free for personal learning, embedded videos belong to their creators, do not re-upload, takedown contact below.' },
  about: {
    title: 'About FreeLMS — Free Online Courses Platform',
    body: 'FreeLMS is a free online courses platform for everyone. We curate the best free video training from independent creators — web development, freelancing and digital skills — and wrap it in a real learning experience: enroll in seconds, track lesson-by-lesson progress, test yourself with quizzes and keep timestamped notes.\n\nEverything is free, with no ads and no fees. Videos play in the official YouTube player and every creator is credited with channel and original-video links. If you are a creator and want a video added or removed, contact us and we act fast.'
  }
};

export function StaticPage({ kind }: { kind: 'privacy' | 'terms' | 'about' }) {
  const c = COPY[kind];
  useEffect(() => { document.title = `${c.title} | FreeLMS`; }, [kind]);
  return (
    <div className="mx-auto max-w-2xl px-3 py-6">
      <div className="card p-6"><h1 className="font-bold">{c.title}</h1><p className="mt-2 text-sm whitespace-pre-wrap">{c.body}</p>
      <p className="mt-2 text-sm">Contact: {import.meta.env.VITE_CONTACT_EMAIL}</p></div>
    </div>
  );
}
