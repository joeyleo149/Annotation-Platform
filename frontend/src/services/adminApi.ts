const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? '/api';

const tokenStorageKey = 'annotate_pro_token';

export type UploadProgressHandler =
  (percentage: number) => void;

export interface DatasetSummary {
  id: number;
  name: string;
  datasetType: string;
  isArchived: boolean;
  archivedAt: string | null;
  totalVideos: number;
  completedVideos: number;
  archivedVideos: number;
  createdAt: string;
}

export interface DatasetMetrics {
  datasetId: number;
  datasetName: string;
  datasetType: string;
  isArchived: boolean;
  totalVideos: number;
  archivedVideos: number;
  completedVideos: number;
  pendingVideos: number;
  totalRequiredAnnotations: number;
  completedAnnotations: number;
  remainingAnnotations: number;
  totalDurationSeconds: number;
  totalHoursAnnotated: number;
}

export interface VideoCatalogItem {
  id: number;
  datasetId: number | null;
  datasetName: string | null;
  scenarioId: string | null;
  datasetRowIndex: number | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  frameRate: number | null;
  width: number | null;
  height: number | null;
  processingStatus: string;
  manifestMatched: boolean;
  scenarioType: string | null;
  drivingInstruction: string | null;
  requiredAnnotationCount: number;
  completedAnnotationCount: number;
  remainingAnnotationCount: number;
  isQuotaMet: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  uploadedAt: string;
  streamUrl: string;
  thumbnailUrl: string | null;
}

export interface TaskRequestItem {
  id: number;
  annotatorId: number;
  datasetId: number;
  status: string;
  requestedAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  annotationSessionId: number | null;
}

export interface AnnotationSessionItem {
  id: number;
  annotatorId: number;
  videoId: number;
  status: string;
  assignedAt: string;
  expiresAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface AssignmentOutcome {
  assigned: boolean;
  message: string;
  requestId: number | null;
  annotatorId: number | null;
  annotationSessionId: number | null;
  videoId: number | null;
  expiresAt: string | null;
}

export interface ExpirationResult {
  expiredSessionCount: number;
  reassignedSessionCount: number;
  processedAt: string;
  assignmentOutcomes: AssignmentOutcome[];
}

export interface ManifestUploadResponse {
  message: string;
  datasetId: number;

  dataset: {
    id: number;
    name: string;
    datasetType: string;
    manifestFileName: string;
    isArchived: boolean;
    createdAt: string;
  };

  manifest: unknown;
}

export interface VideoUploadResult {
  videoId: number;
  fileName: string;
  scenarioId: string | null;
  datasetRowIndex: number | null;
  durationSeconds: number | null;
  frameRate: number | null;
  width: number | null;
  height: number | null;
  thumbnailFileName: string;
  processingStatus: string;
  manifestMatched: boolean;
}

export interface VideoUploadFailure {
  fileName: string;
  statusCode: number;
  error: string;
}

export interface VideoUploadBatchResponse {
  requestedCount: number;
  successfulCount: number;
  failedCount: number;
  successfulUploads: VideoUploadResult[];
  failedUploads: VideoUploadFailure[];
}

export interface VideoArchiveOutcome {
  found: boolean;
  archived: boolean;
  message: string;
  videoId: number;
  completedAnnotationCount: number;
  requiredAnnotationCount: number;
  datasetArchived: boolean;
}

export interface VideoDeletionOutcome {
  found: boolean;
  deleted: boolean;
  message: string;
  videoId: number;
  deletedSessionCount: number;
  deletedSegmentResponseCount: number;
  deletedQuestionAnswerCount: number;
  deletedTaskRequestCount: number;
  videoFileDeleted: boolean;
  thumbnailDeleted: boolean;
}

export interface DatasetArchiveOutcome {
  found: boolean;
  archived: boolean;
  message: string;
  datasetId: number;
  totalVideoCount: number;
  completedVideoCount: number;
}

function createUrl(path: string): string {
  if (path.startsWith('/api')) {
    return path;
  }

  const normalizedPath =
    path.startsWith('/')
      ? path
      : `/${path}`;

  return `${apiBaseUrl}${normalizedPath}`;
}

function createHeaders(
  existingHeaders?: HeadersInit,
  includeContentType = false,
): Headers {
  const headers = new Headers(existingHeaders);

  const token =
    localStorage.getItem(tokenStorageKey);

  if (token) {
    headers.set(
      'Authorization',
      `Bearer ${token}`,
    );
  }

  if (includeContentType) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  return headers;
}

async function readResponse<T>(
  response: Response,
): Promise<T> {
  const text = await response.text();

  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data
        ? String(data.message)
        : typeof data === 'object' &&
            data !== null &&
            'error' in data
          ? String(data.error)
          : typeof data === 'object' &&
              data !== null &&
              'title' in data
            ? String(data.title)
            : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return data as T;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    createUrl(path),
    {
      ...options,

      credentials: 'include',

      headers: createHeaders(
        options.headers,
        options.body !== undefined,
      ),
    },
  );

