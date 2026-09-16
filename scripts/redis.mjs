/**
 * Local Redis (no Docker). Finds redis-server, or downloads a Windows build.
 *
 *   node scripts/redis.mjs start
 *   node scripts/redis.mjs stop
 *   node scripts/redis.mjs status
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'apps', 'api', 'data', 'redis');
const binDir = path.join(root, 'apps', 'api', 'data', 'redis-bin');
const pidFile = path.join(dataDir, 'redis.pid');
const logFile = path.join(root, 'apps', 'api', 'data', 'redis.log');
const port = Number(process.env.ACA_REDIS_PORT || 6379);
const DOWNLOAD =
  process.env.ACA_REDIS_ZIP ||
  'https://github.com/tporadowski/redis/releases/download/v5.0.14/Redis-x64-5.0.14.zip';

function exe(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function which(file) {
  for (const p of (process.env.PATH || '').split(path.delimiter)) {
    const full = path.join(p, file);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function findServer() {
  if (process.env.ACA_REDIS_BIN) {
    const p = path.join(process.env.ACA_REDIS_BIN, exe('redis-server'));
    if (fs.existsSync(p)) return p;
  }
  const onPath = which(exe('redis-server'));
  if (onPath) return onPath;
  const guesses = [
    path.join(binDir, exe('redis-server')),
    path.join(binDir, 'Redis-x64-5.0.14', exe('redis-server')),
    'C:\\Program Files\\Redis\\redis-server.exe',
    'C:\\Program Files\\Memurai\\memurai.exe',
  ];
  for (const g of guesses) {
    if (fs.existsSync(g)) return g;
  }
  if (fs.existsSync(binDir)) {
    const found = walkFind(binDir, exe('redis-server'));
    if (found) return found;
  }
  return null;
}

function walkFind(dir, filename) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase() === filename.toLowerCase()) return full;
    if (e.isDirectory()) {
      const hit = walkFind(full, filename);
      if (hit) return hit;
    }
  }
  return null;
}

function ping(ms = 400) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port }, () => {
      sock.end();
      resolve(true);
    });
    sock.setTimeout(ms);
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => {
      sock.destroy();
      resolve(false);
    });
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http://') ? http : https;
    const req = client.get(url, { headers: { 'User-Agent': 'aca-redis-setup' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`download failed ${res.statusCode}`));
        return;
      }
      pipeline(res, createWriteStream(dest)).then(resolve, reject);
    });
    req.on('error', reject);
  });
}

async function ensureBin() {
  let server = findServer();
  if (server) return server;
  fs.mkdirSync(binDir, { recursive: true });
  const zip = path.join(binDir, 'redis.zip');
  console.log(`[redis] downloading Windows build (no Docker)…`);
  await download(DOWNLOAD, zip);
  const expand = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${zip}' -DestinationPath '${binDir}'`],
    { encoding: 'utf8', windowsHide: true },
  );
  if (expand.status !== 0) {
    throw new Error(expand.stderr || expand.stdout || 'failed to unzip Redis');
  }
  server = findServer();
  if (!server) throw new Error('redis-server.exe not found after download. Set ACA_REDIS_BIN.');
  return server;
}

async function start() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (await ping()) {
    console.log(`[redis] already running on 127.0.0.1:${port}`);
    return;
  }
  const server = await ensureBin();
  const out = fs.openSync(logFile, 'a');
  const child = spawn(
    server,
    ['--port', String(port), '--bind', '127.0.0.1', '--dir', dataDir, '--dbfilename', 'dump.rdb', '--appendonly', 'no'],
    { detached: true, stdio: ['ignore', out, out], windowsHide: true, cwd: path.dirname(server) },
  );
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid || ''), 'utf8');
  for (let i = 0; i < 40; i++) {
    if (await ping(500)) {
      console.log(`[redis] ready  redis://127.0.0.1:${port}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Redis did not become ready. See apps/api/data/redis.log');
}

function stop() {
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    if (pid) {
      try {
        process.kill(pid);
      } catch {
        /* already stopped */
      }
    }
    fs.rmSync(pidFile, { force: true });
  }
  spawnSync('powershell', ['-NoProfile', '-Command', `Get-Process redis-server -ErrorAction SilentlyContinue | Stop-Process -Force`], {
    windowsHide: true,
  });
  console.log('[redis] stopped');
}

async function status() {
  if (await ping()) console.log(`[redis] up  127.0.0.1:${port}`);
  else console.log(`[redis] down (expected 127.0.0.1:${port})`);
}

const cmd = process.argv[2] || 'start';
if (cmd === 'start') await start();
else if (cmd === 'stop') stop();
else if (cmd === 'status') await status();
else {
  console.error('Usage: node scripts/redis.mjs start|stop|status');
  process.exit(1);
}
