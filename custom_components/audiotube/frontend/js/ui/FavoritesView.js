/**
 * Favorites view
 */
import { appState } from '../../src/core/state/AppState.js?v=20260924-1';
import { t }        from '../../src/core/i18n/i18n.js?v=20260924-3';
import { formatDuration } from './helpers.js';
import { icon }     from './icons.js?v=20260924-1';
import { openPlaylistPicker } from './PlaylistPicker.js';

export function renderFavorites(container, ctrl) {
  container.innerHTML = `
    <section class="favorites-view" aria-label="${t('favorites')}">
      <div class="view-header"><h2>${t('favorites')}</h2></div>
      <div id="favList" class="results-grid" aria-live="polite"></div>
    </section>
  `;

  const list = container.querySelector('#favList');

  function render() {
    const favs = appState.get('favorites');
    if (!favs.length) {
      list.innerHTML = `<div class="empty-msg">${t('favoritesEmpty')}</div>`;
      return;
    }
    list.innerHTML = favs.map(track => `
      <article class="result-card" data-id="${track.id}">
        <div class="result-thumb-wrap">
          ${track.thumbnailUrl
            ? `<img src="${track.thumbnailUrl}" alt="${escHtml(track.title)}" loading="lazy" class="result-thumb">`
            : `<div class="result-thumb result-thumb--placeholder">${icon('music', 26)}</div>`}
          <button class="thumb-play btn-play" data-id="${track.id}" title="${t('play')}" aria-label="${t('play')}">${icon('play', 22)}</button>
        </div>
        <div class="result-info">
          <p class="result-title">${escHtml(track.title)}</p>
          <p class="result-artist">${escHtml(track.artist)}</p>
          <span class="result-duration">${formatDuration(track.durationSec)}</span>
        </div>
        <div class="result-actions">
          <button class="btn-icon btn-queue" data-id="${track.id}" title="${t('addToQueue')}" aria-label="${t('addToQueue')}">${icon('queue')}</button>
          <button class="btn-icon btn-addpl" data-id="${track.id}" title="${t('addToPlaylist')}" aria-label="${t('addToPlaylist')}">${icon('plusList')}</button>
          <button class="btn-icon btn-fav active" data-id="${track.id}" title="${t('removeFromFavorites')}" aria-label="${t('removeFromFavorites')}">${icon('heartFill')}</button>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('.btn-play').forEach(btn => {
      const track = favs.find(f => f.id === btn.dataset.id);
      if (track) btn.addEventListener('click', () => ctrl.playNow({ ...track, type: 'track' }));
    });
    list.querySelectorAll('.btn-queue').forEach(btn => {
      const track = favs.find(f => f.id === btn.dataset.id);
      if (track) btn.addEventListener('click', () => ctrl.addToQueue({ ...track, type: 'track' }));
    });
    list.querySelectorAll('.btn-addpl').forEach(btn => {
      const track = favs.find(f => f.id === btn.dataset.id);
      if (track) btn.addEventListener('click', () => openPlaylistPicker(track, ctrl));
    });
    list.querySelectorAll('.btn-fav').forEach(btn => {
      const track = favs.find(f => f.id === btn.dataset.id);
      if (track) btn.addEventListener('click', () => ctrl.toggleFavorite(track));
    });
  }

  const unsub = appState.on('favorites', render);
  appState.on('activeView', view => { if (view !== 'favorites') unsub(); });
  render();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