  return readResponse<T>(response);
}

function uploadForm<T>(
  path: string,
  formData: FormData,
  onProgress?: UploadProgressHandler,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(
      'POST',
      createUrl(path),
    );

    xhr.withCredentials = true;

    const token =
      localStorage.getItem(tokenStorageKey);

    if (token) {
      xhr.setRequestHeader(
        'Authorization',
        `Bearer ${token}`,
      );
    }

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) {
        return;
      }

      const percentage = Math.round(
        (event.loaded / event.total) * 100,
      );

      onProgress?.(percentage);
    };

    xhr.onload = () => {
      let data: unknown = null;

      try {
        data = xhr.responseText
          ? JSON.parse(xhr.responseText)
          : null;
      } catch {
        data = xhr.responseText;
      }

      if (
        xhr.status >= 200 &&
        xhr.status < 300
      ) {
        onProgress?.(100);
        resolve(data as T);
        return;
      }

      const message = (() => {
        if (typeof data === 'object' && data !== null) {
          if ('message' in data && typeof data.message === 'string') {
            return data.message;
          }

          if ('error' in data && typeof data.error === 'string') {
            return data.error;
          }

          if ('title' in data && typeof data.title === 'string') {
            return data.title;
          }

          if ('failedUploads' in data && Array.isArray(data.failedUploads)) {
            const failed = data.failedUploads
              .map(item => {
                if (
                  typeof item === 'object' &&
                  item !== null &&
                  'error' in item &&
                  typeof item.error === 'string'
                ) {
                  const name =
                    'fileName' in item &&
                    typeof item.fileName === 'string'
                      ? item.fileName
                      : 'File';

                  return `${name}: ${item.error}`;
                }

                return String(item);
              })
              .filter(Boolean)
              .join('; ');

            if (failed) {
              return failed;
            }
          }

          if ('errors' in data && typeof data.errors === 'object' && data.errors !== null) {
            const details = Object.values(data.errors)
              .flatMap(value => {
                if (Array.isArray(value)) {
                  return value.map(item => String(item));
                }

                return [String(value)];
              })
              .filter(Boolean)
              .join('; ');

            if (details) {
              return details;
            }
          }
        }

        if (typeof data === 'string' && data.trim()) {
          return data.trim();
        }

        return `Upload failed with status ${xhr.status}.`;
      })();

      reject(new Error(message));
    };

    xhr.onerror = () => {
      reject(
        new Error(
          'The upload could not reach the backend.',
        ),
      );
    };

    xhr.send(formData);
  });
}

