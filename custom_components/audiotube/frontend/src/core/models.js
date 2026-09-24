/**
 * Core data models shared across all adapters and versions.
 * @module core/models
 */

/**
 * @typedef {Object} Track
 * @property {string} id           - YouTube video ID
 * @property {string} title        - Track title
 * @property {string} artist       - Channel / artist name
 * @property {number} durationSec  - Duration in seconds
 * @property {string} thumbnailUrl - Best available thumbnail URL
 * @property {string} videoUrl     - Canonical YouTube watch URL
 */

/**
 * @typedef {Object} SearchResult
 * @property {'track'|'playlist'} type
 * @property {string} id
 * @property {string} title
 * @property {string} artist
 * @property {number} durationSec  - 0 for playlists
 * @property {number} trackCount   - 0 for single tracks
 * @property {string} thumbnailUrl
 * @property {string} videoUrl
 */

/**
 * @typedef {Object} QueueItem
 * @property {string} queueId  - Unique per-queue-slot ID (crypto.randomUUID)
 * @property {Track}  track
 */

/**
 * @typedef {Object} Speaker
 * @property {string}  id          - Unique speaker / group ID
 * @property {string}  name        - Display name (room or group label)
 * @property {'speaker'|'group'} type
 * @property {boolean} isAvailable
 * @property {number}  volume      - 0–100
 */

/**
 * @typedef {Object} Playlist
 * @property {string}   id        - Local UUID
 * @property {string}   name
 * @property {Track[]}  tracks
 * @property {number}   createdAt - unix ms
 * @property {number}   updatedAt - unix ms
 */

/**
 * @typedef {'idle'|'loading'|'playing'|'paused'|'error'} PlaybackStatus
 */

/**
 * @typedef {Object} PlaybackState
 * @property {PlaybackStatus}  status
 * @property {Track|null}      currentTrack
 * @property {number}          positionSec
 * @property {number}          durationSec
 * @property {number}          volume        - 0–100
 * @property {boolean}         shuffle
 * @property {'none'|'one'|'all'} repeat
 */

// ─── Factory helpers ──────────────────────────────────────────────────────────

/**
 * Generate a UUID. `crypto.randomUUID()` requires a secure context
 * (HTTPS or localhost) and throws otherwise, which breaks this app when a
 * Home Assistant instance is reached over plain HTTP via its LAN IP.
 * Falls back to `crypto.getRandomValues` (available everywhere) or Math.random.
 */
export function generateId() {
  if (typeof crypto?.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Insecure context — fall through to the manual implementation below.
    }
  }
  const bytes = typeof crypto?.getRandomValues === 'function'
    ? crypto.getRandomValues(new Uint8Array(16))
    : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createQueueItem(track) {
  return { queueId: generateId(), track };
}

export function createPlaylist(name) {
  const now = Date.now();
  return { id: generateId(), name, tracks: [], createdAt: now, updatedAt: now };
}

/**
 * @typedef {Object} SpeakerGroup
 * @property {string}   id          - Local UUID (referenced as playback target `group:<id>`)
 * @property {string}   name
 * @property {string[]} speakerIds  - Member media_player entity ids. A speaker may belong to
 *                                    several groups at once (unlike native Sonos zone groups).
 * @property {number}   createdAt
 * @property {number}   updatedAt
 */
export function createGroup(name, speakerIds = []) {
  const now = Date.now();
  return { id: generateId(), name, speakerIds: [...speakerIds], createdAt: now, updatedAt: now };
}

export function defaultPlaybackState() {
  return {
    status: 'idle',
    currentTrack: null,
    positionSec: 0,
    durationSec: 0,
    volume: 50,
    shuffle: false,
    repeat: 'none',
  };
}

export function trackFromSearchResult(result) {
  return {
    id: result.id,
    title: result.title,
    artist: result.artist,
    durationSec: result.durationSec,
    thumbnailUrl: result.thumbnailUrl,
    videoUrl: result.videoUrl,
  };
}
