# AudioTube

AudioTube is a small audio-only YouTube player that can run as a standalone local web app or as a Home Assistant sidebar panel. In Home Assistant mode it uses `media_player` services, so Sonos playback is controlled through the official Home Assistant Sonos integration.

## Features

- Audio-only search and playback through `yt-dlp` and `ffmpeg`
- Search, queue, favorites, and playlists
- Browser playback for local development
- Home Assistant playback targets through the HA WebSocket API
- Sonos speakers exposed as Home Assistant `media_player` entities
- MP3 stream output for compatibility with Sonos S1 devices

## Requirements

- Docker Engine with Compose v2
- A Home Assistant instance for Sonos playback
- `yt-dlp` and `ffmpeg` are included in the proxy container
- Node.js 18+ only if running the local proxy directly

## Start With Docker Compose

From the repository root:

```powershell
docker compose up -d --build
```

Services:

- Home Assistant: <http://localhost:8123>
- AudioTube proxy: <http://localhost:3001>
- Music Assistant, when started separately: <http://localhost:8095>

Stop the repository Compose services:

```powershell
docker compose down
```

The Compose Home Assistant configuration is intended for a fresh test instance. Complete the Home Assistant onboarding wizard before opening AudioTube.

## Existing Home Assistant

If another Home Assistant container already owns port `8123`, do not start a second HA instance on that port. Install the app into the active HA configuration instead:

1. Copy `apps/local` and `src` into the active config under `www/tube_audio_player/`.
2. Copy `apps/ha/custom_components/tube_audio_player` into `custom_components/tube_audio_player/`.
3. Add this to `configuration.yaml`:

```yaml
tube_audio_player:
```

4. Restart Home Assistant.
5. Open **AudioTube** in the Home Assistant sidebar.

Back up the active Home Assistant configuration before copying files or editing YAML.

## Sonos Setup

Add the official **Sonos** integration in Home Assistant. If SSDP discovery does not find a speaker, configure its IP address in `configuration.yaml`:

```yaml
sonos:
  media_player:
    hosts:
      - 192.168.178.26
```

Replace the address with the speaker's current IP. The speaker and the proxy host must be on the same LAN. If the proxy runs on Windows, allow inbound TCP port `3001` on the private network so Sonos can fetch the audio stream.

AudioTube uses a LAN-reachable proxy URL in HA mode. Do not use `localhost:3001` in a stream URL sent to Sonos, because `localhost` would refer to the speaker itself.

## Local Browser Mode

Run the proxy directly:

```powershell
Set-Location apps/local
npm.cmd install
npm.cmd start
```

Open <http://localhost:3001>. Local mode uses the browser `<audio>` element and mock playback targets. It does not require Home Assistant or Sonos.

## Music Assistant

Music Assistant is separate from AudioTube. If it is run in Docker on port `8095`, the Home Assistant integration should use:

```text
http://host.docker.internal:8095
```

The browser can use <http://localhost:8095>, but a containerized Home Assistant instance must use `host.docker.internal` to reach a server running on the Docker host.

## Troubleshooting

### AudioTube remains on the loading screen

Open the browser developer console and check for missing `/local/tube_audio_player/src/...` files or an expired Home Assistant WebSocket token. Refresh Home Assistant after clearing site data if the token is invalid.

### Sonos reports an audio stream error

Check the following:

- The selected target is a Home Assistant Sonos `media_player` entity.
- The proxy returns HTTP `200` for `/api/audio/<videoId>.mp3`.
- The response has `Content-Type: audio/mpeg`.
- The Sonos speaker can reach the proxy host on TCP port `3001`.
- The browser is using the current AudioTube panel version, not an old cached tab.

### Check the proxy

```powershell
Invoke-WebRequest http://localhost:3001/api/health
```

A healthy response reports `status: ok` and `ytdlp: ok`.

## Project Layout

```text
src/                         Shared models, state, search, and adapters
apps/local/                  Standalone browser app and local proxy
apps/ha/                     Home Assistant custom integration
deploy/                      Dockerfiles and deployment helpers
docker-compose.yml           Test Home Assistant and proxy stack
DEPENDENCIES.md              Dependency and setup notes
```

## Notes

The proxy resolves and transcodes audio only. It does not fetch or play video. Availability of public search services and YouTube content can change over time.