export const adminApi = {
  getDatasets(
    includeArchived = true,
  ): Promise<DatasetSummary[]> {
    return request<DatasetSummary[]>(
      `/datasets/?includeArchived=${includeArchived}`,
    );
  },

  getDatasetMetrics(
    datasetId: number,
  ): Promise<DatasetMetrics> {
    return request<DatasetMetrics>(
      `/videos/datasets/${datasetId}/metrics`,
    );
  },

  getVideos(
    datasetId?: number,
    includeArchived = true,
  ): Promise<VideoCatalogItem[]> {
    const parameters = new URLSearchParams();

    if (datasetId !== undefined) {
      parameters.set(
        'datasetId',
        datasetId.toString(),
      );
    }

    parameters.set(
      'includeArchived',
      includeArchived.toString(),
    );

    return request<VideoCatalogItem[]>(
      `/videos/?${parameters.toString()}`,
    );
  },

  uploadManifest(
    file: File,
    datasetName: string,
    datasetType: string,
    onProgress?: UploadProgressHandler,
  ): Promise<ManifestUploadResponse> {
    const formData = new FormData();

    formData.append(
      'file',
      file,
    );

    formData.append(
      'datasetName',
      datasetName,
    );

    formData.append(
      'datasetType',
      datasetType,
    );

    return uploadForm<ManifestUploadResponse>(
      '/upload/manifest',
      formData,
      onProgress,
    );
  },

  uploadVideos(
    files: File[],
    uploadedByAdminId: number,
    datasetId: number,
    requiredAnnotationCount: number,
    onProgress?: UploadProgressHandler,
  ): Promise<VideoUploadBatchResponse> {
    const formData = new FormData();

    formData.append(
      'uploadedByAdminId',
      uploadedByAdminId.toString(),
    );

    formData.append(
      'datasetId',
      datasetId.toString(),
    );

    formData.append(
      'requiredAnnotationCount',
      requiredAnnotationCount.toString(),
    );

    for (const file of files) {
      formData.append(
        'files',
        file,
      );
    }

    return uploadForm<VideoUploadBatchResponse>(
      '/upload/videos',
      formData,
      onProgress,
    );
  },

  updateVideoQuota(
    videoId: number,
    requiredAnnotationCount: number,
  ): Promise<{
    message: string;
    video: VideoCatalogItem;
  }> {
    return request(
      `/videos/${videoId}/quota`,
      {
        method: 'PATCH',

        body: JSON.stringify({
          requiredAnnotationCount,
        }),
      },
    );
  },

  getRequests(
    datasetId?: number,
    status?: string,
  ): Promise<TaskRequestItem[]> {
    const parameters = new URLSearchParams();

    if (datasetId !== undefined) {
      parameters.set(
        'datasetId',
        datasetId.toString(),
      );
    }

    if (status) {
      parameters.set(
        'status',
        status,
      );
    }

    return request<TaskRequestItem[]>(
      `/annotation-sessions/requests?` +
        parameters.toString(),
    );
  },

  assignNext(
    datasetId: number,
    assignmentDurationDays: number,
  ): Promise<AssignmentOutcome> {
    return request<AssignmentOutcome>(
      '/annotation-sessions/assign-next',
      {
        method: 'POST',

        body: JSON.stringify({
          datasetId,
          assignmentDurationDays,
        }),
      },
    );
  },

  getSessions():
    Promise<AnnotationSessionItem[]> {
    return request<AnnotationSessionItem[]>(
      '/annotation-sessions/',
    );
  },

  processExpired():
    Promise<ExpirationResult> {
    return request<ExpirationResult>(
      '/annotation-sessions/process-expired',
      {
        method: 'POST',
      },
    );
  },

  archiveVideo(
    videoId: number,
  ): Promise<VideoArchiveOutcome> {
    return request<VideoArchiveOutcome>(
      `/videos/${videoId}/archive`,
      {
        method: 'PATCH',
      },
    );
  },

  restoreVideo(
    videoId: number,
  ): Promise<VideoArchiveOutcome> {
    return request<VideoArchiveOutcome>(
      `/videos/${videoId}/restore`,
      {
        method: 'PATCH',
      },
    );
  },

  deleteVideo(
    videoId: number,
  ): Promise<VideoDeletionOutcome> {
    return request<VideoDeletionOutcome>(
      `/videos/${videoId}`,
      {
        method: 'DELETE',
      },
    );
  },

  archiveDataset(
    datasetId: number,
  ): Promise<DatasetArchiveOutcome> {
    return request<DatasetArchiveOutcome>(
      `/datasets/${datasetId}/archive`,
      {
        method: 'PATCH',
      },
    );
  },

  restoreDataset(
    datasetId: number,
  ): Promise<DatasetArchiveOutcome> {
    return request<DatasetArchiveOutcome>(
      `/datasets/${datasetId}/restore`,
      {
        method: 'PATCH',
      },
    );
  },

  async downloadAnnotations(
    scope: 'videos' | 'datasets',
    id: number,
    format: 'json' | 'csv',
    includeIncomplete = false,
  ): Promise<void> {
    const parameters = new URLSearchParams({
      format,

      includeIncomplete:
        includeIncomplete.toString(),
    });

    const response = await fetch(
      createUrl(
        `/annotation-exports/${scope}/${id}?` +
          parameters.toString(),
      ),
      {
        credentials: 'include',
        headers: createHeaders(),
      },
    );

    if (!response.ok) {
      await readResponse(response);
      return;
    }

    const content = await response.blob();

    const disposition =
      response.headers.get(
        'Content-Disposition',
      );

    const filenameMatch =
      disposition?.match(
        /filename="?([^";]+)"?/i,
      );

    const filename =
      filenameMatch?.[1] ??
      `${scope}-${id}-annotations.${format}`;

    const downloadUrl =
      URL.createObjectURL(content);

    const link =
      document.createElement('a');

    link.href = downloadUrl;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(downloadUrl);
  },
};