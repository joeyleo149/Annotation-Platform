import { useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronRight} from "lucide-react";
import VideoPlayer, { type VideoPlayerHandle } from "../components/VideoPlayer";
import AnnotationControls, { type Segment } from "../components/AnnotationControls";
import api from "../services/api";
import {
  getSegmentsBySession,
  createSegment,
  updateSegment,
  deleteSegment,
  secondsToTimeSpan,
  timeSpanToSeconds,
} from "../services/SegmentResponseService";

const MOCK_MODE = false;

const MOCK_SESSION = {
  sessionId: 1,
  videoSrc: "/download.mp4",
  projectName: "Q3 Product Demo",
  clipName: "download.mp4",
};

const DEFAULT_ANNOTATION_DURATION = 4;

type SessionDetails = {
  id: number;
  annotatorId: number;
  videoId: number;
  status: string;
  assignedAt: string;
  expiresAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

type VideoDetails = {
  id: number;
  datasetId: number | null;
  datasetName: string | null;
  fileName: string;
  durationSeconds: number | null;
  processingStatus: string;
  streamUrl: string;
};

// TODO: real value once sessions can hold multiple videos — hardcoded true for now
// since "Next Video" is a non-functional placeholder until that flow exists.
const IS_LAST_VIDEO = true;

export default function VideoAnnotatorPage() {
  const params = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sessionId = MOCK_MODE ? MOCK_SESSION.sessionId : Number(params.sessionId);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [singleAnnotationDuration, setSingleAnnotationDuration] = useState<number>(DEFAULT_ANNOTATION_DURATION);

  const [videoSrc, setVideoSrc] = useState<string | null>(MOCK_MODE ? MOCK_SESSION.videoSrc : null);
  const [projectName, setProjectName] = useState(MOCK_MODE ? MOCK_SESSION.projectName : "");
  const [clipName, setClipName] = useState(MOCK_MODE ? MOCK_SESSION.clipName : "");

  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    if (MOCK_MODE) return;

    let ignore = false;

    const loadAssignedVideo = async () => {
      try {
        const sessionResponse = await api.get(`/annotation-sessions/${sessionId}`);
        const session = sessionResponse.data as SessionDetails | null;

        if (!session || !session.videoId) {
          throw new Error("This annotation session is missing a valid video.");
        }

        const videoResponse = await api.get(`/videos/${session.videoId}`);
        const video = videoResponse.data as VideoDetails | null;

        if (!video) {
          throw new Error("The assigned video could not be found.");
        }

        const nextDuration = Number(video.durationSeconds ?? DEFAULT_ANNOTATION_DURATION);

        const token = localStorage.getItem("annotate_pro_token");
        const streamResponse = await fetch(`/api/videos/${session.videoId}/stream`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!streamResponse.ok) {
          throw new Error("The assigned video stream could not be loaded.");
        }

        const blob = await streamResponse.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (!ignore) {
          setVideoSrc(objectUrl);
          setProjectName(video.datasetName || "Dataset");
          setClipName(video.fileName || `Video #${video.id}`);
          setSingleAnnotationDuration(Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : DEFAULT_ANNOTATION_DURATION);
        }

        const rows = await getSegmentsBySession(sessionId);

        if (!ignore) {
          setSegments(
            rows.length > 0
              ? rows.map((r) => ({
                  id: String(r.id),
                  startTime: timeSpanToSeconds(r.startTime),
                  endTime: timeSpanToSeconds(r.endTime),
                  text: r.transcript,
                  labels: ["Full Clip"],
                }))
              : []
          );
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : "Unable to load the assigned video.");
        }
      }
    };

    void loadAssignedVideo();

    return () => {
      ignore = true;
    };
  }, [sessionId]);

  // Appends composer text to the existing annotation, or creates the first one.
  // This still writes immediately — it's a deliberate "new line" action, not a
  // live-edit keystroke, so it's fine as-is (unlike the tile textarea, which
  // now buffers locally until "Mark as Completed").
  const handleSaveDraft = async (newText: string) => {
    if (!newText.trim()) return;

    const existingTarget = segments[0];
    const combinedText = existingTarget?.text
      ? `${existingTarget.text.trim()} ${newText.trim()}`
      : newText.trim();

    if (MOCK_MODE) {
      setSegments([
        {
          id: existingTarget?.id || "seg-1",
          startTime: existingTarget?.startTime ?? 0,
          endTime: existingTarget?.endTime ?? singleAnnotationDuration,
          text: combinedText,
          labels: ["Full Clip"],
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
          endTime: secondsToTimeSpan(singleAnnotationDuration),
          transcript: combinedText,
        });
        setSegments([
          {
            id: String(created.id),
            startTime: 0,
            endTime: singleAnnotationDuration,
            text: combinedText,
            labels: ["Full Clip"],
          },
        ]);
      }
    } catch (e: any) {
      setLoadError(e.message);
    }
  };

  // Single commit to the backend — called only from "Mark as Completed" in
  // AnnotationControls, not on every keystroke. Fixes the per-character
  // network-spam bug from the previous version.
  const handleCompleteAnnotation = async (id: string, updated: Partial<Segment>) => {
    const target = segments.find((s) => s.id === id);
    if (!target) return;

    const merged = { ...target, ...updated };
    setSegments((prev) => prev.map((s) => (s.id === id ? merged : s)));

    if (MOCK_MODE) return;

    try {
      await updateSegment(Number(id), {
        annotationSessionId: sessionId,
        segmentNumber: 1,
        startTime: secondsToTimeSpan(merged.startTime),
        endTime: secondsToTimeSpan(merged.endTime),
        transcript: merged.text,
      });
    } catch (e: any) {
      setLoadError(e.message);
    }
  };

  // Fixed: was unconditionally clearing every segment regardless of which
  // delete button was clicked. Only coincidentally "worked" because the
  // model currently guarantees a single segment.
  const handleDeleteSegment = async (id: string) => {
    if (!MOCK_MODE) {
      try {
        await deleteSegment(Number(id));
      } catch (e: any) {
        setLoadError(e.message);
        return;
      }
    }
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  // Placeholder — multi-video session flow isn't built yet. Button is
  // disabled in AnnotationControls; this exists only so the prop is wired.
  const handleNextVideo = () => {
    console.log("Next video — not implemented yet.");
  };

  const handleCompleteSession = async () => {
    if (MOCK_MODE) {
      navigate('/annotator/annotations');
      return;
    }

    const transcript = segments[0]?.text?.trim();
    if (!transcript) {
      setLoadError('Add a transcription before finishing this video.');
      return;
    }

    try {
      const token = localStorage.getItem('annotate_pro_token');
      const response = await fetch(`/api/annotation-sessions/${sessionId}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Unable to complete this annotation.');
      }

      navigate('/annotator/annotations');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to complete this annotation.');
    }
  };

  // const handleUpdateSegment = async (id: string, updatedFields: Partial<Segment>) => {
  //   const target = segments.find(segment => segment.id === id);
  //   if (!target) return;
  //   const updated = { ...target, ...updatedFields };
  //   setSegments(previous => previous.map(segment => segment.id === id ? updated : segment));
  //   if (!MOCK_MODE) {
  //     try {
  //       await updateSegment(Number(id), { annotationSessionId: sessionId, segmentNumber: 1,
  //         startTime: secondsToTimeSpan(updated.startTime), endTime: secondsToTimeSpan(updated.endTime), transcript: updated.text });
  //     } catch (error: unknown) {
  //       setLoadError(error instanceof Error ? error.message : "Unable to update annotation.");
  //     }
  //   }
  // };

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
          {videoSrc ? (
            <VideoPlayer ref={playerRef} src={videoSrc} onTimeUpdate={setCurrentTime} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-200">
              Loading assigned video...
            </div>
          )}
        </div>

        <aside className="w-[400px] border-l border-slate-200 bg-white flex flex-col min-h-0">
          

          <div className="flex-1 px-5 py-4 min-h-0 overflow-y-auto">
            <AnnotationControls
              sessionId={String(sessionId)}
              currentTime={currentTime}
              segments={segments}
              isLastVideo={IS_LAST_VIDEO}
              onSeek={(t) => playerRef.current?.seekTo(t)}
              onSaveDraft={handleSaveDraft}
              onCompleteAnnotation={handleCompleteAnnotation}
              onDeleteSegment={handleDeleteSegment}
              onNextVideo={handleNextVideo}
              onFinalizeSession={handleCompleteSession}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}