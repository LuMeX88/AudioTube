# AudioTube

AudioTube is an all-in-one Home Assistant custom integration installed through HACS. It adds an AudioTube sidebar panel for YouTube audio search, queues, favorites, playlists, and playback on Home Assistant `media_player` entities.

Everything runs inside Home Assistant itself: the browser frontend, the search, and the audio resolution (via `yt-dlp`, run in Python). There is no separate proxy service to install, run, or configure.

## Requirements

- Home Assistant 2024.7 or newer
- HACS
- `ffmpeg` available on the Home Assistant host (already included in Home Assistant OS, Supervised, and the official Docker images)

## Install With HACS

1. In HACS, open **Integrations** and select the three-dot menu.
2. Choose **Custom repositories**.
3. Add this repository URL with category **Integration**.
4. Install **AudioTube** from HACS and restart Home Assistant.
5. In Home Assistant, open **Settings > Devices & services > Add integration**, then choose **AudioTube**.

No configuration is required. The AudioTube sidebar entry appears immediately after setup.

## How Playback Works

AudioTube resolves and caches audio-only tracks as MP3 files directly on the Home Assistant host, then serves them from Home Assistant's own web server. Speakers such as Sonos fetch the audio from the same host and port Home Assistant is already reachable on — no separate proxy host or port to open up.

Cached audio files are automatically deleted after **21 days**.

## Repository Layout

```text
custom_components/audiotube/  HACS custom integration, backend, and bundled frontend
```

## Troubleshooting

- If AudioTube cannot search or play audio, check **Settings > System > Logs** for errors from `custom_components.audiotube`.
- If a speaker fails to play, confirm it can reach the Home Assistant host on its usual port and that the selected entity supports `media_player.play_media`.
- If the sidebar panel is missing after installation, restart Home Assistant and add the AudioTube integration through **Settings > Devices & services**.
- If audio resolution fails, confirm `ffmpeg` is installed and on `PATH` on the Home Assistant host.
- For detailed diagnostics, enable debug logging by adding this to `configuration.yaml` and restarting:

  ```yaml
  logger:
    default: warning
    logs:
      custom_components.audiotube: debug
  ```

  This also logs yt-dlp's own diagnostic messages (for example bot checks or region blocks), and the browser console shows matching `[AudioTube]`-prefixed request/response details for the search and resolve calls.


## Legal Disclaimer

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
