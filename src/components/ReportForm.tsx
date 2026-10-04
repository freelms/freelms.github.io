import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../hooks/useToast';
import { AsyncButton } from './AsyncButton';

export function ReportForm({ courseId, lessonId }: { courseId?: string; lessonId?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('Copyright / takedown');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const { push } = useToast();
  if (!open) return <button className="text-xs underline text-slate-500" onClick={() => setOpen(true)}>Report or takedown request</button>;
  return (
    <form className="card mt-2 p-3 text-sm" onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-2">
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
          <option>Copyright / takedown</option>
          <option>Wrong credit</option>
          <option>Broken video</option>
          <option>Inappropriate content</option>
          <option>Other</option>
        </select>
        <textarea className="input" placeholder="Details" value={details} onChange={(e) => setDetails(e.target.value)} required />
        <input className="input" placeholder="Your email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <p className="text-xs text-slate-500">Contact: {import.meta.env.VITE_CONTACT_EMAIL} · <Link to="/disclaimer" className="underline">How we use videos (Disclaimer)</Link></p>
        <div className="flex gap-2">
          <AsyncButton className="btn-primary" onPress={async () => {
            if (!db || !details.trim() || !email.trim()) return;
            await addDoc(collection(db, 'reports'), { courseId, lessonId, reason, details, email, resolved: false, createdAt: serverTimestamp() });
            push('Report sent. Thank you.');
            setOpen(false); setDetails(''); setEmail('');
          }}>Send</AsyncButton>
          <button className="btn-ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    </form>
  );
}
