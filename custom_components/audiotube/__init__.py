"""AudioTube Home Assistant integration."""
from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .api import (
    AudioTubeAudioView,
    AudioTubeIndexView,
    AudioTubePinnedView,
    AudioTubePrefetchView,
    AudioTubePrepareView,
    AudioTubeResolveView,
    AudioTubeSearchView,
    AudioTubeVersionView,
    AudioTubeWaveformView,
)
from .cache import async_schedule_purge

_LOGGER = logging.getLogger(__name__)

DOMAIN = "audiotube"

PANEL_URL_PATH = DOMAIN
PANEL_TITLE = "AudioTube"
PANEL_ICON = "mdi:music-note"

SUPPORT_CLEAR_PLAYLIST = 8192
SUPPORT_MEDIA_ENQUEUE = 2097152


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the AudioTube integration."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    """Set up AudioTube from a config entry."""
    await _async_register(hass)
    entry.async_on_unload(async_schedule_purge(hass))
    return True


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    """Unload the AudioTube config entry."""
    return True


def _check_yt_dlp_import() -> None:
    """Import yt-dlp in the executor to avoid blocking the event loop."""
    try:
        import yt_dlp  # noqa: PLC0415

        _LOGGER.info("AudioTube found yt-dlp %s", yt_dlp.version.__version__)
    except ImportError:
        _LOGGER.exception(
            "AudioTube could not import yt-dlp. Search and playback will fail "
            "until this is resolved; check that the requirement installed "
            "correctly and restart Home Assistant."
        )


async def _async_register(hass: HomeAssistant) -> None:
    """Register static assets, HTTP views, the service, and the panel once."""
    data = hass.data.setdefault(DOMAIN, {})
    if data.get("registered"):
        return

    await hass.async_add_executor_job(_check_yt_dlp_import)

    frontend_path = Path(__file__).parent / "frontend"
    # index.html is registered as its own no-cache view BEFORE the static
    # path below, so this more specific route wins over the static handler
    # for that one file (see AudioTubeIndexView for why).
    hass.http.register_view(AudioTubeIndexView(frontend_path / "index.html"))
    # Cacheable: every frontend file that changes gets a bumped ?v= query string,
    # so real HTTP caching here is safe and fixes slow repeat loads.
    await hass.http.async_register_static_paths(
        [StaticPathConfig(f"/{DOMAIN}", str(frontend_path), cache_headers=True)]
    )

    hass.http.register_view(AudioTubeSearchView())
    hass.http.register_view(AudioTubeResolveView())
    hass.http.register_view(AudioTubePrepareView())
    hass.http.register_view(AudioTubePrefetchView())
    hass.http.register_view(AudioTubePinnedView())
    hass.http.register_view(AudioTubeAudioView())
    hass.http.register_view(AudioTubeWaveformView())
    hass.http.register_view(AudioTubeVersionView(Path(__file__).parent / "manifest.json"))

    async def async_play_media(call) -> None:
        entity_ids = call.data["entity_id"]
        if isinstance(entity_ids, str):
            entity_ids = [entity_ids]

        # A group's members are addressed independently (see AppController's
        # `group:<id>` targets): one incompatible/unavailable member must not
        # abort playback on the rest, so each entity's failure is caught and
        # logged instead of propagating.
        errors: list[str] = []
        for entity_id in entity_ids:
            try:
                features = 0
                if (state := hass.states.get(entity_id)) is not None:
                    features = state.attributes.get("supported_features") or 0

                data = {
                    "entity_id": entity_id,
                    "media_content_id": call.data["media_url"],
                    "media_content_type": "music",
                }
                if features & SUPPORT_MEDIA_ENQUEUE:
                    # Queued playback carries track metadata; handing a speaker a bare
                    # URI makes the Sonos app show "unknown content". AudioTube keeps
                    # its own queue, so the speaker's queue is cleared first.
                    if features & SUPPORT_CLEAR_PLAYLIST:
                        await hass.services.async_call(
                            "media_player", "clear_playlist", {"entity_id": entity_id},
                            blocking=True,
                        )
                    data["enqueue"] = "play"

                await hass.services.async_call(
                    "media_player", "play_media", data, blocking=True
                )
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("AudioTube play_media failed for %s: %s", entity_id, err)
                errors.append(entity_id)

        if len(errors) == len(entity_ids):
            raise HomeAssistantError(
                f"Wiedergabe auf keinem der Lautsprecher möglich: {', '.join(errors)}"
            )

    hass.services.async_register(
        DOMAIN,
        "play_media",
        async_play_media,
        schema=vol.Schema({
            vol.Required("entity_id"): cv.entity_ids,
            vol.Required("media_url"): cv.string,
            vol.Required("title"): cv.string,
            vol.Optional("artist", default=""): cv.string,
        }),
    )

    frontend.async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_URL_PATH,
        config={"url": f"/{DOMAIN}/index.html"},
        require_admin=False,
    )

    data["registered"] = True
    _LOGGER.info("AudioTube panel registered at /%s", PANEL_URL_PATH)
