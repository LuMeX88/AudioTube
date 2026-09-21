"""HTTP views for AudioTube's built-in search, resolve, and audio endpoints."""
from __future__ import annotations

import logging
import re

from aiohttp import web

from homeassistant.components.http import KEY_HASS, HomeAssistantView
from homeassistant.core import HomeAssistant

from .cache import cache_dir
from .ytdlp_client import async_ensure_audio_file, async_resolve, async_search

_LOGGER = logging.getLogger(__name__)

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,15}$")

_CONTENT_TYPES = {
    ".mp3": "audio/mpeg",
    ".webm": "audio/webm",
    ".m4a": "audio/mp4",
}


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
