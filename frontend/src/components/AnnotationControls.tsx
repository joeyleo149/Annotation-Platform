import { useState, useRef, useEffect } from "react";
import { FileText, HelpCircle, Trash2, Send, Mic, Play, Check, ChevronRight } from "lucide-react";

export interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  labels: string[];
}

interface AnnotationControlsProps {
  sessionId?: string;
  currentTime: number;
  segments: Segment[];
  isLastVideo?: boolean; // controls whether the nav button reads "Next Video" or "Done"
  onSeek: (seconds: number) => void;
  onSaveDraft: (text: string) => void;
  onCompleteAnnotation: (id: string, updated: Partial<Segment>) => void; // single commit to backend
  onDeleteSegment: (id: string) => void;
  onNextVideo?: () => void; // not wired yet — flow for multi-video sessions is incomplete
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

function AutoResizingTextarea({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
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
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      className={`w-full resize-none overflow-hidden ${className}`}
    />
  );
}

// Local, unsaved edit state for a segment tile. Nothing here hits the backend
// until "Mark as Completed" is clicked — fixes both the per-keystroke network
// spam bug and the stale-defaultValue bug from controlling these fields locally.
interface LocalDraft {
  text: string;
  startTime: number;
  endTime: number;
}

export default function AnnotationControls({
  currentTime,
  segments,
  isLastVideo = false,
  onSeek,
  onSaveDraft,
  onCompleteAnnotation,
  onDeleteSegment,
  onNextVideo,
}: AnnotationControlsProps) {
  const [tab, setTab] = useState<"transcription" | "questions">("transcription");
  const [draftText, setDraftText] = useState("");
  const [localEdits, setLocalEdits] = useState<Record<string, LocalDraft>>({});
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  // Seed local edit state only when a segment first appears (new id) —
  // don't clobber in-progress local edits on every parent re-render.
  useEffect(() => {
    setLocalEdits((prev) => {
      const next = { ...prev };
      for (const seg of segments) {
        if (!(seg.id in next)) {
          next[seg.id] = { text: seg.text, startTime: seg.startTime, endTime: seg.endTime };
        }
      }
      return next;
    });
  }, [segments]);

  const handleSubmitDraft = () => {
    if (!draftText.trim()) return;
    onSaveDraft(draftText.trim());
    setDraftText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitDraft();
    }
  };

  const updateLocal = (id: string, fields: Partial<LocalDraft>) => {
    setLocalEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...fields } }));
    setJustCompleted(null);
  };

  const handleComplete = (id: string) => {
    const draft = localEdits[id];
    if (!draft) return;
    onCompleteAnnotation(id, draft);
    setJustCompleted(id);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar — session nav, placeholder until multi-video flow is wired */}
      <div className="flex items-center justify-end gap-2 mb-3">
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
              const isDirty =
                draft.text !== seg.text || draft.startTime !== seg.startTime || draft.endTime !== seg.endTime;

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
                      {isDirty && (
                        <button
                          onClick={() => handleComplete(seg.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                        >
                          <Check size={12} /> Mark as Completed
                        </button>
                      )}
                      {!isDirty && justCompleted === seg.id && (
                        <span className="text-xs text-green-600 font-medium">Saved</span>
                      )}
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
                    className="text-sm text-slate-700 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 leading-relaxed transition-all"
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
          <p className="text-sm text-slate-400 italic">
            Q&A form renders here from session question definitions.
          </p>
        )}
      </div>

      {/* New annotation composer */}
      <div className="border-t border-slate-200 pt-3 mt-3">
        <div className="relative">
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type new transcription segment here..."
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 pr-16 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Dictate">
              <Mic size={16} />
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
          Current time: {currentTime.toFixed(2)}s — Press Enter to submit segment.
        </p>
      </div>
    </div>
  );
}