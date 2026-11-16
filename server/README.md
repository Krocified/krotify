# krotify link service

Small HTTP service that turns a YouTube video id into a best-quality MP3. It runs
`yt-dlp` and `ffmpeg`; the Android app downloads the result into the folder chosen
in Settings.

## Endpoints

- `GET /health`
- `GET /info/:videoId` -> `{ videoId, title, thumbnail, durationMs }`
- `GET /video/:videoId` -> `audio/mpeg`

If `API_TOKEN` is set, every request must send `x-api-key: <token>`.

## Run locally

Requires Node 20+, Python 3.11+, `yt-dlp` on `PATH`, and `ffmpeg`.

```bash
cd server
npm install
API_TOKEN=dev PORT=3000 npm start
```

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
