"""yt-dlp powered search, resolution, and audio download for AudioTube.

Runs entirely inside the Home Assistant integration process, so no
separate proxy service is required.
"""
from __future__ import annotations

import array
import asyncio
import json
import logging
import subprocess
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


class _YtDlpLogger:
    """Routes yt-dlp's internal log messages into the Python logger.

    yt-dlp reports real failure reasons (bot checks, region blocks, missing
    formats, etc.) through this logger rather than raising in every case.
    """

    def debug(self, msg: str) -> None:
        _LOGGER.debug("yt-dlp: %s", msg)

    def info(self, msg: str) -> None:
        _LOGGER.debug("yt-dlp: %s", msg)

    def warning(self, msg: str) -> None:
        _LOGGER.warning("yt-dlp: %s", msg)

    def error(self, msg: str) -> None:
        _LOGGER.error("yt-dlp: %s", msg)


_EXTRACTOR_ARGS = {"youtube": {"player_client": ["android"]}}

_AUDIO_SUFFIXES = {".mp3", ".m4a", ".webm", ".opus", ".ogg", ".aac"}

_SEARCH_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "logger": _YtDlpLogger(),
    "extract_flat": "in_playlist",
    "skip_download": True,
    "extractor_args": _EXTRACTOR_ARGS,
}

_download_locks: dict[str, asyncio.Lock] = {}


def _thumbnail_url(video_id: str) -> str:
    return f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"


def _entry_to_result(entry: dict[str, Any] | None) -> dict[str, Any] | None:
    if not entry:
        return None
    video_id = entry.get("id")
    if not video_id:
        return None
    return {
        "type": "track",
        "id": video_id,
        "title": entry.get("title") or "Unbekannter Titel",
        "artist": entry.get("channel") or entry.get("uploader") or "Unbekannter Kanal",
        "durationSec": round(entry.get("duration") or 0),
        "trackCount": 0,
        "thumbnailUrl": _thumbnail_url(video_id),
        "videoUrl": f"https://www.youtube.com/watch?v={video_id}",
    }


def _search_sync(query: str, limit: int) -> list[dict[str, Any]]:
    import yt_dlp

    _LOGGER.debug("Searching yt-dlp for query=%r limit=%d", query, limit)
    with yt_dlp.YoutubeDL(_SEARCH_OPTS) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)

    results = []
    for entry in info.get("entries") or []:
        if result := _entry_to_result(entry):
            results.append(result)
    _LOGGER.debug("yt-dlp search for %r returned %d result(s)", query, len(results))
    return results


async def async_search(
    hass: HomeAssistant, query: str, limit: int = 25
) -> list[dict[str, Any]]:
    """Search YouTube for audio tracks and return them as SearchResult dicts."""
    query = (query or "").strip()
    if not query:
        return []
    return await hass.async_add_executor_job(_search_sync, query, limit)


def _resolve_sync(url: str) -> list[dict[str, Any]]:
    import yt_dlp

    with yt_dlp.YoutubeDL(_SEARCH_OPTS) as ydl:
        info = ydl.extract_info(url, download=False)

    if info.get("_type") == "playlist":
        results = []
        for entry in info.get("entries") or []:
            if result := _entry_to_result(entry):
                results.append(result)
        return results

    result = _entry_to_result(info)
    return [result] if result else []


async def async_resolve(hass: HomeAssistant, url: str) -> list[dict[str, Any]]:
    """Resolve a YouTube video or playlist URL to one or more SearchResult dicts."""
    url = (url or "").strip()
    if not url:
        return []
    return await hass.async_add_executor_job(_resolve_sync, url)


def _find_audio_file(directory: Path, video_id: str) -> Path | None:
    """Return the cached audio file, ignoring leftover thumbnail images.

    Files are named "Title [video_id].ext" (see _ensure_audio_file_sync), so
    look for the "[video_id]" marker anywhere in the filename rather than
    requiring it as a strict prefix.
    """
    if not directory.is_dir():
        return None
    marker = f"[{video_id}]"
    for candidate in directory.iterdir():
        if (
            candidate.is_file()
            and candidate.suffix.lower() in _AUDIO_SUFFIXES
            and candidate.stat().st_size > 0
            and marker in candidate.stem
        ):
            return candidate
    return None


