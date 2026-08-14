import { useState } from "react";
import { FileText, HelpCircle, Trash2, Send, Mic, Play } from "lucide-react";

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
  onSeek: (seconds: number) => void;
  onSaveDraft: (text: string) => void;
  onUpdateSegment?: (id: string, updated: Partial<Segment>) => void;
  onDeleteSegment: (id: string) => void;
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

export default function AnnotationControls({
  currentTime,
  segments,
  onSeek,
  onSaveDraft,
  onUpdateSegment,
  onDeleteSegment,
}: AnnotationControlsProps) {
  const [tab, setTab] = useState<"transcription" | "questions">("transcription");
  const [draftText, setDraftText] = useState("");

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

  const handleTextChange = (id: string, text: string) => {
    if (onUpdateSegment) {
      onUpdateSegment(id, { text });
    }
  };

  const handleStartTimeChange = (id: string, val: string) => {
    const startTime = parseTimeToSeconds(val);
    if (onUpdateSegment) {
      onUpdateSegment(id, { startTime });
    }
  };

  const handleEndTimeChange = (id: string, val: string) => {
    const endTime = parseTimeToSeconds(val);
    if (onUpdateSegment) {
      onUpdateSegment(id, { endTime });
    }
  };

  return (
    <div className="flex flex-col h-full">
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

      {/* Segment Tile Content */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
        {tab === "transcription" ? (
          segments.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              No annotations yet. Type below to create one.
            </p>
          ) : (
            segments.map((seg) => (
              <div
                key={seg.id}
                className="border border-slate-200 rounded-xl p-3 hover:border-blue-200 transition-colors bg-white shadow-sm space-y-2.5"
              >
                {/* Editable Timestamps */}
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
                      defaultValue={formatTime(seg.startTime)}
                      onBlur={(e) => handleStartTimeChange(seg.id, e.target.value)}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-semibold text-blue-600 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                    />
                    <span className="text-xs text-slate-400 font-mono">-</span>

                    <input
                      type="text"
                      defaultValue={formatTime(seg.endTime)}
                      onBlur={(e) => handleEndTimeChange(seg.id, e.target.value)}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-semibold text-blue-600 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                    />
                  </div>

                  <button
                    onClick={() => onDeleteSegment(seg.id)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    aria-label="Delete segment"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Inline Editable Textarea */}
                <textarea
                  value={seg.text}
                  onChange={(e) => handleTextChange(seg.id, e.target.value)}
                  className="w-full resize-none text-sm text-slate-700 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 leading-relaxed transition-all"
                  rows={3}
                />

                {seg.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {seg.labels.map((label) => (
                      <span
                        key={label}
                        className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          <p className="text-sm text-slate-400 italic">
            Q&A form renders here from session question definitions.
          </p>
        )}
      </div>

      {/* Draft Input Box */}
      <div className="border-t border-slate-200 pt-3 mt-3">
        <div className="relative">
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              segments.length > 0
                ? "Type to append text to current annotation..."
                : "Type transcription here..."
            }
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 pr-16 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <button
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Dictate"
            >
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
        <p className="text-xs text-slate-400 mt-1">
          {segments.length > 0
            ? "Press Enter to append text to the annotation tile above."
            : `Current: ${currentTime.toFixed(2)}s — creates initial annotation tile.`}
        </p>
      </div>
    </div>
  );
}