/**
 * English UI strings.
 */
export default {
  // Search
  searchPlaceholder: 'Song, artist, channel or YouTube URL…',
  searchButton: 'Search',
  searchLoading: 'Searching…',
  searchNoResults: 'No results found.',
  searchError: 'Search failed. Please check your network connection.',
  filterAll: 'All',
  filterTracks: 'Songs',
  filterPlaylists: 'Playlists',

  // Results
  play: 'Play',
  addToQueue: 'Add to queue',
  playNext: 'Play next',
  addToPlaylist: 'Add to playlist',
  addToFavorites: 'Add to favorites',
  removeFromFavorites: 'Remove from favorites',
  trackCount: (n) => `${n} ${n === 1 ? 'song' : 'songs'}`,
  duration: 'Duration',

  // Player bar
  nowPlaying: 'Now playing',
  noTrack: 'No song selected',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'Stop',
  next: 'Next',
  previous: 'Previous',
  volume: 'Volume',
  shuffle: 'Shuffle',
  repeat: 'Repeat',
  repeatNone: 'No repeat',
  repeatOne: 'Repeat song',
  repeatAll: 'Repeat all',

  // Queue
  queue: 'Queue',
  queueEmpty: 'The queue is empty.',
  clearQueue: 'Clear queue',
  removeFromQueue: 'Remove',

  // Speaker picker
  selectSpeaker: 'Choose playback target',
  noSpeakers: 'No speakers found.',
  speakerGroup: 'Group',
  speakerRefresh: 'Refresh',

  // Favorites
  favorites: 'Favorites',
  favoritesEmpty: 'No favorites saved yet.',

  // Playlists
  playlists: 'My Playlists',
  playlistsEmpty: 'No playlists created yet.',
  createPlaylist: 'New playlist',
  playlistName: 'Playlist name',
  renamePlaylist: 'Rename',
  deletePlaylist: 'Delete',
  playlistDeleteConfirm: (name) => `Really delete playlist “${name}”?`,
  playlistItemsEmpty: 'This playlist has no songs yet.',
  playPlaylist: 'Play playlist',
  addPlaylistToQueue: 'Add to queue',

  // Playlist picker (add-to-playlist modal)
  addToPlaylistTitle: 'Add to playlist',
  newPlaylistInline: 'Create new playlist…',
  newPlaylistPrompt: 'Name of the new playlist',
  addedToPlaylist: (title, name) => `“${title}” added to “${name}”.`,
  alreadyInPlaylist: (name) => `Already in “${name}”.`,
  noPlaylistsYet: 'You don’t have any playlists yet. Create one:',

  // Errors
  errorNotAvailable: 'This content is not available or blocked.',
  errorStream: 'The audio stream could not be loaded.',
  errorSpeaker: 'Speaker not reachable.',
  errorUnknown: 'An unknown error occurred.',
  tryNext: 'Continuing with the next song.',

  // Navigation
  navSearch: 'Search',
  navQueue: 'Queue',
  navFavorites: 'Favorites',
  navPlaylists: 'Playlists',

  // Settings
  settings: 'Settings',
  proxyUrl: 'Proxy server URL',
  proxyUrlHelp: 'URL of the local dev server (e.g. http://localhost:3001)',
  aiSettings: 'AI settings (axposervices / OpenAI-compatible)',
  aiBaseUrl: 'API base URL',
  aiApiKey: 'API key',
  aiModel: 'Model',
  aiEnabled: 'Enable AI search enhancement',
  save: 'Save',
  cancel: 'Cancel',

  // Language
  language: 'Language',
  langGerman: 'Deutsch',
  langEnglish: 'English',

  // Misc
  loading: 'Loading…',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  close: 'Close',
  confirm: 'Confirm',
};
