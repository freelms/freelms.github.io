import { useEffect } from 'react';

const COPY: Record<string, { title: string; body: string }> = {
  privacy: { title: 'Privacy', body: 'EDIT ME: explain what data you store (account, progress, notes), that videos are embedded from YouTube (Google privacy policy applies), and how to request deletion (Profile → Delete account).' },
  terms: { title: 'Terms', body: 'EDIT ME: free for personal learning, embedded videos belong to their creators, do not re-upload, takedown contact below.' },
  about: {
    title: 'About FreeLMS — Free Online Courses Platform',
    body: 'FreeLMS is a free online courses platform for everyone. We curate the best free video training from independent creators — web development, freelancing and digital skills — and wrap it in a real learning experience: enroll in seconds, track lesson-by-lesson progress, test yourself with quizzes and keep timestamped notes.\n\nEverything is free, with no ads and no fees. Videos play in the official YouTube player and every creator is credited with channel and original-video links. If you are a creator and want a video added or removed, contact us and we act fast.'
  },
  disclaimer: {
    title: 'Content Disclaimer — How FreeLMS Uses YouTube Videos',
    body: 'HOW WE SHOW VIDEOS\nWe do not download, copy, re-upload, edit or claim anyone\'s videos. Every lesson plays the original video through YouTube\'s official embedded player, streamed directly from YouTube\'s servers. What you watch here is the creator\'s own upload, on the creator\'s own channel.\n\nWHY THIS HELPS CREATORS (NOT HURTS THEM)\n• Every view counts: watching a lesson here registers as a view on the original YouTube video, exactly as if you watched it on YouTube.\n• Watch time and engagement flow to the creator\'s channel, supporting their growth and revenue.\n• Discovery: each lesson links the creator\'s channel and the original video, sending students to subscribe and explore more of their work.\n• Showcase, not theft: we act as a curated shelf that puts quality creators in front of motivated learners who would never have found them otherwise.\n\nWHAT STUDENTS GET\nYouTube is built for entertainment; FreeLMS is built for learning. The same free videos, reorganized into structured courses with a syllabus, progress tracking, quizzes, timestamped notes, timetables and discussion — so a scattered playlist becomes a complete course.\n\nWHAT WE NEVER DO\n• Never re-upload or mirror videos on our servers or any other platform.\n• Never strip, hide or replace creator credits, watermarks or branding.\n• Never charge for access to someone else\'s content and never place our own ads over it.\n• Never claim ownership of any video, thumbnail, title or description.\n\nFOR CREATORS: PERMISSION & TAKEDOWN\nWe feature creators to celebrate and amplify their work, and we always link back. If you are a creator and you want your video featured, credited differently, or removed — for any reason, no questions asked — email us from the address below and we will act within 48 hours. Use the "Report or takedown request" link on any course or video for the fastest response.\n\nIN SHORT\nStudents get a focused, free learning platform. Creators get views, subscribers and full credit. Good for both — that is the entire idea behind FreeLMS.\n\nThis page explains our approach in plain language and is not legal advice.'
  }
};

export function StaticPage({ kind }: { kind: 'privacy' | 'terms' | 'about' | 'disclaimer' }) {
  const c = COPY[kind];
  useEffect(() => { document.title = `${c.title} | FreeLMS`; }, [kind, c.title]);
  if (!c) return null;
  return (
    <div className="mx-auto max-w-2xl px-3 py-6">
      <div className="card p-6"><h1 className="font-bold">{c.title}</h1><p className="mt-2 text-sm whitespace-pre-wrap">{c.body}</p>
      <p className="mt-2 text-sm">Contact: {import.meta.env.VITE_CONTACT_EMAIL}</p></div>
    </div>
  );
}
