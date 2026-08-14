// import { useRef, useState } from "react";
// import { useParams } from "react-router-dom";
// import { ChevronRight, Folder } from "lucide-react";
// import VideoPlayer, { type VideoPlayerHandle } from "../components/VideoPlayer";
// import AnnotationControls, {type Segment } from "../components/AnnotationControls";

// // Flip to false once AnnotationSessionService/VideoService/SegmentResponseService are live.
// // Mocks a session an admin would normally auto-assign: one annotator -> one video.
// const MOCK_MODE = true;

// const MOCK_SESSION = {
//   sessionId: "mock-session-001",
//   videoSrc: "/sample-video.mp4", // drop a real .mp4 in /public
//   projectName: "Q3 Product Demo",
//   clipName: "Clip_001.mp4",
// };

// export default function VideoAnnotatorPage() {
//   const params = useParams<{ sessionId: string }>();
//   const sessionId = MOCK_MODE ? MOCK_SESSION.sessionId : params.sessionId;

//   const playerRef = useRef<VideoPlayerHandle>(null);
//   const [currentTime, setCurrentTime] = useState(0);
//   const [pendingStart, setPendingStart] = useState<number | null>(null);

//   // TODO: fetch session -> videoId -> video src/meta via VideoService.jsx, keyed on sessionId
//   const videoSrc = MOCK_MODE ? MOCK_SESSION.videoSrc : "";
//   const projectName = MOCK_MODE ? MOCK_SESSION.projectName : ""; // TODO: from AnnotationSessionService
//   const clipName = MOCK_MODE ? MOCK_SESSION.clipName : ""; // TODO: from Video entity

//   // TODO: replace with real fetch from SegmentResponseService.jsx, scoped to sessionId
//   const [segments, setSegments] = useState<Segment[]>(
//     MOCK_MODE
//       ? [
//           { id: "seg-1", startTime: 15, endTime: 22, text: "Welcome everyone to the demo.", labels: ["Intro"] },
//           { id: "seg-2", startTime: 84, endTime: 105, text: "The annotation tools allow for faster tagging.", labels: ["Feature", "Demo"] },
//         ]
//       : []
//   );

//   const handleSetStart = () => setPendingStart(currentTime);

//   const handleSetEnd = () => {
//     if (pendingStart === null) return;
//     const newSegment: Segment = {
//       id: crypto.randomUUID(),
//       startTime: pendingStart,
//       endTime: currentTime,
//       text: "",
//       labels: [],
//     };
//     setSegments((prev) => [...prev, newSegment]);
//     setPendingStart(null);
//     // TODO: persist via SegmentResponseService.jsx -> POST /api/segments
//   };

//   const handleSaveDraft = (text: string) => {
//     // TODO: attach to nearest/active segment and persist via SegmentResponseService.jsx
//     console.log("draft saved:", text);
//   };

//   return (
//     <div className="h-screen overflow-hidden flex flex-col bg-slate-50">
//       {/* Breadcrumb bar */}
//       <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white">
//         <div className="flex items-center gap-1.5 text-sm text-slate-500">
//           <span>Projects</span>
//           <ChevronRight size={14} />
//           <span>{projectName}</span>
//           <ChevronRight size={14} />
//           <span className="text-slate-900 font-medium">{clipName}</span>
//         </div>
//       </div>

//       <div className="flex" style={{ height: "calc(100vh - 49px)" }}>
//         {/* Video panel */}
//         <div className="flex-1 p-6 overflow-y-auto">
//           <VideoPlayer
//             ref={playerRef}
//             src={videoSrc}
//             onTimeUpdate={setCurrentTime}
//           />
//         </div>

//         {/* Sidebar */}
//         <aside className="w-[400px] border-l border-slate-200 bg-white flex flex-col">
//           <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
//             <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
//               <Folder size={16} />
//             </div>
//             <div>
//               <div className="text-sm font-semibold text-slate-900">Project Workspace</div>
//               <div className="text-xs text-slate-400">Session {sessionId}</div>
//             </div>
//           </div>

//           <div className="flex-1 px-5 py-4 overflow-hidden">
//             <AnnotationControls
//               sessionId={sessionId}
//               currentTime={currentTime}
//               segments={segments}
//               onSetStart={handleSetStart}
//               onSetEnd={handleSetEnd}
//               onSeek={(t) => playerRef.current?.seekTo(t)}
//               onSaveDraft={handleSaveDraft}
//               onEditSegment={(id) => console.log("edit", id)}
//               onDeleteSegment={(id) =>
//                 setSegments((prev) => prev.filter((s) => s.id !== id))
//               }
//             />
//           </div>
//         </aside>
//       </div>
//     </div>
//   );
// }


