<div align="center">

# 🎵 AudioTube

### *your music, your speakers*

A modern, lightweight **YouTube-audio player** built as a native **Home Assistant
integration**, installed through HACS. AudioTube runs **100% inside Home
Assistant** — no cloud, no subscriptions, no separate proxy service. Search,
queue, favorites, playlists and playback all live in your own Home Assistant
instance, streaming straight to your `media_player` entities (Sonos and more).

[![HACS Custom Repository](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?logo=home-assistant&logoColor=white)](https://hacs.xyz/)
&nbsp;
![Version](https://img.shields.io/badge/version-0.4.0-success.svg)
&nbsp;
![Local & private](https://img.shields.io/badge/100%25-local%20%26%20private-success.svg)

<br>

**One-click install — add the repository to HACS:**

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=LuMeX88&repository=AudioTube&category=integration)

<br>

If AudioTube makes your life easier, you can support its development:

<a href="https://www.buymeacoffee.com/LuMeX88" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" height="50"></a>

</div>

---

## ⚠️ Prerequisites

| Requirement | Notes |
|---|---|
| **Home Assistant 2024.7 or newer** | |
| **HACS** | Used to install and update AudioTube. |
| **`ffmpeg` on the Home Assistant host** | Already included in Home Assistant OS, Supervised, and the official Docker images. |
| **One or more `media_player` entities** | Sonos, or anything else that supports `media_player.play_media`. |

---

## 🤔 Why AudioTube?

Most YouTube-to-speaker setups need a separate proxy container, an API key, or
a subscription. AudioTube doesn't. Everything — the sidebar frontend, the
search, and the audio resolution (via `yt-dlp`) — runs inside Home Assistant
itself and is served from the same host and port Home Assistant already uses.
Speakers fetch audio directly from there — no extra host or port to open up.

---

## ✨ Features

- **🔍 Search** – Find tracks and playlists on YouTube, or paste a URL directly.
- **📃 Queue** – Build a queue, reorder it by drag & drop, and it **auto-advances**
  track to track.
- **❤️ Favorites & 📁 Playlists** – Save tracks, build playlists, and everything
  **syncs live across every device** logged into the same Home Assistant account.
- **🔊 Speaker groups** – Combine several `media_player` entities into a group
  (a speaker can belong to more than one group) and pick the group as a single
  playback target — every member gets the same play/pause/volume commands.
- **🎚️ Vertical volume popover** – A "+"/"−" stepper and a draggable vertical
  slider, matching the app's dark player bar.
- **🌊 Real waveform progress bar** – The progress bar shows the track's actual
  analyzed amplitude (via `ffmpeg`), with the played portion colored
  differently from what's still ahead.
- **🎨 6 themes** – Light, Dark, System, OLED Black, Sepia and High Contrast.
- **💾 Backup & Restore** – Export favorites & playlists to a YAML file and
  import them again.
- **🌍 Multilingual** – German & English.
- **🔐 Home Assistant sidebar panel** – Opens straight from the HA sidebar;
  authentication handled by Home Assistant itself.

---

## 🚀 Installation

### Option A — one-click (recommended)

Click the button below to open Home Assistant and add the AudioTube repository
to HACS, then install it from there:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=LuMeX88&repository=AudioTube&category=integration)

### Option B — manual

1. In HACS, open **Integrations** and select the three-dot menu.
2. Choose **Custom repositories**.
3. Add this repository URL with category **Integration**.
4. Install **AudioTube** from HACS and restart Home Assistant.
5. In Home Assistant, open **Settings → Devices & services → Add integration**,
   then choose **AudioTube**.

No configuration is required. The AudioTube sidebar entry appears immediately after setup.

---

## 🔊 How Playback Works

AudioTube resolves and caches audio-only tracks as MP3 files directly on the
Home Assistant host, then serves them from Home Assistant's own web server.
Speakers such as Sonos fetch the audio from the same host and port Home
Assistant is already reachable on — no separate proxy host or port to open up.

Cached audio files (and their analyzed waveform data) are automatically deleted after **21 days**.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES modules, no bundler/build step) + CSS custom properties |
| Backend | Home Assistant custom integration (Python), served through HA's own HTTP layer |
| Audio resolution | `yt-dlp` |
| Waveform analysis | `ffmpeg` (raw PCM decode) + pure-Python bucketing |
| Sync | Home Assistant's per-user `frontend/set_user_data` websocket API |
| Auth | Home Assistant (via the embedded sidebar panel) |

---

## ✅ Tested environments

AudioTube's interface is actively tested on:

- **Google Chrome** (desktop)
- **Microsoft Edge** (desktop)
- **Home Assistant Companion app** (Android)

