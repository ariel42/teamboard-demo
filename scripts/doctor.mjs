#!/usr/bin/env node
// Environment check for Teamboard. Prints who/what the environment is and verifies the basics.
// Exit code is non-zero if any check fails. Never prints DATABASE_URL.
import { readdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const useColor = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => paint('32', s);
const red = (s) => paint('31', s);
const dim = (s) => paint('2', s);
const bold = (s) => paint('1', s);

let failures = 0;
const ok = (label, detail = '') =>
  console.log(`${green('OK  ')} ${label}${detail ? ` ${dim(detail)}` : ''}`);
const fail = (label, hint) => {
  failures++;
  console.log(`${red('FAIL')} ${label}`);
  if (hint) console.log(`     ${dim('fix:')} ${hint}`);
};

console.log(bold('Teamboard doctor'));
console.log(`DEVENV_KIND=${process.env.DEVENV_KIND ?? dim('(not set)')}`);
console.log(`DEVENV_USER=${process.env.DEVENV_USER ?? dim('(not set)')}`);
console.log('');

// --- Node version vs engines ---------------------------------------------------------------
function satisfies(version, range) {
  const v = version.split('.').map(Number);
  return range
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => {
      const m = /^(>=|<=|>|<|=)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(part);
      if (!m) return true;
      const [, op = '=', maj, min, pat] = m;
      const want = [Number(maj), Number(min ?? 0), Number(pat ?? 0)];
      let cmp = 0;
      for (let i = 0; i < 3 && cmp === 0; i++) cmp = Math.sign(v[i] - want[i]);
      if (op === '>=') return cmp >= 0;
      if (op === '>') return cmp > 0;
      if (op === '<=') return cmp <= 0;
      if (op === '<') return cmp < 0;
      return cmp === 0;
    });
}
const engines = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).engines?.node ?? '*';
const nodeVersion = process.versions.node;
if (satisfies(nodeVersion, engines)) ok(`Node ${nodeVersion}`, `(engines: ${engines})`);
else
  fail(
    `Node ${nodeVersion} does not satisfy engines "${engines}"`,
    'install Node 24 with your environment manager (mise, devcontainer, Coder template)',
  );

// --- Database -----------------------------------------------------------------------------
const prefix = process.env.DB_SCHEMA_PREFIX ?? '';
if (!/^[a-z_][a-z0-9_]{0,40}$|^$/.test(prefix)) {
  fail('DB_SCHEMA_PREFIX is invalid', 'use lowercase letters, digits and underscores only');
}
if (!process.env.DATABASE_URL) {
  fail(
    'DATABASE_URL is not set',
    'the environment should provide it; re-open the shell or restart the workspace',
  );
} else {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', () => {});
  let reachable = false;
  try {
    const { rows } = await pool.query('select current_database() as db');
    reachable = true;
    ok('DATABASE_URL set, database reachable', `(db: ${rows[0].db})`);
  } catch (err) {
    const msg = err?.message || err?.code || String(err);
    fail(`database not reachable: ${msg}`, 'check DATABASE_URL and that the Postgres host is up');
  }
  if (reachable) {
    const files = readdirSync(join(root, 'packages/db/migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    try {
      const { rows } = await pool.query(`select name from "${prefix}app"."migrations"`);
      const done = new Set(rows.map((r) => r.name));
      const pending = files.filter((f) => !done.has(f));
      if (pending.length === 0) ok(`migrations applied (${files.length}/${files.length})`);
      else
        fail(`${pending.length} migration(s) pending: ${pending.join(', ')}`, 'npm run db:migrate');
    } catch (err) {
      if (err?.code === '42P01' || err?.code === '3F000') {
        fail('migrations not applied (schema or table missing)', 'npm run db:setup');
      } else {
        fail(`could not read migrations: ${err?.message ?? err}`, 'npm run db:setup');
      }
    }
  }
  await pool.end().catch(() => {});
}

// --- Ports ----------------------------------------------------------------------------------
function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => resolve(err.code === 'EADDRINUSE' ? false : err));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}
for (const [port, name] of [
  [5173, 'web'],
  [3000, 'API'],
  [6006, 'Storybook'],
]) {
  const free = await portFree(port);
  if (free === true) ok(`port ${port} free`, `(${name})`);
  else if (free === false)
    fail(
      `port ${port} (${name}) is in use`,
      `stop the process using it (ss -ltnp | grep :${port})`,
    );
  else
    fail(
      `port ${port} (${name}) cannot be checked: ${free.message}`,
      'check permissions and network settings',
    );
}

console.log('');
if (failures > 0) {
  console.log(red(`${failures} check(s) failed`));
  process.exit(1);
}
console.log(green('All checks passed'));
