import { useState, useRef, useEffect } from "react";
import { FileText, HelpCircle, Trash2, Send, Mic, MicOff, Play, Check } from "lucide-react";
import {
  getAnswersForSegment,
  getQuestions,
  submitAnswer,
  updateAnswer,
  type QuestionDto,
} from "../services/Questionanswerservice";

export interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  labels: string[];
  segmentNumber?: number;
}

interface AnnotationControlsProps {
  sessionId?: string;
  datasetId?: number | null;
  currentTime: number;
  videoDuration?: number;
  segments: Segment[];
  onSeek: (seconds: number) => void;
  onSaveDraft: (text: string) => void;
  onCompleteAnnotation: (id: string, updated: Partial<Segment>) => Promise<void> | void; // single commit to backend
  onDeleteSegment: (id: string) => void;
  onFinalizeSession?: () => Promise<void> | void;
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function parseTimeToSeconds(str: string): number {
  const parts = str.split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function getSupportedRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function AutoResizingTextarea({
  value,
  onChange,
  className,
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      className={`w-full resize-none overflow-hidden ${className}`}
    />
  );
}

// Local, unsaved edit state for a segment tile. Nothing here hits the backend
// until "Mark as Completed" is clicked.
interface LocalDraft {
  text: string;
  startTime: number;
  endTime: number;
}

export default function AnnotationControls({
  sessionId,
  datasetId,
  currentTime,
  segments,
  onSeek,
  onSaveDraft,
  onCompleteAnnotation,
  onDeleteSegment,
  onFinalizeSession,
}: AnnotationControlsProps) {
  const [tab, setTab] = useState<"transcription" | "questions">("transcription");
  const [draftText, setDraftText] = useState("");
  const [localEdits, setLocalEdits] = useState<Record<string, LocalDraft>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Questions are ordered by segment, then by creation id. Unanswered items
  // stay at the front; submitting one appends it to the answered end.
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [answeredOrder, setAnsweredOrder] = useState<number[]>([]);
  const [answerDraft, setAnswerDraft] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [answerSaving, setAnswerSaving] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Tracks the last-seen parent values per segment id, separately from the
  // user's local draft. This is what makes it possible to tell "the parent
  // changed this externally (e.g. composer appended text)" apart from
  // "the user is mid-edit in this tile" — both look like localEdits !==
  // segments[i] otherwise, which was the bug: external updates (composer
  // append) were indistinguishable from stale-but-untouched cache, so
  // neither case ever resynced once an id existed.
  const lastSyncedRef = useRef<Record<string, LocalDraft>>({});

  useEffect(() => {
    setLocalEdits((prev) => {
      const next = { ...prev };
      for (const seg of segments) {
        const lastSynced = lastSyncedRef.current[seg.id];
        const current = next[seg.id];

        const isNew = !lastSynced;
        const wasClean =
          current &&
          lastSynced &&
          current.text === lastSynced.text &&
          current.startTime === lastSynced.startTime &&
          current.endTime === lastSynced.endTime;
        const parentChanged =
          !lastSynced ||
          lastSynced.text !== seg.text ||
          lastSynced.startTime !== seg.startTime ||
          lastSynced.endTime !== seg.endTime;

        // Resync when: brand new segment, or the parent changed AND the
        // user has no unsaved local edits pending (wasClean). If the user
        // is actively mid-edit (dirty), don't clobber their in-progress
        // text — the external change will apply next time they're clean.
        if (isNew || (parentChanged && wasClean)) {
          next[seg.id] = { text: seg.text, startTime: seg.startTime, endTime: seg.endTime };
        }

        lastSyncedRef.current[seg.id] = { text: seg.text, startTime: seg.startTime, endTime: seg.endTime };
      }
      return next;
    });
  }, [segments]);

  // Load active questions as soon as the annotation opens so completion
  // validation works even if the annotator has not visited the Questions tab.
  useEffect(() => {
    let cancelled = false;

    const loadQuestions = async () => {
      setQuestionsLoading(true);
      setQuestionsError(null);
      try {
        const active = await getQuestions(false, datasetId, sessionId ? Number(sessionId) : null);
        const ordered = [...active].sort((a, b) => a.segmentNo - b.segmentNo || a.id - b.id);
        const targetSegment = segments[0];
        const savedAnswers = targetSegment
          ? await getAnswersForSegment(Number(targetSegment.id))
          : [];

        if (!cancelled) {
          const saved = Object.fromEntries(savedAnswers.map((item) => [item.questionId, item.answer]));
          setQuestions(ordered);
          setAnswers(saved);
          setAnsweredOrder(ordered.filter((question) => saved[question.id] !== undefined).map((question) => question.id));
        }
      } catch (error) {
        if (!cancelled) setQuestionsError(error instanceof Error ? error.message : "Unable to load questions.");
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    };

    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [datasetId, sessionId, segments.length, segments[0]?.id]);

  const unansweredQuestions = questions.filter((question) => answers[question.id] === undefined);
  const answeredQuestions = answeredOrder
    .map((id) => questions.find((question) => question.id === id))
    .filter((question): question is QuestionDto => question !== undefined && answers[question.id] !== undefined);
  const currentQuestion = unansweredQuestions[0] ?? null;
  const queue = [...unansweredQuestions, ...answeredQuestions];

  const handleSendAnswer = async () => {
    const targetSegment = segments[0];
    if (!targetSegment || !currentQuestion || !answerDraft.trim() || answerSaving) return;

    setAnswerSaving(true);
    try {
      await submitAnswer({
        segmentResponseId: Number(targetSegment.id),
        questionId: currentQuestion.id,
        answer: answerDraft.trim(),
      });
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answerDraft.trim() }));
      setAnsweredOrder((prev) => [...prev.filter((id) => id !== currentQuestion.id), currentQuestion.id]);
      setAnswerDraft("");
      setQuestionsError(null);
      setCompletionError(null);
    } catch (error) {
      setQuestionsError(error instanceof Error ? error.message : "Unable to save answer.");
    } finally {
      setAnswerSaving(false);
    }
  };

  const handleAnswerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendAnswer();
    }
  };

  const startEditingAnswer = (questionId: number) => {
    setEditingQuestionId(questionId);
    setEditDraft(answers[questionId] ?? "");
  };

  const saveEditedAnswer = async (questionId: number) => {
    const targetSegment = segments[0];
    if (!targetSegment || !editDraft.trim()) return;

    try {
      await updateAnswer(Number(targetSegment.id), questionId, editDraft.trim());
      setAnswers((prev) => ({ ...prev, [questionId]: editDraft.trim() }));
      setEditingQuestionId(null);
      setQuestionsError(null);
    } catch (error) {
      setQuestionsError(error instanceof Error ? error.message : "Unable to update answer.");
    }
  };

  const handleSubmitDraft = () => {
    if (!draftText.trim()) return;
    onSaveDraft(draftText.trim());
    setDraftText("");
  };

  const toggleDictation = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    setMicError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError("Microphone access failed or was denied.");
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setIsTranscribing(true);

      try {
        const rawAudio = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const formData = new FormData();
        const ext = rawAudio.type.includes("mp4") ? "mp4" : rawAudio.type.includes("ogg") ? "ogg" : "webm";
        formData.append("audio", rawAudio, `recording.${ext}`);

        const token = localStorage.getItem("annotate_pro_token");
        const res = await fetch("/api/transcribe", {
          method: "POST",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
        const { text } = await res.json();
        setDraftText((prev) => (prev ? prev + " " : "") + text);
      } catch (e: any) {
        setMicError(e.message ?? "Transcription failed.");
      } finally {
        setIsTranscribing(false);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  // Stop any in-progress recording if the component unmounts mid-recording.
  useEffect(() => {
    return () => mediaRecorderRef.current?.stop();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitDraft();
    }
  };

  const updateLocal = (id: string, fields: Partial<LocalDraft>) => {
    setLocalEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...fields } }));
  };

  const handleComplete = async (id: string) => {
    const draft = localEdits[id];
    if (!draft) return;
    await onCompleteAnnotation(id, draft);
  };

  const completionText = segments[0] ? (localEdits[segments[0].id]?.text ?? segments[0].text ?? "") : "";
  const hasTranscription = completionText.trim().length > 0;
  const canOpenQuestions = hasTranscription;
  const canComplete =
    hasTranscription &&
    !questionsLoading &&
    !questionsError &&
    !answerSaving &&
    unansweredQuestions.length === 0;

  useEffect(() => {
    if (!canOpenQuestions && tab === "questions") {
      setTab("transcription");
    }
  }, [canOpenQuestions, tab]);

  const completeAnnotation = async () => {
    const firstSegment = segments[0];
    if (!firstSegment || !completionText.trim()) {
      setCompletionError("Add a transcription before completing this annotation.");
      setTab("transcription");
      return;
    }

    if (unansweredQuestions.length > 0) {
      setCompletionError(`Answer all questions before completing this annotation. ${unansweredQuestions.length} remaining.`);
      setTab("questions");
      return;
    }

    if (!canComplete || isCompleting || isCompleted) return;

    setCompletionError(null);
    setIsCompleting(true);
    try {
      await handleComplete(firstSegment.id);
      if (onFinalizeSession) {
        await onFinalizeSession();
      }
      setIsCompleted(true);
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : "Unable to complete this annotation.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Single completion action for the annotation session. */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          onClick={completeAnnotation}
          disabled={!canComplete || isCompleting || isCompleted}
          title={!hasTranscription
            ? "Add and save a transcription first."
            : questionsLoading
            ? "Loading questions…"
            : unansweredQuestions.length > 0
            ? `Answer all questions first (${unansweredQuestions.length} remaining).`
            : "Complete this annotation"}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
        >
          <Check size={14} />
          {isCompleted ? "Saved" : isCompleting ? "Completing…" : "Mark as Completed"}
        </button>
      </div>
      {completionError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {completionError}
        </p>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab("transcription")}
          className={`flex items-center gap-1.5 px-1 pb-2.5 mr-6 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "transcription"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText size={15} /> Transcription
        </button>
        <button
          onClick={() => {
            if (canOpenQuestions) setTab("questions");
          }}
          disabled={!canOpenQuestions}
          title={canOpenQuestions ? "Answer annotation questions" : "Save a transcription to unlock Questions"}
          className={`flex items-center gap-1.5 px-1 pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "questions"
              ? "border-blue-600 text-blue-600"
              : canOpenQuestions
              ? "border-transparent text-slate-500 hover:text-slate-700"
              : "border-transparent text-slate-300 cursor-not-allowed"
          }`}
        >
          <HelpCircle size={15} /> Questions
        </button>
      </div>

      {/* Segment tiles / Questions */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
        {tab === "transcription" ? (
          segments.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No annotations yet. Type below to create one.</p>
          ) : (
            segments.map((seg) => {
              const draft = localEdits[seg.id] ?? { text: seg.text, startTime: seg.startTime, endTime: seg.endTime };

              return (
                <div
                  key={seg.id}
                  className="border border-slate-200 rounded-xl p-3 hover:border-blue-200 transition-colors bg-white shadow-sm space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onSeek(seg.startTime)}
                        className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                        title="Jump to time"
                      >
                        <Play size={12} className="fill-current" />
                      </button>

                      <input
                        type="text"
                        value={formatTime(draft.startTime)}
                        onChange={(e) => updateLocal(seg.id, { startTime: parseTimeToSeconds(e.target.value) })}
                        className="w-16 px-1.5 py-0.5 text-xs font-mono font-semibold text-blue-600 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                      />
                      <span className="text-xs text-slate-400 font-mono">-</span>
                      <input
                        type="text"
                        value={formatTime(draft.endTime)}
                        onChange={(e) => updateLocal(seg.id, { endTime: parseTimeToSeconds(e.target.value) })}
                        className="w-16 px-1.5 py-0.5 text-xs font-mono font-semibold text-blue-600 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onDeleteSegment(seg.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        aria-label="Delete segment"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <AutoResizingTextarea
                    value={draft.text}
                    onChange={(text) => updateLocal(seg.id, { text })}
                    className="text-sm text-slate-700 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 leading-relaxed transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  />

                  {seg.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {seg.labels.map((label) => (
                        <span key={label} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          <div className="space-y-4">
            {questionsError && <p className="text-sm text-red-600">{questionsError}</p>}

            {questionsLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Loading questions…
              </div>
            ) : currentQuestion ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      Segment {currentQuestion.segmentNo} · Next question
                    </span>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{currentQuestion.questionText}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500">
                    {answeredQuestions.length + 1}/{questions.length}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                  rows={2}
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
                  onKeyDown={handleAnswerKeyDown}
                  placeholder="Type your answer, then press Enter…"
                  autoFocus
                  className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  onClick={() => void handleSendAnswer()}
                  disabled={!answerDraft.trim() || answerSaving || !segments[0]}
                  title={!segments[0] ? "Add the transcription first so this answer can be saved." : "Save answer"}
                  className="flex h-10 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Send size={14} />
                  {answerSaving ? "Saving…" : "Enter"}
                </button>
                </div>
                {!segments[0] && (
                  <p className="mt-2 text-xs text-amber-700">Add a transcription before answering questions.</p>
                )}
              </div>
            ) : questions.length > 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                All {questions.length} questions have been answered.
              </div>
            ) : null}

            {queue.length > 0 && (
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question queue</h3>
                <span className="text-xs text-slate-400">{unansweredQuestions.length} remaining</span>
              </div>
            )}

            <div className="space-y-3">
              {queue.map((q, index) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = q.id === currentQuestion?.id;
                return (
                  <div key={q.id} className={`rounded-xl border bg-white p-3 ${isCurrent ? "border-blue-300" : "border-slate-200"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-blue-600">Segment {q.segmentNo}</span>
                          <span className={`text-[11px] font-medium ${isAnswered ? "text-emerald-600" : "text-slate-400"}`}>
                            {isAnswered ? "Answered" : isCurrent ? "Answering now" : `Waiting · #${index + 1}`}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-800">{q.questionText}</p>
                      </div>
                      {isAnswered && <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />}
                    </div>
                    {editingQuestionId === q.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEditedAnswer(q.id)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                        >
                          Save
                        </button>
                      </div>
                    ) : isAnswered ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-sm text-slate-600">{answers[q.id]}</p>
                        <button
                          onClick={() => startEditingAnswer(q.id)}
                          className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {questions.length === 0 && !questionsLoading && (
                <p className="text-sm text-slate-400 italic">No active questions.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* The transcription composer belongs only to the Transcription tab. */}
      {tab === "transcription" && (
        <div className="border-t border-slate-200 pt-3 mt-3">
          <div className="relative">
          <textarea
            value={draftText}
            onChange={(e) => {
              setDraftText(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type new transcription segment here..."
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 pr-16 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <button
              onClick={toggleDictation}
              disabled={isTranscribing}
              className={`p-1.5 rounded-lg transition-colors ${
                isRecording
                  ? "text-white bg-red-500 hover:bg-red-600"
                  : isTranscribing
                  ? "text-slate-300 cursor-wait"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              aria-label={isRecording ? "Stop recording" : "Dictate"}
              title={isRecording ? "Stop recording" : "Describe the video by speaking"}
            >
              {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              onClick={handleSubmitDraft}
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              aria-label="Save transcription"
            >
              <Send size={14} />
            </button>
          </div>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {isRecording
              ? "Recording... click the mic to stop and transcribe."
              : isTranscribing
              ? "Transcribing..."
              : "Current time: " + currentTime.toFixed(2) + "s — Press Enter to submit segment."}
          </p>
          {micError && <p className="text-xs text-red-600 mt-1">{micError}</p>}
        </div>
      )}
    </div>
  );
}
