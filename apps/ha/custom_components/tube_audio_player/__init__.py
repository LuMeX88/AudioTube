"""
Tube Audio Player — Home Assistant Custom Component
Version A stub: registers a panel and provides a WebSocket API.

Directory structure (place in <config>/custom_components/tube_audio_player/):
  __init__.py
  manifest.json
  panel/         ← symlink or copy of apps/local/ (shared UI)

Sprint 1: minimal scaffold, panel registration, config entry.
Sprint 2: full Sonos/media_player adapter, yt-dlp integration.
"""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.panel_custom import async_register_panel
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DOMAIN        = "tube_audio_player"
PANEL_URL     = "/tube-audio-player"
PANEL_TITLE   = "Tube Audio"
PANEL_ICON    = "mdi:music-note"
PANEL_DIR     = Path(__file__).parent / "panel"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Tube Audio Player integration."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Tube Audio Player from a config entry."""
    _LOGGER.info("Setting up Tube Audio Player panel")

    # Register the frontend panel (serves the HTML/JS/CSS app)
    await async_register_panel(
        hass,
        component_name="custom",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_URL.lstrip("/"),
        config={
            "name": "tube-audio-player",
            "embed_iframe": False,
            "trust_external": False,
            "js_url": f"/tube_audio_player/panel/js/main.js",
        },
        require_admin=False,
    )

    # Store controller reference for WebSocket handlers
    hass.data[DOMAIN]["entry"] = entry

    # TODO Sprint 2: register WebSocket commands for speaker/playback control
    # from .ws_api import async_register_ws_commands
    # async_register_ws_commands(hass)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    hass.data[DOMAIN].pop("entry", None)
    return True
