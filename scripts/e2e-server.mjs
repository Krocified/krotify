#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const distRoot = resolve(repoRoot, 'dist');
const indexFile = resolve(distRoot, 'index.html');
const port = Number(process.env.E2E_PORT ?? 4173);
const host = process.env.E2E_HOST ?? '127.0.0.1';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function buildWebExport() {
  console.log('[e2e] dist is missing or E2E_REBUILD=1, exporting the web build...');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npx, ['expo', 'export', '--platform', 'web'], {
    cwd: repoRoot,
    env: { ...process.env, EXPO_PUBLIC_E2E: '1' },
    stdio: 'inherit',
  });
  if (result.error) {
    console.error('[e2e] could not start the web export:', result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[e2e] web export exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function resolveRequestPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const withoutQuery = decoded.split('?')[0].split('#')[0];
  const relative = normalize(withoutQuery).replace(/^([/\\]|\.\.[/\\])+/, '');
  const candidate = resolve(distRoot, relative === '' ? 'index.html' : relative);
  if (candidate !== distRoot && !candidate.startsWith(`${distRoot}/`)) return null;
  return candidate;
}

function sendFile(res, filePath) {
  const extension = extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
    Expires: '0',
    Pragma: 'no-cache',
  });
  createReadStream(filePath).pipe(res);
}

if (process.env.E2E_REBUILD === '1' || !existsSync(indexFile)) {
  buildWebExport();
}

if (!existsSync(indexFile)) {
  console.error(`[e2e] no web export at ${indexFile}`);
  process.exit(1);
}

const server = createServer((req, res) => {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const urlPath = (req.url ?? '/').split('?')[0];
  if (urlPath === '/health') {
    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end(method === 'HEAD' ? undefined : 'ok');
    return;
  }

  const filePath = resolveRequestPath(req.url ?? '/');
  if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
    if (method === 'HEAD') {
      const extension = extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
      });
      res.end();
      return;
    }
    sendFile(res, filePath);
    return;
  }

  const requestedExtension = extname(urlPath);
  if (requestedExtension) {
    res.writeHead(404, { 'Cache-Control': 'no-store' });
    res.end('Not found');
    return;
  }

  if (method === 'HEAD') {
    res.writeHead(200, {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.end();
    return;
  }
  sendFile(res, indexFile);
});

server.listen(port, host, () => {
  console.log(`[e2e] serving ${distRoot} at http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
