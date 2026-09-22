/**
 * Resolves an access token for calling the Home Assistant HTTP/WebSocket APIs.
 *
 * AudioTube is registered as an "iframe" panel, so it runs in a same-origin
 * <iframe> inside the real Home Assistant frontend. That frontend already
 * maintains a fully authenticated connection and exposes it on its own
 * window as `window.hassConnection` (a Promise<{ auth, conn }>) — this is
 * set up identically whether the user is in a normal browser tab or the
 * iOS/Android Companion App, because it happens *before* our panel is even
 * loaded. Reading it via `window.parent.hassConnection` (same-origin, so a
 * plain property access, no postMessage needed) is Home Assistant's own
 * mechanism for this and works everywhere.
 *
 * (Earlier versions of this file tried to reimplement the Companion App's
 * "external auth" postMessage protocol directly from inside this iframe.
 * That bridge is apparently only exposed to the top frame, not nested
 * iframes, so it silently never resolved here — hence this simpler,
 * documented approach instead. See home-assistant/frontend
 * `src/entrypoints/core.ts`, which sets `window.hassConnection`.)
 */

let authPromise = null;

async function getAuth() {
  if (!authPromise) {
    const topWindow = window.parent && window.parent !== window ? window.parent : window;
    if (!topWindow.hassConnection) {
      throw new Error('Home Assistant-Verbindung wurde nicht gefunden (window.hassConnection fehlt).');
    }
    authPromise = topWindow.hassConnection.then(({ auth }) => auth);
  }
  return authPromise;
}

/**
 * @param {{ force?: boolean }} [options] - force=true refreshes the token even if it looks valid (used to retry after a 401).
 * @returns {Promise<string|null>} access token, or null if no HA connection is available at all.
 */
export async function getAccessToken(options = {}) {
  let auth;
  try {
    auth = await getAuth();
  } catch {
    return null;
  }
  const expiresInMs = auth.data.expires ? auth.data.expires - Date.now() : null;
  if (options.force || !auth.data.access_token || (expiresInMs !== null && expiresInMs <= 10000)) {
    await auth.refreshAccessToken(Boolean(options.force));
  }
  return auth.data.access_token;
}
