#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: true });
    child.on('exit', (code) => (code === 0 ? resolvePromise(undefined) : reject(new Error(`${command} exited ${code}`))));
  });
}

async function main() {
  await run('docker', ['compose', '-f', 'infra/docker-compose.yml', 'up', '-d', 'postgres', 'redis']);
  await run('npm', ['run', 'db:migrate']);
  await run('npm', ['run', 'db:seed']);
  await run('npx', ['concurrently', '-n', 'auth,api,tick', '-c', 'cyan,magenta,yellow', 'npm run dev:auth', 'npm run dev:game-api', 'npm run dev:tick-worker']);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