def _ensure_audio_file_sync(directory: Path, video_id: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)

    if cached := _find_audio_file(directory, video_id):
        _LOGGER.debug("Using cached audio file for %s: %s", video_id, cached.name)
        return cached

    import yt_dlp

    opts = {
        "quiet": True,
        "no_warnings": True,
        "logger": _YtDlpLogger(),
        "format": "bestaudio/best",
        # Human-readable filename (shows up in HA's Media browser); the video
        # ID stays embedded in brackets so _find_audio_file can still locate it.
        "outtmpl": str(directory / "%(title)s [%(id)s].%(ext)s"),
        "extractor_args": _EXTRACTOR_ARGS,
        # Speakers read title, artist and cover art from the file's own tags.
        "writethumbnail": True,
        "postprocessors": [
            # MP3 has the broadest Sonos S1 compatibility.
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3"},
            {"key": "FFmpegMetadata", "add_metadata": True},
            {"key": "EmbedThumbnail", "already_have_thumbnail": False},
        ],
    }
    _LOGGER.debug("Downloading audio for video_id=%r", video_id)
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={video_id}"])

    if downloaded := _find_audio_file(directory, video_id):
        _LOGGER.debug("Downloaded audio for %s: %s", video_id, downloaded.name)
        return downloaded
    raise FileNotFoundError(f"Audio file for {video_id} was not created")


async def async_ensure_audio_file(
    hass: HomeAssistant, directory: Path, video_id: str
) -> Path:
    """Return the cached audio-only file for a video, downloading it if needed."""
    lock = _download_locks.setdefault(video_id, asyncio.Lock())
    async with lock:
        try:
            return await hass.async_add_executor_job(
                _ensure_audio_file_sync, directory, video_id
            )
        finally:
            _download_locks.pop(video_id, None)


async def async_get_cached_audio_file(
    hass: HomeAssistant, directory: Path, video_id: str
) -> Path | None:
    """Return the audio file only if it's already cached, without downloading.

    Used by the waveform endpoint so it never competes with (or piggybacks a
    second concurrent yt-dlp invocation onto) the actual playback-critical
    download kicked off by /api/audiotube/prepare — waveform generation is a
    nice-to-have and must never add latency to "the track actually starts
    playing".
    """
    return await hass.async_add_executor_job(_find_audio_file, directory, video_id)


def _waveform_cache_path(directory: Path, video_id: str) -> Path:
    return directory / f"{video_id}.waveform.json"


def _generate_waveform_sync(directory: Path, video_id: str, bars: int) -> list[float]:
    """Decode the cached audio file with ffmpeg and bucket it into peak values.

    Real amplitude analysis (not a fake/random pattern), cached as a small JSON
    sidecar file so it's only computed once per track. Decodes to low-sample-rate
    mono 16-bit PCM (ffmpeg is already a hard dependency via yt-dlp's own
    FFmpegExtractAudio postprocessor, so no extra runtime dependency here) and
    takes the peak absolute sample per bucket, normalized to 0..1.
    """
    cache_path = _waveform_cache_path(directory, video_id)
    if cache_path.is_file():
        try:
            return json.loads(cache_path.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            _LOGGER.debug("Waveform cache for %s was unreadable, regenerating", video_id)

    audio_path = _find_audio_file(directory, video_id)
    if not audio_path:
        raise FileNotFoundError(f"Audio file for {video_id} is not cached yet")

    sample_rate = 4000
    proc = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(audio_path),
            "-ac", "1", "-ar", str(sample_rate), "-f", "s16le", "-",
        ],
        capture_output=True,
        check=True,
    )

    samples = array.array("h")
    usable_len = len(proc.stdout) - (len(proc.stdout) % samples.itemsize)
    samples.frombytes(proc.stdout[:usable_len])

    sample_count = len(samples)
    peaks: list[float] = []
    if sample_count == 0:
        peaks = [0.0] * bars
    else:
        bucket_size = max(1, sample_count // bars)
        for i in range(bars):
            start = i * bucket_size
            end = sample_count if i == bars - 1 else min(sample_count, start + bucket_size)
            chunk = samples[start:end] or samples[start:start + 1]
            peak = max(abs(s) for s in chunk) / 32768
            peaks.append(round(peak, 4))

    cache_path.write_text(json.dumps(peaks), encoding="utf-8")
    return peaks


async def async_ensure_waveform(
    hass: HomeAssistant, directory: Path, video_id: str, bars: int = 100
) -> list[float]:
    """Return cached (or freshly generated) waveform peak data for a track."""
    return await hass.async_add_executor_job(
        _generate_waveform_sync, directory, video_id, bars
    )
