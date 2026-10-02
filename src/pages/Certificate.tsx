import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Certificate() {
  const { certificateId } = useParams();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!db || !certificateId) return;
    (async () => {
      const snap = await getDocs(query(collection(db, 'certificates_public'), where('certificateId', '==', certificateId)));
      if (!snap.empty) setData(snap.docs[0].data());
    })();
  }, [certificateId]);

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const [html2canvas, { jsPDF }] = await Promise.all([
        import('html2canvas').then((m) => m.default),
        import('jspdf')
      ]);
      const el = document.getElementById('cert');
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height / canvas.width) * w;
      pdf.addImage(img, 'PNG', 40, 60, w - 80, h);
      pdf.save(`certificate-${certificateId}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="mx-auto max-w-xl p-8 text-sm">Loading certificate…</div>;
  return (
    <div className="mx-auto max-w-2xl px-3 py-8">
      <div id="cert" className="card p-10 text-center">
        <p className="text-xs uppercase tracking-widest text-slate-500">LearnHub · Certificate of Completion</p>
        <h1 className="mt-2 text-2xl font-bold">{data.courseTitle}</h1>
        <p className="mt-4 text-sm">Awarded to</p>
        <p className="text-xl font-semibold">{data.studentName}</p>
        <p className="mt-4 text-xs text-slate-500">Certificate ID: {data.certificateId} · Verify at {import.meta.env.VITE_APP_URL}/#/certificate/{data.certificateId}</p>
      </div>
      <div className="no-print mt-4 flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={downloadPdf}>{busy ? 'Generating…' : 'Download PDF'}</button>
        <button className="btn-ghost" onClick={() => window.print()}>Print</button>
        <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(location.href)}>Copy link</button>
        <Link to="/" className="btn-ghost">Home</Link>
      </div>
    </div>
  );
}
