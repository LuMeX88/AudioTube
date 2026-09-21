"""AudioTube Home Assistant integration."""
from __future__ import annotations

import logging
from pathlib import Path
from urllib.parse import quote

import voluptuous as vol
from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

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
    await _async_register(hass, entry.data["proxy_url"])
    return True


async def _async_register(hass: HomeAssistant, proxy_url: str) -> None:
    """Register static assets, the service, and the panel once."""
    data = hass.data.setdefault(DOMAIN, {})
    if data.get("registered"):
        return

    frontend_path = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(f"/{DOMAIN}", str(frontend_path), cache_headers=False)]
    )

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
        config={"url": f"/{DOMAIN}/index.html?proxy={quote(proxy_url, safe=':/')}"},
        require_admin=False,
    )

    data["registered"] = True
    _LOGGER.info("AudioTube panel registered at /%s", PANEL_URL_PATH)
