import WebSocket from 'ws';
import { loadEnvFile } from '../packages/db/src/loadEnv.js';
import { getOrCreateDevAccount } from '../packages/db/src/accounts.js';
import { signAccessToken } from '../packages/shared/src/auth/jwt.js';

loadEnvFile();

const WS_URL = 'ws://localhost:3002/session';
const TIMEOUT_MS = 12_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mintToken(): Promise<{ accountId: string; token: string }> {
  const account = await getOrCreateDevAccount('00000000-0000-4000-8000-000000000099');
  const { token } = await signAccessToken(account.id);
  return { accountId: account.id, token };
}

function send(ws: WebSocket, message: Record<string, unknown>): void {
  ws.send(JSON.stringify(message));
}

async function runHappyPath(token: string): Promise<boolean> {
  console.log('\n[1] Happy path: connect -> backdoor -> disable alarm -> claim');
  const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

  const result = await new Promise<{ success: boolean; message: string }>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('Happy path timed out waiting for claim_result'));
    }, TIMEOUT_MS);

    ws.on('error', reject);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      const type = String(msg.type);
      console.log('  <=', type, msg.code ?? msg.success ?? (typeof msg.output === 'string' ? msg.output.slice(0, 50) : ''));

      if (type === 'session_ready') {
        send(ws, { type: 'connect', ipv6: '2001:db8:1:7::3' });
      } else if (type === 'session_started') {
        send(ws, { type: 'shell_command', command: 'assume superuser backdoor' });
      } else if (type === 'shell_output' && String(msg.output).includes('Access granted')) {
        send(ws, { type: 'shell_command', command: 'disable alarm' });
      } else if (type === 'shell_output' && String(msg.output).includes('Alarm daemon stopped')) {
        send(ws, { type: 'claim' });
      } else if (type === 'claim_result') {
        clearTimeout(timer);
        resolve({ success: Boolean(msg.success), message: String(msg.message ?? '') });
        ws.close();
      } else if (type === 'error') {
        clearTimeout(timer);
        reject(new Error(`${String(msg.code)}: ${String(msg.message)}`));
        ws.close();
      }
    });
  });

  console.log('  => claim:', result.success ? 'OK' : 'FAIL', result.message);
  return result.success;
}

async function runToolLevelReject(token: string): Promise<void> {
  console.log('\n[2] Tool level rejection on hardened target');
  const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('Tool level test timed out'));
    }, TIMEOUT_MS);

    ws.on('error', reject);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      const type = String(msg.type);
      console.log('  <=', type, msg.code ?? (typeof msg.message === 'string' ? msg.message.slice(0, 60) : ''));

      if (type === 'session_ready') {
        send(ws, { type: 'connect', ipv6: '2001:db8:1:7::2' });
      } else if (type === 'session_started') {
        send(ws, { type: 'run_tool', toolId: 'cracker_l1' });
      } else if (type === 'error' && msg.code === 'insufficient_tool_level') {
        clearTimeout(timer);
        console.log('  => rejected as expected');
        ws.close();
        resolve();
      } else if (type === 'tool_started') {
        clearTimeout(timer);
        ws.close();
        reject(new Error('Expected insufficient_tool_level, got tool_started'));
      }
    });
  });
}

async function main(): Promise<void> {
  const health = (await fetch('http://localhost:3002/health').then((r) => r.json())) as {
    status: string;
    checks: { database: string };
  };
  console.log('Health:', health.status, '| db:', health.checks.database);

  const { accountId, token } = await mintToken();
  console.log('Account:', accountId);

  const claimOk = await runHappyPath(token);
  await sleep(500);
  await runToolLevelReject(token);

  console.log('\nResult:', claimOk ? 'PASS' : 'FAIL');
  process.exit(claimOk ? 0 : 1);
}

main().catch((err: Error) => {
  console.error('\nTest failed:', err.message);
  process.exit(1);
});
