# Release Notes

## 0.5.0 - 2026-09-25

- Moved queue ownership and auto-advance into the Home Assistant backend.
- Kept playback running while no AudioTube browser or Companion App is connected.
- Made the queue global so every Home Assistant user sees and edits the same list.
- Added private and shared playlist visibility when creating a playlist.
- Kept private playlists scoped to their Home Assistant user account.
- Made shared playlists visible and editable for every authenticated Home Assistant user.
- Persisted the shared queue, playback session, and shared playlists across Home Assistant restarts.