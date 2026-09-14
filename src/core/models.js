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

export function createQueueItem(track) {
  return { queueId: crypto.randomUUID(), track };
}

export function createPlaylist(name) {
  const now = Date.now();
  return { id: crypto.randomUUID(), name, tracks: [], createdAt: now, updatedAt: now };
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
