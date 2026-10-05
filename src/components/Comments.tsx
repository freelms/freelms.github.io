import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AsyncButton } from './AsyncButton';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

export function LessonComments({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { user, isAdmin } = useAuth();
  const { push } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [muted, setMuted] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const perPage = 20;
  const byId = new Map(items.map((c) => [c.id, c]));

  useEffect(() => {
    if (!db || !user) return;
    getDoc(doc(db, 'users', user.uid)).then((s) => setMuted((s.data() as any)?.commenting === 'off')).catch(() => {});
  }, [user]);

  const reload = async () => {
    if (!db) return;
    const snap = await getDocs(
      query(collection(db, 'comments'), where('courseId', '==', courseId), where('lessonId', '==', lessonId), orderBy('createdAt', 'desc'), limit(perPage * page))
    );
    setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((c) => !c.hidden || isAdmin));
  };
  useEffect(() => { setPage(1); }, [lessonId]);
  useEffect(() => { reload(); }, [courseId, lessonId, page]);

  return (
    <div className="card mt-3 p-3">
      <h3 className="text-sm font-semibold">Discussion</h3>
      {muted && <p className="mt-2 text-sm text-red-600">You are muted from commenting. Contact support.</p>}
      {!muted && (
      <form className="mt-2 flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <input className="input" placeholder="Ask a question… (max 1000 chars)" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} aria-label="Comment" />
        <AsyncButton className="btn-primary" onPress={async () => {
          if (!db || !user || text.trim().length === 0 || text.length > 1000) return;
          await addDoc(collection(db, 'comments'), {
            courseId, lessonId, uid: user.uid, displayName: user.displayName ?? user.email,
            ...(isAdmin ? { authorRole: 'admin' } : {}),
            text: text.trim(), createdAt: serverTimestamp(), reported: false, hidden: false
          });
          setText('');
          reload();
          push('Posted');
        }}>Post</AsyncButton>
      </form>
      )}
      <div className="mt-2 space-y-2 text-sm">
        {items.map((c) => (
          <div key={c.id} className={`rounded-lg border p-2 ${c.authorRole === 'admin' ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-800'}`}>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              {c.displayName}
              {c.authorRole === 'admin' && <span className="rounded-full bg-indigo-600 px-1.5 py-px text-[10px] font-bold text-white">Instructor</span>}
              {c.reported && isAdmin && <span className="chip">reported</span>}
            </p>
            {c.replyTo && byId.get(c.replyTo) && (
              <blockquote className="mt-1 border-l-2 border-slate-300 pl-2 text-xs italic text-slate-500">
                {String(byId.get(c.replyTo).text).slice(0, 140)}
              </blockquote>
            )}
            {editingId === c.id ? (
              <form className="mt-1 flex gap-2" onSubmit={async (e) => {
                e.preventDefault();
                if (!db || editText.trim().length === 0) return;
                await updateDoc(doc(db, 'comments', c.id), { text: editText.trim() });
                setEditingId(null); reload();
              }}>
                <input className="input" value={editText} maxLength={1000} onChange={(e) => setEditText(e.target.value)} aria-label="Edit comment" />
                <button className="btn-primary !py-1">Save</button>
                <button type="button" className="btn-ghost !py-1" onClick={() => setEditingId(null)}>Cancel</button>
              </form>
            ) : (
              <p className="whitespace-pre-wrap">{c.text}</p>
            )}
            <div className="mt-1 flex gap-2 text-xs">
              {c.uid === user?.uid && (
                <button className="underline" onClick={() => { setEditingId(c.id); setEditText(c.text); }}>Edit</button>
              )}
              {(c.uid === user?.uid || isAdmin) && (
                <button className="underline text-red-600" onClick={async () => { if (db && confirm('Delete?')) { await deleteDoc(doc(db, 'comments', c.id)); reload(); } }}>Delete</button>
              )}
              <button className="underline" onClick={async () => { if (db) { await updateDoc(doc(db, 'comments', c.id), { reported: true }); push('Reported'); } }}>Report</button>
              {isAdmin && <button className="underline" onClick={async () => { if (db) { await updateDoc(doc(db, 'comments', c.id), { hidden: !c.hidden }); reload(); } }}>{c.hidden ? 'Unhide' : 'Hide'}</button>}
              {(isAdmin || c.uid !== user?.uid) && (
                <button className="font-medium text-indigo-600" onClick={() => { setReplyId(replyId === c.id ? null : c.id); setReplyText(''); }}>
                  {replyId === c.id ? 'Cancel reply' : 'Reply'}
                </button>
              )}
            </div>
            {replyId === c.id && (
              <div className="mt-2 flex gap-2">
                <input
                  className="input"
                  placeholder={isAdmin ? 'Reply as instructor…' : 'Write a reply…'}
                  value={replyText}
                  maxLength={1000}
                  onChange={(e) => setReplyText(e.target.value)}
                  aria-label="Reply text"
                />
                <AsyncButton className="btn-primary shrink-0" onPress={async () => {
                  if (!db || !user || !replyText.trim()) return;
                  await addDoc(collection(db, 'comments'), {
                    courseId, lessonId, uid: user.uid, displayName: user.displayName ?? user.email,
                    ...(isAdmin ? { authorRole: 'admin' } : {}),
                    replyTo: c.id, text: replyText.trim(),
                    createdAt: serverTimestamp(), reported: false, hidden: false
                  });
                  setReplyId(null); setReplyText(''); reload(); push('Reply posted');
                }}>Reply</AsyncButton>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-slate-500">No questions yet. Be the first!</p>}
      </div>
      {items.length >= perPage * page && <button className="btn-ghost mt-2 !py-1 text-xs" onClick={() => setPage((p) => p + 1)}>Load more (20 at a time)</button>}
    </div>
  );
}

export function ModerationTab() {
  const [items, setItems] = useState<any[]>([]);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const { push } = useToast();
  const { user } = useAuth();
  useEffect(() => {
    if (!db) return;
    (async () => {
      const snap = await getDocs(query(collection(db, 'comments'), where('reported', '==', true), limit(50)));
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, []);
  return (
    <div className="space-y-2 text-sm">
      {items.map((c) => (
        <div key={c.id} className="card p-3">
          <p className="font-medium">{c.displayName} · {c.courseId}/{c.lessonId}</p>
          <p>{c.text}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <button className="font-medium text-indigo-600 underline" onClick={() => { setReplyId(replyId === c.id ? null : c.id); setReplyText(''); }}>
              {replyId === c.id ? 'Cancel reply' : 'Reply as instructor'}
            </button>
            <button className="underline" onClick={async () => { if (db) { await updateDoc(doc(db, 'comments', c.id), { hidden: true, reported: false }); location.reload(); } }}>Hide</button>
            <button className="underline" onClick={async () => { if (db) { await deleteDoc(doc(db, 'comments', c.id)); location.reload(); } }}>Delete</button>
            <button className="underline" onClick={async () => { if (db) { await updateDoc(doc(db, 'comments', c.id), { reported: false }); location.reload(); } }}>Dismiss</button>
            <button className="underline text-red-600" onClick={async () => { if (db && confirm(`Ban ${c.displayName} from commenting?`)) { await updateDoc(doc(db, 'users', c.uid), { commenting: 'off' }); } }}>Ban user</button>
          </div>
          {replyId === c.id && (
            <div className="mt-2 flex gap-2">
              <input
                className="input"
                placeholder="Reply as instructor…"
                value={replyText}
                maxLength={1000}
                onChange={(e) => setReplyText(e.target.value)}
                aria-label="Reply text"
              />
              <AsyncButton className="btn-primary shrink-0 !py-1 text-xs" onPress={async () => {
                if (!db || !user || !replyText.trim()) return;
                await addDoc(collection(db, 'comments'), {
                  courseId: c.courseId, lessonId: c.lessonId, uid: user.uid,
                  displayName: user.displayName ?? user.email, authorRole: 'admin',
                  replyTo: c.id, text: replyText.trim(),
                  createdAt: serverTimestamp(), reported: false, hidden: false
                });
                setReplyId(null); setReplyText(''); push('Reply posted'); location.reload();
              }}>Reply</AsyncButton>
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && <p className="text-slate-500">No reported posts.</p>}
    </div>
  );
}
