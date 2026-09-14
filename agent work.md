# Agent Work — Tube Audio Player

> **Rolle dieses Dokuments:** Product Owner / Product Manager Briefing für das Entwickler-Team (bzw. Coding-Agents).
> Basis: [instructions.md](instructions.md) (Lastenheft). Dieses Dokument **priorisiert, schneidet und verteilt** die Arbeit.
> Sprache Code/Kommentare: EN. Sprache UI: DE (mit i18n-Struktur).

---

## 0. Zwei Ziel-Builds (WICHTIG)

Wir liefern **zwei parallele Versionen derselben App**, damit Features unabhängig von einer Home-Assistant-Instanz testbar sind.

| Version | Ziel | Zweck | Wiedergabe-Ziel |
|---|---|---|---|
| **A — HA Version** | Home Assistant Integration (Custom Panel / Lovelace Card + Python-Backend) | Produktivbetrieb, Sonos-Steuerung | Sonos via HA `media_player` Services |
| **B — Local Version** | Reine Browser-App (HTML/JS/CSS), kein HA nötig | Schnelles Testen von UI, Suche, Queue, Playlist-Logik | Lokales `<audio>`-Element im Browser (Mock-Speaker) |

**Leitprinzip:** Der komplette UI- und Logik-Kern (Suche, Queue, Favoriten, Playlists, State) ist **identisch** und wird nur über eine **austauschbare Adapter-Schicht** an das jeweilige Backend/Ausgabegerät angebunden.

```
┌─────────────────────────────────────────────┐
│   Shared Core (UI + State + Logic)           │  ← identisch in A & B
│   Search · Queue · Favorites · Playlists     │
└───────────────┬─────────────────────────────┘
                │  Adapter Interface
      ┌─────────┴──────────┐
      ▼                    ▼
┌──────────────┐   ┌──────────────────┐
│ HA Adapter   │   │ Local Adapter    │
│ (Sonos/HA)   │   │ (<audio> Mock)   │
└──────────────┘   └──────────────────┘
   Version A            Version B
```

---

## 1. Architektur-Vorgabe (verbindlich)

### 1.1 Gemeinsamer Kern (`/src/core`)
Framework-frei oder leichtgewichtig (Vanilla JS / TS). **Keine HA-Abhängigkeit im Core.**

- `state/` — App State (Queue, NowPlaying, Favorites, Playlists, Settings)
- `search/` — Such-Client (spricht gegen ein austauschbares `SearchProvider`-Interface)
- `models/` — `Track`, `Playlist`, `SearchResult`, `Speaker`, `QueueItem`
- `i18n/` — DE-Strings (Struktur für weitere Sprachen)
- `ui/` — Views/Components (reine DOM-Rendering, keine Ausgabelogik)

### 1.2 Adapter-Interface (Kernstück beider Versionen)
Zwei Interfaces, die **beide Versionen implementieren müssen**:

```ts
interface PlaybackAdapter {
  getSpeakers(): Promise<Speaker[]>;      // A: HA media_players · B: ["Browser"]
  selectSpeaker(id: string): Promise<void>;
  play(track: Track): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setVolume(level: number): Promise<void>;
  onStateChange(cb: (s: PlaybackState) => void): void;
}

interface SearchProvider {
  search(query: string, type: "track" | "playlist" | "all"): Promise<SearchResult[]>;
  resolveUrl(url: string): Promise<SearchResult[]>;   // einzelner Titel oder Playlist
  getAudioStream(videoId: string): Promise<StreamInfo>; // nur Version B / HA-Backend
}
```

### 1.3 Persistenz
- **Version A:** Speicherung über HA (z. B. `.storage` / Integration-Config / WebSocket).
- **Version B:** `localStorage` / `IndexedDB`.
- Beide nutzen dasselbe `StorageAdapter`-Interface.

---

## 2. Arbeitspakete (Work Packages) & Zuständigkeiten

> Legende Priorität: **P0** = MVP-blocker, **P1** = MVP, **P2** = später (Soll).
> Jede Task referenziert die Lastenheft-IDs (F-xx / NF-xx).

### WP-1 — Shared Core & Datenmodell  · Owner: *Dev Core*
| Task | Beschreibung | Lastenheft | Prio |
|---|---|---|---|
| 1.1 | Datenmodelle definieren (`Track`, `Playlist`, `Speaker`, `QueueItem`) | — | P0 |
| 1.2 | Adapter-Interfaces (`PlaybackAdapter`, `SearchProvider`, `StorageAdapter`) | — | P0 |
| 1.3 | Zentraler State-Store (observierbar, ohne Framework-Zwang) | F-30, F-36 | P0 |
| 1.4 | i18n-Gerüst mit DE-Strings | F-55 | P1 |

