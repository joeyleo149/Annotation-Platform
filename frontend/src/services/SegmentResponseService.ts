const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface SegmentResponseDto {
  id: number;
  annotationSessionId: number;
  segmentNumber: number;
  startTime: string;
  endTime: string;
  transcript: string;
  submittedAt: string;
}

export interface SegmentResponseRequest {
  annotationSessionId: number;
  segmentNumber: number;
  startTime: string;
  endTime: string;
  transcript: string;
  submittedAt?: string;
}

function endpoint(path = "") {
  return `${apiBaseUrl}/segment-responses${path}`;
}

function requestHeaders(): HeadersInit {
  const token = localStorage.getItem("annotate_pro_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? JSON.parse(text) as T | { error?: string; message?: string } : undefined;

  if (!response.ok) {
    const details = body as { error?: string; message?: string } | undefined;
    throw new Error(details?.error ?? details?.message ?? `Request failed (${response.status}).`);
  }

  return body as T;
}

function withSubmittedAt(request: SegmentResponseRequest) {
  return {
    ...request,
    submittedAt: request.submittedAt ?? new Date().toISOString(),
  };
}

export async function getSegmentsBySession(sessionId: number): Promise<SegmentResponseDto[]> {
  const response = await fetch(endpoint("/"), { headers: requestHeaders() });
  const rows = await parseResponse<SegmentResponseDto[]>(response);
  return rows.filter((row) => row.annotationSessionId === sessionId);
}

export async function createSegment(request: SegmentResponseRequest): Promise<SegmentResponseDto> {
  const response = await fetch(endpoint("/"), {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(withSubmittedAt(request)),
  });
  return parseResponse<SegmentResponseDto>(response);
}

export async function updateSegment(id: number, request: SegmentResponseRequest): Promise<SegmentResponseDto> {
  const response = await fetch(endpoint(`/${id}`), {
    method: "PUT",
    headers: requestHeaders(),
    body: JSON.stringify(withSubmittedAt(request)),
  });
  return parseResponse<SegmentResponseDto>(response);
}

export async function deleteSegment(id: number): Promise<void> {
  const response = await fetch(endpoint(`/${id}`), {
    method: "DELETE",
    headers: requestHeaders(),
  });
  if (!response.ok) await parseResponse<never>(response);
}

export function secondsToTimeSpan(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${seconds.toFixed(3).padStart(6, "0")}`;
}

export function timeSpanToSeconds(value: string): number {
  const parts = value.split(":").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
