import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import type { Quiz } from '../types';

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function QuizRunner({ quiz, courseId, onDone }: { quiz: Quiz; courseId: string; onDone: () => void }) {
  const { user } = useAuth();
  const { push } = useToast();
  // shuffle questions + options, remap answerIndex
  const order = useMemo(() => {
    const qs = (quiz.shuffle ?? true) ? shuffled(quiz.questions.map((_, i) => i)) : quiz.questions.map((_, i) => i);
    return qs.map((qi) => {
      const q = quiz.questions[qi];
      const optOrder = (quiz.shuffle ?? true) ? shuffled(q.options.map((_, i) => i)) : q.options.map((_, i) => i);
      return { qi, optOrder, answer: optOrder.indexOf(q.answerIndex) };
    });
  }, [quiz]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [missedOnly, setMissedOnly] = useState(false);
  const [queue, setQueue] = useState<number[]>(order.map((_, i) => i));
  const [timeLeft, setTimeLeft] = useState<number | null>(quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60 : null);
  const [finished, setFinished] = useState<{ score: number; total: number } | null>(null);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { finish(answers); return; }
    const t = setTimeout(() => setTimeLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const cur = order[queue[idx]];
  const q = cur ? quiz.questions[cur.qi] : null;

  async function finish(allAnswers: number[]) {
    const total = queue.length;
    let correct = 0;
    const wrongCounts = [...(quiz.wrongCounts ?? Array(quiz.questions.length).fill(0))];
    queue.forEach((oi, k) => {
      if (allAnswers[k] === order[oi].answer) correct++;
      else wrongCounts[order[oi].qi] = (wrongCounts[order[oi].qi] ?? 0) + 1;
    });
    const score = total ? Math.round((correct / total) * 100) : 0;
    setFinished({ score, total });
    if (user && db) {
      await addDoc(collection(db, 'users', user.uid, 'quizAttempts'), {
        quizId: quiz.id, courseId, score, total, passed: score >= quiz.passingScore,
        answers: allAnswers, missedOnly, createdAt: serverTimestamp()
      });
      // aggregate wrong counts + streak
      try {
        await updateDoc(doc(db, 'courses', courseId, 'quizzes', quiz.id), { wrongCounts });
      } catch { /* quiz doc may be minimal */ }
      const { updateStreak } = await import('./streak');
      await updateStreak(user.uid);
    }
    push(`Quiz finished: ${score}%`);
  }

  if (finished) {
    const passed = finished.score >= quiz.passingScore;
    return (
      <div className="card p-4">
        <h3 className="font-semibold">{quiz.title} — {finished.score}% {passed ? '🎉' : ''}</h3>
        <p className="text-sm text-slate-500">Passing: {quiz.passingScore}% · {missedOnly ? 'Missed-only retry' : 'Full attempt'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={onDone}>Back to quizzes</button>
          <button className="btn-ghost" onClick={() => { setAnswers([]); setIdx(0); setPicked(null); setFinished(null); setMissedOnly(false); setQueue(order.map((_, i) => i)); }}>Retry</button>
          <button className="btn-ghost" onClick={() => {
            // retry missed only
            const missed = queue.filter((oi, k) => answers[k] !== order[oi].answer);
            if (missed.length === 0) return;
            setQueue(missed); setAnswers([]); setIdx(0); setPicked(null); setFinished(null); setMissedOnly(true);
          }}>Retry missed only</button>
        </div>
        <div className="mt-4 space-y-3">
          {queue.map((oi, k) => {
            const o = order[oi];
            const qq = quiz.questions[o.qi];
            const mine = answers[k];
            return (
              <div key={k} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="font-medium">{k + 1}. {qq.question}</p>
                <p className={mine === o.answer ? 'text-green-700' : 'text-red-600'}>Your answer: {mine !== undefined ? qq.options[o.optOrder[mine]] : '—'}</p>
                <p className="text-green-700">Correct: {qq.options[qq.answerIndex]}</p>
                {qq.explanation && <p className="mt-1 text-slate-500">{qq.explanation}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!q || !cur) return null;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Question {idx + 1} / {queue.length}</span>
        {timeLeft !== null && <span aria-label="Time left">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full bg-indigo-600" style={{ width: `${((idx) / queue.length) * 100}%` }} />
      </div>
      <h3 className="mt-3 font-medium">{q.question}</h3>
      <div className="mt-2 space-y-2">
        {cur.optOrder.map((oi, displayIdx) => (
          <button key={oi} onClick={() => setPicked(displayIdx)}
            className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${picked === displayIdx ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-800'}`}>
            {q.options[oi]}
          </button>
        ))}
      </div>
      {picked !== null && (
        <p className={`mt-2 text-sm ${picked === cur.answer ? 'text-green-700' : 'text-red-600'}`}>
          {picked === cur.answer ? 'Correct! ' : 'Not quite. '}{q.explanation ?? ''}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" disabled={picked === null} onClick={() => {
          const next = [...answers, picked as number];
          if (idx + 1 >= queue.length) finish(next);
          else { setAnswers(next); setIdx(idx + 1); setPicked(null); }
        }}>{idx + 1 >= queue.length ? 'Finish' : 'Next'}</button>
      </div>
    </div>
  );
}

export function validateQuizJson(raw: string): { ok: boolean; errors: string[]; quiz?: Omit<Quiz, 'id'> } {
  const errors: string[] = [];
  let j: any;
  try { j = JSON.parse(raw); } catch { return { ok: false, errors: ['Invalid JSON.'] }; }
  if (typeof j.title !== 'string' || !j.title.trim()) errors.push('Missing "title".');
  if (typeof j.passingScore !== 'number') errors.push('Missing numeric "passingScore".');
  if (!Array.isArray(j.questions) || j.questions.length === 0) errors.push('"questions" must be a non-empty array.');
  (j.questions ?? []).forEach((q: any, i: number) => {
    if (typeof q.question !== 'string') errors.push(`Q${i + 1}: missing question text.`);
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`Q${i + 1}: need ≥2 options.`);
    if (typeof q.answerIndex !== 'number' || q.answerIndex < 0 || q.answerIndex >= (q.options?.length ?? 0)) errors.push(`Q${i + 1}: bad answerIndex.`);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], quiz: { title: j.title, passingScore: j.passingScore, questions: j.questions, lessonId: j.lessonId, timeLimitMinutes: j.timeLimitMinutes, shuffle: j.shuffle ?? true } };
}