Other modern browsers are expected to work but are not regularly tested.

---

## ☕ Support

AudioTube is free and open-source. If it makes your setup better, consider
buying me a coffee — it genuinely helps and is hugely appreciated. 🙏

<a href="https://www.buymeacoffee.com/LuMeX88" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" height="60"></a>

---

## 🧭 Philosophy

> your music. your speakers. your data.

AudioTube is built on the belief that a simple YouTube-to-speaker bridge
shouldn't need a cloud account. No accounts, no sync servers, no telemetry —
everything runs on your own Home Assistant instance.

---

## 🩺 Troubleshooting

- If AudioTube cannot search or play audio, check **Settings → System → Logs** for errors from `custom_components.audiotube`.
- If a speaker fails to play, confirm it can reach the Home Assistant host on its usual port and that the selected entity supports `media_player.play_media`.
- If the sidebar panel is missing after installation, restart Home Assistant and add the AudioTube integration through **Settings → Devices & services**.
- If audio resolution fails, confirm `ffmpeg` is installed and on `PATH` on the Home Assistant host.
- For detailed diagnostics, enable debug logging by adding this to `configuration.yaml` and restarting:

  ```yaml
  logger:
    default: warning
    logs:
      custom_components.audiotube: debug
  ```

  This also logs yt-dlp's own diagnostic messages (for example bot checks or region blocks), and the browser console shows matching `[AudioTube]`-prefixed request/response details for the search and resolve calls.

---

## 📁 Repository Layout

```text
custom_components/audiotube/  HACS custom integration, backend, and bundled frontend
```

---

## 📜 Legal Disclaimer

### Deutsch

> **Wichtiger Hinweis & Rechtlicher Haftungsausschluss (Disclaimer)**
>
> **1. Speicherung & Funktionsweise:**
>
> Diese Anwendung lädt Mediendateien (inkl. MP3-Audiodateien) direkt und lokal auf das Endgerät des Nutzers herunter. Es werden keine Inhalte auf externen Servern des Entwicklers gespeichert, gehostet oder bereitgestellt.
>
> **2. Akzeptanz der Bedingungen (Nutzung, Cloning, Contributing):**
>
> Durch das Verwenden, Herunterladen, Klonen (*cloning*), Verzweigen (*forking*), Kompilieren, Ausführen oder Beitragen (*contributing*) zu diesem Repository und dem Quellcode erklärt sich der Nutzer bzw. Mitwirkende ausdrücklich mit diesen Bestimmungen und dem vollständigen Haftungsausschluss des Entwicklers einverstanden.
>
> **3. Eigenverantwortung der Nutzer:**
>
> Die gesamte Nutzung der Software erfolgt auf eigene Verantwortung. Jeder Nutzer und Mitwirkende ist selbst und vollumfänglich dafür verantwortlich, sicherzustellen, dass das Herunterladen, Speichern und Nutzen der jeweiligen Inhalte den in seinem jeweiligen Land geltenden Gesetzen, Urheberrechtsbestimmungen sowie den Nutzungsbedingungen der Quellplattformen entspricht.
>
> **4. Vollständiger Haftungsausschluss:**
>
> Der Entwickler übernimmt keinerlei Haftung, Gewährleistung oder Verantwortung für die Nutzung, Funktion oder Folgen dieser Software. Jegliche rechtliche Haftung für Urheberrechtsverletzungen, unbefugtes Herunterladen, Datenverluste oder sonstige Gesetzesverstöße, die durch den Einsatz oder die Weiterentwicklung dieser Anwendung entstehen, wird hiermit ausdrücklich und vollumfänglich ausgeschlossen.

### English

> **Important Notice & Legal Disclaimer**
>
> **1. Local Storage:**
>
> This application downloads media files (including MP3 audio) directly and locally to the user's device. No content is stored, hosted, or distributed on servers managed by the developer.
>
> **2. Acceptance of Terms (Usage, Cloning, Contributing):**
>
> By using, downloading, cloning, forking, compiling, running, or contributing to this repository and software, you explicitly acknowledge and agree to this full legal disclaimer and the complete exclusion of developer liability.
>
> **3. User Responsibility:**
>
> Use of this software is entirely at your own risk. Each user and contributor is solely responsible for ensuring that downloading, storing, and using any content complies with local laws, copyright regulations, and the terms of service of the respective source platforms in their jurisdiction.
>
> **4. Complete Limitation of Liability:**
>
> The developer assumes no liability, warranty, or responsibility for the use, operation, or consequences of this software. Any legal liability regarding copyright infringement, unauthorized downloads, or other statutory violations arising from the use, cloning, or contribution to this application is expressly disclaimed in full.

