"""yt-dlp powered search, resolution, and audio download for AudioTube.

Runs entirely inside the Home Assistant integration process, so no
separate proxy service is required.
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

_EXTRACTOR_ARGS = {"youtube": {"player_client": ["android"]}}

_SEARCH_OPTS = {
    "quiet": True,
    "no_warnings": True,
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

    with yt_dlp.YoutubeDL(_SEARCH_OPTS) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)

    results = []
    for entry in info.get("entries") or []:
        if result := _entry_to_result(entry):
            results.append(result)
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


def _ensure_audio_file_sync(directory: Path, video_id: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)

    for candidate in directory.glob(f"{video_id}.*"):
        if candidate.is_file() and candidate.stat().st_size > 0:
            return candidate

    import yt_dlp

    opts = {
        "quiet": True,
        "no_warnings": True,
        "format": "bestaudio/best",
        "outtmpl": str(directory / f"{video_id}.%(ext)s"),
        "extractor_args": _EXTRACTOR_ARGS,
        # MP3 has the broadest Sonos S1 compatibility.
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3"}],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={video_id}"])

    mp3_path = directory / f"{video_id}.mp3"
    if mp3_path.exists() and mp3_path.stat().st_size > 0:
        return mp3_path
    for candidate in directory.glob(f"{video_id}.*"):
        if candidate.is_file() and candidate.stat().st_size > 0:
            return candidate
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
