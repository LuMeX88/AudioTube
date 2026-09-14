"""
Home Assistant Playback Adapter — Sprint 2 stub.
Controls Sonos speakers via HA media_player services.

Implements the same PlaybackAdapter interface as LocalPlaybackAdapter,
but translated to Python / HA service calls.

Status: STUB — methods are scaffolded, implementation due Sprint 2.
"""
from __future__ import annotations

import logging
from typing import Callable

from homeassistant.core import HomeAssistant, callback

_LOGGER = logging.getLogger(__name__)

# HA service names
SERVICE_PLAY_MEDIA  = "media_player.play_media"
SERVICE_MEDIA_PAUSE = "media_player.media_pause"
SERVICE_MEDIA_PLAY  = "media_player.media_play"
SERVICE_MEDIA_STOP  = "media_player.media_stop"
SERVICE_MEDIA_NEXT  = "media_player.media_next_track"
SERVICE_MEDIA_PREV  = "media_player.media_previous_track"
SERVICE_VOLUME_SET  = "media_player.volume_set"


class HAPlaybackAdapter:
    """
    Bridges the UI adapter interface to Home Assistant media_player services.

    Sprint 2 TODOs:
    - Resolve YouTube video to audio-only stream URL (via yt-dlp subprocess or
      dedicated HA service / add-on).
    - Call media_player.play_media with content_type='music' and the stream URL.
    - Subscribe to HA state changes for the selected entity and push PlaybackState
      updates back to the frontend via WebSocket.
    - Support Sonos groups via join/unjoin services.
    """

    def __init__(self, hass: HomeAssistant, stream_resolver) -> None:
        self._hass = hass
        self._stream_resolver = stream_resolver   # async (video_id: str) -> str
        self._selected_entity: str | None = None
        self._state_callbacks: list[Callable] = []

    # ── PlaybackAdapter interface ─────────────────────────────────────────────

    async def get_speakers(self) -> list[dict]:
        """Return all media_player entities that are Sonos devices."""
        states = self._hass.states.async_all("media_player")
        speakers = []
        for state in states:
            attrs = state.attributes
            # Filter to Sonos entities (platform attribute or entity_id prefix)
            # TODO Sprint 2: filter by integration / platform = sonos
            speakers.append({
                "id":          state.entity_id,
                "name":        attrs.get("friendly_name", state.entity_id),
                "type":        "group" if attrs.get("sonos_group") else "speaker",
                "isAvailable": state.state not in ("unavailable", "unknown"),
                "volume":      int((attrs.get("volume_level", 0.5)) * 100),
            })
        return speakers

    async def select_speaker(self, entity_id: str) -> None:
        self._selected_entity = entity_id

    async def play(self, track: dict) -> None:
        """Resolve audio stream and send to Sonos via play_media."""
        if not self._selected_entity:
            raise RuntimeError("Kein Lautsprecher ausgewählt.")

        stream_url = await self._stream_resolver(track["id"])

        await self._hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id":    self._selected_entity,
                "media_content_id":   stream_url,
                "media_content_type": "music",  # audio only — no video (F-10)
            },
        )

    async def pause(self) -> None:
        await self._call("media_pause")

    async def resume(self) -> None:
        await self._call("media_play")

    async def stop(self) -> None:
        await self._call("media_stop")

    async def next(self) -> None:
        await self._call("media_next_track")

    async def previous(self) -> None:
        await self._call("media_previous_track")

    async def set_volume(self, level: int) -> None:
        if not self._selected_entity:
            return
        await self._hass.services.async_call(
            "media_player",
            "volume_set",
            {"entity_id": self._selected_entity, "volume_level": level / 100},
        )

    def on_state_change(self, cb: Callable) -> None:
        self._state_callbacks.append(cb)

    def destroy(self) -> None:
        self._state_callbacks.clear()

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _call(self, service: str) -> None:
        if not self._selected_entity:
            return
        await self._hass.services.async_call(
            "media_player", service, {"entity_id": self._selected_entity}
        )
