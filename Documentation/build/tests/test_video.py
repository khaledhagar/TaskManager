"""T-629 for Task_Manager_Features.mp4: run after `build_video.py mix`."""

import json
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg

DOCS = Path(__file__).parents[2]
VIDEO = DOCS / "Task_Manager_Features.mp4"


def probe() -> str:
    """ffmpeg prints the file's streams and duration on stderr."""
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-i", str(VIDEO)]
    return subprocess.run(cmd, capture_output=True, text=True).stderr  # noqa: S603


def test_has_video_and_audio():
    info = probe()
    assert re.search(r"Stream .*: Video: h264", info)
    assert re.search(r"Stream .*: Audio: aac", info)


def test_lasts_4_to_15_minutes():
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe()).groups()
    minutes = int(h) * 60 + int(m) + float(s) / 60
    assert 4 <= minutes <= 15


def test_every_scene_is_spoken_in_order():
    scenes = [s["id"] for s in json.loads((DOCS / "build" / "video_script.json").read_text(encoding="utf-8"))]
    timeline = json.loads((DOCS / "video" / "timeline.json").read_text(encoding="utf-8"))
    durations = json.loads((DOCS / "video" / "durations.json").read_text(encoding="utf-8"))
    assert list(timeline) == scenes
    for current, following in zip(scenes, scenes[1:], strict=False):
        assert timeline[current] + durations[current] <= timeline[following], current
