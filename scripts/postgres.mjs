/**
 * Local PostgreSQL cluster (no Docker).
 * Uses an already-installed PostgreSQL (Windows: Program Files\PostgreSQL\*).
 *
 *   node scripts/postgres.mjs start
 *   node scripts/postgres.mjs stop
 *   node scripts/postgres.mjs status
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'apps', 'api', 'data', 'pgdata');
const logFile = path.join(root, 'apps', 'api', 'data', 'postgres.log');
const port = process.env.ACA_PG_PORT || '5434';
const dbName = process.env.ACA_PG_DATABASE || 'aca';
const dbUser = process.env.ACA_PG_USER || 'aca';

function findPgBin() {
  if (process.env.ACA_PG_BIN && fs.existsSync(path.join(process.env.ACA_PG_BIN, exe('initdb')))) {
    return process.env.ACA_PG_BIN;
  }
  const fromPath = which(exe('initdb'));
  if (fromPath) return path.dirname(fromPath);

  const bases = [
    'C:\\Program Files\\PostgreSQL',
    'C:\\Program Files (x86)\\PostgreSQL',
    '/usr/lib/postgresql',
    '/usr/pgsql-18/bin',
    '/usr/bin',
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];
  const versions = ['18', '17', '16', '15', '14', '13'];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    if (fs.existsSync(path.join(base, exe('initdb')))) return base;
    for (const v of versions) {
      const cand = path.join(base, v, 'bin');
      if (fs.existsSync(path.join(cand, exe('initdb')))) return cand;
    }
  }
  throw new Error(
    'PostgreSQL binaries not found. Install PostgreSQL locally (not Docker) and retry, or set ACA_PG_BIN.',
  );
}

function exe(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function which(file) {
  const parts = (process.env.PATH || '').split(path.delimiter);
  for (const p of parts) {
    const full = path.join(p, file);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...opts,
  });
  return r;
}

function ready(pgBin) {
  const r = run(path.join(pgBin, exe('pg_isready')), ['-h', '127.0.0.1', '-p', port]);
  return r.status === 0;
}

function initIfNeeded(pgBin) {
  if (fs.existsSync(path.join(dataDir, 'PG_VERSION'))) return;
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  console.log(`[postgres] initdb → ${dataDir}`);
  const r = run(path.join(pgBin, exe('initdb')), [
    '-D',
    dataDir,
    '-U',
    dbUser,
    '-E',
    'UTF8',
    '--locale=C',
    '--auth-local=trust',
    '--auth-host=trust',
  ]);
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || 'initdb failed');
  }
  const confPath = path.join(dataDir, 'postgresql.conf');
  let conf = fs.readFileSync(confPath, 'utf8');
  conf = conf.replace(/^#?listen_addresses\s*=.*$/m, "listen_addresses = '127.0.0.1'");
  conf = conf.replace(/^#?port\s*=.*$/m, `port = ${port}`);
  fs.writeFileSync(confPath, conf);
}

function start(pgBin) {
  initIfNeeded(pgBin);
  if (ready(pgBin)) {
    console.log(`[postgres] already running on 127.0.0.1:${port}`);
    ensureDatabase(pgBin);
    return;
  }
  console.log(`[postgres] starting on 127.0.0.1:${port}`);
  const r = run(
    path.join(pgBin, exe('pg_ctl')),
    ['-D', dataDir, '-l', logFile, '-w', '-t', '15', '-o', `-p ${port} -h 127.0.0.1`, 'start'],
    { timeout: 20_000 },
  );
  if (r.status !== 0 && !ready(pgBin)) {
    const extra = (r.stderr || '') + (r.stdout || '');
    throw new Error(extra.trim() || 'pg_ctl start failed');
  }
  for (let i = 0; i < 20; i++) {
    if (ready(pgBin)) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  if (!ready(pgBin)) throw new Error('PostgreSQL did not become ready');
  ensureDatabase(pgBin);
  console.log(`[postgres] ready  postgresql://${dbUser}@127.0.0.1:${port}/${dbName}`);
}

function stop(pgBin) {
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log('[postgres] no local cluster');
    return;
  }
  const r = run(path.join(pgBin, exe('pg_ctl')), ['-D', dataDir, 'stop', '-m', 'fast']);
  if (r.status !== 0) console.log(r.stderr || r.stdout || '[postgres] stop');
  else console.log('[postgres] stopped');
}

function ensureDatabase(pgBin) {
  const exists = run(path.join(pgBin, exe('psql')), [
    '-h',
    '127.0.0.1',
    '-p',
    port,
    '-U',
    dbUser,
    '-d',
    'postgres',
    '-tAc',
    `SELECT 1 FROM pg_database WHERE datname='${dbName}'`,
  ]);
  if ((exists.stdout || '').trim() === '1') return;
  console.log(`[postgres] creating database ${dbName}`);
  const r = run(path.join(pgBin, exe('createdb')), [
    '-h',
    '127.0.0.1',
    '-p',
    port,
    '-U',
    dbUser,
    dbName,
  ]);
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'createdb failed');
}

function status(pgBin) {
  if (ready(pgBin)) console.log(`[postgres] up  127.0.0.1:${port}  db=${dbName}`);
  else console.log(`[postgres] down  (expected 127.0.0.1:${port})`);
}

const cmd = process.argv[2] || 'start';
const pgBin = findPgBin();
if (cmd === 'start') start(pgBin);
else if (cmd === 'stop') stop(pgBin);
else if (cmd === 'status') status(pgBin);
else {
  console.error('Usage: node scripts/postgres.mjs start|stop|status');
  process.exit(1);
}
