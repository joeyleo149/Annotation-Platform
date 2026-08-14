const BASE = "/api/segment-responses";

export interface SegmentResponseDto {
  id: number;
  annotationSessionId: number;
  segmentNumber: number;
  startTime: string; // "hh:mm:ss"
  endTime: string;
  transcript: string;
  submittedAt: string;
}

interface SegmentPayload {
  annotationSessionId: number;
  segmentNumber: number;
  startTime: string;
  endTime: string;
  transcript: string;
}

// Backend has no ?sessionId filter yet — fetch all, filter client-side.
// TODO: ask backend to add GET /api/segment-responses?sessionId= if list grows large.
export async function getSegmentsBySession(sessionId: number): Promise<SegmentResponseDto[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`Failed to load segments: ${res.status}`);
  const all: SegmentResponseDto[] = await res.json();
  return all.filter((s) => s.annotationSessionId === sessionId);
}

export async function createSegment(payload: SegmentPayload): Promise<SegmentResponseDto> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, submittedAt: new Date().toISOString() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Failed to create segment: ${res.status}`);
  }
  return res.json();
}

export async function updateSegment(id: number, payload: SegmentPayload): Promise<SegmentResponseDto> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, submittedAt: new Date().toISOString() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Failed to update segment: ${res.status}`);
  }
  return res.json();
}

export async function deleteSegment(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete segment: ${res.status}`);
}

// Converts a plain seconds number (from the video player) into "hh:mm:ss" for the API.
export function secondsToTimeSpan(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Converts "hh:mm:ss" back to seconds for the player/UI.
export function timeSpanToSeconds(ts: string): number {
  const [h, m, s] = ts.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}