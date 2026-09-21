/**
 * Local Dev Proxy Server — Tube Audio Player (Version B)
 * ========================================================
 * Provides two endpoints for the browser app:
 *
 *  GET /api/stream?videoId=<id>
 *      Resolves a YouTube video to its audio-only stream URL via yt-dlp,
 *      then redirects the browser to that URL (or proxies it).
 *      IMPORTANT: Audio only — no video stream is ever fetched (--format bestaudio).
 *      Requires yt-dlp to be installed: https://github.com/yt-dlp/yt-dlp
 *
 *  GET /api/search?q=<query>&type=video|playlist
 *      Proxy to Invidious API (fallback if browser CORS fails).
 *
 * Serves the local app at http://localhost:3001/
 *
 * Usage:
 *   cd apps/local
 *   npm install
 *   node proxy-server.js
 */

import express  from 'express';
import cors     from 'cors';
import path     from 'path';
import { fileURLToPath } from 'url';
import { execFile }      from 'child_process';
import { promisify }     from 'util';
import fs                from 'fs';
import os                from 'os';

const execFileAsync = promisify(execFile);
const __dirname     = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3001', 10);

// Temp directory where audio-only tracks are cached before being served.
const AUDIO_CACHE_DIR = path.join(os.tmpdir(), 'tube-audio-cache');
fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });

const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
];

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

app.use(cors({ methods: ['GET'] }));

// Serve the local app
app.use(express.static(__dirname));

// ─── /api/stream ──────────────────────────────────────────────────────────────

app.get('/api/stream', async (req, res) => {
  const videoId = req.query.videoId?.trim();

  if (!videoId || !/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) {
    return res.status(400).json({ error: 'Ungültige videoId.' });
  }

  // Return a *proxied* URL. The browser fetches audio bytes through /api/audio,
  // which downloads the audio-only track once and serves it with range support.
  // (No video is ever fetched — audio-only, F-10 / NF-05 compliant.)
  res.json({ streamUrl: `/api/audio/${encodeURIComponent(videoId)}.mp3` });
});

// ─── /api/audio ───────────────────────────────────────────────────────────────
// Downloads the audio-only track once to a temp file (via yt-dlp) and serves it
// as a static file with Express range support. Downloading once avoids the
// googlevideo CDN/session inconsistency that breaks progressive <audio> seeking.
const audioDownloads = new Map(); // videoId -> Promise<string filePath>

async function ensureAudioFile(videoId) {
  const existing = audioDownloads.get(videoId);
  if (existing) return existing;

  const p = (async () => {
    const outPath = path.join(AUDIO_CACHE_DIR, `${videoId}.mp3`);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return outPath;

    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    // MP3 has the broadest Sonos S1 compatibility and avoids UPnP MIME errors.
    await execFileAsync('yt-dlp', [
      '--extractor-args', 'youtube:player_client=android',
      '--format', 'bestaudio/best',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--no-playlist',
      '--no-check-certificates',
      '--quiet',
      '--no-warnings',
      '-o', path.join(AUDIO_CACHE_DIR, `${videoId}.%(ext)s`),
      ytUrl,
    ], { timeout: 120000, maxBuffer: 20 * 1024 * 1024 });

    if (!fs.existsSync(outPath)) {
      // yt-dlp may have produced a different extension; find it.
      const found = fs.readdirSync(AUDIO_CACHE_DIR).find(f => f.startsWith(videoId + '.'));
      if (found) return path.join(AUDIO_CACHE_DIR, found);
      throw new Error('Audiodatei wurde nicht erzeugt.');
    }
    return outPath;
  })();

  audioDownloads.set(videoId, p);
  try {
    return await p;
  } catch (err) {
    audioDownloads.delete(videoId); // allow retry on failure
    throw err;
  }
}

app.get(['/api/audio', '/api/audio/:videoId.mp3'], async (req, res) => {
  const videoId = (req.params.videoId || req.query.videoId)?.trim();

  if (!videoId || !/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) {
    return res.status(400).json({ error: 'Ungültige videoId.' });
  }

  try {
    const filePath = await ensureAudioFile(videoId);
    const ct = filePath.endsWith('.mp3')  ? 'audio/mpeg'
         : filePath.endsWith('.webm') ? 'audio/webm'
         : filePath.endsWith('.m4a')  ? 'audio/mp4'
             : 'application/octet-stream';
    // express handles Range requests, content-type and caching consistently.
    res.sendFile(filePath, {
      headers: { 'Content-Type': ct, 'Accept-Ranges': 'bytes' },
    });
  } catch (err) {
    console.error('[/api/audio] error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Audio konnte nicht gestreamt werden.' });
    }
  }
});

