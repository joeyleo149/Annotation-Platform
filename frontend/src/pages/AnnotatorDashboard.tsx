import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import api from '../services/api';
import { getCurrentUser } from '../services/authService';

type Session = {
  id: number;
  videoId: number;
  status: string;
  assignedAt: string;
  completedAt?: string;
};

type Dataset = {
  id: number;
  name: string;
  datasetType?: string;
  isArchived?: boolean;
};

type AutomaticRequestResult = {
  assignment: {
    assigned: boolean;
    message: string;
    annotationSessionId: number | null;
  };
};

const groups = [
  ['Assigned', 'Assigned'],
  ['In Progress', 'InProgress'],
  ['Completed', 'Completed'],
] as const;

export function AnnotatorDashboard() {
  const user = getCurrentUser();
  const location = useLocation();
  const isAnnotationsView = location.pathname === '/annotator/annotations';
  const isVideosView = location.pathname === '/annotator/videos' || location.pathname === '/workspace';
  const [sessions, setSessions] = useState<Session[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [requestingIds, setRequestingIds] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusAssigned, setStatusAssigned] = useState(false);
  const [error, setError] = useState('');
  const [blockedDatasetIds, setBlockedDatasetIds] = useState<Set<number>>(new Set());
  const [assignedDatasetIds, setAssignedDatasetIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let ignore = false;

    const loadDashboard = async () => {
      try {
        const [sessionResponse, datasetResponse] = await Promise.all([
          api.get('/annotation-sessions/mine'),
          api.get('/datasets/available'),
        ]);

        if (ignore) {
          return;
        }

        const sessionList = (sessionResponse.data as Session[]) ?? [];
        setSessions(sessionList);
        setDatasets((datasetResponse.data as Dataset[]) ?? []);
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load tasks.',
          );
        }
      }
    };

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, [user?.userId]);

  const byStatus = useMemo(
    () =>
      Object.fromEntries(
        groups.map(([, status]) => [
          status,
          sessions.filter(session => session.status === status),
        ]),
      ),
    [sessions],
  );

  const handleRequestDataset = async (datasetId: number, datasetName: string) => {
    if (!user) {
      setError('Please log in to request annotation access.');
      return;
    }

    setRequestingIds(current => [...current, datasetId]);
    setStatusMessage(null);
    setStatusAssigned(false);
    setError('');

    try {
      const requestResponse = await api.post(
        '/annotation-sessions/requests',
        {
        datasetId,
        },
      );

      const automaticResult =
        requestResponse.data as AutomaticRequestResult;

      const sessionResponse = await api.get(
        '/annotation-sessions/mine',
      );

      setSessions(
        (sessionResponse.data as Session[]) ?? [],
      );

      setBlockedDatasetIds(current => new Set([...current, datasetId]));

      const wasAssigned = automaticResult.assignment.assigned;
      setStatusAssigned(wasAssigned);

      if (wasAssigned) {
        setAssignedDatasetIds(current => new Set([...current, datasetId]));
      }

      setStatusMessage(
        wasAssigned
          ? `A video from "${datasetName}" was assigned automatically.`
          : `No eligible video from "${datasetName}" is available anymore.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to send the request.',
      );
    } finally {
      setRequestingIds(current => current.filter(id => id !== datasetId));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6">
      <header className="dashboard-view">
        <p className="dashboard-kicker">Annotator workspace</p>
        <h1>{isVideosView ? 'My annotations' : 'Discover datasets to annotate'}</h1>
        <p>
          {isVideosView
            ? 'Launch pending work and continue your active annotation sessions.'
            : 'Browse available datasets and request an eligible video to start annotating.'}
        </p>
      </header>

      {statusMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMessage}
          {statusAssigned && (
            <>
              {' '}
              <Link
                to="/annotator/videos"
                className="font-semibold text-emerald-700 underline hover:text-emerald-900"
              >
                Go to My Annotations to start annotating →
              </Link>
            </>
          )}
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}

      {!isVideosView && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Available datasets</h2>
              <p className="text-sm text-slate-500">Request work and receive an eligible video automatically.</p>
            </div>
          </div>

          {datasets.length === 0 ? (
            <p className="text-sm text-slate-400">No active datasets are available right now.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {datasets.map(dataset => (
                <article key={dataset.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{dataset.datasetType ?? 'Dataset'}</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{dataset.name}</h3>
                  </div>

                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={requestingIds.includes(dataset.id)}
                    onClick={() => handleRequestDataset(dataset.id, dataset.name)}
                  >
                    {requestingIds.includes(dataset.id)
                      ? 'Sending request…'
                      : assignedDatasetIds.has(dataset.id)
                        ? 'Assigned!'
                        : blockedDatasetIds.has(dataset.id)
                          ? 'Request locked'
                          : 'Request a task'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {isVideosView && (
        <div className="grid gap-5 lg:grid-cols-3">
          {groups.map(([label, status]) => (
            <section key={status} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">
                {label} <span className="text-slate-400">({byStatus[status].length})</span>
              </h2>

              <div className="space-y-3">
                {byStatus[status].map(session => (
                  <article key={session.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <strong className="block text-slate-900">Video #{session.videoId}</strong>
                    <p className="mt-1 text-sm text-slate-500">Session #{session.id}</p>

                    {status !== 'Completed' && (
                      <Link
                        className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
                        to={`/annotate/${session.id}`}
                      >
                        {status === 'Assigned' ? 'Start annotation' : 'Continue annotation'} →
                      </Link>
                    )}
                  </article>
                ))}

                {byStatus[status].length === 0 && (
                  <p className="text-sm text-slate-400">No sessions.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {isAnnotationsView && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
          No annotation sessions to display here. Use the videos view to manage your assigned work.
        </div>
      )}
    </div>
  );
}
