/**
 * App shell renderer — mounts all views and wires up navigation.
 * @module apps/local/js/ui/App
 */
import { appState }    from '../../src/core/state/AppState.js?v=20260924-1';
import { t, getLocale, setLocale, availableLocales, onLocaleChange } from '../../src/core/i18n/i18n.js?v=20260925-1';
import { icon }        from './icons.js?v=20260924-1';
import { showConfirm, showPrompt } from './dialogs.js?v=20260925-1';
import { renderSearch }   from './SearchView.js?v=20260924-1';
import { renderQueue }    from './QueueView.js?v=20260924-1';
import { renderFavorites} from './FavoritesView.js?v=20260924-1';
import { renderPlaylists} from './PlaylistsView.js?v=20260925-1';
import { renderPlayerBar} from './PlayerBar.js?v=20260924-7';
import { renderNotification } from './Notification.js';

export function renderApp(ctrl) {
  const root = document.getElementById('app');
  // Re-runs on every language switch; drop the previous run's document-level
  // listeners so they don't stack up against a detached DOM.
  root._audiotubeCleanup?.();
  const appTeardown = new AbortController();
  root._audiotubeCleanup = () => appTeardown.abort();
  root.innerHTML = `
    <div class="app-layout">
      <header class="app-header">
        <div class="app-logo">
          <span class="logo-icon">${icon('music', 22)}</span>
          <span class="logo-text">AudioTube</span>
        </div>
        <button class="nav-toggle" id="navToggle" aria-label="${t('navMenu')}" aria-expanded="false" aria-controls="appNav">
          ${icon('menu', 20)}
        </button>
        <nav class="app-nav" id="appNav" role="navigation" aria-label="${t('navSearch')}">
          <button class="nav-btn active" data-view="search"    aria-label="${t('navSearch')}">${t('navSearch')}</button>
          <button class="nav-btn"        data-view="queue"     aria-label="${t('navQueue')}">${t('navQueue')}</button>
          <button class="nav-btn"        data-view="favorites" aria-label="${t('navFavorites')}">${t('navFavorites')}</button>
          <button class="nav-btn"        data-view="playlists" aria-label="${t('navPlaylists')}">${t('navPlaylists')}</button>
        </nav>
        <div class="speaker-badge" id="speakerBadge" role="button" tabindex="0" aria-label="${t('selectSpeaker')}">
          <span class="speaker-icon">${icon('speaker', 16)}</span>
          <span id="speakerName">–</span>
        </div>
        <button class="btn-icon settings-btn" id="settingsBtn" title="${t('openSettings')}" aria-label="${t('openSettings')}">
          ${icon('gear', 20)}
        </button>
      </header>

      <main class="app-main" id="mainContent" role="main"></main>

      <div id="notification" class="notification hidden" aria-live="polite"></div>
      <div id="speakerModal" class="modal hidden" role="dialog" aria-modal="true" aria-label="${t('selectSpeaker')}"></div>
      <div id="settingsModal" class="modal hidden" role="dialog" aria-modal="true" aria-label="${t('settings')}"></div>

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
    closeNavMenu();
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  // Hamburger menu — only visible/interactive on narrow screens (see CSS);
  // the nav stays a normal always-expanded row on wider viewports.
  const appNav = document.getElementById('appNav');
  const navToggle = document.getElementById('navToggle');
  function closeNavMenu() {
    appNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }
  navToggle.addEventListener('click', () => {
    const open = appNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (!appNav.classList.contains('open')) return;
    if (appNav.contains(e.target) || navToggle.contains(e.target)) return;
    closeNavMenu();
  }, { signal: appTeardown.signal });

  // Language switch — re-render the whole app in the new locale
  const offLocale = onLocaleChange(() => {
    offLocale();          // avoid stacking listeners across re-renders
    renderApp(ctrl);
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

  // Settings modal (language, theme, backup)
  const settingsModal = document.getElementById('settingsModal');
  document.getElementById('settingsBtn').addEventListener('click', () => openSettingsModal(settingsModal, ctrl));
  settingsModal.addEventListener('click', e => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
  });

  // Speaker name in header
  const renderSpeakerName = () => {
    const id = appState.get('selectedSpeakerId');
    const sp = ctrl.getSelectableTargets().find(s => s.id === id);
    document.getElementById('speakerName').textContent = sp?.name || '–';
  };
  appState.on(['selectedSpeakerId', 'speakers', 'groups'], renderSpeakerName);
  // The speaker is restored during init(), before this view subscribes.
  renderSpeakerName();

  // Initial view
  navigate('search');
}

function openSpeakerModal(modal, ctrl) {
  const targets  = ctrl.getSelectableTargets();
  const selected = appState.get('selectedSpeakerId');

  modal.innerHTML = `
    <div class="modal-box">
      <h2 class="modal-title">${t('selectSpeaker')}</h2>
      <ul class="speaker-list">
        ${targets.length
          ? targets.map(sp => `
            <li>
              <button class="speaker-item ${!sp.isAvailable ? 'unavailable' : ''} ${sp.id === selected ? 'selected' : ''}"
                      data-id="${sp.id}"
                      ${!sp.isAvailable ? 'disabled' : ''}
                      aria-pressed="${sp.id === selected}">
                <span class="speaker-type-icon">${icon(sp.type === 'group' ? 'queue' : 'speaker', 18)}</span>
                <span class="speaker-name">${sp.name}</span>
                ${sp.type === 'group' ? `<span class="unavailable-badge">${t('speakerGroup')}</span>` : ''}
                ${!sp.isAvailable ? `<span class="unavailable-badge">${t('errorSpeaker')}</span>` : ''}
                ${sp.id === selected ? `<span class="selected-badge">${icon('check', 16)}</span>` : ''}
              </button>
            </li>`).join('')
          : `<li class="no-speakers">${t('noSpeakers')}</li>`
        }
      </ul>
      <div class="modal-actions">
        <button class="btn-secondary" id="manageGroups">${t('manageGroups')}</button>
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

  modal.querySelector('#manageGroups').addEventListener('click', () => {
    openGroupsModal(modal, ctrl);
  });

  modal.querySelector('#closeSpeakerModal').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
}

