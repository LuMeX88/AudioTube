"""Config flow for AudioTube."""
from __future__ import annotations

from homeassistant import config_entries

from . import DOMAIN


class AudioTubeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Create the single AudioTube integration entry. No configuration is required."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Set up AudioTube immediately; the integration is fully self-contained."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return self.async_create_entry(title="AudioTube", data={})

    async def async_step_import(self, user_input=None):
        """Reject legacy YAML imports in favor of the UI setup."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return self.async_abort(reason="not_supported")
