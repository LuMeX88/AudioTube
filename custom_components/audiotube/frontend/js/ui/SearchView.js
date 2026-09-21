/**
 * Search view — search bar, filter tabs, and result cards.
 */
import { appState } from '../../src/core/state/AppState.js';
import { t }        from '../../src/core/i18n/i18n.js';
import { formatDuration, isoThumb } from './helpers.js';
import { icon }     from './icons.js';
import { openPlaylistPicker } from './PlaylistPicker.js';
import { trackFromSearchResult } from '../../src/core/models.js';

let _ctrl;

export function renderSearch(container, ctrl) {
  _ctrl = ctrl;
  container.innerHTML = `
    <section class="search-view" aria-label="${t('navSearch')}">
      <form class="search-form" id="searchForm" role="search">
        <input
          type="search"
          id="searchInput"
          class="search-input"
          placeholder="${t('searchPlaceholder')}"
          autocomplete="off"
          aria-label="${t('searchPlaceholder')}"
          value="${appState.get('searchQuery')}"
        />
        <button type="submit" class="btn-primary search-btn" aria-label="${t('searchButton')}">
          ${t('searchButton')}
        </button>
      </form>

      <div class="filter-tabs" role="tablist" aria-label="Inhaltstyp-Filter">
        <button class="filter-tab active" data-type="all"      role="tab" aria-selected="true">${t('filterAll')}</button>
        <button class="filter-tab"        data-type="track"    role="tab" aria-selected="false">${t('filterTracks')}</button>
        <button class="filter-tab"        data-type="playlist" role="tab" aria-selected="false">${t('filterPlaylists')}</button>
      </div>

      <div id="searchResults" class="results-grid" aria-live="polite" aria-busy="false"></div>
    </section>
  `;

  const form    = container.querySelector('#searchForm');
  const input   = container.querySelector('#searchInput');
  const results = container.querySelector('#searchResults');
  const tabs    = container.querySelectorAll('.filter-tab');

  let activeType = 'all';

  // Filter tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeType = tab.dataset.type;
      renderResults(results);
    });
  });

  // Search form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    // Detect if it's a URL
    if (/^https?:\/\//i.test(q)) {
      await _ctrl.resolveUrl(q);
    } else {
      await _ctrl.search(q, activeType);
    }
  });

  // Reactive updates
  const unsub = appState.on(['searchResults', 'searchLoading', 'searchError'], () => {
    renderResults(results);
  });

  // Cleanup when view changes
  appState.on('activeView', view => {
    if (view !== 'search') unsub();
  });

  // Initial render if we have results
  renderResults(results);
}

function renderResults(container) {
  const loading = appState.get('searchLoading');
  const error   = appState.get('searchError');
  const all     = appState.get('searchResults');
  const favIds  = new Set(appState.get('favorites').map(f => f.id));

  container.setAttribute('aria-busy', loading);

  if (loading) {
    container.innerHTML = `<div class="loading-indicator" role="status">${t('searchLoading')}</div>`;
    return;
  }
  if (error) {
    container.innerHTML = `<div class="error-msg" role="alert">${t('searchError')}</div>`;
    return;
  }
  if (!all.length && appState.get('searchQuery')) {
    container.innerHTML = `<div class="empty-msg">${t('searchNoResults')}</div>`;
    return;
  }
  if (!all.length) { container.innerHTML = ''; return; }

  container.innerHTML = all.map(r => resultCardHtml(r, favIds.has(r.id))).join('');

  // Wire buttons
  container.querySelectorAll('.result-card').forEach(card => {
    const id = card.dataset.id;
    const result = all.find(r => r.id === id);
    if (!result) return;

    card.querySelector('.btn-play')?.addEventListener('click', () => _ctrl.playNow(result));
    card.querySelector('.btn-queue')?.addEventListener('click', () => _ctrl.addToQueue(result));
    card.querySelector('.btn-next')?.addEventListener('click', () => _ctrl.playNext(result));
    card.querySelector('.btn-addpl')?.addEventListener('click', () => openPlaylistPicker(result, _ctrl));
    card.querySelector('.btn-fav')?.addEventListener('click', () => {
      const track = trackFromSearchResult(result);
      _ctrl.toggleFavorite(track);
      // Re-render the star only
      const btn = card.querySelector('.btn-fav');
      const isFav = _ctrl.isFavorite(result.id);
      btn.innerHTML = isFav ? icon('heartFill') : icon('heart');
      btn.classList.toggle('active', isFav);
      btn.title = isFav ? t('removeFromFavorites') : t('addToFavorites');
    });
  });
}

function resultCardHtml(r, isFav) {
  const thumb = r.thumbnailUrl
    ? `<img src="${r.thumbnailUrl}" alt="${escHtml(r.title)}" loading="lazy" class="result-thumb">`
    : `<div class="result-thumb result-thumb--placeholder">🎵</div>`;

  const meta = r.type === 'track'
    ? `<span class="result-duration">${formatDuration(r.durationSec)}</span>`
    : `<span class="result-playlist-badge">Playlist · ${t('trackCount', r.trackCount)}</span>`;

  const isPlaylist = r.type === 'playlist';
  return `
    <article class="result-card" data-id="${r.id}" data-type="${r.type}">
      <div class="result-thumb-wrap">${thumb}
        <button class="thumb-play btn-play" title="${t('play')}" aria-label="${t('play')}">${icon('play', 22)}</button>
      </div>
      <div class="result-info">
        <p class="result-title" title="${escHtml(r.title)}">${escHtml(r.title)}</p>
        <p class="result-artist">${escHtml(r.artist)}</p>
        ${meta}
      </div>
      <div class="result-actions">
        <button class="btn-icon btn-queue" title="${t('addToQueue')}" aria-label="${t('addToQueue')}">${icon('queue')}</button>
        <button class="btn-icon btn-next"  title="${t('playNext')}" aria-label="${t('playNext')}">${icon('next')}</button>
        ${isPlaylist ? '' : `<button class="btn-icon btn-addpl" title="${t('addToPlaylist')}" aria-label="${t('addToPlaylist')}">${icon('plusList')}</button>`}
        <button class="btn-icon btn-fav ${isFav ? 'active' : ''}"
                title="${isFav ? t('removeFromFavorites') : t('addToFavorites')}"
                aria-label="${isFav ? t('removeFromFavorites') : t('addToFavorites')}">
          ${isFav ? icon('heartFill') : icon('heart')}
        </button>
      </div>
    </article>
  `;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
