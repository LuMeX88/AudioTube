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

const execFileAsync = promisify(execFile);
const __dirname     = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3001', 10);

const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
];

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3001', 'http://127.0.0.1:3001',
    'http://localhost:8123', 'http://127.0.0.1:8123',
    'null',
  ],
  methods: ['GET'],
}));

// Serve the local app
app.use(express.static(__dirname));

// ─── /api/stream ──────────────────────────────────────────────────────────────

app.get('/api/stream', async (req, res) => {
  const videoId = req.query.videoId?.trim();

  if (!videoId || !/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) {
    return res.status(400).json({ error: 'Ungültige videoId.' });
  }

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    // yt-dlp: extract AUDIO ONLY stream URL — no video download, no storage (NF-05)
    const { stdout } = await execFileAsync('yt-dlp', [
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--get-url',
      '--no-playlist',
      '--quiet',
      ytUrl,
    ], { timeout: 15000 });

    const streamUrl = stdout.trim().split('\n')[0];

    if (!streamUrl || !streamUrl.startsWith('http')) {
      return res.status(502).json({ error: 'Stream-URL konnte nicht aufgelöst werden.' });
    }

    // Return URL to browser — browser plays it via <audio> (audio-only, F-10 compliant)
    res.json({ streamUrl });
  } catch (err) {
    console.error('[/api/stream] yt-dlp error:', err.message);

    if (err.message.includes('not found') || err.code === 'ENOENT') {
      return res.status(503).json({
        error: 'yt-dlp ist nicht installiert. Bitte installieren: https://github.com/yt-dlp/yt-dlp',
      });
    }
    if (err.killed || err.signal === 'SIGTERM') {
      return res.status(504).json({ error: 'Stream-Auflösung hat zu lange gedauert.' });
    }

    res.status(502).json({
      error: 'Inhalt nicht verfügbar oder gesperrt. Nächsten Titel versuchen.',
    });
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

// ─── Health check ─────────────────────────────────────────────────────────────

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
