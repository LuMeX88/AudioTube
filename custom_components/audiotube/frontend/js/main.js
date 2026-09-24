/**
 * Local app entry point (Version B — Browser).
 * Instantiates all adapters, search client, and controller,
 * then renders the UI.
 */
import { config }                   from './config.js';
import { LocalStorageAdapter }      from '../src/adapters/local/LocalStorageAdapter.js?v=20260924-1';
import { HAUserDataStorageAdapter } from './HAUserDataStorageAdapter.js?v=20260924-1';
import { LocalPlaybackAdapter }     from '../src/adapters/local/LocalPlaybackAdapter.js';
import { HAPlaybackAdapter }        from './HAPlaybackAdapter.js?v=20260924-3';
import { InvidiousSearchProvider }  from '../src/core/search/InvidiousSearchProvider.js?v=20260924-2';
import { SearchClient }             from '../src/core/search/SearchClient.js?v=20260924-1';
import { AppController }            from './AppController.js?v=20260924-3';
import { appState }                 from '../src/core/state/AppState.js?v=20260924-1';
import { t }                        from '../src/core/i18n/i18n.js?v=20260924-2';
import { renderApp }                from './ui/App.js?v=20260924-6';

async function bootstrap() {
  const inHomeAssistant = location.pathname.startsWith('/audiotube/');

  // 1. Load settings from storage first (may override config defaults).
  // Favorites/playlists sync per HA user account; settings/queue stay per-device.
  const storage   = inHomeAssistant ? new HAUserDataStorageAdapter() : new LocalStorageAdapter();
  const settings  = await storage.getSettings();

  const aiCfg     = { ...config.ai, ...(settings.ai || {}) };

  // 2. Instantiate search (talks to the built-in AudioTube API, same-origin)
  const invidiousProvider = new InvidiousSearchProvider();
  const searchClient      = new SearchClient(invidiousProvider, aiCfg);

  // 3. Instantiate playback adapter
  const PlaybackAdapter = inHomeAssistant ? HAPlaybackAdapter : LocalPlaybackAdapter;
  const playbackAdapter = new PlaybackAdapter(
    (videoId) => searchClient.getAudioStreamUrl(videoId)
  );

  // 4. Wire controller
  const ctrl = new AppController({
    playbackAdapter,
    searchClient,
    storageAdapter: storage,
  });

  await ctrl.init();

  // 5. Render UI
  renderApp(ctrl);
}

bootstrap().catch(err => {
  console.error('[bootstrap] Fatal error:', err);
  document.getElementById('app').innerHTML = `
    <div class="fatal-error">
      <h2>Start fehlgeschlagen</h2>
      <p>${err.message}</p>
    </div>`;
});
