const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS || 240000);

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

async function fetchInfo(videoId) {
  const raw = await run([
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
  const template = path.join(workDir, `${videoId}.%(ext)s`);
  await run([
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
  const file = path.join(workDir, `${videoId}.mp3`);
  const stat = await fs.stat(file);
  if (!stat.size) throw new Error('yt-dlp produced an empty file');
  return file;
}

module.exports = { fetchInfo, downloadMp3 };
