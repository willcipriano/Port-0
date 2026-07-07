#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const dockerCmd = isWindows ? 'docker.exe' : 'docker';
const composeFile = 'infra/docker-compose.yml';

const SERVICES = [
  { label: 'mock', script: 'dev:mock', port: 3099 },
  { label: 'auth', script: 'dev:auth', port: 3001 },
  { label: 'api', script: 'dev:game-api', port: 3002 },
  { label: 'tick', script: 'dev:tick-worker', port: 3003 },
  { label: 'client', script: 'dev:client', port: 5173 },
];

const DEV_PORTS = SERVICES.map((s) => s.port);

let children = [];
let shuttingDown = false;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForInfra(timeoutMs = 60_000) {
  const start = Date.now();
  process.stdout.write('Waiting for Postgres and Redis');
  while (Date.now() - start < timeoutMs) {
    const postgresReady = execQuiet([
      dockerCmd,
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'postgres',
      'pg_isready',
      '-U',
      'port0',
    ]);
    const redisReady = execQuiet([
      dockerCmd,
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'redis',
      'redis-cli',
      'ping',
    ]);
    if (postgresReady && redisReady) {
      process.stdout.write(' ready\n');
      return;
    }
    process.stdout.write('.');
    await sleep(1000);
  }
  throw new Error('Postgres/Redis did not become ready in time');
}

function execQuiet(argv) {
  try {
    execSync(argv.join(' '), { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (isWindows) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    // Process may already be gone.
  }
}

function pidsOnPort(port) {
  const pids = new Set();
  try {
    if (isWindows) {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      for (const line of out.split('\n')) {
        if (!line.includes('LISTENING')) continue;
        const pid = Number(line.trim().split(/\s+/).pop());
        if (pid > 0) pids.add(pid);
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
      for (const line of out.split('\n')) {
        const pid = Number(line.trim());
        if (pid > 0) pids.add(pid);
      }
    }
  } catch {
    // Nothing listening on this port.
  }
  return [...pids];
}

function killPorts(ports) {
  for (const port of ports) {
    for (const pid of pidsOnPort(port)) {
      killProcessTree(pid);
    }
  }
}

function spawnServices() {
  const names = SERVICES.map((s) => s.label).join(',');
  const colors = 'cyan,green,yellow,magenta,blue';
  const commands = SERVICES.map((s) =>
    isWindows ? `"npm run ${s.script}"` : `npm run ${s.script}`,
  ).join(' ');
  const cmd = `npx concurrently --kill-others-on-fail -n ${names} -c ${colors} ${commands}`;

  const child = spawn(cmd, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
    detached: !isWindows,
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null && !shuttingDown) {
      console.error(`Dev services exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

function printBanner() {
  console.log('');
  console.log('Port 0 dev stack');
  console.log('  Client     http://localhost:5173/');
  console.log('  Mock API   http://localhost:3099/health');
  console.log('  Auth       http://localhost:3001/health');
  console.log('  Game API   http://localhost:3002/health');
  console.log('  Tick       http://localhost:3003/health');
  console.log('');
  console.log('Press Ctrl+C or run `npm run dev:down` to stop everything.');
  console.log('');
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('\nStopping dev services...');
  for (const child of children) {
    killProcessTree(child.pid);
  }
  children = [];

  killPorts(DEV_PORTS);

  try {
    await run(dockerCmd, ['compose', '-f', composeFile, 'down']);
  } catch {
    // Docker may already be stopped.
  }

  console.log('Dev stack stopped.');
  setTimeout(() => process.exit(code), 200);
}

async function up() {
  console.log('Starting Postgres and Redis...');
  await run(dockerCmd, ['compose', '-f', composeFile, 'up', '-d', 'postgres', 'redis']);
  await waitForInfra();
  await run('npm', ['run', 'db:migrate'], { shell: true });
  await run('npm', ['run', 'db:seed'], { shell: true });

  console.log('Starting mock (:3099), auth (:3001), game-api (:3002), tick-worker (:3003), client (:5173)...');
  children = [spawnServices()];

  printBanner();

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
}

async function down() {
  shuttingDown = true;
  killPorts(DEV_PORTS);
  try {
    await run(dockerCmd, ['compose', '-f', composeFile, 'down']);
    console.log('Dev stack stopped.');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

const command = process.argv[2] ?? 'up';

if (command === 'up') {
  up().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
} else if (command === 'down') {
  down();
} else {
  console.error('Usage: node scripts/dev.mjs [up|down]');
  process.exit(1);
}
