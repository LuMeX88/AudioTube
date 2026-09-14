# Dependencies & Local Run Guide — Tube Audio Player

This document lists everything required to run the app locally and inside a
Home Assistant test instance, all orchestrated with Docker.

## Host requirements

| Tool | Version | Purpose |
|---|---|---|
| Docker Engine | 24+ (Compose v2) | Runs HA + proxy containers |
| Git | any | Version control |
| (optional) Node.js | 20+ | Run the proxy without Docker |

Everything else (Node, yt-dlp, ffmpeg, Home Assistant) is provided by the
container images — no local install needed.

## Container stack (`docker-compose.yml`)

| Service | Image / Build | Port | Role |
|---|---|---|---|
| `homeassistant` | `ghcr.io/home-assistant/home-assistant:stable` | 8123 | HA test instance, serves the app as an iframe panel |
| `proxy` | `deploy/Dockerfile.proxy` (Node 20 + yt-dlp + ffmpeg) | 3001 | `/api/search` (Invidious) and `/api/stream` (audio-only resolver) |

### Runtime dependencies baked into the proxy image
- `express` ^4.19, `cors` ^2.8 (from `apps/local/package.json`)
- `yt-dlp` (latest release binary)
- `python3`, `ffmpeg`

## How the app is served in Home Assistant

1. `./src` and `./apps` are mounted read-only into `/config/www/tube_audio_player/`.
2. HA serves `www/` at `/local/`, so the app entry point is
   `http://localhost:8123/local/tube_audio_player/apps/local/index.html`.
3. `configuration.yaml` registers a **`panel_iframe`** sidebar entry ("Tube Audio")
   pointing at that URL.
4. Search runs directly against public Invidious instances from the browser.
   Audio streaming calls the `proxy` service at `http://localhost:3001`.

## Quick start

```bash
# from the repository root
docker compose up -d --build

# open Home Assistant, complete the onboarding wizard, then click
# "Tube Audio" in the sidebar:
#   http://localhost:8123
```

Stop / clean up:

```bash
docker compose down
```

## Run only the browser app (no Home Assistant)

```bash
cd apps/local
npm install
node proxy-server.js
# open http://localhost:3001
```

## Notes
- First HA start requires a one-time onboarding (create a user account).
- The proxy allows CORS from `localhost:8123` and `localhost:3001` for testing.
- Audio is resolved **audio-only** (`yt-dlp --format bestaudio`); no video is fetched.
