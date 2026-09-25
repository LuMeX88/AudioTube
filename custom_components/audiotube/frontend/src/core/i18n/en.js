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
  volumeIncrease: 'Increase volume',
  volumeDecrease: 'Decrease volume',
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
  manageGroups: 'Manage groups',
  createGroup: 'New group',
  groupName: 'Group name',
  renameGroup: 'Rename',
  deleteGroup: 'Delete',
  groupDeleteConfirm: (name) => `Really delete group "${name}"?`,
  noGroupsYet: 'No groups yet. A speaker can belong to several groups.',

  // Favorites
  favorites: 'Favorites',
  favoritesEmpty: 'No favorites saved yet.',

  // Playlists
  playlists: 'My Playlists',
  playlistsEmpty: 'No playlists created yet.',
  createPlaylist: 'New playlist',
  playlistName: 'Playlist name',
  playlistVisibility: 'Visibility',
  playlistPrivate: 'Private',
  playlistPrivateHint: 'Only you can see and edit this playlist.',
  playlistShared: 'Shared',
  playlistSharedHint: 'Every Home Assistant user can see and edit it.',
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
  navMenu: 'Menu',

  // Settings
  settings: 'Settings',
  openSettings: 'Settings',
  aiSettings: 'AI settings (OpenAI-compatible)',
  aiBaseUrl: 'API base URL',
  aiApiKey: 'API key',
  aiModel: 'Model',
  aiEnabled: 'Enable AI search enhancement',
  save: 'Save',
  cancel: 'Cancel',

  // Theme
  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',
  themeOled: 'OLED Black',
  themeSepia: 'Sepia',
  themeContrast: 'High Contrast',

  // Backup (export/import favorites & playlists)
  backup: 'Backup',
  backupHint: 'Save your favorites and playlists to a file, or restore them from one.',
  exportYaml: 'Export as YAML',
  importYaml: 'Import from YAML',
  importReplaceConfirm: 'Replace your current favorites and playlists with the imported file? Choose “Cancel” to merge instead.',
  importSuccess: (favs, pls) => `Imported ${favs} favorite(s) and ${pls} playlist(s).`,
  importError: 'This file could not be read. Please make sure it’s a valid AudioTube YAML backup.',

  // Language
  language: 'Language',
  langGerman: 'Deutsch',
  langEnglish: 'English',

  // About
  about: 'About',
  version: (v) => `Version ${v}`,

  // Misc
  loading: 'Loading…',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  close: 'Close',
  confirm: 'Confirm',
};
