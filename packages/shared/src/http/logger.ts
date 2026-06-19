export function logInfo(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level: 'info', event, ts: new Date().toISOString(), ...fields }));
}

export function logWarn(event: string, fields: Record<string, unknown> = {}): void {
  console.warn(JSON.stringify({ level: 'warn', event, ts: new Date().toISOString(), ...fields }));
}

export function logError(event: string, fields: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ level: 'error', event, ts: new Date().toISOString(), ...fields }));
}
