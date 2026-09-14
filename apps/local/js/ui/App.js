/**
 * App shell renderer — mounts all views and wires up navigation.
 * @module apps/local/js/ui/App
 */
import { appState }    from '../../../../src/core/state/AppState.js';
import { t }           from '../../../../src/core/i18n/i18n.js';
import { renderSearch }   from './SearchView.js';
import { renderQueue }    from './QueueView.js';
import { renderFavorites} from './FavoritesView.js';
import { renderPlaylists} from './PlaylistsView.js';
import { renderPlayerBar} from './PlayerBar.js';
import { renderNotification } from './Notification.js';

export function renderApp(ctrl) {
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="app-layout">
      <header class="app-header">
        <div class="app-logo">
          <span class="logo-icon">🎵</span>
          <span class="logo-text">Tube Audio Player</span>
        </div>
        <nav class="app-nav" role="navigation" aria-label="Hauptnavigation">
          <button class="nav-btn active" data-view="search"    aria-label="${t('navSearch')}">${t('navSearch')}</button>
          <button class="nav-btn"        data-view="queue"     aria-label="${t('navQueue')}">${t('navQueue')}</button>
          <button class="nav-btn"        data-view="favorites" aria-label="${t('navFavorites')}">${t('navFavorites')}</button>
          <button class="nav-btn"        data-view="playlists" aria-label="${t('navPlaylists')}">${t('navPlaylists')}</button>
        </nav>
        <div class="speaker-badge" id="speakerBadge" role="button" tabindex="0" aria-label="${t('selectSpeaker')}">
          <span class="speaker-icon">🔊</span>
          <span id="speakerName">–</span>
        </div>
      </header>

      <main class="app-main" id="mainContent" role="main"></main>

      <div id="notification" class="notification hidden" aria-live="polite"></div>
      <div id="speakerModal" class="modal hidden" role="dialog" aria-modal="true" aria-label="${t('selectSpeaker')}"></div>

      <footer class="player-bar" id="playerBar"></footer>
    </div>
  `;

  // Render sub-sections
  renderPlayerBar(document.getElementById('playerBar'), ctrl);
  renderNotification(document.getElementById('notification'));

  // View routing
  const views = {
    search:    () => renderSearch(document.getElementById('mainContent'), ctrl),
    queue:     () => renderQueue(document.getElementById('mainContent'), ctrl),
    favorites: () => renderFavorites(document.getElementById('mainContent'), ctrl),
    playlists: () => renderPlaylists(document.getElementById('mainContent'), ctrl),
  };

  function navigate(view) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    appState.set({ activeView: view });
    views[view]?.();
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  // Speaker modal
  const speakerModal = document.getElementById('speakerModal');
  document.getElementById('speakerBadge').addEventListener('click', () => openSpeakerModal(speakerModal, ctrl));
  document.getElementById('speakerBadge').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSpeakerModal(speakerModal, ctrl); }
  });
  speakerModal.addEventListener('click', e => {
    if (e.target === speakerModal) speakerModal.classList.add('hidden');
  });

  // Speaker name in header
  appState.on(['selectedSpeakerId', 'speakers'], () => {
    const id       = appState.get('selectedSpeakerId');
    const speakers = appState.get('speakers');
    const sp       = speakers.find(s => s.id === id);
    document.getElementById('speakerName').textContent = sp?.name || '–';
  });

  // Initial view
  navigate('search');
}

function openSpeakerModal(modal, ctrl) {
  const speakers = appState.get('speakers');
  const selected = appState.get('selectedSpeakerId');

  modal.innerHTML = `
    <div class="modal-box">
      <h2 class="modal-title">${t('selectSpeaker')}</h2>
      <ul class="speaker-list">
        ${speakers.length
          ? speakers.map(sp => `
            <li>
              <button class="speaker-item ${!sp.isAvailable ? 'unavailable' : ''} ${sp.id === selected ? 'selected' : ''}"
                      data-id="${sp.id}"
                      ${!sp.isAvailable ? 'disabled' : ''}
                      aria-pressed="${sp.id === selected}">
                <span class="speaker-type-icon">${sp.type === 'group' ? '👥' : '🔊'}</span>
                <span class="speaker-name">${sp.name}</span>
                ${!sp.isAvailable ? '<span class="unavailable-badge">Nicht verfügbar</span>' : ''}
                ${sp.id === selected ? '<span class="selected-badge">✓</span>' : ''}
              </button>
            </li>`).join('')
          : `<li class="no-speakers">${t('noSpeakers')}</li>`
        }
      </ul>
      <div class="modal-actions">
        <button class="btn-secondary" id="refreshSpeakers">${t('speakerRefresh')}</button>
        <button class="btn-secondary" id="closeSpeakerModal">${t('close')}</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  modal.querySelectorAll('.speaker-item:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', async () => {
      await ctrl.selectSpeaker(btn.dataset.id);
      modal.classList.add('hidden');
    });
  });

  modal.querySelector('#refreshSpeakers').addEventListener('click', async () => {
    await ctrl.refreshSpeakers();
    openSpeakerModal(modal, ctrl); // re-render
  });

  modal.querySelector('#closeSpeakerModal').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
}
