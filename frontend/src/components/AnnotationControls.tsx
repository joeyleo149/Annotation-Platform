import { useState, useRef, useEffect } from "react";
import { FileText, HelpCircle, Trash2, Send, Mic, MicOff, Play, Check, ChevronRight } from "lucide-react";
import { getAnswersForSegment, getQuestions, submitAnswer, type QuestionDto } from "../services/Questionanswerservice";

export interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  labels: string[];
  segmentNumber: number;
}

interface AnnotationControlsProps {
  sessionId?: string;
  datasetId?: number | null; 
  currentTime: number;
  videoDuration?: number;
  segments: Segment[];
  isLastVideo?: boolean; // controls whether the nav button reads "Next Video" or "Done"
  onSeek: (seconds: number) => void;
  onSaveDraft: (text: string) => void;
  onCompleteAnnotation: (id: string, updated: Partial<Segment>) => void; // single commit to backend
  onDeleteSegment: (id: string) => void;
  onNextVideo?: () => void; // not wired yet — flow for multi-video sessions is incomplete
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
  currentTime,
  videoDuration = 0,
  segments,
  isLastVideo = false,
  onSeek,
  onSaveDraft,
  onCompleteAnnotation,
  onDeleteSegment,
  onNextVideo,
  onFinalizeSession,
}: AnnotationControlsProps) {
  const [tab, setTab] = useState<"transcription" | "questions">("transcription");
  const [draftText, setDraftText] = useState("");
  const [localEdits, setLocalEdits] = useState<Record<string, LocalDraft>>({});
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [isMarkedCompleted, setIsMarkedCompleted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [questionError, setQuestionError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "questions") return;
    let cancelled = false;
    const loadQuestions = async () => {
      try {
        const active = await getQuestions(false);
        const answerGroups = await Promise.all(segments.filter(segment => Number(segment.id) > 0).map(segment => getAnswersForSegment(Number(segment.id))));
        if (!cancelled) {
          setQuestions(active);
          setAnswers(Object.fromEntries(answerGroups.flat().map(answer => [answer.questionId, answer.answer])));
        }
      } catch (error) { if (!cancelled) setQuestionError(error instanceof Error ? error.message : "Unable to load questions."); }
    };
    void loadQuestions();
    return () => { cancelled = true; };
  }, [segments, tab]);

  const isQuestionUnlocked = (question: QuestionDto) => question.segmentNo === 1
    ? currentTime >= 4
    : question.segmentNo === 2
      ? currentTime >= 7
      : videoDuration > 0 && currentTime >= videoDuration - 0.15;

  const saveQuestionAnswer = async (question: QuestionDto) => {
    const segment = segments.find(item => item.segmentNumber === question.segmentNo);
    const answer = answerDrafts[question.id]?.trim();
    if (!segment || !answer) return;
    try {
      await submitAnswer({ segmentResponseId: Number(segment.id), questionId: question.id, answer });
      setAnswers(previous => ({ ...previous, [question.id]: answer }));
      setAnswerDrafts(previous => ({ ...previous, [question.id]: "" }));
    } catch (error) { setQuestionError(error instanceof Error ? error.message : "Unable to save answer."); }
  };

  const handleSubmitDraft = () => {
    if (isMarkedCompleted || !draftText.trim()) return;
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
    if (isMarkedCompleted) return;
    setLocalEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...fields } }));
    setJustCompleted(null);
  };

  const handleComplete = (id: string) => {
    const draft = localEdits[id];
    if (!draft) return;
    onCompleteAnnotation(id, draft);
    setJustCompleted(id);
  };

  const completionText = segments[0] ? (localEdits[segments[0].id]?.text ?? segments[0].text ?? "") : "";

  const toggleCompleteState = async () => {
    if (isMarkedCompleted) {
      setIsMarkedCompleted(false);
      setJustCompleted(null);
      return;
    }

    const firstSegment = segments[0];
    if (!firstSegment || !completionText.trim()) return;

    handleComplete(firstSegment.id);
    setIsMarkedCompleted(true);

    if (onFinalizeSession) {
      await onFinalizeSession();
    }
  };

  const isDirtyFor = (seg: Segment) => {
    const draft = localEdits[seg.id];
    if (!draft) return false;
    return draft.text !== seg.text || draft.startTime !== seg.startTime || draft.endTime !== seg.endTime;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar — Mark as Completed (left), session nav (right, placeholder) */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          onClick={toggleCompleteState}
          disabled={!isMarkedCompleted && !completionText.trim()}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isMarkedCompleted
              ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
              : "bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white"
          }`}
        >
          <Check size={14} />
          {isMarkedCompleted || (segments[0] && justCompleted === segments[0].id && !isDirtyFor(segments[0]))
            ? "Saved"
            : "Mark as Completed"}
        </button>
        <button
          onClick={onNextVideo}
          disabled
          title="Multi-video session flow not wired yet"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400 cursor-not-allowed"
        >
          {isLastVideo ? "Done" : "Next Video"}
          <ChevronRight size={14} />
        </button>
      </div>

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
          onClick={() => setTab("questions")}
          className={`flex items-center gap-1.5 px-1 pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "questions"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <HelpCircle size={15} /> Questions
        </button>
      </div>

      {/* Segment tiles */}
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
                    disabled={isMarkedCompleted}
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
        ) : <div className="space-y-3">
          {questionError ? <p className="text-sm text-red-600">{questionError}</p> : null}
          {questions.map(question => {
            const unlocked = isQuestionUnlocked(question);
            const segment = segments.find(item => item.segmentNumber === question.segmentNo);
            const saved = answers[question.id];
            return <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-blue-600">Segment {question.segmentNo}</span>{saved ? <span className="text-xs text-emerald-600">Answered</span> : null}</div>
              <p className="text-sm font-medium text-slate-800">{question.questionText}</p>
              {!unlocked ? <p className="mt-2 text-xs text-slate-400">Available {question.segmentNo === 1 ? "after 4 seconds" : question.segmentNo === 2 ? "after 7 seconds" : "when the video finishes"}.</p>
                : saved ? <p className="mt-2 text-sm text-slate-600">{saved}</p>
                : !segment ? <p className="mt-2 text-xs text-amber-600">Create the matching segment response before answering.</p>
                : <div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" value={answerDrafts[question.id] ?? ""} onChange={event => setAnswerDrafts(previous => ({ ...previous, [question.id]: event.target.value }))} placeholder="Enter your answer" /><button className="rounded-lg bg-blue-600 px-3 text-sm text-white" onClick={() => void saveQuestionAnswer(question)}>Save</button></div>}
            </article>;
          })}
          {questions.length === 0 ? <p className="text-sm text-slate-400 italic">No active questions.</p> : null}
        </div>}
      </div>

      {/* New annotation composer */}
      <div className="border-t border-slate-200 pt-3 mt-3">
        <div className="relative">
          <textarea
            value={draftText}
            disabled={isMarkedCompleted}
            onChange={(e) => {
              if (isMarkedCompleted) return;
              setDraftText(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={isMarkedCompleted ? "Completed — click the button to resume editing." : "Type new transcription segment here..."}
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
    </div>
  );
}
