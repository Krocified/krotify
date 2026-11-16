const express = require('express');
const cors = require('cors');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { fetchInfo, downloadMp3 } = require('./ytdlp');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_TOKEN = process.env.API_TOKEN || '';
const MAX_JOBS = Math.max(1, Number(process.env.MAX_JOBS || 2));
const INFO_TTL_MS = 10 * 60 * 1000;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const infoCache = new Map();
let activeJobs = 0;
const waiting = [];

app.disable('x-powered-by');
app.use(cors());

function requireToken(req, res, next) {
  if (!API_TOKEN) return next();
  const token = req.get('x-api-key') || req.query.token;
  if (token === API_TOKEN) return next();
  return res.status(401).json({ error: 'Missing or invalid API token.' });
}

function validId(req, res) {
  const id = req.params.id;
  if (!VIDEO_ID.test(id)) {
    res.status(400).json({ error: 'Invalid YouTube video id.' });
    return null;
  }
  return id;
}

function cachedInfo(id) {
  const hit = infoCache.get(id);
  if (hit && hit.expires > Date.now()) return hit.promise;
  const promise = fetchInfo(id);
  infoCache.set(id, { promise, expires: Date.now() + INFO_TTL_MS });
  promise.catch(() => infoCache.delete(id));
  return promise;
}

function acquire() {
  if (activeJobs < MAX_JOBS) {
    activeJobs += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else activeJobs = Math.max(0, activeJobs - 1);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, jobs: activeJobs, waiting: waiting.length });
});

app.get('/info/:id', requireToken, async (req, res) => {
  const id = validId(req, res);
  if (!id) return;
  try {
    res.json(await cachedInfo(id));
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not read video info.' });
  }
});

app.get('/video/:id', requireToken, async (req, res) => {
  const id = validId(req, res);
  if (!id) return;

  let info = null;
  try {
    info = await cachedInfo(id);
  } catch {}

  await acquire();
  let workDir = null;
  try {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'krotify-'));
    const file = await downloadMp3(id, workDir);
    const title = (info?.title || id).replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.download(file, `${title || id}.mp3`, async () => {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      workDir = null;
      release();
    });
  } catch (error) {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    release();
    if (!res.headersSent) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'Could not convert this video.' });
    }
  }
});

app.get('/', (_req, res) => {
  res.json({
    name: 'krotify-link',
    endpoints: ['GET /health', 'GET /info/:videoId', 'GET /video/:videoId'],
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.listen(PORT, () => {
  console.log(`krotify-link listening on ${PORT}`);
});
