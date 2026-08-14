import { useState } from "react";
import { FileText, HelpCircle, Plus, Pencil, MoreHorizontal, Send, Mic } from "lucide-react";

export interface Segment {
  id: string;
  startTime: number; // seconds
  endTime: number;
  text: string;
  labels: string[];
}

interface AnnotationControlsProps {
  sessionId?: string;
  currentTime: number;
  segments: Segment[];
  onSetStart: () => void;
  onSetEnd: () => void;
  onSeek: (seconds: number) => void;
  onSaveDraft: (text: string) => void; // persists a new segment via SegmentResponseService
  onEditSegment: (id: string) => void;
  onDeleteSegment: (id: string) => void;
}

function formatRange(start: number, end: number): string {
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

export default function AnnotationControls({
  currentTime,
  segments,
  onSetStart,
  onSetEnd,
  onSeek,
  onSaveDraft,
  onEditSegment,
  onDeleteSegment,
}: AnnotationControlsProps) {
  const [tab, setTab] = useState<"transcription" | "questions">("transcription");
  const [draftText, setDraftText] = useState("");

  const handleSubmitDraft = () => {
    if (!draftText.trim()) return;
    onSaveDraft(draftText.trim());
    setDraftText("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab("transcription")}
          className={`flex items-center gap-1.5 px-1 pb-2.5 mr-6 text-sm font-medium border-b-2 -mb-px ${
            tab === "transcription"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText size={15} /> Transcription
        </button>
        <button
          onClick={() => setTab("questions")}
          className={`flex items-center gap-1.5 px-1 pb-2.5 text-sm font-medium border-b-2 -mb-px ${
            tab === "questions"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <HelpCircle size={15} /> Questions
        </button>
      </div>

      {/* Set start/end — Story 4.2 */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onSetStart}
          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm text-slate-700"
        >
          Set Start Time
        </button>
        <button
          onClick={onSetEnd}
          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm text-slate-700"
        >
          Set End Time
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-3">
        {tab === "transcription" ? (
          segments.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No segments yet. Set a start/end time to begin.</p>
          ) : (
            segments.map((seg) => (
              <div
                key={seg.id}
                className="border border-slate-200 rounded-xl p-3 hover:border-blue-200 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <button
                    onClick={() => onSeek(seg.startTime)}
                    className="text-xs font-mono font-medium text-blue-600 hover:underline"
                  >
                    {formatRange(seg.startTime, seg.endTime)}
                  </button>
                  <div className="flex items-center gap-2 text-slate-400">
                    <button onClick={() => onEditSegment(seg.id)} aria-label="Edit segment">
                      <Pencil size={14} className="hover:text-slate-600" />
                    </button>
                    <button onClick={() => onDeleteSegment(seg.id)} aria-label="Segment options">
                      <MoreHorizontal size={14} className="hover:text-slate-600" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{seg.text}</p>
                {seg.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {seg.labels.map((label) => (
                      <span
                        key={label}
                        className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600"
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
            Q&A form renders here from session question definitions — wire to QuestionAnswerService.jsx
          </p>
        )}
      </div>

      {/* New annotation / composer */}
      <div className="border-t border-slate-200 pt-3 mt-3">
        <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 mb-3">
          <Plus size={15} /> New Annotation
        </button>

        <div className="relative">
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Type transcription here..."
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 pr-16 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <button className="p-1.5 text-slate-400 hover:text-slate-600" aria-label="Dictate">
              <Mic size={16} />
            </button>
            <button
              onClick={handleSubmitDraft}
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              aria-label="Save transcription"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Current: {currentTime.toFixed(2)}s — attaches to segment at this time
        </p>
      </div>
    </div>
  );
}