const QUESTIONS_BASE = "/api/questions";
const ANSWERS_BASE = "/api/question-answers";

export interface QuestionDto {
  id: number;
  questionNumber: number;
  text: string;
}

export interface QuestionAnswerDto {
  segmentResponseId: number;
  questionNumber: number;
  answer: string;
}

// Global fixed question bank
export async function getQuestions(): Promise<QuestionDto[]> {
  const res = await fetch(QUESTIONS_BASE);
  if (!res.ok) throw new Error(`Failed to load questions: ${res.status}`);
  return res.json();
}

// Backend has no ?segmentResponseId filter yet — fetch all, filter client-side.
// TODO: ask backend to add a filter param if the answer set grows large.
export async function getAnswersForSegment(segmentResponseId: number): Promise<QuestionAnswerDto[]> {
  const res = await fetch(ANSWERS_BASE);
  if (!res.ok) throw new Error(`Failed to load answers: ${res.status}`);
  const all: QuestionAnswerDto[] = await res.json();
  return all.filter((a) => a.segmentResponseId === segmentResponseId);
}

export async function submitAnswer(payload: QuestionAnswerDto): Promise<QuestionAnswerDto> {
  const res = await fetch(ANSWERS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Failed to submit answer: ${res.status}`);
  }
  return res.json();
import api from './api';
export interface QuestionDto { id: number; datasetId?: number | null; questionText: string; segmentNo: 1 | 2 | 3; isActive: boolean; }
export interface QuestionAnswerDto { segmentResponseId: number; questionId: number; answer: string; }
export async function getQuestions(includeInactive = false, datasetId?: number | null, sessionId?: number | null) {
  const params = new URLSearchParams({ includeInactive: String(includeInactive) });
  if (datasetId !== undefined && datasetId !== null) params.set('datasetId', String(datasetId));
  if (sessionId !== undefined && sessionId !== null) params.set('sessionId', String(sessionId));
  return (await api.get(`/questions?${params.toString()}`)).data as QuestionDto[];
}

export async function updateAnswer(
  segmentResponseId: number,
  questionNumber: number,
  answer: string
): Promise<QuestionAnswerDto> {
  const res = await fetch(`${ANSWERS_BASE}/${segmentResponseId}/${questionNumber}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
  if (!res.ok) throw new Error(`Failed to update answer: ${res.status}`);
  return res.json();
}