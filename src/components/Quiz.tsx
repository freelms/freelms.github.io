import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AsyncButton } from './AsyncButton';
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
    const correct = Math.round((finished.score / 100) * finished.total);
    const R = 34;
    const C = 2 * Math.PI * R;
    return (
      <div className="card overflow-hidden">
        <div className={`p-6 text-center ${passed ? 'bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-950/40' : 'bg-gradient-to-b from-rose-50 to-transparent dark:from-rose-950/40'}`}>
          <div className="relative mx-auto h-28 w-28" role="img" aria-label={`Score ${finished.score} percent`}>
            <svg viewBox="0 0 84 84" className="h-28 w-28 -rotate-90">
              <circle cx="42" cy="42" r={R} fill="none" strokeWidth="9" className="stroke-slate-200 dark:stroke-slate-800" />
              <circle cx="42" cy="42" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
                className={passed ? 'stroke-emerald-500' : 'stroke-rose-500'}
                strokeDasharray={C} strokeDashoffset={C - (C * finished.score) / 100} />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-2xl font-extrabold">{finished.score}<span className="text-sm font-semibold text-slate-400">%</span></span>
          </div>
          <h3 className="mt-3 text-lg font-extrabold tracking-tight">
            {passed ? 'Passed — nicely done 🎉' : 'Not quite — keep going'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {quiz.title} · {correct}/{finished.total} correct · passing {quiz.passingScore}% · {missedOnly ? 'Missed-only retry' : 'Full attempt'}
          </p>
          <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2">
            <button className="btn-primary" onClick={onDone}>Back to quizzes</button>
            <button className="btn-ghost" onClick={() => { setAnswers([]); setIdx(0); setPicked(null); setFinished(null); setMissedOnly(false); setQueue(order.map((_, i) => i)); }}>Retry</button>
            <button className="btn-ghost" onClick={() => {
              const missed = queue.filter((oi, k) => answers[k] !== order[oi].answer);
              if (missed.length === 0) return;
              setQueue(missed); setAnswers([]); setIdx(0); setPicked(null); setFinished(null); setMissedOnly(true);
            }}>Retry missed only</button>
          </div>
        </div>
        <div className="space-y-2 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Review answers</h4>
          {queue.map((oi, k) => {
            const o = order[oi];
            const qq = quiz.questions[o.qi];
            const mine = answers[k];
            const ok = mine === o.answer;
            return (
              <details key={k} className={`rounded-xl border p-3 text-sm ${ok ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20'}`}>
                <summary className="cursor-pointer font-medium">
                  <span className={`mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`}>{ok ? '✓' : '✕'}</span>
                  {k + 1}. {qq.question}
                </summary>
                <div className="mt-2 space-y-1 pl-7 text-[13px]">
                  <p className={ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}>Your answer: {mine !== undefined ? qq.options[o.optOrder[mine]] : '—'}</p>
                  {!ok && <p className="text-emerald-700 dark:text-emerald-300">Correct: {qq.options[qq.answerIndex]}</p>}
                  {qq.explanation && <p className="text-slate-500">{qq.explanation}</p>}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    );
  }

  if (!q || !cur) return null;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const answered = picked !== null;
  const wasRight = picked === cur.answer;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{quiz.title}</p>
        {timeLeft !== null && (
          <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold ${timeLeft < 60 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`} aria-label="Time left">
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-1" role="progressbar" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={queue.length} aria-label="Quiz progress">
        {queue.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < idx ? 'bg-emerald-500' : i === idx ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">Question {idx + 1} of {queue.length}</p>
      <h3 className="mt-2 text-[17px] font-bold leading-snug">{q.question}</h3>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label="Answer options">
        {cur.optOrder.map((oi, displayIdx) => {
          const selected = picked === displayIdx;
          return (
            <button key={oi} role="radio" aria-checked={selected} onClick={() => setPicked(displayIdx)}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium transition ${
                selected
                  ? 'border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/60'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
              }`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${
                selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {letters[displayIdx] ?? displayIdx + 1}
              </span>
              <span className="flex-1">{q.options[oi]}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${wasRight ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'}`} role="status">
          <span className="text-base" aria-hidden>{wasRight ? '✓' : '✕'}</span>
          <p><strong>{wasRight ? 'Correct! ' : 'Not quite. '}</strong>{q.explanation ?? (wasRight ? 'Well done.' : 'Review the options and try the next one.')}</p>
        </div>
      )}
      <div className="mt-4">
        <AsyncButton className="btn-primary w-full !py-2.5" disabled={picked === null} onPress={async () => {
          const next = [...answers, picked as number];
          if (idx + 1 >= queue.length) await finish(next);
          else { setAnswers(next); setIdx(idx + 1); setPicked(null); }
        }}>{idx + 1 >= queue.length ? 'Finish quiz' : 'Next question →'}</AsyncButton>
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
  // Omit undefined optionals — Firestore rejects explicit undefined values.
  const quiz: any = { title: j.title, passingScore: j.passingScore, questions: j.questions };
  if (j.lessonId) quiz.lessonId = j.lessonId;
  if (j.timeLimitMinutes !== undefined) quiz.timeLimitMinutes = j.timeLimitMinutes;
  quiz.shuffle = j.shuffle ?? true;
  return { ok: true, errors: [], quiz };
}
