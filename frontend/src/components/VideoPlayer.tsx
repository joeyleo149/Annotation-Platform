import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Captions, Maximize, Gauge } from "lucide-react";

const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;
const ASSUMED_FPS = 29.97;

export interface VideoPlayerHandle {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  src: string;
  fps?: number;
  hasAudio?: boolean;
  hasCaptions?: boolean;
  onTimeUpdate?: (seconds: number) => void;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (
    {
      src,
      fps = ASSUMED_FPS,
      hasAudio = false,
      hasCaptions = false,
      onTimeUpdate,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [rateIndex, setRateIndex] = useState(1); // Default to 1x speed
    const [isMuted, setIsMuted] = useState(false);
    const frameDuration = 1 / fps;

    const currentRate = PLAYBACK_RATES[rateIndex];

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      seekTo: (seconds: number) => {
        if (videoRef.current) videoRef.current.currentTime = seconds;
      },
    }));

    const handleTimeUpdate = useCallback(() => {
      const t = videoRef.current?.currentTime ?? 0;
      setCurrentTime(t);
      onTimeUpdate?.(t);
    }, [onTimeUpdate]);

    useEffect(() => {
      if (videoRef.current) videoRef.current.playbackRate = currentRate;
    }, [currentRate]);

    const togglePlay = () => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    const toggleMute = () => {
      if (!videoRef.current || !hasAudio) return;
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    };

    const cycleSpeed = () => {
      setRateIndex((prev) => (prev + 1) % PLAYBACK_RATES.length);
    };

    const stepFrame = (direction: 1 | -1) => {
      if (!videoRef.current) return;
      videoRef.current.pause();
      setIsPlaying(false);
      const next = Math.min(
        Math.max(videoRef.current.currentTime + direction * frameDuration, 0),
        duration
      );
      videoRef.current.currentTime = next;
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = Number(e.target.value);
      if (videoRef.current) videoRef.current.currentTime = t;
      setCurrentTime(t);
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (document.fullscreenElement) document.exitFullscreen();
      else containerRef.current.requestFullscreen();
    };

    const progressPct = duration ? (currentTime / duration) * 100 : 0;

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full min-h-0 min-w-0 rounded-xl flex flex-col justify-between "
      >
        {/* Video Area */}
        <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-black overflow-hidden">
          <video
            ref={videoRef}
            src={src}
            className="max-w-full max-h-full object-contain block cursor-pointer"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
          />
        </div>

        {/* Integrated Control Bar */}
        <div className="bg-black/90 px-4 py-3 flex items-center gap-4 shrink-0 border-t border-white/10">
          <button
            onClick={togglePlay}
            className="text-white hover:text-blue-400 transition-colors"
            aria-label="Play/pause"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            onClick={() => stepFrame(-1)}
            className="text-white hover:text-blue-400 transition-colors"
            aria-label="Previous frame"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={() => stepFrame(1)}
            className="text-white hover:text-blue-400 transition-colors"
            aria-label="Next frame"
          >
            <SkipForward size={16} />
          </button>

          <span className="text-white text-sm font-mono tabular-nums w-28 shrink-0">
            {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
          </span>

          {/* Timeline Scrubber */}
          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={frameDuration}
              value={currentTime}
              onChange={handleScrub}
              className="w-full h-1.5 rounded-full appearance-none bg-white/20 accent-blue-600 cursor-pointer"
              style={{
                background: `linear-gradient(to right, #2563eb ${progressPct}%, rgba(255,255,255,0.2) ${progressPct}%)`,
              }}
              aria-label="Timeline scrubber"
            />
          </div>

          {/* Playback Speed Icon Button */}
          <button
            onClick={cycleSpeed}
            className="text-white hover:text-blue-400 transition-colors flex items-center gap-1 text-xs font-mono px-1.5 py-1 rounded hover:bg-white/10"
            aria-label="Playback speed"
            title={`Speed: ${currentRate}x`}
          >
            <Gauge size={18} />
            <span>{currentRate}x</span>
          </button>

          {/* Volume Control */}
          <button
            onClick={toggleMute}
            disabled={!hasAudio}
            className={`text-white transition-colors ${
              !hasAudio ? "opacity-40 cursor-not-allowed" : "hover:text-blue-400"
            }`}
            aria-label={hasAudio ? (isMuted ? "Unmute" : "Mute") : "No audio available"}
            title={hasAudio ? (isMuted ? "Unmute" : "Mute") : "No audio available"}
          >
            {isMuted || !hasAudio ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Captions Control */}
          <button
            disabled={!hasCaptions}
            className={`text-white transition-colors ${
              !hasCaptions ? "opacity-40 cursor-not-allowed" : "hover:text-blue-400"
            }`}
            aria-label={hasCaptions ? "Captions" : "No captions available"}
            title={hasCaptions ? "Captions" : "No captions available"}
          >
            <Captions size={18} />
          </button>

          {/* Fullscreen Control */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-blue-400 transition-colors"
            aria-label="Fullscreen"
          >
            <Maximize size={18} />
          </button>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;