# v8 device checks

Recorded against a dev build. Fill each row on the device; do not infer from the
web preview.

| Area | Check | Build | Result |
|---|---|---|---|
| Keyboard | New playlist sheet: name field and Create stay above the keyboard |  | pending |
| Keyboard | Edit playlist, Paste lyrics, tag picker, playlist picker New playlist |  | pending |
| Keyboard | Import link field and Download stay visible while typing |  | pending |
| Import | Pick from local storage and from a cloud provider |  | pending |
| Import | Folder-sized import: progress, current file, cancel after 3 of 12 |  | pending |
| Import | Duplicate and hidden reporting; duration/artwork fill after the row lands |  | pending |
| Artwork | Gallery pick, files pick, EXIF-rotated crop, tall/wide crop |  | pending |
| Artwork | Playlist cover isolation; artist cover survives rescan and case-only rename |  | pending |
| Playlists | Card menu hit target; picker with a large library; back precedence |  | pending |
| Player | Ambient backdrop stable per track; pause stops motion; reduce motion static |  | pending |
| Player | Expanded row back behavior; sleep caption; lyrics overflow |  | pending |
| Notification | Seek bar and timestamps: cold start, 5-minute track, 30-second track |  | pending |
| Notification | Next from app and notification, queue rebuild, background return |  | pending |

## v8.1

| Area | Check | Build | Result |
|---|---|---|---|
| Ambient | Motion is visible while paused; still distinct per track; reduce motion static |  | pending |
| Player | Overflow is icon-only; the back/down pill stays put when it opens |  | pending |
| Selection | Library actions visible: Like, Tag, Playlist, Hide, Delete; Like reports a count |  | pending |
| Keyboard | Sheet field and submit row stay above the keyboard after the ScrollView shrinks |  | pending |
| Notification | Pause from the notification, open the app, then Play starts playback |  | pending |
| Notification | Determinate progress bar advances for a five-minute and a thirty-second track |  | pending |
