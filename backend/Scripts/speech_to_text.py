"""
speech_to_text.py

Offline speech-to-text for annotation-platform video clips, using OpenAI Whisper.

Usage:
    python speech_to_text.py --video path/to/clip.mp4 --output path/to/out.json
    python speech_to_text.py --video clip.mp4 --language en --model base

Output JSON shape matches SegmentResponse fields (StartTime/EndTime as "hh:mm:ss"),
so it can be loaded directly as draft transcripts in AnnotationControls.tsx or
posted to POST /api/segment-responses.

Note: segment end-times are Whisper's raw output, not clipped against the actual
video duration. Whisper sometimes estimates a segment boundary slightly past the
real audio end (silence padding / VAD behavior) — that's left as-is intentionally,
not treated as an error.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_LANGUAGE = "en"
DEFAULT_MODEL = "base"  # tiny/base/small/medium/large — base is a reasonable speed/accuracy default


def seconds_to_timespan(seconds: float) -> str:
    """Converts float seconds to 'hh:mm:ss' to match backend TimeSpan serialization."""
    total = int(round(seconds))
    h, remainder = divmod(total, 3600)
    m, s = divmod(remainder, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def get_ffmpeg_path() -> str:
    """Resolves ffmpeg from the venv-bundled imageio-ffmpeg package —
    no system-wide install or PATH edit required. Downloads the static
    binary into the package cache on first use if not already present."""
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def ensure_ffmpeg_on_path() -> None:
    """Whisper's own transcribe() internally shells out to a bare 'ffmpeg'
    command (not a path we control) to decode audio. Prepending the
    venv-bundled binary's folder to PATH — for this process only, not
    system-wide — makes Whisper's internal call find it too."""
    ffmpeg_dir = str(Path(get_ffmpeg_path()).parent)
    os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")


def extract_audio(video_path: Path, out_wav: Path) -> None:
    """Extracts mono 16kHz audio via the venv-bundled ffmpeg — Whisper's preferred input format."""
    ffmpeg_path = get_ffmpeg_path()
    cmd = [
        ffmpeg_path, "-y",
        "-i", str(video_path),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-loglevel", "error",
        str(out_wav),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg audio extraction failed:\n{result.stderr}")


def transcribe(audio_path: Path, language: str, model_name: str) -> list[dict]:
    """Runs Whisper and returns raw segment dicts with start/end/text."""
    import whisper  # imported here so --help works even if whisper isn't installed yet

    model = whisper.load_model(model_name)
    result = model.transcribe(
        str(audio_path),
        language=language,
        task="transcribe",
        verbose=False,
    )
    return result["segments"]


def build_output(segments: list[dict]) -> list[dict]:
    """Maps Whisper segments to the SegmentResponse-compatible shape."""
    return [
        {
            "segmentNumber": i + 1,
            "startTime": seconds_to_timespan(seg["start"]),
            "endTime": seconds_to_timespan(seg["end"]),
            "transcript": seg["text"].strip(),
        }
        for i, seg in enumerate(segments)
    ]


def main():
    parser = argparse.ArgumentParser(description="Offline speech-to-text for a video file using Whisper.")
    parser.add_argument("--video", required=True, type=Path, help="Path to the input video file.")
    parser.add_argument("--output", type=Path, default=None, help="Path to write the output JSON. Defaults to <video>.transcript.json")
    parser.add_argument("--language", default=DEFAULT_LANGUAGE, help=f"Language code for transcription (default: {DEFAULT_LANGUAGE}).")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Whisper model size: tiny/base/small/medium/large (default: {DEFAULT_MODEL}).")
    args = parser.parse_args()

    if not args.video.exists():
        print(f"Error: video file not found: {args.video}", file=sys.stderr)
        sys.exit(1)

    output_path = args.output or args.video.with_suffix(".transcript.json")

    with tempfile.TemporaryDirectory() as tmp_dir:
        audio_path = Path(tmp_dir) / "audio.wav"

        ensure_ffmpeg_on_path()

        print(f"Extracting audio from {args.video} ...")
        extract_audio(args.video, audio_path)

        print(f"Transcribing with Whisper model '{args.model}' (language={args.language}) ...")
        raw_segments = transcribe(audio_path, args.language, args.model)

    segments = build_output(raw_segments)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(segments, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(segments)} segments to {output_path}")


if __name__ == "__main__":
    main()