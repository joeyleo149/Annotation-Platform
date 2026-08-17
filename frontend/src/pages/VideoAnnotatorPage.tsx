import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router";
import { ChevronRight, Folder } from "lucide-react";
import VideoPlayer, { type VideoPlayerHandle } from "../components/VideoPlayer";
import AnnotationControls, { type Segment } from "../components/AnnotationControls";
import {
  getSegmentsBySession,
  createSegment,
  updateSegment,
  deleteSegment,
  secondsToTimeSpan,
  timeSpanToSeconds,
  type SegmentResponseDto,
} from "../services/SegmentResponseService";

const MOCK_MODE = true;

const MOCK_SESSION = {
  sessionId: 1,
  videoSrc: "/download.mp4",
  projectName: "Q3 Product Demo",
  clipName: "download.mp4",
};

const SINGLE_ANNOTATION_DURATION = 4;

export default function VideoAnnotatorPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = MOCK_MODE ? MOCK_SESSION.sessionId : Number(params.sessionId);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const videoSrc = MOCK_MODE ? MOCK_SESSION.videoSrc : "";
  const projectName = MOCK_MODE ? MOCK_SESSION.projectName : "";
  const clipName = MOCK_MODE ? MOCK_SESSION.clipName : "";

  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    if (MOCK_MODE) return;
    getSegmentsBySession(sessionId)
      .then((rows: SegmentResponseDto[]) => {
        if (rows.length > 0) {
          setSegments(
            rows.length > 0
              ? rows.map((r) => ({
                  id: String(r.id),
                  startTime: timeSpanToSeconds(r.startTime),
                  endTime: timeSpanToSeconds(r.endTime),
                  text: r.transcript,
                  labels: ["Full Clip"],
                  segmentNumber: r.segmentNumber,
                }))
              : []
          );
        }
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Unable to load annotations."));
  }, [sessionId]);

  // Appends incoming text if an annotation already exists
  const handleSaveDraft = async (newText: string) => {
    if (!newText.trim()) return;

    const existingTarget = segments[0];

    // Combine previous text with new text (if segment exists)
    const combinedText = existingTarget?.text
      ? `${existingTarget.text.trim()} ${newText.trim()}`
      : newText.trim();

    if (MOCK_MODE) {
      setSegments([
        {
          id: existingTarget?.id || "seg-1",
          startTime: existingTarget?.startTime ?? 0,
          endTime: existingTarget?.endTime ?? SINGLE_ANNOTATION_DURATION,
          text: combinedText,
          labels: ["Full Clip"],
          segmentNumber: existingTarget?.segmentNumber ?? 1,
        },
      ]);
      return;
    }

    try {
      if (existingTarget) {
        await updateSegment(Number(existingTarget.id), {
          annotationSessionId: sessionId,
          segmentNumber: 1,
          startTime: secondsToTimeSpan(existingTarget.startTime),
          endTime: secondsToTimeSpan(existingTarget.endTime),
          transcript: combinedText,
        });
        setSegments([{ ...existingTarget, text: combinedText }]);
      } else {
        const created = await createSegment({
          annotationSessionId: sessionId,
          segmentNumber: 1,
          startTime: secondsToTimeSpan(0),
          endTime: secondsToTimeSpan(SINGLE_ANNOTATION_DURATION),
          transcript: combinedText,
        });
        setSegments([
          {
            id: String(created.id),
            startTime: 0,
            endTime: SINGLE_ANNOTATION_DURATION,
            text: combinedText,
            labels: ["Full Clip"],
            segmentNumber: created.segmentNumber,
          },
        ]);
      }
    } catch (e: any) {
      setLoadError(e.message);
    }
  };

  const handleDeleteSegment = async (id: string) => {
    if (!MOCK_MODE) {
      try {
        await deleteSegment(Number(id));
      } catch (e: any) {
        setLoadError(e.message);
        return;
      }
    }
    setSegments([]);
  };

  const handleUpdateSegment = async (id: string, updatedFields: Partial<Segment>) => {
    const target = segments.find(segment => segment.id === id);
    if (!target) return;
    const updated = { ...target, ...updatedFields };
    setSegments(previous => previous.map(segment => segment.id === id ? updated : segment));
    if (!MOCK_MODE) {
      try {
        await updateSegment(Number(id), { annotationSessionId: sessionId, segmentNumber: 1,
          startTime: secondsToTimeSpan(updated.startTime), endTime: secondsToTimeSpan(updated.endTime), transcript: updated.text });
      } catch (error: unknown) {
        setLoadError(error instanceof Error ? error.message : "Unable to update annotation.");
      }
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <span>Projects</span>
          <ChevronRight size={14} />
          <span>{projectName}</span>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">{clipName}</span>
        </div>
      </div>

      {loadError && (
        <div className="shrink-0 px-6 py-2 bg-red-50 text-red-600 text-sm border-b border-red-200">
          {loadError}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden bg-black flex flex-col">
          <VideoPlayer
            ref={playerRef}
            src={videoSrc}
            onTimeUpdate={setCurrentTime}
          />
        </div>

        <aside className="w-[400px] border-l border-slate-200 bg-white flex flex-col min-h-0">
          <div className="shrink-0 flex items-center gap-2 px-5 py-4 border-b border-slate-200">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Folder size={16} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Project Workspace</div>
              <div className="text-xs text-slate-400">Session {sessionId}</div>
            </div>
          </div>

          <div className="flex-1 px-5 py-4 min-h-0 overflow-y-auto">
            <AnnotationControls
              sessionId={String(sessionId)}
              currentTime={currentTime}
              videoDuration={SINGLE_ANNOTATION_DURATION}
              segments={segments}
              onSeek={(t) => playerRef.current?.seekTo(t)}
              onSaveDraft={handleSaveDraft}
              onUpdateSegment={handleUpdateSegment}
              onDeleteSegment={handleDeleteSegment}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
