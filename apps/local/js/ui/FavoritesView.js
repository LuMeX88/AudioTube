/**
 * Favorites view
 */
import { appState } from '../../../../src/core/state/AppState.js';
import { t }        from '../../../../src/core/i18n/i18n.js';
import { formatDuration } from './helpers.js';

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
            : `<div class="result-thumb result-thumb--placeholder">🎵</div>`}
        </div>
        <div class="result-info">
          <p class="result-title">${escHtml(track.title)}</p>
          <p class="result-artist">${escHtml(track.artist)}</p>
          <span class="result-duration">${formatDuration(track.durationSec)}</span>
        </div>
        <div class="result-actions">
          <button class="btn-icon btn-play"  data-id="${track.id}" title="${t('play')}">▶</button>
          <button class="btn-icon btn-queue" data-id="${track.id}" title="${t('addToQueue')}">＋</button>
          <button class="btn-icon btn-fav active" data-id="${track.id}" title="${t('removeFromFavorites')}">★</button>
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
