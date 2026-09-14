"""
Tube Audio Player — Home Assistant Custom Component
===================================================
Registers a sidebar **iframe panel** that loads the shared browser app
served from HA's static `/local/` path (www folder).

Modern HA removed the built-in `panel_iframe` YAML integration, so this
component registers the same built-in "iframe" frontend panel directly.

App URL (served from <config>/www via the docker-compose mounts):
  /local/tube_audio_player/apps/local/index.html
"""
from __future__ import annotations

import logging

from homeassistant.components import frontend
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

_LOGGER = logging.getLogger(__name__)

DOMAIN = "tube_audio_player"

PANEL_URL_PATH = "tube-audio"
PANEL_TITLE = "AudioTube"
PANEL_ICON = "mdi:music-note"
APP_URL = "/local/tube_audio_player/apps/local/index.html"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Tube Audio Player iframe panel."""
    hass.data.setdefault(DOMAIN, {})

    frontend.async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_URL_PATH,
        config={"url": APP_URL},
        require_admin=False,
    )

    _LOGGER.info("Tube Audio Player panel registered at /%s", PANEL_URL_PATH)
    return True
