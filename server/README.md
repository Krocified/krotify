# krotify link service

Small HTTP service that turns a YouTube video id into a best-quality MP3. It runs
`yt-dlp` and `ffmpeg`; the Android app downloads the result into the folder chosen
in Settings.

## Endpoints

- `GET /health`
- `GET /version`
- `GET /info/:videoId` -> `{ videoId, title, thumbnail, durationMs }`
- `GET /video/:videoId` -> `audio/mpeg`

If `API_TOKEN` is set, every request must send `x-api-key: <token>`.

## YouTube blocking datacenter IPs

The service tries `android_vr`, then `tv_embedded`, then the default client. If all
three return `Failed to extract any player response`, YouTube is treating the host
as a bot. Two ways forward:

- Set `YTDLP_COOKIES_B64` to a base64-encoded Netscape `cookies.txt` from a
  logged-in YouTube session. Cookies expire and need refreshing.
- Run the service on a host with a residential IP, or route `yt-dlp` through a
  residential proxy.

`YTDLP_PLAYER_CLIENTS` overrides the fallback order. `YTDLP_TIMEOUT_MS` and
`YTDLP_PATH` are also available.

## Run locally

Requires Node 20+ and `ffmpeg`. The repo uses `server/bin/yt-dlp`; if that is
missing, put a `yt-dlp` binary there or on `PATH`.

From the repo root:

```bash
./run-server.sh
```

All server state stays under `server/`: `bin/yt-dlp`, `.env`, `.tmp/`,
`node_modules/` and logs. Nothing is written to your home directory.

For Tailscale:

```bash
sudo tailscale up
tailscale ip -4
```

Install Tailscale on the phone, sign in to the same account, and open
`http://<tailscale-ip>:3000/health`. Use that URL in the app.

Check it:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/info/jNQXAC9IVRw
curl -o test.mp3 http://localhost:3000/video/jNQXAC9IVRw
```

The phone cannot reach `localhost` on your computer. Use the computer's LAN address
(for example `http://192.168.1.20:3000`) or a tunnel, and put that in the app's
Settings.

## Deploy on Render

1. Push the repo.
2. In Render, choose **New > Blueprint** and select the repo. Render reads
   `render.yaml` at the root.
3. Set `API_TOKEN` in the Render dashboard if you want auth.
4. After the deploy, copy the service URL (for example
   `https://krotify-link.onrender.com`).
5. In Krotify: Settings > Storage > Link service URL. Paste the URL. If you set
   `API_TOKEN`, paste the same value in Link service token.

The free plan sleeps after inactivity, so the first conversion after a quiet period
can take 30-60 seconds.
