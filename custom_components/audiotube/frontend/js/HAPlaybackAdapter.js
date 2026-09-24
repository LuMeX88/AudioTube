/**
 * Home Assistant playback adapter used when AudioTube is embedded in HA.
 * It reads media_player states and sends playback commands through the HA
 * websocket API using the existing frontend session.
 */
import { defaultPlaybackState } from '../src/core/models.js?v=20260924-1';
import { getAccessToken } from './haAuth.js?v=20260923-1';

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/websocket`;

export class HAPlaybackAdapter {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #selectedSpeakerId = null;
  #targetIds = []; // entity ids actually addressed by service calls — [selectedSpeakerId], or all group members
  #stateCallbacks = new Set();
  #state = defaultPlaybackState();
  #streamUrlResolver;
  #pollTimer;
  #lastRemoteStatus = 'idle';
  #seekTarget = null;
  #seekGuardUntil = 0;
  #volumeTarget = null;
  #volumeGuardUntil = 0;
  #authRetried = false;
  #manualPause = false;
  // While true (a few seconds after we ourselves told the speaker to switch
  // tracks), transient 'idle'/'paused' readings are NOT treated as "track
  // ended" — the speaker briefly reports idle while stopping the previous
  // URI before it starts the new one, and without this guard that blip was
  // being misread as a second natural end-of-track, cascading into several
  // tracks being skipped from one next()/previous() press.
  #suppressEndedUntil = 0;
  #stallPositionSec = null;
  #stallSince = 0;
  // Client-side wall-clock fallback for "track ended", independent of
  // whatever the remote entity does or doesn't report for media_position/
  // media_duration on a raw (non-queue) play_media URI — some integrations
  // never update those attributes at all for such a call, which would
  // otherwise make idle/paused/stalled detection above never fire.
  #trackDurationSec = 0;   // from the track's own (YouTube) metadata, not the entity
  #playStartedAt = null;   // Date.now() timestamp of the current playing segment's start, or null while paused/loading
  #accumulatedPlayedSec = 0; // seconds already played across previous segments (before a pause/seek)

  constructor(streamUrlResolver) {
    this.#streamUrlResolver = streamUrlResolver;
  }

  async #connect() {
    if (this.#socket?.readyState === WebSocket.OPEN) return;

    let accessToken = await getAccessToken();
    if (!accessToken) {
      window.top.location.href = '/';
      throw new Error('Home Assistant-Anmeldung abgelaufen.');
    }

    await new Promise((resolve, reject) => {
      const socket = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('Home Assistant-WebSocket antwortet nicht. Bitte Home Assistant neu laden.'));
      }, 8000);
      const fail = error => {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      };
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', access_token: accessToken }));
      };
      socket.onmessage = async event => {
        const message = JSON.parse(event.data);
        if (message.type === 'auth_ok') {
          clearTimeout(timeout);
          this.#authRetried = false;
          this.#socket = socket;
          this.#startPolling();
          resolve();
          return;
        }
        if (message.type === 'auth_invalid') {
          // The token can be stale for a moment after a refresh; retry once with a
          // forced refresh before giving up and bouncing to the login screen.
          if (!this.#authRetried) {
            this.#authRetried = true;
            try {
              accessToken = await getAccessToken({ force: true });
              socket.send(JSON.stringify({ type: 'auth', access_token: accessToken }));
              return;
            } catch (refreshError) {
              fail(refreshError);
              return;
            }
          }
          fail(new Error('Home Assistant-Anmeldung ist abgelaufen. Bitte Home Assistant neu laden.'));
          window.top.location.href = '/';
          return;
        }
        if (message.id && this.#pending.has(message.id)) {
          const pending = this.#pending.get(message.id);
          this.#pending.delete(message.id);
          if (message.success) pending.resolve(message.result);
          else pending.reject(new Error(message.error?.message || 'Home Assistant request failed.'));
        }
      };
      socket.onerror = () => fail(new Error('Home Assistant-WebSocket konnte nicht verbunden werden.'));
      socket.onclose = () => {
        this.#socket = null;
        for (const pending of this.#pending.values()) pending.reject(new Error('Home Assistant WebSocket geschlossen.'));
        this.#pending.clear();
      };
    });
  }

  async #call(type, payload = {}) {
    await this.#connect();
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, type, ...payload }));
    });
  }

  async getSpeakers() {
    const states = await this.#apiRequest('/api/states');
    const PLAY_MEDIA = 4; // MediaPlayerEntityFeature.PLAY_MEDIA
    return states
      .filter(state => state.entity_id.startsWith('media_player.'))
      // Entities without PLAY_MEDIA support (e.g. some demo/TV media_players)
      // reject AudioTube's play_media call outright — hide them so they can't
      // be picked as a target or a group member in the first place.
      .filter(state => ((state.attributes.supported_features ?? 0) & PLAY_MEDIA) !== 0)
      .map(state => ({
        id: state.entity_id,
        name: state.attributes.friendly_name || state.entity_id,
        type: 'speaker',
        isAvailable: !['unavailable', 'unknown'].includes(state.state),
        volume: Math.round((state.attributes.volume_level ?? 0.5) * 100),
      }));
  }

  /**
   * @param {string} id          - the (possibly synthetic `group:<id>`) target id, kept for display/lookup
   * @param {string[]|null} memberIds - real media_player entity ids to actually address; a plain single
   *   speaker passes null (defaults to `[id]`), a group passes all its available member entity ids so every
   *   service call below fans out to all of them (HA's entity services natively accept an entity_id array).
   */
  async selectSpeaker(id, memberIds = null) {
    if (!memberIds) {
      const speakers = await this.getSpeakers();
      const speaker = speakers.find(item => item.id === id);
      if (!speaker) throw new Error(`Lautsprecher "${id}" nicht gefunden.`);
      this.#patchState({ volume: speaker.volume });
      this.#targetIds = [id];
    } else {
      if (!memberIds.length) throw new Error(`Gruppe "${id}" hat keine verfügbaren Lautsprecher.`);
      this.#targetIds = memberIds;
    }
    this.#selectedSpeakerId = id;
    this.#startPolling();
  }

  async play(track) {
    if (!this.#targetIds.length) throw new Error('Kein Lautsprecher ausgewählt.');
    this.#lastRemoteStatus = 'playing';
    this.#manualPause = false;
    // Grace period covering the speaker's stop-old/start-new transition, so
    // the transient idle/paused reading during that switch isn't mistaken
    // for the new track having already ended too.
    this.#suppressEndedUntil = Date.now() + 6000;
    this.#stallPositionSec = null;
    // Reset the wall-clock timer immediately (not just after play_media
    // succeeds) so a leftover previous track's elapsed time can't spuriously
    // fire "ended" again while this new one is still loading.
    this.#trackDurationSec = track.durationSec || 0;
    this.#accumulatedPlayedSec = 0;
    this.#playStartedAt = null;
    this.#patchState({ status: 'loading', currentTrack: track });
    const streamUrl = await this.#streamUrlResolver(track.id);
    await this.#apiRequest('/api/services/audiotube/play_media', {
      method: 'POST',
      body: JSON.stringify({
        entity_id: this.#targetIds,
        media_url: streamUrl,
        title: track.title,
        artist: track.artist,
      }),
    });
    this.#playStartedAt = Date.now();
    this.#patchState({ status: 'playing' });
    this.#startPolling();
  }

  async pause() {
    this.#manualPause = true;
    if (this.#playStartedAt) {
      this.#accumulatedPlayedSec += (Date.now() - this.#playStartedAt) / 1000;
      this.#playStartedAt = null;
    }
    await this.#callService('media_pause');
    this.#patchState({ status: 'paused' });
  }
  async resume() {
    this.#manualPause = false;
    this.#suppressEndedUntil = Date.now() + 3000;
    this.#playStartedAt = Date.now();
    await this.#callService('media_play');
    this.#patchState({ status: 'playing' });
  }
  async stop() {
    await this.#callService('media_stop');
    this.#lastRemoteStatus = 'idle';
    this.#manualPause = false;
    this.#trackDurationSec = 0;
    this.#accumulatedPlayedSec = 0;
    this.#playStartedAt = null;
    this.#patchState(defaultPlaybackState());
  }
  async next() { await this.#callService('media_next_track'); }
  async previous() { await this.#callService('media_previous_track'); }

  async setVolume(level) {
    const target = Math.max(0, Math.min(100, level));
    // The speaker keeps reporting the old volume for a moment; ignore that
    // until it catches up, otherwise the slider snaps back (e.g. to 16%).
    this.#volumeTarget = target;
    this.#volumeGuardUntil = Date.now() + 5000;
    await this.#callService('volume_set', { volume_level: target / 100 });
    this.#patchState({ volume: target });
  }

  async seek(positionSec) {
    const target = Math.max(0, positionSec);
    await this.#callService('media_seek', { seek_position: target });
    // The speaker keeps reporting the old position for a moment; ignore that
    // until it catches up, otherwise the progress bar snaps back.
    this.#seekTarget = target;
    this.#seekGuardUntil = Date.now() + 5000;
    // Re-anchor the wall-clock ended-fallback timer to the new position too.
    this.#accumulatedPlayedSec = target;
    if (this.#playStartedAt) this.#playStartedAt = Date.now();
    this.#patchState({ positionSec: target });
  }

  async #callService(service, serviceData = {}) {
    if (!this.#targetIds.length) return;
    await this.#apiRequest(`/api/services/media_player/${service}`, {
      method: 'POST',
      body: JSON.stringify({ entity_id: this.#targetIds, ...serviceData }),
    });
  }

  async #apiRequest(path, options = {}, retried = false) {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      window.top.location.href = '/';
      throw new Error('Home Assistant-Anmeldung abgelaufen.');
    }
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      // The token can be stale for a moment after a refresh; force a fresh one and retry once.
      if (!retried) {
        await getAccessToken({ force: true });
        return this.#apiRequest(path, options, true);
      }
      window.top.location.href = '/';
      throw new Error('Home Assistant-Anmeldung abgelaufen.');
    }
    if (!response.ok) throw new Error(`Home Assistant API Fehler: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }

  onStateChange(callback) { this.#stateCallbacks.add(callback); callback({ ...this.#state }); }
  destroy() {
    clearInterval(this.#pollTimer);
    this.#socket?.close();
    this.#stateCallbacks.clear();
  }

  #startPolling() {
    if (this.#pollTimer) return;
    this.#pollTimer = setInterval(() => this.#pollState(), 1000);
    this.#pollState();
  }

  async #pollState() {
    // For a group, the first member is read as the representative state (position/
    // duration/volume/status) — Sonos-style true multi-speaker sync isn't attempted,
    // each member just independently receives the same play/pause/volume commands.
    const primaryId = this.#targetIds[0];
    if (!primaryId) return;
    try {
      const states = await this.#apiRequest('/api/states');
      const remote = states.find(state => state.entity_id === primaryId);
      if (!remote) return;

      const attributes = remote.attributes || {};
      const remoteStatus = remote.state;
      let durationSec = Number(attributes.media_duration || this.#state.currentTrack?.durationSec || 0);
      let positionSec = Number(attributes.media_position || 0);
      const updatedAt = Date.parse(attributes.media_position_updated_at || '');
      if (remoteStatus === 'playing' && Number.isFinite(updatedAt)) {
        positionSec += Math.max(0, (Date.now() - updatedAt) / 1000);
      }

      // Some media_player integrations never populate media_position/
      // media_duration at all for a raw (non-queue) play_media URI. When
      // that's the case, fall back to our own wall-clock estimate so the
      // progress bar still shows something instead of staying at 0:00.
      if (!attributes.media_position && !durationSec && this.#trackDurationSec > 0) {
        durationSec = this.#trackDurationSec;
        positionSec = this.#estimatedElapsedSec();
      }

      if (this.#seekTarget !== null) {
        const caughtUp = Math.abs(positionSec - this.#seekTarget) < 4;
        if (caughtUp || Date.now() > this.#seekGuardUntil) {
          this.#seekTarget = null;
        } else {
          positionSec = this.#state.positionSec;
        }
      }

      const status = remoteStatus === 'playing' ? 'playing'
        : remoteStatus === 'paused' ? 'paused'
        : remoteStatus === 'buffering' ? 'loading'
        : remoteStatus === 'idle' ? 'idle'
        : this.#state.status;

      let volume = Math.round((attributes.volume_level ?? this.#state.volume / 100) * 100);
      if (this.#volumeTarget !== null) {
        const caughtUp = Math.abs(volume - this.#volumeTarget) < 3;
        if (caughtUp || Date.now() > this.#volumeGuardUntil) {
          this.#volumeTarget = null;
        } else {
          volume = this.#state.volume;
        }
      }

      this.#patchState({
        status,
        currentTrack: this.#state.currentTrack ?? this.#trackFromRemote(attributes, durationSec),
        positionSec: Math.min(positionSec, durationSec || positionSec),
        durationSec,
        volume,
      });

      // Detect "track actually finished" from up to three independent signals,
      // since different Sonos/media_player integrations report the end of a
      // manually-issued play_media URI differently (some go 'idle', some sit
      // in 'paused' at the last position, some just stop advancing position
      // while still claiming 'playing'):
      const pastSuppressWindow = Date.now() > this.#suppressEndedUntil;
      const nearEnd = durationSec > 0 && positionSec >= durationSec - 2;
      const wentIdle = remoteStatus === 'idle';
      const pausedAtEnd = remoteStatus === 'paused' && !this.#manualPause && nearEnd;

      let stalled = false;
      if (remoteStatus === 'playing' && nearEnd) {
        if (this.#stallPositionSec !== null && Math.abs(positionSec - this.#stallPositionSec) < 0.5) {
          if (Date.now() - this.#stallSince > 3000) stalled = true;
        } else {
          this.#stallPositionSec = positionSec;
          this.#stallSince = Date.now();
        }
      } else {
        this.#stallPositionSec = null;
      }

      // Wall-clock fallback: fires purely from our own timer against the
      // track's own (YouTube) metadata duration, entirely independent of
      // whatever the remote entity reports — the only signal guaranteed to
      // eventually fire even if the entity never changes state at all.
      const timerElapsed = this.#trackDurationSec > 0
        && this.#estimatedElapsedSec() >= this.#trackDurationSec + 2;

      if (this.#lastRemoteStatus === 'playing' && pastSuppressWindow && (wentIdle || pausedAtEnd || stalled || timerElapsed)) {
        this.#emit({ ...this.#state, _event: 'ended' });
      }
      this.#lastRemoteStatus = remoteStatus;
    } catch (error) {
      console.warn('[HAPlaybackAdapter] State polling failed:', error.message);
    }
  }

  /** Wall-clock estimate of playback position, independent of the remote entity. */
  #estimatedElapsedSec() {
    return this.#accumulatedPlayedSec
      + (this.#playStartedAt ? (Date.now() - this.#playStartedAt) / 1000 : 0);
  }

  /**
   * Rebuilds a track from what the speaker reports, so the player bar still
   * reflects playback after the panel was unmounted and mounted again.
   */
  #trackFromRemote(attributes, durationSec) {
    if (!attributes.media_title) return null;
    return {
      id: '',
      title: attributes.media_title,
      artist: attributes.media_artist || '',
      durationSec,
      thumbnailUrl: attributes.entity_picture || '',
      videoUrl: '',
    };
  }

  #patchState(patch) {
    this.#state = { ...this.#state, ...patch };
    this.#emit(this.#state);
  }

  #emit(state) {
    for (const callback of this.#stateCallbacks) callback({ ...state });
  }
}