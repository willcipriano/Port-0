#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const dockerCmd = isWindows ? 'docker.exe' : 'docker';

function run(command, args, { shell = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell,
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolvePromise(undefined) : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

function spawnService(label, script) {
  const child = spawn('npm', ['run', script], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${label}] exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

const services = [
  { label: 'auth', script: 'dev:auth' },
  { label: 'api', script: 'dev:game-api' },
  { label: 'tick', script: 'dev:tick-worker' },
];

let children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(isWindows ? undefined : 'SIGTERM');
    }
  }
  setTimeout(() => process.exit(code), 500);
}

async function main() {
  await run(dockerCmd, ['compose', '-f', 'infra/docker-compose.yml', 'up', '-d', 'postgres', 'redis']);
  await run('npm', ['run', 'db:migrate'], { shell: true });
  await run('npm', ['run', 'db:seed'], { shell: true });

  console.log('Starting auth (:3001), game-api (:3002), tick-worker (:3003)...');
  children = services.map(({ label, script }) => spawnService(label, script));

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
