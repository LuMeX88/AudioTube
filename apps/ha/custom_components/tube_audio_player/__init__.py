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
from functools import partial

import voluptuous as vol
from homeassistant.components import frontend
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.typing import ConfigType

_LOGGER = logging.getLogger(__name__)

DOMAIN = "tube_audio_player"

PANEL_URL_PATH = "tube-audio"
PANEL_TITLE = "AudioTube"
PANEL_ICON = "mdi:music-note"
APP_URL = "/local/tube_audio_player/apps/local/index.html?v=20260914-18"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Tube Audio Player iframe panel."""
    hass.data.setdefault(DOMAIN, {})

    async def async_play_media(call) -> None:
      entity_id = call.data["entity_id"]
      registry_entry = er.async_get(hass).async_get(entity_id)
      if registry_entry is None:
        raise ValueError(f"Unknown media player: {entity_id}")

      speaker = None
      for entry in hass.config_entries.async_entries("sonos"):
        data = getattr(entry, "runtime_data", None)
        if data:
          speaker = data.unique_id_speaker_mappings.get(registry_entry.unique_id)
          if speaker:
            break
      if speaker is None:
        raise ValueError(f"Sonos speaker not found: {entity_id}")

      display_title = call.data["title"]
      artist = call.data.get("artist")
      if artist:
        display_title = f"{display_title} - {artist}"
      player = speaker.coordinator or speaker
      await hass.async_add_executor_job(
        partial(player.soco.play_uri, call.data["media_url"], title=display_title)
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
        config={"url": APP_URL},
        require_admin=False,
    )

    _LOGGER.info("Tube Audio Player panel registered at /%s", PANEL_URL_PATH)
    return True
