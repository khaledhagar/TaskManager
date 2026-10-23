"""Feature video in three steps (T-629):

1. `uv run python build_video.py voice`  speaks video_script.json into Documentation/video/clips/*.wav
   and writes durations.json (milliseconds per scene).
2. `npm run docs:video` (in frontend/) records the app scene by scene, waiting for each clip,
   and writes Documentation/video/raw.webm and timeline.json (when each scene starts).
3. `uv run python build_video.py mix`  lays each clip over the recording at its start time
   and writes Documentation/Task_Manager_Features.mp4.
"""

import json
import subprocess
import sys
import wave
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).parent
VIDEO = HERE.parent / "video"
CLIPS = VIDEO / "clips"
OUT = HERE.parent / "Task_Manager_Features.mp4"


def scenes() -> list[dict]:
    return json.loads((HERE / "video_script.json").read_text(encoding="utf-8"))


def voice() -> None:
    subprocess.run(  # noqa: S603
        ["pwsh", "-NoProfile", "-File", str(HERE / "tts.ps1"), str(HERE / "video_script.json"), str(CLIPS)],  # noqa: S607
        check=True,
    )
    durations = {}
    for scene in scenes():
        with wave.open(str(CLIPS / f"{scene['id']}.wav")) as w:
            durations[scene["id"]] = round(w.getnframes() / w.getframerate() * 1000)
    (VIDEO / "durations.json").write_text(json.dumps(durations, indent=1), encoding="utf-8")
    print(f"{len(durations)} clips, {sum(durations.values()) / 60000:.1f} min of speech")


def mix() -> None:
    timeline = json.loads((VIDEO / "timeline.json").read_text(encoding="utf-8"))
    inputs = ["-i", str(VIDEO / "raw.webm")]
    delays = []
    for n, scene in enumerate(scenes(), 1):
        inputs += ["-i", str(CLIPS / f"{scene['id']}.wav")]
        delays.append(f"[{n}:a]adelay={timeline[scene['id']]}:all=1[a{n}]")
    labels = "".join(f"[a{n}]" for n in range(1, len(delays) + 1))
    graph = ";".join(delays) + f";{labels}amix=inputs={len(delays)}:normalize=0[audio]"
    subprocess.run(  # noqa: S603
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-y",
            "-loglevel",
            "error",
            *inputs,
            "-filter_complex",
            graph,
            "-map",
            "0:v",
            "-map",
            "[audio]",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-r",
            "25",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(OUT),
        ],
        check=True,
    )
    print(OUT)


if __name__ == "__main__":
    {"voice": voice, "mix": mix}[sys.argv[1]]()
