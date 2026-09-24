"""HTTP views for AudioTube's built-in search, resolve, and audio endpoints."""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from aiohttp import web

from homeassistant.components.http import KEY_HASS, HomeAssistantView
from homeassistant.core import HomeAssistant

from .cache import cache_dir
from .ytdlp_client import (
    async_ensure_audio_file,
    async_ensure_waveform,
    async_get_cached_audio_file,
    async_resolve,
    async_search,
)

_LOGGER = logging.getLogger(__name__)

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,15}$")

_CONTENT_TYPES = {
    ".mp3": "audio/mpeg",
    ".webm": "audio/webm",
    ".m4a": "audio/mp4",
}


class AudioTubeIndexView(HomeAssistantView):
    """Serves the panel's index.html with no-cache headers.

    Every other file under the /audiotube static path is safe to send with
    a long-lived Cache-Control (cache_headers=True in __init__.py), because
    every one of them is loaded through a versioned `?v=` query string that
    changes whenever the file changes. index.html itself has no such query
    string (it's the fixed iframe panel URL), so if it were cached the same
    way, browsers/WebViews could keep serving a stale entry document loading
    stale versioned imports too — for up to the static path's max-age.
    Registered before the static path so this more specific route wins.
    """

    url = "/audiotube/index.html"
    name = "audiotube:index"
    requires_auth = False

    def __init__(self, index_path: Path) -> None:
        """Store the on-disk path of index.html."""
        self._index_path = index_path

    async def get(self, request: web.Request) -> web.Response:
        """Return index.html, always revalidated (cheap ETag/304, never stale)."""
        hass: HomeAssistant = request.app[KEY_HASS]
        text = await hass.async_add_executor_job(self._index_path.read_text, "utf-8")
        return web.Response(text=text, content_type="text/html", headers={"Cache-Control": "no-cache"})


class AudioTubeVersionView(HomeAssistantView):
    """Exposes the installed version and GitHub repo URL from manifest.json.

    Lets the Settings screen show a version number that matches GitHub
    release tags (e.g. 0.4.0 -> https://github.com/.../releases/tag/v0.4.0)
    without duplicating/hardcoding it in the frontend.
    """

    url = "/api/audiotube/version"
    name = "api:audiotube:version"
    requires_auth = False

    def __init__(self, manifest_path: Path) -> None:
        """Store the on-disk path of manifest.json."""
        self._manifest_path = manifest_path

    async def get(self, request: web.Request) -> web.Response:
        """Return {version, repository} parsed from manifest.json."""
        hass: HomeAssistant = request.app[KEY_HASS]
        try:
            text = await hass.async_add_executor_job(self._manifest_path.read_text, "utf-8")
            manifest = json.loads(text)
        except Exception:  # noqa: BLE001
            _LOGGER.exception("AudioTube failed to read manifest.json for version info")
            return self.json({"version": "unknown", "repository": ""}, status_code=500)
        return self.json({
            "version": manifest.get("version", "unknown"),
            "repository": manifest.get("documentation", ""),
        })


class AudioTubeSearchView(HomeAssistantView):
    """Search YouTube for audio tracks."""

    url = "/api/audiotube/search"
    name = "api:audiotube:search"

    async def get(self, request: web.Request) -> web.Response:
        """Handle the search request."""
        hass: HomeAssistant = request.app[KEY_HASS]
        query = request.query.get("q", "").strip()
        if not query:
            return self.json({"error": "Kein Suchbegriff angegeben."}, status_code=400)
        try:
            results = await async_search(hass, query)
        except Exception as err:  # noqa: BLE001
            _LOGGER.exception("AudioTube search failed for query=%r", query)
            return self.json({"error": f"Suche fehlgeschlagen: {err}"}, status_code=502)
        _LOGGER.debug("AudioTube search for %r returned %d result(s)", query, len(results))
        return self.json(results)


