# AudioTube

AudioTube is a Home Assistant custom integration installed through HACS. It adds an AudioTube sidebar panel for YouTube audio search, queues, favorites, playlists, and playback on Home Assistant `media_player` entities.

The Home Assistant integration includes the entire browser frontend. Docker and Home Assistant test data are intentionally local-only and ignored by Git.

## Requirements

- Home Assistant 2024.1 or newer
- HACS
- A host reachable by Home Assistant and the target speakers that runs the AudioTube proxy
- Node.js 18 or newer, `yt-dlp`, and `ffmpeg` on the proxy host

The proxy creates MP3 streams, which are suitable for Sonos and other speakers that need a LAN-reachable audio URL.

## Install With HACS

1. In HACS, open **Integrations** and select the three-dot menu.
2. Choose **Custom repositories**.
3. Add this repository URL with category **Integration**.
4. Install **AudioTube** from HACS and restart Home Assistant.
5. In Home Assistant, open **Settings > Devices & services > Add integration**, then choose **AudioTube**.
6. Enter the proxy URL, for example `http://192.168.1.20:3001`.

The AudioTube sidebar entry appears after setup. The proxy URL must be reachable from both Home Assistant and the selected speaker. Do not use `localhost` unless the proxy runs on the same machine as both clients, which is normally not the case for speakers.

## Run The Proxy

The proxy is intentionally independent of Home Assistant and HACS. On a LAN-reachable host:

```powershell
Set-Location proxy
npm.cmd install
npm.cmd start
```

Verify it with:

```powershell
Invoke-WebRequest http://<proxy-host>:3001/api/health
```

A healthy response contains `"status": "ok"` and `"ytdlp": "ok"`.

## Repository Layout

```text
custom_components/audiotube/  HACS custom integration and bundled frontend
proxy/                        Optional Node.js, yt-dlp, and ffmpeg audio proxy
```

## Troubleshooting

- If AudioTube cannot search or play audio, verify the proxy URL in the AudioTube integration configuration and check `/api/health`.
- If a speaker fails to play, confirm it can reach the proxy host on TCP port `3001` and that the selected entity supports `media_player.play_media`.
- If the sidebar panel is missing after installation, restart Home Assistant and add the AudioTube integration through **Settings > Devices & services**.
