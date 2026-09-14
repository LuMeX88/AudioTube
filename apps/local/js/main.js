/**
 * Local app entry point (Version B — Browser).
 * Instantiates all adapters, search client, and controller,
 * then renders the UI.
 */
import { config }                   from './config.js';
import { LocalStorageAdapter }      from '../../../src/adapters/local/LocalStorageAdapter.js?v=20260914-3';
import { LocalPlaybackAdapter }     from '../../../src/adapters/local/LocalPlaybackAdapter.js';
import { HAPlaybackAdapter }        from './HAPlaybackAdapter.js?v=20260914-16';
import { InvidiousSearchProvider }  from '../../../src/core/search/InvidiousSearchProvider.js';
import { SearchClient }             from '../../../src/core/search/SearchClient.js';
import { AppController }            from './AppController.js';
import { appState }                 from '../../../src/core/state/AppState.js';
import { t }                        from '../../../src/core/i18n/i18n.js';
import { renderApp }                from './ui/App.js';

async function bootstrap() {
  // 1. Load settings from storage first (may override config defaults)
  const storage   = new LocalStorageAdapter();
  const settings  = await storage.getSettings();

  const proxyUrl  = settings.proxyBaseUrl || config.proxyBaseUrl;
  const aiCfg     = { ...config.ai, ...(settings.ai || {}) };

  // 2. Instantiate search
  const invidiousProvider = new InvidiousSearchProvider({ proxyBaseUrl: proxyUrl });
  const searchClient      = new SearchClient(invidiousProvider, aiCfg);

  // 3. Instantiate playback adapter
  const PlaybackAdapter = location.pathname.startsWith('/local/tube_audio_player/')
    ? HAPlaybackAdapter
    : LocalPlaybackAdapter;
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