### WP-2 — Suche  · Owner: *Dev Search*
| Task | Beschreibung | Lastenheft | Prio |
|---|---|---|---|
| 2.1 | Freitextsuche über `SearchProvider` (ohne API-Key, ohne Login) | F-01, F-02, NF-01/02/03 | P0 |
| 2.2 | Ergebnisdarstellung: Titel, Kanal, Thumbnail, Dauer | F-03 | P0 |
| 2.3 | Trennung Titel- vs. Playlist-Ergebnisse | F-04 | P0 |
| 2.4 | URL-Eingabe (Einzeltitel & öffentliche Playlist) auflösen | F-06 | P1 |
| 2.5 | Filter nach Relevanz / Inhaltstyp | F-05 | P2 |

> **Hinweis PO:** Die konkrete anonyme Suchquelle (inoffizielle YouTube-Endpunkte / lokaler Resolver im HA-Backend) wählt das Team. Rechtlicher/ToS-Vorbehalt aus Lastenheft §9 dokumentieren (NF-33).

### WP-3 — Queue / Warteschlange  · Owner: *Dev Core*
| Task | Beschreibung | Lastenheft | Prio |
|---|---|---|---|
| 3.1 | Sichtbare Queue-Ansicht | F-30 | P0 |
| 3.2 | Hinzufügen / Sofort abspielen / Als nächstes / Entfernen | F-31–F-34 | P0 |
| 3.3 | Reihenfolge ändern (Drag & Drop) | F-35 | P2 |
| 3.4 | Queue-Wiederherstellung nach Neustart | F-36 | P2 |
| 3.5 | Shuffle / Repeat | F-19 | P2 |
| 3.6 | Sleep-Timer | F-20 | P2 |

### WP-4 — Favoriten & eigene Playlists  · Owner: *Dev Core*
| Task | Beschreibung | Lastenheft | Prio |
|---|---|---|---|
| 4.1 | Favoriten hinzufügen/entfernen | F-40 | P1 |
| 4.2 | Playlists anlegen/umbenennen/löschen | F-41 | P1 |
| 4.3 | Inhalte zu Playlist hinzufügen/entfernen | F-42 | P1 |
| 4.4 | Playlist abspielen / zur Queue hinzufügen | F-43 | P1 |
| 4.5 | Lokale Persistenz (Storage-Adapter) | F-44 | P1 |
| 4.6 | Verlauf (zuletzt gesucht/gespielt) & gespeicherte URL-Links | F-45, F-46 | P2 |

### WP-5 — UI / Player-Oberfläche  · Owner: *Dev UI*
| Task | Beschreibung | Lastenheft | Prio |
|---|---|---|---|
| 5.1 | Responsive Layout (Desktop/Tablet/Smartphone) | F-51 | P0 |
| 5.2 | Now-Playing-Bar: Titel, Cover, Status, Zielraum | F-52 | P0 |
| 5.3 | Kernaktionen wenige Klicks: Suche, Ziel, Play, +Queue, Pause | F-53 | P0 |
| 5.4 | Transport-Controls: Play/Pause/Stop/Next/Prev/Volume | F-16–F-18 | P0 |
| 5.5 | Hell-/Dunkelmodus | F-54 | P2 |
| 5.6 | Touch-Optimierung & Tastatur-Fokus | NF-24, NF-25 | P1 |
| 5.7 | Verständliche Fehlermeldungen mit Handlungsempfehlung | NF-22, F-… | P1 |

---

## 3. Versions-spezifische Arbeitspakete

### WP-A — Version A: Home Assistant  · Owner: *Dev HA*
| Task | Beschreibung | Lastenheft | Prio |
|---|---|---|---|
| A.1 | HA-Integrationsgerüst (Custom Component / Panel-Registrierung) | F-50, NF-10 | P0 |
| A.2 | `HAPlaybackAdapter`: Sonos via `media_player.*` Services + `play_media` (Audio-only) | F-10–F-15, NF-11 | P0 |
| A.3 | Sonos-Räume & Gruppen auslesen und wählbar machen | F-13, F-15, Akzeptanz 3/4 | P0 |
| A.4 | Audio-Stream-Auflösung im Backend (kein Video, kein Download) | F-10, NF-05 | P0 |
| A.5 | HA-Storage-Adapter für Favoriten/Playlists/Settings | F-44, NF-32 | P1 |
| A.6 | State-Sync HA ↔ UI (WebSocket) | NF-21, NF-23 | P1 |
| A.7 | Lovelace-Einbindung + Installations-/Konfig-Anleitung | Liefergegenstände 1–3 | P1 |

