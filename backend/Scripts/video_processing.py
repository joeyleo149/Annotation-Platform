import argparse
import json
import shutil
import subprocess
import sys
from fractions import Fraction
from pathlib import Path
from typing import Any


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract video metadata with ffprobe and generate "
            "a JPG thumbnail with ffmpeg."
        )
    )

    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Path to the input video file.",
    )

    parser.add_argument(
        "--thumbnail",
        required=True,
        type=Path,
        help="Path where the JPG thumbnail will be saved.",
    )

    parser.add_argument(
        "--thumbnail-width",
        type=int,
        default=480,
        help="Thumbnail width in pixels. Default: 480.",
    )

    return parser.parse_args()


def find_required_program(program_name: str) -> str:
    program_path = shutil.which(program_name)

    if program_path is None:
        raise RuntimeError(
            f"{program_name} was not found on the system PATH."
        )

    return program_path


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )

    if result.returncode != 0:
        error_message = result.stderr.strip()

        if not error_message:
            error_message = (
                f"The command failed with exit code "
                f"{result.returncode}."
            )

        raise RuntimeError(error_message)

    return result


def parse_frame_rate(raw_frame_rate: str | None) -> float:
    if not raw_frame_rate or raw_frame_rate in {"0/0", "N/A"}:
        return 0.0

    try:
        return float(Fraction(raw_frame_rate))
    except (ValueError, ZeroDivisionError):
        return 0.0


def extract_metadata(
    video_path: Path,
    ffprobe_path: str,
) -> dict[str, Any]:
    command = [
        ffprobe_path,
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        (
            "stream=width,height,codec_name,"
            "avg_frame_rate,r_frame_rate:"
            "format=duration"
        ),
        "-of",
        "json",
        str(video_path),
    ]

    result = run_command(command)

    try:
        probe_data = json.loads(result.stdout)
    except json.JSONDecodeError as exception:
        raise RuntimeError(
            "ffprobe returned an invalid JSON response."
        ) from exception

    streams = probe_data.get("streams", [])

    if not streams:
        raise RuntimeError(
            "The uploaded file does not contain a video stream."
        )

    video_stream = streams[0]
    format_data = probe_data.get("format", {})

    raw_duration = format_data.get("duration")

    try:
        duration_seconds = float(raw_duration)
    except (TypeError, ValueError):
        duration_seconds = 0.0

    raw_frame_rate = (
        video_stream.get("avg_frame_rate")
        or video_stream.get("r_frame_rate")
    )

    frame_rate = parse_frame_rate(raw_frame_rate)

    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))
    codec = video_stream.get("codec_name", "unknown")

    if duration_seconds <= 0:
        raise RuntimeError(
            "The video duration could not be determined."
        )

    if width <= 0 or height <= 0:
        raise RuntimeError(
            "The video resolution could not be determined."
        )

    return {
        "durationSeconds": round(duration_seconds, 3),
        "frameRate": round(frame_rate, 3),
        "width": width,
        "height": height,
        "codec": codec,
    }


def generate_thumbnail(
    video_path: Path,
    thumbnail_path: Path,
    duration_seconds: float,
    thumbnail_width: int,
    ffmpeg_path: str,
) -> None:
    thumbnail_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    capture_time = min(
        max(duration_seconds / 2.0, 0.0),
        max(duration_seconds - 0.1, 0.0),
    )

    command = [
        ffmpeg_path,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        f"{capture_time:.3f}",
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        "-vf",
        f"scale={thumbnail_width}:-2",
        "-q:v",
        "2",
        str(thumbnail_path),
    ]

    run_command(command)

    if (
        not thumbnail_path.exists()
        or thumbnail_path.stat().st_size == 0
    ):
        raise RuntimeError(
            "FFmpeg did not create a valid thumbnail."
        )


def process_video(
    video_path: Path,
    thumbnail_path: Path,
    thumbnail_width: int,
) -> dict[str, Any]:
    if not video_path.exists():
        raise FileNotFoundError(
            f"The input video does not exist: {video_path}"
        )

    if not video_path.is_file():
        raise ValueError(
            f"The input path is not a file: {video_path}"
        )

    if thumbnail_width <= 0:
        raise ValueError(
            "The thumbnail width must be greater than zero."
        )

    ffprobe_path = find_required_program("ffprobe")
    ffmpeg_path = find_required_program("ffmpeg")

    metadata = extract_metadata(
        video_path,
        ffprobe_path,
    )

    generate_thumbnail(
        video_path=video_path,
        thumbnail_path=thumbnail_path,
        duration_seconds=metadata["durationSeconds"],
        thumbnail_width=thumbnail_width,
        ffmpeg_path=ffmpeg_path,
    )

    return {
        "success": True,
        "fileName": video_path.name,
        "fileSizeBytes": video_path.stat().st_size,
        **metadata,
        "thumbnailPath": str(thumbnail_path.resolve()),
    }


def main() -> int:
    arguments = parse_arguments()

    try:
        result = process_video(
            video_path=arguments.input.resolve(),
            thumbnail_path=arguments.thumbnail.resolve(),
            thumbnail_width=arguments.thumbnail_width,
        )

        print(
            json.dumps(
                result,
                ensure_ascii=False,
            )
        )

        return 0

    except Exception as exception:
        error_result = {
            "success": False,
            "error": str(exception),
        }

        print(
            json.dumps(
                error_result,
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )

        return 1


if __name__ == "__main__":
    raise SystemExit(main())