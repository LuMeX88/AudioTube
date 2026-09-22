/**
 * German UI strings.
 * Extend with additional locales by adding more locale files
 * and registering them in i18n.js.
 */
export default {
  // Search
  searchPlaceholder: 'Titel, Künstler, Kanal oder YouTube-URL…',
  searchButton: 'Suchen',
  searchLoading: 'Suche läuft…',
  searchNoResults: 'Keine Ergebnisse gefunden.',
  searchError: 'Suche fehlgeschlagen. Bitte Netzwerkverbindung prüfen.',
  filterAll: 'Alle',
  filterTracks: 'Titel',
  filterPlaylists: 'Playlists',

  // Results
  play: 'Abspielen',
  addToQueue: 'Zur Warteschlange',
  playNext: 'Als nächstes',
  addToPlaylist: 'Zu Playlist',
  addToFavorites: 'Zu Favoriten',
  removeFromFavorites: 'Aus Favoriten entfernen',
  trackCount: (n) => `${n} Titel`,
  duration: 'Dauer',

  // Player bar
  nowPlaying: 'Spielt jetzt',
  noTrack: 'Kein Titel ausgewählt',
  pause: 'Pause',
  resume: 'Weiter',
  stop: 'Stopp',
  next: 'Nächster',
  previous: 'Vorheriger',
  volume: 'Lautstärke',
  shuffle: 'Zufallswiedergabe',
  repeat: 'Wiederholen',
  repeatNone: 'Kein Repeat',
  repeatOne: 'Titel wiederholen',
  repeatAll: 'Alles wiederholen',

  // Queue
  queue: 'Warteschlange',
  queueEmpty: 'Warteschlange ist leer.',
  clearQueue: 'Warteschlange leeren',
  removeFromQueue: 'Entfernen',

  // Speaker picker
  selectSpeaker: 'Wiedergabeziel wählen',
  noSpeakers: 'Keine Lautsprecher gefunden.',
  speakerGroup: 'Gruppe',
  speakerRefresh: 'Aktualisieren',

  // Favorites
  favorites: 'Favoriten',
  favoritesEmpty: 'Noch keine Favoriten gespeichert.',

  // Playlists
  playlists: 'Meine Playlists',
  playlistsEmpty: 'Noch keine Playlist erstellt.',
  createPlaylist: 'Neue Playlist',
  playlistName: 'Playlist-Name',
  renamePlaylist: 'Umbenennen',
  deletePlaylist: 'Löschen',
  playlistDeleteConfirm: (name) => `Playlist „${name}" wirklich löschen?`,
  playlistItemsEmpty: 'Diese Playlist enthält noch keine Titel.',
  playPlaylist: 'Playlist abspielen',
  addPlaylistToQueue: 'Zur Warteschlange hinzufügen',

  // Playlist picker (add-to-playlist modal)
  addToPlaylistTitle: 'Zu Playlist hinzufügen',
  newPlaylistInline: 'Neue Playlist erstellen…',
  newPlaylistPrompt: 'Name der neuen Playlist',
  addedToPlaylist: (title, name) => `„${title}“ zu „${name}“ hinzugefügt.`,
  alreadyInPlaylist: (name) => `Bereits in „${name}“ enthalten.`,
  noPlaylistsYet: 'Du hast noch keine Playlists. Erstelle eine:',

  // Errors
  errorNotAvailable: 'Dieser Inhalt ist nicht verfügbar oder gesperrt.',
  errorStream: 'Audio-Stream konnte nicht geladen werden.',
  errorSpeaker: 'Lautsprecher nicht erreichbar.',
  errorUnknown: 'Ein unbekannter Fehler ist aufgetreten.',
  tryNext: 'Mit nächstem Titel fortfahren.',

  // Navigation
  navSearch: 'Suche',
  navQueue: 'Warteschlange',
  navFavorites: 'Favoriten',
  navPlaylists: 'Playlists',
  navMenu: 'Menü',

  // Settings
  settings: 'Einstellungen',
  aiSettings: 'KI-Einstellungen (OpenAI-kompatibel)',
  aiBaseUrl: 'API Base URL',
  aiApiKey: 'API-Key',
  aiModel: 'Modell',
  aiEnabled: 'KI-Suchverbesserung aktivieren',
  save: 'Speichern',
  cancel: 'Abbrechen',

  // Language
  language: 'Sprache',
  langGerman: 'Deutsch',
  langEnglish: 'English',

  // Misc
  loading: 'Laden…',
  yes: 'Ja',
  no: 'Nein',
  ok: 'OK',
  close: 'Schliessen',
  confirm: 'Bestätigen',
};
