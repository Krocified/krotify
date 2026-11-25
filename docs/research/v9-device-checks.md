# v9 device checks

| Check | Steps | Expected | Result | Notes |
|---|---|---|---|---|
| Enable while playing | Settings → Playback → Spatial audio → High | Audible widening; Low/Medium/High differ | pending | |
| Enable while paused | Select High while paused, then play | Effect applies; no crash | pending | |
| Unsupported device | Emulator or device without the effect | Mode returns to Off; "Not supported on this device"; playback unaffected | pending | |
| Recreate | Play, trigger missing-file recovery or change queue | Mode stays selected and reapplies | pending | |
| Restart | Set High, kill and relaunch the app | High restored; applies on first play | pending | |
| Track changes | Let 10+ songs auto-advance | No crash; mode persists | pending | |
| Lock screen | Lock the screen, use notification controls | Playback and effect unchanged | pending | |
| Wired headphones | Enable High on wired output | Audible widening | pending | |
| Bluetooth | Enable High on Bluetooth output | Record whether effect applies or is bypassed | pending | |
| Phone speaker | Enable High on speaker | Record result | pending | |
