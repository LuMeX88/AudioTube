/**
 * Playlists view — create, rename, delete, play playlists.
 */
import { appState } from '../../src/core/state/AppState.js';
import { t }        from '../../src/core/i18n/i18n.js';
import { formatDuration } from './helpers.js';
import { icon }     from './icons.js';

export function renderPlaylists(container, ctrl) {
  container.innerHTML = `
    <section class="playlists-view" aria-label="${t('playlists')}">
      <div class="view-header">
        <h2>${t('playlists')}</h2>
        <button class="btn-primary" id="createPlaylistBtn">${icon('add', 18)} ${t('createPlaylist')}</button>
      </div>
      <div id="playlistsContent" aria-live="polite"></div>
    </section>
  `;

  container.querySelector('#createPlaylistBtn').addEventListener('click', () => {
    const name = prompt(t('playlistName'));
    if (name?.trim()) ctrl.createPlaylist(name.trim());
  });

  const content = container.querySelector('#playlistsContent');

  function render() {
    const pls = appState.get('playlists');
    if (!pls.length) {
      content.innerHTML = `<div class="empty-msg">${t('playlistsEmpty')}</div>`;
      return;
    }
    content.innerHTML = pls.map(pl => `
      <div class="playlist-card" data-id="${pl.id}">
        <div class="playlist-card-header">
          <div class="playlist-meta">
            <h3 class="playlist-name">${escHtml(pl.name)}</h3>
            <span class="playlist-count">${t('trackCount', pl.tracks.length)}</span>
          </div>
          <div class="playlist-actions">
            <button class="btn-icon btn-play-pl"    data-id="${pl.id}" title="${t('playPlaylist')}">${icon('play')}</button>
            <button class="btn-icon btn-queue-pl"   data-id="${pl.id}" title="${t('addPlaylistToQueue')}">${icon('queue')}</button>
            <button class="btn-icon btn-rename-pl"  data-id="${pl.id}" title="${t('renamePlaylist')}">${icon('edit')}</button>
            <button class="btn-icon btn-delete-pl"  data-id="${pl.id}" title="${t('deletePlaylist')}">${icon('trash')}</button>
          </div>
        </div>
        <ol class="playlist-tracks" aria-label="${escHtml(pl.name)} – ${t('trackCount', pl.tracks.length)}">
          ${pl.tracks.length
            ? pl.tracks.map((track, i) => `
              <li class="playlist-track-item" data-track-id="${track.id}" data-pl-id="${pl.id}">
                <span class="track-num">${i + 1}</span>
                <div class="track-info">
                  <span class="track-title">${escHtml(track.title)}</span>
                  <span class="track-artist">${escHtml(track.artist)}</span>
                </div>
                <span class="track-dur">${formatDuration(track.durationSec)}</span>
                <button class="btn-icon btn-remove-track"
                        data-pl-id="${pl.id}"
                        data-track-id="${track.id}"
                        title="${t('removeFromQueue')}">${icon('close', 18)}</button>
              </li>`).join('')
            : `<li class="empty-msg small">${t('playlistItemsEmpty')}</li>`
          }
        </ol>
      </div>
    `).join('');

    content.querySelectorAll('.btn-play-pl').forEach(btn => {
      btn.addEventListener('click', () => ctrl.playPlaylist(btn.dataset.id));
    });
    content.querySelectorAll('.btn-queue-pl').forEach(btn => {
      btn.addEventListener('click', () => ctrl.addPlaylistToQueue(btn.dataset.id));
    });
    content.querySelectorAll('.btn-rename-pl').forEach(btn => {
      btn.addEventListener('click', () => {
        const pl = appState.get('playlists').find(p => p.id === btn.dataset.id);
        const name = prompt(t('playlistName'), pl?.name || '');
        if (name?.trim()) ctrl.renamePlaylist(btn.dataset.id, name.trim());
      });
    });
    content.querySelectorAll('.btn-delete-pl').forEach(btn => {
      btn.addEventListener('click', () => {
        const pl = appState.get('playlists').find(p => p.id === btn.dataset.id);
        if (confirm(t('playlistDeleteConfirm', pl?.name || ''))) {
          ctrl.deletePlaylist(btn.dataset.id);
        }
      });
    });
    content.querySelectorAll('.btn-remove-track').forEach(btn => {
      btn.addEventListener('click', () => ctrl.removeTrackFromPlaylist(btn.dataset.plId, btn.dataset.trackId));
    });
  }

  const unsub = appState.on('playlists', render);
  appState.on('activeView', view => { if (view !== 'playlists') unsub(); });
  render();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
