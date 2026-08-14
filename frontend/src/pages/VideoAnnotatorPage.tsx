import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronRight, Folder } from "lucide-react";
import VideoPlayer, { type VideoPlayerHandle } from "../components/VideoPlayer";
import AnnotationControls, {type Segment } from "../components/AnnotationControls";

// Flip to false once AnnotationSessionService/VideoService/SegmentResponseService are live.
// Mocks a session an admin would normally auto-assign: one annotator -> one video.
const MOCK_MODE = true;

const MOCK_SESSION = {
  sessionId: "mock-session-001",
  videoSrc: "/sample-video.mp4", // drop a real .mp4 in /public
  projectName: "Q3 Product Demo",
  clipName: "Clip_001.mp4",
};

export default function VideoAnnotatorPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = MOCK_MODE ? MOCK_SESSION.sessionId : params.sessionId;

  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [pendingStart, setPendingStart] = useState<number | null>(null);

  // TODO: fetch session -> videoId -> video src/meta via VideoService.jsx, keyed on sessionId
  const videoSrc = MOCK_MODE ? MOCK_SESSION.videoSrc : "";
  const projectName = MOCK_MODE ? MOCK_SESSION.projectName : ""; // TODO: from AnnotationSessionService
  const clipName = MOCK_MODE ? MOCK_SESSION.clipName : ""; // TODO: from Video entity

  // TODO: replace with real fetch from SegmentResponseService.jsx, scoped to sessionId
  const [segments, setSegments] = useState<Segment[]>(
    MOCK_MODE
      ? [
          { id: "seg-1", startTime: 15, endTime: 22, text: "Welcome everyone to the demo.", labels: ["Intro"] },
          { id: "seg-2", startTime: 84, endTime: 105, text: "The annotation tools allow for faster tagging.", labels: ["Feature", "Demo"] },
        ]
      : []
  );

  const handleSetStart = () => setPendingStart(currentTime);

  const handleSetEnd = () => {
    if (pendingStart === null) return;
    const newSegment: Segment = {
      id: crypto.randomUUID(),
      startTime: pendingStart,
      endTime: currentTime,
      text: "",
      labels: [],
    };
    setSegments((prev) => [...prev, newSegment]);
    setPendingStart(null);
    // TODO: persist via SegmentResponseService.jsx -> POST /api/segments
  };

  const handleSaveDraft = (text: string) => {
    // TODO: attach to nearest/active segment and persist via SegmentResponseService.jsx
    console.log("draft saved:", text);
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50">
      {/* Breadcrumb bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <span>Projects</span>
          <ChevronRight size={14} />
          <span>{projectName}</span>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">{clipName}</span>
        </div>
      </div>

      <div className="flex" style={{ height: "calc(100vh - 49px)" }}>
        {/* Video panel */}
        <div className="flex-1 p-6 overflow-y-auto">
          <VideoPlayer
            ref={playerRef}
            src={videoSrc}
            onTimeUpdate={setCurrentTime}
          />
        </div>

        {/* Sidebar */}
        <aside className="w-[400px] border-l border-slate-200 bg-white flex flex-col">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Folder size={16} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Project Workspace</div>
              <div className="text-xs text-slate-400">Session {sessionId}</div>
            </div>
          </div>

          <div className="flex-1 px-5 py-4 overflow-hidden">
            <AnnotationControls
              sessionId={sessionId}
              currentTime={currentTime}
              segments={segments}
              onSetStart={handleSetStart}
              onSetEnd={handleSetEnd}
              onSeek={(t) => playerRef.current?.seekTo(t)}
              onSaveDraft={handleSaveDraft}
              onEditSegment={(id) => console.log("edit", id)}
              onDeleteSegment={(id) =>
                setSegments((prev) => prev.filter((s) => s.id !== id))
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}