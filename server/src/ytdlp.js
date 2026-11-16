const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS || 240000);
const CLIENTS = (process.env.YTDLP_PLAYER_CLIENTS || 'android_vr,tv_embedded,default')
  .split(',')
  .map((client) => client.trim())
  .filter(Boolean);
const COOKIES_PATH = process.env.YTDLP_COOKIES_PATH || '';
const COOKIES_B64 = process.env.YTDLP_COOKIES_B64 || '';

let cookiesFile = COOKIES_PATH;

if (!cookiesFile && COOKIES_B64) {
  try {
    cookiesFile = path.join('/tmp', 'krotify-cookies.txt');
    fs.writeFileSync(cookiesFile, Buffer.from(COOKIES_B64, 'base64'));
  } catch {
    cookiesFile = '';
  }
}

function watchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {}
      finish(new Error('yt-dlp timed out'));
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 16000) stderr = stderr.slice(-16000);
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (code === 0) return finish(null, stdout);
      const detail = stderr.trim().split('\n').slice(-2).join(' | ');
      finish(new Error(detail || `yt-dlp exited with ${code}`));
    });
  });
}

function commonArgs() {
  return cookiesFile ? ['--cookies', cookiesFile] : [];
}

function clientArgs(client) {
  return client === 'default' ? [] : ['--extractor-args', `youtube:player_client=${client}`];
}

async function withClientFallback(buildArgs) {
  let lastError = null;
  for (const client of CLIENTS) {
    try {
      return await run([...commonArgs(), ...clientArgs(client), ...buildArgs(client)]);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('yt-dlp failed');
}

async function fetchInfo(videoId) {
  const raw = await withClientFallback((client) => [
    '--no-playlist',
    '--skip-download',
    '--dump-single-json',
    '--no-warnings',
    watchUrl(videoId),
  ]);
  const data = JSON.parse(raw);
  return {
    videoId,
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'YouTube audio',
    thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : null,
    durationMs: Math.max(0, Math.round((Number(data.duration) || 0) * 1000)),
  };
}

async function downloadMp3(videoId, workDir) {
  let lastError = null;
  for (const client of CLIENTS) {
    const clientDir = path.join(workDir, client);
    try {
      await fsp.mkdir(clientDir, { recursive: true });
      const template = path.join(clientDir, `${videoId}.%(ext)s`);
      await run([
        ...commonArgs(),
        ...clientArgs(client),
        '--no-playlist',
        '--no-warnings',
        '-x',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '0',
        '-o',
        template,
        watchUrl(videoId),
      ]);
      const file = path.join(clientDir, `${videoId}.mp3`);
      const stat = await fsp.stat(file);
      if (!stat.size) throw new Error('yt-dlp produced an empty file');
      return file;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('yt-dlp could not produce a file');
}

async function ytdlpVersion() {
  try {
    return (await run(['--version'])).trim();
  } catch {
    return 'unknown';
  }
}

module.exports = { fetchInfo, downloadMp3, ytdlpVersion };