class AudioTubeResolveView(HomeAssistantView):
    """Resolve a YouTube video or playlist URL to search results."""

    url = "/api/audiotube/resolve"
    name = "api:audiotube:resolve"

    async def get(self, request: web.Request) -> web.Response:
        """Handle the resolve request."""
        hass: HomeAssistant = request.app[KEY_HASS]
        url = request.query.get("url", "").strip()
        if not url:
            return self.json({"error": "Keine URL angegeben."}, status_code=400)
        try:
            results = await async_resolve(hass, url)
        except Exception as err:  # noqa: BLE001
            _LOGGER.exception("AudioTube resolve failed for url=%r", url)
            return self.json({"error": f"Ungültige YouTube-URL: {err}"}, status_code=502)
        return self.json(results)


class AudioTubePrepareView(HomeAssistantView):
    """Download and cache a track's audio before a speaker is told to play it."""

    url = "/api/audiotube/prepare/{video_id}"
    name = "api:audiotube:prepare"

    async def get(self, request: web.Request, video_id: str) -> web.Response:
        """Ensure the audio file exists, so the speaker's request is served instantly."""
        hass: HomeAssistant = request.app[KEY_HASS]
        video_id = video_id.removesuffix(".mp3")
        if not VIDEO_ID_RE.match(video_id):
            return self.json({"error": "Ungültige videoId."}, status_code=400)

        try:
            await async_ensure_audio_file(hass, cache_dir(hass), video_id)
        except Exception as err:  # noqa: BLE001
            _LOGGER.exception("AudioTube prepare failed for video_id=%r", video_id)
            return self.json(
                {"error": f"Audio konnte nicht geladen werden: {err}"}, status_code=502
            )
        return self.json({"ready": True})


class AudioTubeWaveformView(HomeAssistantView):
    """Returns real amplitude-analyzed waveform peak data (0..1 per bar) for a track."""

    url = "/api/audiotube/waveform/{video_id}"
    name = "api:audiotube:waveform"

    async def get(self, request: web.Request, video_id: str) -> web.Response:
        """Return waveform peaks if the audio is already cached, else 202 (pending).

        Deliberately does NOT trigger a download itself: it must never compete
        with (or effectively double) the playback-critical download already
        kicked off by /api/audiotube/prepare for the same video_id — that
        would add latency to "the track actually starts playing" for a
        purely cosmetic feature.
        """
        hass: HomeAssistant = request.app[KEY_HASS]
        video_id = video_id.removesuffix(".mp3")
        if not VIDEO_ID_RE.match(video_id):
            return self.json({"error": "Ungültige videoId."}, status_code=400)

        directory = cache_dir(hass)
        audio_path = await async_get_cached_audio_file(hass, directory, video_id)
        if not audio_path:
            return self.json({"peaks": None, "pending": True}, status_code=202)

        try:
            peaks = await async_ensure_waveform(hass, directory, video_id)
        except Exception as err:  # noqa: BLE001
            _LOGGER.exception("AudioTube waveform generation failed for video_id=%r", video_id)
            return self.json(
                {"error": f"Waveform konnte nicht erzeugt werden: {err}"}, status_code=502
            )
        return self.json({"peaks": peaks})


class AudioTubeAudioView(HomeAssistantView):
    """Resolve and serve cached audio-only files."""

    url = "/api/audiotube/audio/{video_id}"
    name = "api:audiotube:audio"
    requires_auth = False  # Speakers fetch this URL directly, without a HA session.

    async def get(self, request: web.Request, video_id: str) -> web.StreamResponse:
        """Serve the resolved audio-only file, downloading it first if needed."""
        hass: HomeAssistant = request.app[KEY_HASS]
        video_id = video_id.removesuffix(".mp3")
        if not VIDEO_ID_RE.match(video_id):
            return self.json({"error": "Ungültige videoId."}, status_code=400)

        try:
            file_path = await async_ensure_audio_file(hass, cache_dir(hass), video_id)
        except Exception as err:  # noqa: BLE001
            _LOGGER.exception("AudioTube audio resolution failed for video_id=%r", video_id)
            return self.json(
                {"error": f"Audio konnte nicht geladen werden: {err}"}, status_code=502
            )

        content_type = _CONTENT_TYPES.get(file_path.suffix, "application/octet-stream")
        return web.FileResponse(file_path, headers={"Content-Type": content_type})
