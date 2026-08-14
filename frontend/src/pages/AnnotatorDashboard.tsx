import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import api from '../services/api';

type Session = { id: number; videoId: number; status: string; assignedAt: string; completedAt?: string };
const groups = [['Pending', 'Assigned'], ['In Progress', 'InProgress'], ['Completed', 'Completed']] as const;

export function AnnotatorDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/annotation-sessions/mine').then(r => setSessions(r.data as Session[])).catch(e => setError(e instanceof Error ? e.message : 'Unable to load tasks.')); }, []);
  const byStatus = useMemo(() => Object.fromEntries(groups.map(([, status]) => [status, sessions.filter(s => s.status === status)])), [sessions]);
  return <div className="max-w-6xl mx-auto space-y-6"><header className="dashboard-view"><p className="dashboard-kicker">Annotator workspace</p><h1>My assigned tasks</h1><p>Launch pending work, continue active sessions, or review completed assignments.</p></header>
    {error && <p className="text-red-600">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-3">{groups.map(([label, status]) => <section key={status} className="bg-white border border-slate-200 rounded-2xl p-5"><h2 className="font-bold text-lg mb-4">{label} <span className="text-slate-400">({byStatus[status].length})</span></h2><div className="space-y-3">{byStatus[status].map(session => <article key={session.id} className="border border-slate-100 rounded-xl p-4"><strong>Video #{session.videoId}</strong><p className="text-sm text-slate-500">Session #{session.id}</p>{status !== 'Completed' && <Link className="inline-block mt-3 text-blue-600 font-semibold" to={`/annotate/${session.id}`}>{status === 'Assigned' ? 'Start annotation' : 'Continue annotation'} →</Link>}</article>)}{byStatus[status].length === 0 && <p className="text-sm text-slate-400">No sessions.</p>}</div></section>)}</div>
  </div>;
}