function openGroupsModal(modal, ctrl) {
  const groups   = appState.get('groups');
  const speakers = appState.get('speakers');

  modal.innerHTML = `
    <div class="modal-box">
      <h2 class="modal-title">${t('manageGroups')}</h2>
      <ul class="group-list">
        ${groups.length
          ? groups.map(g => `
            <li class="group-card" data-id="${g.id}">
              <div class="group-card-header">
                <span class="group-name">${escHtml(g.name)}</span>
                <div class="group-actions">
                  <button class="btn-icon group-rename" title="${t('renameGroup')}" aria-label="${t('renameGroup')}">${icon('edit', 16)}</button>
                  <button class="btn-icon group-delete" title="${t('deleteGroup')}" aria-label="${t('deleteGroup')}">${icon('trash', 16)}</button>
                </div>
              </div>
              <ul class="group-members">
                ${speakers.length
                  ? speakers.map(sp => `
                    <li>
                      <label class="group-member-item">
                        <input type="checkbox" data-speaker="${sp.id}" ${g.speakerIds.includes(sp.id) ? 'checked' : ''}>
                        <span>${escHtml(sp.name)}</span>
                      </label>
                    </li>`).join('')
                  : `<li class="empty-msg small">${t('noSpeakers')}</li>`
                }
              </ul>
            </li>`).join('')
          : `<li class="empty-msg small">${t('noGroupsYet')}</li>`
        }
      </ul>
      <button class="picker-new" id="createGroup">${icon('add', 18)} ${t('createGroup')}</button>
      <div class="modal-actions">
        <button class="btn-secondary" id="backToSpeakers">${t('close')}</button>
      </div>
    </div>
  `;

  modal.querySelectorAll('.group-member-item input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const card = cb.closest('.group-card');
      const groupId = card.dataset.id;
      const speakerIds = [...card.querySelectorAll('input[type=checkbox]:checked')].map(el => el.dataset.speaker);
      ctrl.setGroupMembers(groupId, speakerIds);
    });
  });

  modal.querySelectorAll('.group-rename').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.group-card');
      const group = groups.find(g => g.id === card.dataset.id);
      const name = await showPrompt(t('groupName'), group?.name || '');
      if (!name) return;
      ctrl.renameGroup(card.dataset.id, name);
      openGroupsModal(modal, ctrl);
    });
  });

  modal.querySelectorAll('.group-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.group-card');
      const group = groups.find(g => g.id === card.dataset.id);
      const ok = await showConfirm(t('groupDeleteConfirm', group?.name || ''));
      if (!ok) return;
      ctrl.deleteGroup(card.dataset.id);
      openGroupsModal(modal, ctrl);
    });
  });

  modal.querySelector('#createGroup').addEventListener('click', async () => {
    const name = await showPrompt(t('groupName'));
    if (!name) return;
    ctrl.createGroup(name);
    openGroupsModal(modal, ctrl);
  });

  modal.querySelector('#backToSpeakers').addEventListener('click', () => {
    openSpeakerModal(modal, ctrl);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function openSettingsModal(modal, ctrl) {
  const settings = await ctrl.getSettings();
  const theme = settings?.theme || 'system';

  modal.innerHTML = `
    <div class="modal-box settings-box">
      <h2 class="modal-title">${t('settings')}</h2>

      <section class="settings-section">
        <h3 class="settings-section-title">${t('language')}</h3>
        <div class="lang-switch" role="group" aria-label="${t('language')}">
          <span class="lang-icon" aria-hidden="true">${icon('globe', 16)}</span>
          ${availableLocales().map(loc => `
            <button class="lang-btn ${loc === getLocale() ? 'active' : ''}" data-locale="${loc}"
                    aria-pressed="${loc === getLocale()}">${loc.toUpperCase()}</button>`).join('')}
        </div>
      </section>

      <section class="settings-section">
        <h3 class="settings-section-title">${t('theme')}</h3>
        <div class="theme-switch" role="group" aria-label="${t('theme')}">
          ${['light', 'dark', 'system', 'oled', 'sepia', 'contrast'].map(th => `
            <button class="theme-btn ${th === theme ? 'active' : ''}" data-theme="${th}"
                    aria-pressed="${th === theme}">${t(`theme${th.charAt(0).toUpperCase()}${th.slice(1)}`)}</button>`).join('')}
        </div>
      </section>

      <section class="settings-section">
        <h3 class="settings-section-title">${t('backup')}</h3>
        <p class="settings-hint">${t('backupHint')}</p>
        <div class="modal-actions">
          <button class="btn-secondary" id="exportYamlBtn">${icon('download', 16)} ${t('exportYaml')}</button>
          <button class="btn-secondary" id="importYamlBtn">${icon('upload', 16)} ${t('importYaml')}</button>
          <input type="file" id="importYamlFile" accept=".yaml,.yml,text/yaml" class="visually-hidden" />
        </div>
      </section>

      <section class="settings-section">
        <h3 class="settings-section-title">${t('about')}</h3>
        <p class="settings-hint" id="aboutVersion">${t('version', '…')}</p>
      </section>

      <div class="modal-actions">
        <button class="btn-secondary" id="closeSettingsModal">${t('close')}</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  // Version is served by a small public endpoint (reads manifest.json), so it
  // never needs to be hand-kept in sync with GitHub release tags here.
  fetch('/api/audiotube/version').then(r => r.json()).then(({ version, repository }) => {
    const el = modal.querySelector('#aboutVersion');
    if (!el) return;
    const label = t('version', version);
    el.innerHTML = repository
      ? `<a href="${repository}/releases/tag/v${version}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
  }).catch(() => {
    const el = modal.querySelector('#aboutVersion');
    if (el) el.textContent = t('version', '?');
  });

  modal.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.locale === getLocale()) return;
      setLocale(btn.dataset.locale); // triggers a full re-render via onLocaleChange
    });
  });

  modal.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await ctrl.setTheme(btn.dataset.theme);
      modal.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
    });
  });

  modal.querySelector('#exportYamlBtn').addEventListener('click', () => {
    const yaml = ctrl.exportBackupYaml();
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `audiotube-backup-${stamp}.yaml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const fileInput = modal.querySelector('#importYamlFile');
  modal.querySelector('#importYamlBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const replace = await showConfirm(t('importReplaceConfirm'));
      const { favoritesCount, playlistsCount } = await ctrl.importBackupYaml(text, { replace });
      appState.notify(t('importSuccess', favoritesCount, playlistsCount), 'info');
    } catch (err) {
      appState.notify(t('importError'), 'error');
    }
  });

  modal.querySelector('#closeSettingsModal').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
}
