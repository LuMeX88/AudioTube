"""Persistent shared queue and playlist coordinator for AudioTube."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .cache import cache_dir
from .ytdlp_client import async_ensure_audio_file

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = "audiotube.shared_state"
STORAGE_VERSION = 1


class AudioTubeCoordinator:
    """Own shared AudioTube state and keep playback alive without a client."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the coordinator."""
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._lock = asyncio.Lock()
        self._queue: list[dict[str, Any]] = []
        self._queue_index = -1
        self._target_id: str | None = None
        self._target_ids: list[str] = []
        self._base_url = ""
        self._status = "idle"
        self._started_at: float | None = None
        self._position_sec = 0.0
        self._revision = 0
        self._shared_playlists: list[dict[str, Any]] = []
        self._play_task: asyncio.Task | None = None
        self._generation = 0

    async def async_load(self) -> None:
        """Restore shared state after an integration reload or HA restart."""
        data = await self._store.async_load() or {}
        self._queue = data.get("queue", []) if isinstance(data.get("queue", []), list) else []
        self._queue_index = int(data.get("queue_index", -1))
        self._target_id = data.get("target_id")
        self._target_ids = self._valid_entity_ids(data.get("target_ids", []))
        self._base_url = str(data.get("base_url", "")).rstrip("/")
        self._shared_playlists = (
            data.get("shared_playlists", [])
            if isinstance(data.get("shared_playlists", []), list)
            else []
        )
        self._position_sec = max(0.0, float(data.get("position_sec", 0)))

        if data.get("status") == "playing" and self.current_track and self._target_ids:
            # A HA restart interrupts the stream. Resume the current track from
            # the beginning; after a normal browser/app close this object never
            # stops, so playback continues uninterrupted.
            self._position_sec = 0
            self._schedule_play(self._queue_index)
        else:
            self._status = "idle"

    async def async_shutdown(self) -> None:
        """Cancel tasks while the integration unloads."""
        self._generation += 1
        if self._play_task:
            self._play_task.cancel()
        await self._async_save()

    @property
    def current_track(self) -> dict[str, Any] | None:
        """Return the current queue track."""
        if 0 <= self._queue_index < len(self._queue):
            track = self._queue[self._queue_index].get("track")
            return track if isinstance(track, dict) else None
        return None

    def snapshot(self) -> dict[str, Any]:
        """Return JSON-safe shared state."""
        position = self._position_sec
        if self._status == "playing" and self._started_at is not None:
            position += max(0.0, dt_util.utcnow().timestamp() - self._started_at)
        track = self.current_track
        duration = max(0.0, float(track.get("durationSec", 0))) if track else 0.0
        return {
            "queue": self._queue,
            "queueIndex": self._queue_index,
            "selectedSpeakerId": self._target_id,
            "targetIds": self._target_ids,
            "playback": {
                "status": self._status,
                "currentTrack": track,
                "positionSec": min(position, duration or position),
                "durationSec": duration,
            },
            "revision": self._revision,
        }

    def shared_playlists(self) -> list[dict[str, Any]]:
        """Return all globally visible playlists."""
        return self._shared_playlists

    async def async_set_shared_playlists(self, playlists: Any) -> None:
        """Replace globally shared playlists."""
        if not isinstance(playlists, list):
            raise HomeAssistantError("Playlists müssen eine Liste sein.")
        async with self._lock:
            self._shared_playlists = [item for item in playlists if isinstance(item, dict)]
            self._changed()
            await self._async_save()

    async def async_command(self, command: str, data: dict[str, Any]) -> dict[str, Any]:
        """Apply one atomic shared queue/playback command."""
        play_index: int | None = None
        service: str | None = None
        service_data: dict[str, Any] = {}

        async with self._lock:
            self._update_target(data)

            if command == "set_target":
                pass
            elif command == "play_now":
                item = self._require_item(data.get("item"))
                self._queue = [item]
                self._queue_index = 0
                play_index = 0
            elif command == "replace_and_play":
                items = self._require_items(data.get("items"))
                self._queue = items
                self._queue_index = 0 if items else -1
                play_index = self._queue_index if items else None
            elif command == "add":
                item = self._require_item(data.get("item"))
                self._queue.append(item)
                if self._status == "idle":
                    self._queue_index = len(self._queue) - 1
                    play_index = self._queue_index
            elif command == "play_next":
                item = self._require_item(data.get("item"))
                insert_at = max(0, self._queue_index + 1)
                self._queue.insert(insert_at, item)
            elif command == "skip":
                queue_id = str(data.get("queueId", ""))
                play_index = next(
                    (index for index, item in enumerate(self._queue) if item.get("queueId") == queue_id),
                    None,
                )
                if play_index is None:
                    raise HomeAssistantError("Titel nicht in der Warteschlange gefunden.")
                self._queue_index = play_index
            elif command in ("next", "previous"):
                delta = 1 if command == "next" else -1
                candidate = self._queue_index + delta
                if 0 <= candidate < len(self._queue):
                    self._queue_index = candidate
                    play_index = candidate
                elif command == "next":
                    self._set_stopped()
                    service = "media_stop"
            elif command == "remove":
                self._remove(str(data.get("queueId", "")))
            elif command == "reorder":
                self._reorder(data.get("queueIds"))
            elif command == "clear":
                self._queue = []
                self._queue_index = -1
                self._set_stopped()
                service = "media_stop"
            elif command == "pause":
                self._capture_position()
                self._status = "paused"
                self._cancel_play_task()
                service = "media_pause"
            elif command == "resume":
                if self.current_track:
                    self._status = "playing"
                    self._started_at = dt_util.utcnow().timestamp()
                    self._schedule_timer(self._generation)
                    service = "media_play"
            elif command == "seek":
                if self.current_track:
                    duration = max(0.0, float(self.current_track.get("durationSec", 0)))
                    self._position_sec = max(0.0, min(float(data.get("positionSec", 0)), duration))
                    self._started_at = (
                        dt_util.utcnow().timestamp() if self._status == "playing" else None
                    )
                    self._cancel_play_task()
                    if self._status == "playing":
                        self._schedule_timer(self._generation)
                    service = "media_seek"
                    service_data = {"seek_position": self._position_sec}
            elif command == "stop":
                self._set_stopped()
                service = "media_stop"
            else:
                raise HomeAssistantError(f"Unbekannter Queue-Befehl: {command}")

            self._changed()
            await self._async_save()

        if service:
            await self._async_media_service(service, service_data)
        if play_index is not None:
            self._schedule_play(play_index)
        return self.snapshot()

    def _update_target(self, data: dict[str, Any]) -> None:
        if "targetIds" in data:
            self._target_ids = self._valid_entity_ids(data.get("targetIds"))
        if "targetId" in data:
            self._target_id = str(data.get("targetId") or "") or None
        if "baseUrl" in data:
            self._base_url = str(data.get("baseUrl") or "").rstrip("/")

    @staticmethod
    def _valid_entity_ids(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, str) and item.startswith("media_player.")]

    @staticmethod
    def _require_item(value: Any) -> dict[str, Any]:
        if not isinstance(value, dict) or not isinstance(value.get("track"), dict):
            raise HomeAssistantError("Ungültiger Warteschlangen-Titel.")
        return value

    def _require_items(self, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            raise HomeAssistantError("Ungültige Warteschlange.")
        return [self._require_item(item) for item in value]

    def _remove(self, queue_id: str) -> None:
        removed_index = next(
            (index for index, item in enumerate(self._queue) if item.get("queueId") == queue_id),
            None,
        )
        if removed_index is None:
            return
        self._queue.pop(removed_index)
        if removed_index < self._queue_index:
            self._queue_index -= 1
        elif self._queue_index >= len(self._queue):
            self._queue_index = len(self._queue) - 1

    def _reorder(self, queue_ids: Any) -> None:
        if not isinstance(queue_ids, list):
            raise HomeAssistantError("Ungültige Reihenfolge.")
        current_id = self._queue[self._queue_index].get("queueId") if self.current_track else None
        by_id = {item.get("queueId"): item for item in self._queue}
        reordered = [by_id[item_id] for item_id in queue_ids if item_id in by_id]
        if len(reordered) != len(self._queue):
            raise HomeAssistantError("Die Warteschlange hat sich zwischenzeitlich geändert.")
        self._queue = reordered
        self._queue_index = next(
            (index for index, item in enumerate(reordered) if item.get("queueId") == current_id),
            self._queue_index,
        )

    def _schedule_play(self, index: int) -> None:
        self._generation += 1
        generation = self._generation
        if self._play_task and self._play_task is not asyncio.current_task():
            self._play_task.cancel()
        self._play_task = self.hass.async_create_task(self._async_play(index, generation))

    async def _async_play(self, index: int, generation: int) -> None:
        try:
            if not self._target_ids:
                raise HomeAssistantError("Kein Lautsprecher ausgewählt.")
            if not self._base_url:
                raise HomeAssistantError("Keine Home-Assistant-URL verfügbar.")
            track = self._queue[index]["track"]
            self._status = "loading"
            self._position_sec = 0
            self._started_at = None
            self._changed()
            await self._async_save()

            await async_ensure_audio_file(self.hass, cache_dir(self.hass), str(track["id"]))
            if generation != self._generation or index != self._queue_index:
                return
            await self.hass.services.async_call(
                "audiotube",
                "play_media",
                {
                    "entity_id": self._target_ids,
                    "media_url": f"{self._base_url}/api/audiotube/audio/{track['id']}.mp3",
                    "title": str(track.get("title", "")),
                    "artist": str(track.get("artist", "")),
                },
                blocking=True,
            )
            self._status = "playing"
            self._started_at = dt_util.utcnow().timestamp()
            self._changed()
            await self._async_save()
            await asyncio.sleep(max(1.0, float(track.get("durationSec", 0))) + 2)
            await self._async_advance(generation)
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("AudioTube backend playback failed: %s", err)
            if generation == self._generation:
                await self._async_advance(generation)

    async def _async_advance(self, generation: int) -> None:
        async with self._lock:
            if generation != self._generation:
                return
            next_index = self._queue_index + 1
            if next_index >= len(self._queue):
                self._set_stopped()
                self._changed()
                await self._async_save()
                return
            self._queue_index = next_index
            self._changed()
            await self._async_save()
            self._schedule_play(next_index)

    def _schedule_timer(self, generation: int) -> None:
        track = self.current_track
        if not track:
            return
        remaining = max(1.0, float(track.get("durationSec", 0)) - self._position_sec + 2)

        async def _wait() -> None:
            await asyncio.sleep(remaining)
            await self._async_advance(generation)

        self._play_task = self.hass.async_create_task(_wait())

    async def _async_media_service(self, service: str, data: dict[str, Any]) -> None:
        if not self._target_ids:
            return
        await self.hass.services.async_call(
            "media_player",
            service,
            {"entity_id": self._target_ids, **data},
            blocking=True,
        )

    def _capture_position(self) -> None:
        if self._started_at is not None:
            self._position_sec += max(0.0, dt_util.utcnow().timestamp() - self._started_at)
        self._started_at = None

    def _cancel_play_task(self) -> None:
        self._generation += 1
        if self._play_task:
            self._play_task.cancel()
            self._play_task = None

    def _set_stopped(self) -> None:
        self._cancel_play_task()
        self._status = "idle"
        self._position_sec = 0
        self._started_at = None

    def _changed(self) -> None:
        self._revision += 1

    async def _async_save(self) -> None:
        await self._store.async_save({
            "queue": self._queue,
            "queue_index": self._queue_index,
            "target_id": self._target_id,
            "target_ids": self._target_ids,
            "base_url": self._base_url,
            "status": self._status,
            "position_sec": self.snapshot()["playback"]["positionSec"],
            "shared_playlists": self._shared_playlists,
        })