### WP-B — Version B: Local Browser Build  · Owner: *Dev Local*
| Task | Beschreibung | Lastenheft | Prio |
|---|---|---|---|
| B.1 | Statische App (HTML/JS/CSS), lauffähig via einfachem `index.html` / Dev-Server | — | P0 |
| B.2 | `LocalPlaybackAdapter`: Wiedergabe über `<audio>`-Element (Mock-Speaker "Browser") | F-11, F-16–F-18 | P0 |
| B.3 | Mock-Speaker-Liste (z. B. "Browser", "Wohnzimmer (Mock)", "Gruppe (Mock)") zum Testen von Raum-/Gruppenauswahl | F-13, F-15 | P0 |
| B.4 | `localStorage`/`IndexedDB` Storage-Adapter | F-44 | P1 |
| B.5 | Optionaler lokaler Such-Proxy (Dev-Server) falls Browser-CORS blockiert | F-01 | P1 |
| B.6 | Audio-only erzwingen: kein Video-Element, nur Audiospur | F-10, NF-05 | P0 |

> **PO-Grund für Version B:** Erlaubt QA und UI-Entwicklung **ohne Sonos/HA**. Alle Akzeptanzkriterien außer den Sonos-spezifischen (3, 4) sind hier demonstrierbar. Version B ist die **Referenz für Look & Feel**.

---

## 4. Definition of Done (DoD)

Eine Task gilt als erledigt, wenn:
- [ ] Funktioniert in **beiden** Versionen (sofern Core-Task) über die Adapter-Schicht.
- [ ] **Kein Video** wird geladen/angezeigt (F-10) — aktiv geprüft.
- [ ] **Kein** API-Key, Login oder Premium nötig (NF-01–NF-04).
- [ ] Responsive auf Desktop + Tablet (F-51).
- [ ] Fehlerfälle liefern verständliche Meldung, App bleibt bedienbar (NF-22, NF-23).
- [ ] Code strukturiert & dokumentiert (NF-40); externe Abhängigkeiten notiert (NF-33, NF-42).

---

## 5. Empfohlene Projektstruktur

```
/src
  /core            ← Shared: models, state, search, i18n, ui  (WP-1..5)
  /adapters
    /ha            ← HAPlaybackAdapter, HAStorageAdapter        (WP-A)
    /local         ← LocalPlaybackAdapter, LocalStorageAdapter  (WP-B)
/apps
  /local           ← index.html + Bootstrap für Version B
  /ha              ← Panel/Card + Python custom_component für Version A
/docs
  install-ha.md
  usage.md
  dependencies.md  ← NF-33
```

---

## 6. Reihenfolge / Sprint-Vorschlag

**Sprint 1 (MVP-Fundament)**
1. WP-1 (Core & Adapter-Interfaces) — *Blocker für alles*
2. WP-B B.1/B.2/B.6 (Local Build lauffähig, Audio spielt) — *frühes Testen*
3. WP-2 2.1–2.3 (Suche + Ergebnisse)
4. WP-5 5.1–5.4 (UI + Transport)

**Sprint 2 (MVP komplett)**
5. WP-3 3.1–3.2 (Queue)
6. WP-4 4.1–4.5 (Favoriten/Playlists + Persistenz)
7. WP-A A.1–A.4 (HA + Sonos Audio-only)

**Sprint 3 (HA-Reife + Soll)**
8. WP-A A.5–A.7 (HA-Storage, Sync, Doku)
9. WP-2 2.4, WP-5 5.5–5.7, WP-3 3.3–3.6 (Soll-Features)

---

## 7. Risiken / PO-Hinweise

- **Externe YouTube-Quelle instabil** (Lastenheft §9): Resolver kapseln, damit Austausch ohne UI-Änderung möglich ist (NF-43).
- **CORS im Local Build:** ggf. kleiner Dev-Proxy nötig (B.5) — nicht in Produktions-HA-Version.
- **Audio-only Compliance (F-10):** In Code-Review als Pflichtpunkt aufnehmen — nie ein Video-Element instanziieren.
- **Adapter-Disziplin:** Kein HA-Aufruf im Core, kein `<audio>` im Core — sonst driften die Versionen auseinander.