import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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
} from "../services/SegmentResponseService";

// Flip to false once AnnotationSessionService/VideoService are live.
// Mocks a session an admin would normally auto-assign: one annotator -> one video.
const MOCK_MODE = true;

const MOCK_SESSION = {
  sessionId: 1, // backend AnnotationSession.Id is int — mock uses a plausible seeded id
  videoSrc: "/sample-video.mp4", // drop a real .mp4 in /public
  projectName: "Q3 Product Demo",
  clipName: "Clip_001.mp4",
};

export default function VideoAnnotatorPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = MOCK_MODE ? MOCK_SESSION.sessionId : Number(params.sessionId);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // TODO: fetch session -> videoId -> video src/meta via VideoService.jsx, keyed on sessionId
  const videoSrc = MOCK_MODE ? MOCK_SESSION.videoSrc : "";
  const projectName = MOCK_MODE ? MOCK_SESSION.projectName : ""; // TODO: from AnnotationSessionService
  const clipName = MOCK_MODE ? MOCK_SESSION.clipName : ""; // TODO: from Video entity

  const [segments, setSegments] = useState<Segment[]>(
    MOCK_MODE
      ? [
          { id: "seg-1", startTime: 15, endTime: 22, text: "Welcome everyone to the demo.", labels: ["Intro"] },
          { id: "seg-2", startTime: 84, endTime: 105, text: "The annotation tools allow for faster tagging.", labels: ["Feature", "Demo"] },
        ]
      : []
  );

  // Load real segments once, when not mocking. Backend has no Labels field yet — always [].
  useEffect(() => {
    if (MOCK_MODE) return;
    getSegmentsBySession(sessionId)
      .then((rows) =>
        setSegments(
          rows.map((r: any) => ({
            id: String(r.id),
            startTime: timeSpanToSeconds(r.startTime),
            endTime: timeSpanToSeconds(r.endTime),
            text: r.transcript,
            labels: [],
          }))
        )
      )
      .catch((e) => setLoadError(e.message));
  }, [sessionId]);

  const handleSetStart = () => setPendingStart(currentTime);

  const handleSetEnd = async () => {
    if (pendingStart === null) return;

    if (MOCK_MODE) {
      setSegments((prev) => [
        ...prev,
        { id: crypto.randomUUID(), startTime: pendingStart, endTime: currentTime, text: "", labels: [] },
      ]);
      setPendingStart(null);
      return;
    }

    try {
      const created = await createSegment({
        annotationSessionId: sessionId,
        segmentNumber: segments.length + 1,
        startTime: secondsToTimeSpan(pendingStart),
        endTime: secondsToTimeSpan(currentTime),
        transcript: "",
      });
      setSegments((prev) => [
        ...prev,
        { id: String(created.id), startTime: pendingStart, endTime: currentTime, text: "", labels: [] },
      ]);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setPendingStart(null);
    }
  };

  // Attaches the composer text to the most recent segment still missing a transcript.
  // TODO: revisit — ambiguous which segment a free-floating draft should attach to
  // if multiple are empty; consider requiring an active/selected segment instead.
  const handleSaveDraft = async (text: string) => {
    const target = [...segments].reverse().find((s) => !s.text);
    if (!target) {
      setLoadError("Set a start/end time before saving a transcript.");
      return;
    }

    if (MOCK_MODE) {
      setSegments((prev) => prev.map((s) => (s.id === target.id ? { ...s, text } : s)));
      return;
    }

    try {
      await updateSegment(Number(target.id), {
        annotationSessionId: sessionId,
        segmentNumber: segments.findIndex((s) => s.id === target.id) + 1,
        startTime: secondsToTimeSpan(target.startTime),
        endTime: secondsToTimeSpan(target.endTime),
        transcript: text,
      });
      setSegments((prev) => prev.map((s) => (s.id === target.id ? { ...s, text } : s)));
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
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col">
      {/* Breadcrumb bar */}
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
        {/* Video panel */}
        <div className="flex-1 p-6 overflow-hidden">
          <VideoPlayer
            ref={playerRef}
            src={videoSrc}
            onTimeUpdate={setCurrentTime}
          />
        </div>

        {/* Sidebar */}
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

          <div className="flex-1 px-5 py-4 min-h-0">
            <AnnotationControls
              sessionId={String(sessionId)}
              currentTime={currentTime}
              segments={segments}
              onSetStart={handleSetStart}
              onSetEnd={handleSetEnd}
              onSeek={(t) => playerRef.current?.seekTo(t)}
              onSaveDraft={handleSaveDraft}
              onEditSegment={(id) => console.log("edit", id)}
              onDeleteSegment={handleDeleteSegment}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}