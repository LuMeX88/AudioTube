"""Cache directory management for AudioTube's downloaded audio files."""
from __future__ import annotations

import logging
import shutil
import time
from datetime import timedelta
from pathlib import Path

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval

_LOGGER = logging.getLogger(__name__)

CACHE_DIR_NAME = "audiotube_cache"
FILE_TTL = timedelta(days=21)
PURGE_INTERVAL = timedelta(hours=6)


def cache_dir(hass: HomeAssistant) -> Path:
    """Return the cache directory path. Does not touch disk.

    Stored under <config>/media/ so downloaded tracks show up in Home
    Assistant's Media browser (local media source), while still being
    cleaned up by the same TTL purge as before.
    """
    return Path(hass.config.path("media", CACHE_DIR_NAME))


def _purge_expired_sync(path: Path) -> None:
    if not path.is_dir():
        return
    cutoff = time.time() - FILE_TTL.total_seconds()
    for file in path.glob("*"):
        try:
            if file.is_file() and file.stat().st_mtime < cutoff:
                file.unlink()
                _LOGGER.debug("Purged expired cached audio file %s", file.name)
        except OSError as err:
            _LOGGER.warning("Failed to purge cached file %s: %s", file, err)


def _migrate_old_cache_sync(hass: HomeAssistant) -> None:
    """One-time move of files from the pre-media cache location, if present."""
    old_dir = Path(hass.config.path(CACHE_DIR_NAME))
    if old_dir == cache_dir(hass) or not old_dir.is_dir():
        return
    new_dir = cache_dir(hass)
    new_dir.mkdir(parents=True, exist_ok=True)
    for file in old_dir.glob("*"):
        try:
            if file.is_file():
                shutil.move(str(file), str(new_dir / file.name))
        except OSError as err:
            _LOGGER.warning("Failed to migrate cached file %s: %s", file, err)
    try:
        old_dir.rmdir()
    except OSError:
        pass  # not empty or in use; leave it, nothing left to purge from it


async def async_purge_expired(hass: HomeAssistant) -> None:
    """Remove cached audio files older than the 21-day TTL."""
    await hass.async_add_executor_job(_migrate_old_cache_sync, hass)
    await hass.async_add_executor_job(_purge_expired_sync, cache_dir(hass))


@callback
def async_schedule_purge(hass: HomeAssistant):
    """Purge expired files now and periodically. Returns an unsub callback."""
    hass.async_create_task(async_purge_expired(hass))

    async def _purge(_now) -> None:
        await async_purge_expired(hass)

    return async_track_time_interval(hass, _purge, PURGE_INTERVAL)
