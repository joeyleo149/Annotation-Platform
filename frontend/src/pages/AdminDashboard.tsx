import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router';

import {
  adminApi,
  type AnnotationSessionItem,
  type DatasetMetrics,
  type DatasetSummary,
  type TaskRequestItem,
  type VideoCatalogItem,
} from '../services/adminApi';

import './AdminDashboard.css';
import { getCurrentUser, logout } from '../services/authService';
import AddAdminPage from './AddAdminPage';
import { AddQuestionPage, QuestionsPage } from './QuestionManagementPage';

type DashboardView =
  | 'overview'
  | 'datasets'
  | 'videos'
  | 'archivedVideos'
  | 'requests'
  | 'sessions'
  | 'uploads'
  | 'addAdmin'
  | 'addQuestion'
  | 'questions';

const navigation: {
  id: DashboardView;
  label: string;
  icon: string;
}[] = [
  { id: 'overview', label: 'Overview', icon: '⌂' },
  { id: 'datasets', label: 'Datasets', icon: '▦' },
  { id: 'videos', label: 'Videos', icon: '▶' },
  {
    id: 'archivedVideos',
    label: 'Archived Videos',
    icon: '▣',
  },
  { id: 'requests', label: 'Requests', icon: '⇄' },
  { id: 'sessions', label: 'Sessions', icon: '◷' },
  { id: 'uploads', label: 'Uploads', icon: '↑' },
  { id: 'addAdmin', label: 'Add Admin', icon: '+' },
  { id: 'addQuestion', label: 'Add Question', icon: '?' },
  { id: 'questions', label: 'Questions', icon: '≡' },
];

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString();
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [view, setView] =
    useState<DashboardView>('overview');

  const [datasets, setDatasets] =
    useState<DatasetSummary[]>([]);

  const [selectedDatasetId, setSelectedDatasetId] =
    useState<number | null>(null);

  const [metrics, setMetrics] =
    useState<DatasetMetrics | null>(null);

  const [videos, setVideos] =
    useState<VideoCatalogItem[]>([]);

  const [requests, setRequests] =
    useState<TaskRequestItem[]>([]);

  const [sessions, setSessions] =
    useState<AnnotationSessionItem[]>([]);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [previewVideo, setPreviewVideo] =
    useState<VideoCatalogItem | null>(null);

  const [quotaVideo, setQuotaVideo] =
    useState<VideoCatalogItem | null>(null);

  const [quotaValue, setQuotaValue] = useState('');

  const [archiveVideoTarget, setArchiveVideoTarget] =
    useState<VideoCatalogItem | null>(null);

  const [deleteVideoTarget, setDeleteVideoTarget] =
    useState<VideoCatalogItem | null>(null);

  const [archiveDatasetTarget, setArchiveDatasetTarget] =
    useState<DatasetSummary | null>(null);

  const [datasetName, setDatasetName] = useState('');
  const [datasetType, setDatasetType] =
    useState('Video Trajectory Annotation');

  const [manifestFile, setManifestFile] =
    useState<File | null>(null);

  const [manifestProgress, setManifestProgress] =
    useState(0);

  const [videoFiles, setVideoFiles] =
    useState<File[]>([]);

  const [requiredAnnotations, setRequiredAnnotations] =
    useState('3');

  const [videoUploadProgress, setVideoUploadProgress] =
    useState(0);

  const selectedDataset = useMemo(
    () =>
      datasets.find(
        dataset => dataset.id === selectedDatasetId,
      ) ?? null,
    [datasets, selectedDatasetId],
  );

  const hidesDatasetControls = view === 'addAdmin' || view === 'addQuestion' || view === 'questions';

  const filteredVideos = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    const archiveFiltered = videos.filter(video =>
      view === 'archivedVideos'
        ? video.isArchived
        : !video.isArchived,
    );

    if (!normalizedSearch) {
      return archiveFiltered;
    }

    return archiveFiltered.filter(video =>
      [
        video.fileName,
        video.scenarioId,
        video.scenarioType,
        video.drivingInstruction,
        video.processingStatus,
      ]
        .filter(Boolean)
        .some(value =>
          String(value)
            .toLowerCase()
            .includes(normalizedSearch),
        ),
    );
  }, [search, videos, view]);

  const waitingRequests = useMemo(
    () =>
      requests.filter(
        request => request.status === 'Waiting',
      ),
    [requests],
  );

  const selectedVideoIds = useMemo(
    () => new Set(videos.map(video => video.id)),
    [videos],
  );

  const selectedDatasetSessions = useMemo(
    () =>
      sessions.filter(session =>
        selectedVideoIds.has(session.videoId),
      ),
    [sessions, selectedVideoIds],
  );

  const activeSessions = useMemo(
    () =>
      selectedDatasetSessions.filter(
        session =>
          session.status === 'Assigned' ||
          session.status === 'InProgress',
      ),
    [selectedDatasetSessions],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const datasetItems =
        await adminApi.getDatasets(true);

      setDatasets(datasetItems);

      const effectiveDatasetId =
        selectedDatasetId ??
        datasetItems[0]?.id ??
        null;

      if (
        selectedDatasetId === null &&
        effectiveDatasetId !== null
      ) {
        setSelectedDatasetId(effectiveDatasetId);
      }

      if (effectiveDatasetId === null) {
        setMetrics(null);
        setVideos([]);
        setRequests([]);
        setSessions([]);
        return;
      }

      const [
        metricsResult,
        videoResult,
        requestResult,
        sessionResult,
      ] = await Promise.all([
        adminApi.getDatasetMetrics(
          effectiveDatasetId,
        ),
        adminApi.getVideos(
          effectiveDatasetId,
          true,
        ),
        adminApi.getRequests(effectiveDatasetId),
        adminApi.getSessions(),
      ]);

      setMetrics(metricsResult);
      setVideos(videoResult);
      setRequests(requestResult);
      setSessions(sessionResult);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setLoading(false);
    }
  }, [selectedDatasetId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const runAction = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setActionBusy(true);
    setError(null);
    setMessage(null);

    try {
      await action();
      setMessage(successMessage);
      await loadDashboard();
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setActionBusy(false);
    }
  };

  const handleManifestUpload = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!manifestFile || !datasetName.trim()) {
      setError(
        'Select a manifest and enter a dataset name.',
      );
      return;
    }

    setActionBusy(true);
    setError(null);
    setMessage(null);
    setManifestProgress(0);

    try {
      const result = await adminApi.uploadManifest(
        manifestFile,
        datasetName.trim(),
        datasetType.trim(),
        setManifestProgress,
      );

      setMessage(result.message);
      setSelectedDatasetId(result.datasetId);
      setDatasetName('');
      setManifestFile(null);
      await loadDashboard();
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setActionBusy(false);
    }
  };

  const handleVideoUpload = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (selectedDatasetId === null) {
      setError('Select a dataset first.');
      return;
    }

    if (videoFiles.length === 0) {
      setError('Select at least one video.');
      return;
    }

    const parsedRequiredAnnotations =
      Number(requiredAnnotations);

    if (
      !Number.isInteger(parsedRequiredAnnotations) ||
      parsedRequiredAnnotations < 1
    ) {
      setError(
        'Required annotations must be a positive integer.',
      );
      return;
    }

    setActionBusy(true);
    setError(null);
    setMessage(null);
    setVideoUploadProgress(0);

    try {
      const result = await adminApi.uploadVideos(
        videoFiles,
        selectedDatasetId,
        parsedRequiredAnnotations,
        setVideoUploadProgress,
      );

      setMessage(
        `${result.successfulCount} videos uploaded; ` +
        `${result.failedCount} failed.`,
      );

      setVideoFiles([]);
      await loadDashboard();
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setActionBusy(false);
    }
  };

  const handleQuotaUpdate = (
    video: VideoCatalogItem,
  ) => {
    setQuotaVideo(video);
    setQuotaValue(
      video.requiredAnnotationCount.toString(),
    );
  };

  const submitQuotaUpdate = () => {
    if (!quotaVideo) {
      return;
    }

    const quota = Number(quotaValue);

    if (!Number.isInteger(quota) || quota <= 0) {
      setError('The quota must be a positive integer.');
      return;
    }

    const videoId = quotaVideo.id;
    setQuotaVideo(null);

    void runAction(
      () =>
        adminApi.updateVideoQuota(
          videoId,
          quota,
        ),
      'Annotation quota updated.',
    );
  };

  const handleVideoArchive = (
    video: VideoCatalogItem,
  ) => {
    setArchiveVideoTarget(video);
  };

  const confirmVideoArchive = () => {
    if (!archiveVideoTarget) {
      return;
    }

    const video = archiveVideoTarget;
    setArchiveVideoTarget(null);

    void runAction(
      () =>
        video.isArchived
          ? adminApi.restoreVideo(video.id)
          : adminApi.archiveVideo(video.id),
      video.isArchived
        ? 'Video restored.'
        : 'Video archived.',
    );
  };

  const confirmVideoDeletion = () => {
    if (!deleteVideoTarget) {
      return;
    }

    const video = deleteVideoTarget;
    setDeleteVideoTarget(null);

    void runAction(
      () => adminApi.deleteVideo(video.id),
      `Video "${video.fileName}" and all related data were permanently deleted.`,
    );
  };

  const handleDatasetArchive = (
    dataset: DatasetSummary,
  ) => {
    setArchiveDatasetTarget(dataset);
  };

  const confirmDatasetArchive = () => {
    if (!archiveDatasetTarget) {
      return;
    }

    const dataset = archiveDatasetTarget;
    setArchiveDatasetTarget(null);

    void runAction(
      () =>
        dataset.isArchived
          ? adminApi.restoreDataset(dataset.id)
          : adminApi.archiveDataset(dataset.id),
      dataset.isArchived
        ? 'Dataset restored.'
        : 'Dataset archived.',
    );
  };

  const renderOverview = () => {
    const completionPercentage =
      metrics && metrics.totalRequiredAnnotations > 0
        ? Math.round(
            (metrics.completedAnnotations /
              metrics.totalRequiredAnnotations) *
              100,
          )
        : 0;

    return (
      <>
        <section className="metric-grid">
          <article className="metric-card">
            <span className="metric-icon blue">▦</span>
            <div>
              <p>Total videos</p>
              <strong>{metrics?.totalVideos ?? 0}</strong>
              <small>
                {metrics?.pendingVideos ?? 0} pending
              </small>
            </div>
          </article>

          <article className="metric-card">
            <span className="metric-icon green">✓</span>
            <div>
              <p>Completed videos</p>
              <strong>
                {metrics?.completedVideos ?? 0}
              </strong>
              <small>
                {completionPercentage}% annotation progress
              </small>
            </div>
          </article>

          <article className="metric-card">
            <span className="metric-icon orange">⇄</span>
            <div>
              <p>Remaining annotations</p>
              <strong>
                {metrics?.remainingAnnotations ?? 0}
              </strong>
              <small>
                {activeSessions.length} active sessions
              </small>
            </div>
          </article>

          <article className="metric-card">
            <span className="metric-icon violet">◷</span>
            <div>
              <p>Hours annotated</p>
              <strong>
                {(metrics?.totalHoursAnnotated ?? 0)
                  .toFixed(2)}
              </strong>
              <small>
                {metrics?.completedAnnotations ?? 0}{' '}
                completed annotations
              </small>
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="panel progress-panel">
            <div className="panel-heading">
              <div>
                <h2>Annotation progress</h2>
                <p>
                  Annotation completion for the selected
                  dataset.
                </p>
              </div>
              <span>{completionPercentage}%</span>
            </div>

            <div className="large-progress">
              <span
                style={{
                  width: `${completionPercentage}%`,
                }}
              />
            </div>

            <div className="progress-stats">
              <div>
                <strong>
                  {metrics?.completedAnnotations ?? 0}
                </strong>
                <span>Completed annotations</span>
              </div>
              <div>
                <strong>
                  {metrics?.remainingAnnotations ?? 0}
                </strong>
                <span>Remaining annotations</span>
              </div>
              <div>
                <strong>
                  {metrics?.totalRequiredAnnotations ?? 0}
                </strong>
                <span>Required annotations</span>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Recent assignments</h2>
                <p>Latest sessions for this dataset.</p>
              </div>
              <button
                className="text-button"
                onClick={() => setView('sessions')}
              >
                View all
              </button>
            </div>

            <div className="compact-list">
              {selectedDatasetSessions.slice(0, 4).map(session => (
                <div
                  className="compact-row"
                  key={session.id}
                >
                  <span className="avatar">
                    A{session.annotatorId}
                  </span>
                  <div>
                    <strong>
                      Video #{session.videoId}
                    </strong>
                    <small>
                      {formatDate(session.assignedAt)}
                    </small>
                  </div>
                  <span className={`status ${session.status.toLowerCase()}`}>
                    {session.status}
                  </span>
                </div>
              ))}

              {selectedDatasetSessions.length === 0 && (
                <div className="empty-state">
                  No assignments yet.
                </div>
              )}
            </div>
          </article>
        </section>
      </>
    );
  };

  const renderDatasets = () => (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>Dataset management</h2>
          <p>
            Monitor, export, archive and restore datasets.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => setView('uploads')}
        >
          + New dataset
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Type</th>
              <th>Videos</th>
              <th>Completed</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map(dataset => (
              <tr key={dataset.id}>
                <td>
                  <button
                    className="dataset-link"
                    onClick={() => {
                      setSelectedDatasetId(dataset.id);
                      setView('overview');
                    }}
                  >
                    {dataset.name}
                  </button>
                </td>
                <td>{dataset.datasetType}</td>
                <td>{dataset.totalVideos}</td>
                <td>{dataset.completedVideos}</td>
                <td>
                  <span
                    className={
                      dataset.isArchived
                        ? 'status archived'
                        : 'status ready'
                    }
                  >
                    {dataset.isArchived
                      ? 'Archived'
                      : 'Active'}
                  </span>
                </td>
                <td>{formatDate(dataset.createdAt)}</td>
                <td>
                  <div className="table-actions">
                    <button
                      onClick={() =>
                        void adminApi.downloadAnnotations(
                          'datasets',
                          dataset.id,
                          'json',
                          true,
                        )
                      }
                    >
                      JSON
                    </button>
                    <button
                      onClick={() =>
                        void adminApi.downloadAnnotations(
                          'datasets',
                          dataset.id,
                          'csv',
                          true,
                        )
                      }
                    >
                      CSV
                    </button>
                    <button
                      onClick={() =>
                        handleDatasetArchive(dataset)
                      }
                    >
                      {dataset.isArchived
                        ? 'Restore'
                        : 'Archive'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderVideos = () => (
    <section className="panel table-panel">
      <div className="panel-heading video-heading">
        <div>
          <h2>
            {view === 'archivedVideos'
              ? 'Archived videos'
              : 'Active video catalog'}
          </h2>
          <p>
            {view === 'archivedVideos'
              ? 'View, export or restore archived videos.'
              : 'Review videos, playback, quotas and progress.'}
          </p>
        </div>

        <div className="catalog-controls">
          <input
            type="search"
            placeholder="Search videos..."
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
          />

        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Preview</th>
              <th>Video</th>
              <th>Scenario</th>
              <th>Metadata</th>
              <th>Annotations</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVideos.map(video => (
              <tr key={video.id}>
                <td>
                  <button
                    className="thumbnail-button"
                    onClick={() =>
                      setPreviewVideo(video)
                    }
                  >
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.fileName}
                      />
                    ) : (
                      <span>▶</span>
                    )}
                  </button>
                </td>
                <td>
                  <strong>{video.fileName}</strong>
                  <small className="table-subtitle">
                    {formatBytes(video.fileSizeBytes)}
                  </small>
                </td>
                <td>
                  <strong>
                    {video.scenarioId ?? '—'}
                  </strong>
                  <small className="table-subtitle">
                    {video.drivingInstruction ?? '—'}
                  </small>
                </td>
                <td>
                  {video.width ?? '—'} ×{' '}
                  {video.height ?? '—'}
                  <small className="table-subtitle">
                    {video.frameRate ?? '—'} FPS ·{' '}
                    {video.durationSeconds ?? '—'} sec
                  </small>
                </td>
                <td>
                  <strong>
                    {video.completedAnnotationCount}/
                    {video.requiredAnnotationCount}
                  </strong>
                  <div className="mini-progress">
                    <span
                      style={{
                        width: `${
                          video.requiredAnnotationCount > 0
                            ? Math.min(
                                100,
                                (video.completedAnnotationCount /
                                  video.requiredAnnotationCount) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </td>
                <td>
                  <span
                    className={`status ${
                      video.isArchived
                        ? 'archived'
                        : video.processingStatus
                            .toLowerCase()
                    }`}
                  >
                    {video.isArchived
                      ? 'Archived'
                      : video.processingStatus}
                  </span>
                </td>
                <td>
                  <div className="table-actions vertical">
                    <button
                      onClick={() =>
                        setPreviewVideo(video)
                      }
                    >
                      Play
                    </button>
                    <button
                      onClick={() =>
                        handleQuotaUpdate(video)
                      }
                    >
                      Quota
                    </button>
                    <button
                      onClick={() =>
                        void adminApi.downloadAnnotations(
                          'videos',
                          video.id,
                          'json',
                          true,
                        )
                      }
                    >
                      Export
                    </button>
                    <button
                      onClick={() =>
                        handleVideoArchive(video)
                      }
                    >
                      {video.isArchived
                        ? 'Restore'
                        : 'Archive'}
                    </button>
                    <button
                      className="danger-action"
                      onClick={() =>
                        setDeleteVideoTarget(video)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredVideos.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    No videos found.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderRequests = () => (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>Annotation requests</h2>
          <p>
            Review automatically processed task requests.
          </p>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Dataset</th>
              <th>Annotator</th>
              <th>Requested</th>
              <th>Status</th>
              <th>Session</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(request => {
              const datasetName =
                datasets.find(
                  dataset =>
                    dataset.id === request.datasetId,
                )?.name ?? `#${request.datasetId}`;

              return (
                <tr key={request.id}>
                  <td>#{request.id}</td>
                  <td>{datasetName}</td>
                  <td>
                    Annotator {request.annotatorId}
                  </td>
                  <td>
                    {formatDate(request.requestedAt)}
                  </td>
                  <td>
                    <span
                      className={`status ${request.status.toLowerCase()}`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td>
                    {request.annotationSessionId
                      ? `#${request.annotationSessionId}`
                      : '—'}
                  </td>
                </tr>
              );
            })}

            {requests.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    No task requests.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderSessions = () => (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>Annotation sessions</h2>
          <p>
            Monitor assignments, deadlines and completion.
          </p>
        </div>

        <button
          className="secondary-button"
          disabled={actionBusy}
          onClick={() =>
            void runAction(
              () => adminApi.processExpired(),
              'Expired sessions processed.',
            )
          }
        >
          Process expired
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Session</th>
              <th>Annotator</th>
              <th>Video</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Expires</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session.id}>
                <td>#{session.id}</td>
                <td>
                  Annotator {session.annotatorId}
                </td>
                <td>Video #{session.videoId}</td>
                <td>
                  <span
                    className={`status ${session.status.toLowerCase()}`}
                  >
                    {session.status}
                  </span>
                </td>
                <td>
                  {formatDate(session.assignedAt)}
                </td>
                <td>
                  {formatDate(session.expiresAt)}
                </td>
                <td>
                  {formatDate(session.completedAt)}
                </td>
              </tr>
            ))}

            {sessions.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    No sessions found.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderUploads = () => (
    <section className="upload-grid">
      <form
        className="panel upload-card"
        onSubmit={handleManifestUpload}
      >
        <span className="upload-icon">◇</span>
        <h2>Create dataset</h2>
        <p>
          Upload and validate a trajectory manifest.
        </p>

        <label>
          Dataset name
          <input
            value={datasetName}
            onChange={event =>
              setDatasetName(event.target.value)
            }
            placeholder="KITScenes LongTail Train"
            required
          />
        </label>

        <label>
          Dataset type
          <input
            value={datasetType}
            onChange={event =>
              setDatasetType(event.target.value)
            }
            required
          />
        </label>

        <label className="file-drop">
          <strong>
            {manifestFile?.name ??
              'Choose JSON manifest'}
          </strong>
          <span>Maximum size: 20 MB</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={event =>
              setManifestFile(
                event.target.files?.[0] ?? null,
              )
            }
          />
        </label>

        {manifestProgress > 0 && (
          <div className="upload-progress">
            <span
              style={{
                width: `${manifestProgress}%`,
              }}
            />
            <small>{manifestProgress}%</small>
          </div>
        )}

        <button
          className="primary-button full"
          disabled={actionBusy}
        >
          Upload manifest
        </button>
      </form>

      <form
        className="panel upload-card"
        onSubmit={handleVideoUpload}
      >
        <span className="upload-icon">▶</span>
        <h2>Upload videos</h2>
        <p>
          Add reconstructed videos to the selected dataset.
        </p>

        <label>
          Required annotations per video
          <input
            type="number"
            min="1"
            value={requiredAnnotations}
            onChange={event =>
              setRequiredAnnotations(event.target.value)
            }
          />
        </label>

        <label className="file-drop">
          <strong>
            {videoFiles.length > 0
              ? `${videoFiles.length} videos selected`
              : 'Choose video files'}
          </strong>
          <span>MP4, AVI or MKV</span>
          <input
            type="file"
            multiple
            accept=".mp4,.avi,.mkv,video/mp4"
            onChange={event =>
              setVideoFiles(
                Array.from(event.target.files ?? []),
              )
            }
          />
        </label>

        {videoUploadProgress > 0 && (
          <div className="upload-progress">
            <span
              style={{
                width: `${videoUploadProgress}%`,
              }}
            />
            <small>{videoUploadProgress}%</small>
          </div>
        )}

        <button
          className="primary-button full"
          disabled={
            actionBusy ||
            selectedDatasetId === null
          }
        >
          Upload videos
        </button>
      </form>
    </section>
  );

  const renderContent = () => {
    switch (view) {
      case 'datasets':
        return renderDatasets();
      case 'videos':
      case 'archivedVideos':
        return renderVideos();
      case 'requests':
        return renderRequests();
      case 'sessions':
        return renderSessions();
      case 'uploads':
        return renderUploads();
      case 'addAdmin':
        return <AddAdminPage />;
      case 'addQuestion':
        return <AddQuestionPage />;
      case 'questions':
        return <QuestionsPage />;
      default:
        return renderOverview();
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          <span className="brand-mark">▷</span>
          <div>
            <strong>Annotate Pro</strong>
            <small>Admin workspace</small>
          </div>
        </div>

        <nav>
          {navigation.map(item => (
            <button
              key={item.id}
              className={
                view === item.id ? 'active' : ''
              }
              onClick={() => setView(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.id === 'requests' &&
                waitingRequests.length > 0 && (
                  <em>{waitingRequests.length}</em>
                )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="avatar admin">{currentUser?.email.slice(0, 2).toUpperCase() ?? 'AD'}</span>
          <div className="admin-identity">
            <strong>{currentUser?.email ?? 'Administrator'}</strong>
            <small>Administrator</small>
          </div>
          <button className="admin-logout" type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }} aria-label="Log out">
            Log out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>
              {navigation.find(item => item.id === view)
                ?.label ?? 'Overview'}
            </h1>
            <p>
              Manage datasets, annotation work and progress.
            </p>
          </div>

          {!hidesDatasetControls && <div className="header-actions">
            <select
              value={selectedDatasetId ?? ''}
              onChange={event =>
                setSelectedDatasetId(
                  event.target.value
                    ? Number(event.target.value)
                    : null,
                )
              }
            >
              <option value="">Select dataset</option>
              {datasets.map(dataset => (
                <option
                  key={dataset.id}
                  value={dataset.id}
                >
                  {dataset.name}
                </option>
              ))}
            </select>

            <button
              className="refresh-button"
              onClick={() => void loadDashboard()}
              disabled={loading}
            >
              ↻
            </button>
          </div>}
        </header>

        <div className="admin-content">
          {!hidesDatasetControls && selectedDataset && (
            <div className="dataset-context">
              <span>
                Dataset
              </span>
              <strong>{selectedDataset.name}</strong>
              <em
                className={
                  selectedDataset.isArchived
                    ? 'archived'
                    : ''
                }
              >
                {selectedDataset.isArchived
                  ? 'Archived'
                  : 'Active'}
              </em>
            </div>
          )}

          {message && (
            <div className="notice success">
              {message}
              <button
                onClick={() => setMessage(null)}
              >
                ×
              </button>
            </div>
          )}

          {error && (
            <div className="notice error">
              {error}
              <button onClick={() => setError(null)}>
                ×
              </button>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <span />
              Loading dashboard…
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </main>

      {quotaVideo && (
        <div
          className="modal-backdrop"
          onClick={() => setQuotaVideo(null)}
        >
          <section
            className="action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quota-modal-title"
            onClick={event => event.stopPropagation()}
          >
            <span className="action-modal-icon blue">✓</span>
            <h2 id="quota-modal-title">
              Update annotation quota
            </h2>
            <p>
              Set the required number of completed annotations
              for <strong>{quotaVideo.fileName}</strong>.
            </p>

            <label className="modal-field">
              Required annotations
              <input
                autoFocus
                type="number"
                min="1"
                value={quotaValue}
                onChange={event =>
                  setQuotaValue(event.target.value)
                }
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    submitQuotaUpdate();
                  }
                }}
              />
            </label>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setQuotaVideo(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={submitQuotaUpdate}
              >
                Save quota
              </button>
            </div>
          </section>
        </div>
      )}

      {archiveVideoTarget && (
        <div
          className="modal-backdrop"
          onClick={() => setArchiveVideoTarget(null)}
        >
          <section
            className="action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-archive-title"
            onClick={event => event.stopPropagation()}
          >
            <span className="action-modal-icon orange">
              {archiveVideoTarget.isArchived ? '↺' : '▣'}
            </span>
            <h2 id="video-archive-title">
              {archiveVideoTarget.isArchived
                ? 'Restore video?'
                : 'Archive video?'}
            </h2>
            <p>
              <strong>{archiveVideoTarget.fileName}</strong>{' '}
              will be {archiveVideoTarget.isArchived
                ? 'returned to the active video catalog.'
                : 'moved to the Archived Videos page.'}
            </p>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setArchiveVideoTarget(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={confirmVideoArchive}
              >
                {archiveVideoTarget.isArchived
                  ? 'Restore video'
                  : 'Archive video'}
              </button>
            </div>
          </section>
        </div>
      )}

      {deleteVideoTarget && (
        <div
          className="modal-backdrop"
          onClick={() => setDeleteVideoTarget(null)}
        >
          <section
            className="action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-delete-title"
            onClick={event => event.stopPropagation()}
          >
            <span className="action-modal-icon red">!</span>
            <h2 id="video-delete-title">
              Permanently delete video?
            </h2>
            <p>
              <strong>{deleteVideoTarget.fileName}</strong>{' '}
              will be deleted permanently together with its
              thumbnail, assignments, annotation responses,
              question answers, and linked task requests. This
              action cannot be undone.
            </p>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setDeleteVideoTarget(null)}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                onClick={confirmVideoDeletion}
                disabled={actionBusy}
              >
                Delete permanently
              </button>
            </div>
          </section>
        </div>
      )}

      {archiveDatasetTarget && (
        <div
          className="modal-backdrop"
          onClick={() => setArchiveDatasetTarget(null)}
        >
          <section
            className="action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dataset-archive-title"
            onClick={event => event.stopPropagation()}
          >
            <span className="action-modal-icon orange">▣</span>
            <h2 id="dataset-archive-title">
              {archiveDatasetTarget.isArchived
                ? 'Restore dataset?'
                : 'Archive dataset?'}
            </h2>
            <p>
              Confirm this change for{' '}
              <strong>{archiveDatasetTarget.name}</strong>.
              Archiving is allowed only when all video quotas
              have been met.
            </p>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setArchiveDatasetTarget(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={confirmDatasetArchive}
              >
                {archiveDatasetTarget.isArchived
                  ? 'Restore dataset'
                  : 'Archive dataset'}
              </button>
            </div>
          </section>
        </div>
      )}

      {previewVideo && (
        <div
          className="modal-backdrop"
          onClick={() => setPreviewVideo(null)}
        >
          <section
            className="video-modal"
            onClick={event => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>{previewVideo.fileName}</h2>
                <p>
                  Scenario{' '}
                  {previewVideo.scenarioId ?? '—'} ·{' '}
                  {previewVideo.drivingInstruction ?? '—'}
                </p>
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
              >
                ×
              </button>
            </div>

            <video
              controls
              autoPlay
              src={previewVideo.streamUrl}
            />

            <div className="video-details">
              <span>
                {previewVideo.width} ×{' '}
                {previewVideo.height}
              </span>
              <span>
                {previewVideo.frameRate} FPS
              </span>
              <span>
                {previewVideo.durationSeconds} seconds
              </span>
              <span>
                {previewVideo.completedAnnotationCount}/
                {previewVideo.requiredAnnotationCount}{' '}
                annotations
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
