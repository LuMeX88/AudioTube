/**
 * Resolves an access token for calling the Home Assistant HTTP/WebSocket APIs.
 *
 * In a normal browser tab the token lives in `localStorage.hassTokens`
 * (written by the HA frontend after login). Inside the official Companion
 * Apps (iOS/Android) the panel runs in a WebView where auth is NEVER
 * persisted to localStorage — the native shell instead hands out short-lived
 * tokens on request via the documented "external auth" postMessage protocol
 * (see home-assistant/frontend `src/external_app/external_auth.ts`).
 * Without this, `getSpeakers()`/API calls silently 401 and the panel behaves
 * as if no media_players exist.
 */

const CALLBACK_SET_TOKEN = 'externalAuthSetToken';

let cachedToken = null; // { access_token, expires }
let pendingRequest = null;

function externalApp() {
  return window.externalApp || window.externalAppV2 || window.webkit?.messageHandlers?.getExternalAuth
    ? window
    : null;
}

export function isExternalApp() {
  return Boolean(externalApp());
}

function requestExternalToken(force) {
  if (pendingRequest && !force) return pendingRequest;

  const payload = { callback: CALLBACK_SET_TOKEN };
  if (force) payload.force = true;

  pendingRequest = new Promise((resolve, reject) => {
    window[CALLBACK_SET_TOKEN] = (success, data) => {
      if (success) resolve(data);
      else reject(new Error('Companion App hat die Anmeldung verweigert.'));
    };
  })
    .then(data => {
      cachedToken = { access_token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
      return cachedToken;
    })
    .finally(() => { pendingRequest = null; });

  // Let the promise above register its window callback before the native
  // shell can respond (postMessage replies can arrive on the next tick).
  Promise.resolve().then(() => {
    if (window.externalAppV2) {
      window.externalAppV2.postMessage(JSON.stringify({ type: 'getExternalAuth', payload }));
    } else if (window.externalApp) {
      window.externalApp.getExternalAuth(JSON.stringify(payload));
    } else {
      window.webkit.messageHandlers.getExternalAuth.postMessage(payload);
    }
  });

  return pendingRequest;
}

/**
 * @param {{ force?: boolean }} [options] - force=true bypasses the cache (used to retry after a 401).
 * @returns {Promise<string|null>} access token, or null if the browser session is simply logged out.
 */
export async function getAccessToken(options = {}) {
  if (isExternalApp()) {
    if (!options.force && cachedToken && cachedToken.expires - Date.now() > 10000) {
      return cachedToken.access_token;
    }
    const token = await requestExternalToken(Boolean(options.force));
    return token.access_token;
  }

  const tokens = JSON.parse(localStorage.getItem('hassTokens') || '{}');
  if (!tokens.access_token || (tokens.expires && tokens.expires <= Date.now())) return null;
  return tokens.access_token;
}
