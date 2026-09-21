"""Config flow for AudioTube."""
from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.selector import (
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from . import DOMAIN

STEP_USER_DATA_SCHEMA = vol.Schema({
    vol.Required("proxy_url"): TextSelector(
        TextSelectorConfig(type=TextSelectorType.URL, autocomplete="url")
    ),
})


class AudioTubeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Create the single AudioTube integration entry."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle setup from the Home Assistant UI."""
        errors: dict[str, str] = {}
        if user_input is not None:
            try:
                cv.url(user_input["proxy_url"])
            except vol.Invalid:
                errors["proxy_url"] = "invalid_url"
            else:
                await self.async_set_unique_id(DOMAIN)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title="AudioTube", data=user_input)

        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_DATA_SCHEMA, errors=errors
        )

    async def async_step_import(self, user_input=None):
        """Reject legacy YAML imports in favor of the UI setup."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return self.async_abort(reason="not_supported")