// ─── /api/search (Invidious proxy fallback) ───────────────────────────────────
app.get('/api/search', async (req, res) => {
  const q    = req.query.q?.trim();
  const type = ['video', 'playlist', 'all'].includes(req.query.type) ? req.query.type : 'video';

  if (!q) return res.status(400).json({ error: 'Kein Suchbegriff angegeben.' });

  const params = new URLSearchParams({ q, type, fields: 'videoId,title,author,lengthSeconds,videoThumbnails,playlistId,videoCount,playlistThumbnail' });
  const apiPath = `/api/v1/search?${params}`;

  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const r = await fetch(base + apiPath, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const data = await r.json();
      return res.json(data);
    } catch { /* try next */ }
  }

  res.status(502).json({ error: 'Alle Suchdienste nicht erreichbar.' });
});

// ─── /api/invidious (generic server-side passthrough) ─────────────────────────
// The browser calls: /api/invidious?path=/api/v1/search?q=...
app.get('/api/invidious', async (req, res) => {
  const rawPath = req.query.path?.trim();

  // Only allow safe, read-only Invidious v1 API paths.
  if (!rawPath || !rawPath.startsWith('/api/v1/') || rawPath.includes('..')) {
    return res.status(400).json({ error: 'Ungültiger API-Pfad.' });
  }

  // Public Invidious instances now block anonymous /search (HTTP 401), so serve
  // video search results via yt-dlp instead — shaped like the Invidious API.
  const searchMatch = rawPath.match(/^\/api\/v1\/search\?(.*)$/);
  if (searchMatch) {
    const qp = new URLSearchParams(searchMatch[1]);
    const type = qp.get('type') || 'video';
    if (type === 'playlist') {
      // Playlist search is not supported via yt-dlp here; return empty set.
      return res.json([]);
    }
    try {
      const results = await ytSearch(qp.get('q') || '', 10);
      return res.json(results);
    } catch (err) {
      console.error('[/api/invidious] yt-dlp search error:', err.message);
      return res.status(502).json({ error: 'Suche fehlgeschlagen.' });
    }
  }

  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const r = await fetch(base + rawPath, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const data = await r.json();
      return res.json(data);
    } catch { /* try next instance */ }
  }

  res.status(502).json({ error: 'Alle Suchdienste nicht erreichbar.' });
});

/**
 * Search YouTube via yt-dlp and return Invidious-API-shaped video results.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function ytSearch(query, limit = 25) {
  const q = (query || '').trim();
  if (!q) return [];

  const { stdout } = await execFileAsync('yt-dlp', [
    `ytsearch${limit}:${q}`,
    '--extractor-args', 'youtube:player_client=android',
    '--dump-json',
    '--ignore-errors',
    '--no-warnings',
    '--no-check-certificates',
    '--quiet',
  ], { timeout: 25000, maxBuffer: 20 * 1024 * 1024 });

  return stdout
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(e => e && e.id)
    .map(e => ({
      type: 'video',
      videoId: e.id,
      title: e.title || '(ohne Titel)',
      author: e.channel || e.uploader || '',
      authorId: e.channel_id || e.uploader_id || '',
      lengthSeconds: Math.round(e.duration || 0),
      videoThumbnails: [
        { quality: 'medium', url: `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg`, width: 320, height: 180 },
        { quality: 'default', url: `https://i.ytimg.com/vi/${e.id}/default.jpg`, width: 120, height: 90 },
      ],
    }));
}

app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', version: '0.1.0', ytdlp: await checkYtDlp() });
});

async function checkYtDlp() {
  try {
    const { execFileSync } = await import('child_process');
    execFileSync('yt-dlp', ['--version'], { timeout: 3000 });
    return 'ok';
  } catch { return 'not found — install from https://github.com/yt-dlp/yt-dlp'; }
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🎵 Tube Audio Player — Dev Server`);
  console.log(`   http://localhost:${PORT}/`);
  console.log(`   API: http://localhost:${PORT}/api/stream?videoId=dQw4w9WgXcQ`);
  console.log(`\n   Voraussetzung: yt-dlp installiert`);
  console.log(`   → https://github.com/yt-dlp/yt-dlp#installation\n`);
});
