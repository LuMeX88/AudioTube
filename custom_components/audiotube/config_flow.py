"""Config flow for AudioTube."""
from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers import config_validation as cv

from . import DOMAIN


class AudioTubeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Create the single AudioTube integration entry."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle setup from the Home Assistant UI."""
        if user_input is not None:
            await self.async_set_unique_id(DOMAIN)
            self._abort_if_unique_id_configured()
            return self.async_create_entry(title="AudioTube", data=user_input)

        schema = vol.Schema({
            vol.Required("proxy_url"): cv.url,
        })
        return self.async_show_form(step_id="user", data_schema=schema)

    async def async_step_import(self, user_input=None):
        """Reject legacy YAML imports in favor of the UI setup."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return self.async_abort(reason="not_supported")