"""AudioTube Home Assistant integration."""
from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .api import (
    AudioTubeAudioView,
    AudioTubePrepareView,
    AudioTubeResolveView,
    AudioTubeSearchView,
)
from .cache import async_schedule_purge

_LOGGER = logging.getLogger(__name__)

DOMAIN = "audiotube"

PANEL_URL_PATH = DOMAIN
PANEL_TITLE = "AudioTube"
PANEL_ICON = "mdi:music-note"


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
    await hass.http.async_register_static_paths(
        [StaticPathConfig(f"/{DOMAIN}", str(frontend_path), cache_headers=False)]
    )

    hass.http.register_view(AudioTubeSearchView())
    hass.http.register_view(AudioTubeResolveView())
    hass.http.register_view(AudioTubePrepareView())
    hass.http.register_view(AudioTubeAudioView())

    async def async_play_media(call) -> None:
        await hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": call.data["entity_id"],
                "media_content_id": call.data["media_url"],
                "media_content_type": "music",
            },
            blocking=True,
        )

    hass.services.async_register(
        DOMAIN,
        "play_media",
        async_play_media,
        schema=vol.Schema({
            vol.Required("entity_id"): cv.entity_id,
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
