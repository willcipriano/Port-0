import { useState, useRef, useEffect, useCallback } from 'react';

interface TerminalLine {
  id: number;
  type: 'output' | 'input' | 'system' | 'error' | 'success';
  text: string;
}

const BANNER = [
  '╔══════════════════════════════════════════════╗',
  '║  PORT 0 REMOTE SHELL  //  SECURE CHANNEL      ║',
  '║  Encryption: AES-256-CTR  ·  MTU: 1420        ║',
  '╚══════════════════════════════════════════════╝',
  '',
  'Type HELP for available commands.',
  '',
];

const COMMANDS: Record<string, (args: string[]) => string[]> = {
  help: () => [
    'Available commands:',
    '  ls [-la]         list directory contents',
    '  cat <file>       display file contents',
    '  pwd              print working directory',
    '  whoami           current user',
    '  ps               running processes',
    '  netstat          network connections',
    '  clear            clear terminal',
    '  disconnect       end session',
  ],
  ls: (args) => args.includes('-la') || args.includes('-l')
    ? [
        'total 48',
        'drwxr-xr-x  2 root root 4096 Jun 18 03:12 .',
        'drwxr-xr-x 18 root root 4096 Jun 10 22:01 ..',
        '-rw-r--r--  1 root root  220 Jun 10 22:01 .bash_logout',
        '-rw-------  1 root root  847 Jun 18 03:12 .bash_history',
        '-rw-r--r--  1 root root 3526 Jun 10 22:01 .bashrc',
        '-rw-r--r--  1 root root  807 Jun 10 22:01 .profile',
        'drwx------  2 root root 4096 Jun 18 02:44 .ssh',
        '-rw-------  1 root root 1024 Jun 14 17:30 access.log',
        '-rw-r--r--  1 root root 2048 Jun 14 17:30 config.db',
      ]
    : ['access.log  config.db  .ssh/'],
  pwd: () => ['/root'],
  whoami: () => ['root'],
  ps: () => [
    'PID   USER   STAT  COMMAND',
    '1     root   Ss    /sbin/init',
    '142   root   S     sshd: root@pts/0',
    '289   root   S     /usr/bin/logger',
    '301   root   R     ps',
  ],
  netstat: () => [
    'Proto  Recv-Q  Send-Q  Local Address        Foreign Address      State',
    'tcp    0       0       0.0.0.0:22           0.0.0.0:*            LISTEN',
    'tcp    0       52      [::1]:22             [::c7e1]:49812       ESTABLISHED',
  ],
  clear: () => ['__CLEAR__'],
  disconnect: () => ['Session terminated.', '__DISCONNECT__'],
  cat: (args) => {
    if (args[0] === 'access.log') {
      return [
        '2026-06-18 03:12:44 [SSH] Accepted publickey for root',
        '2026-06-18 03:13:01 [AUTH] Login successful',
        '2026-06-18 03:14:22 [FS] /root/config.db read',
      ];
    }
    if (args[0] === 'config.db') {
      return ['[ENCRYPTED — use decrypt tool]'];
    }
    return args[0] ? [`cat: ${args[0]}: No such file or directory`] : ['cat: missing operand'];
  },
};

let lineId = 0;

function makeLine(type: TerminalLine['type'], text: string): TerminalLine {
  return { id: lineId++, type, text };
}

export function Terminal({ target }: { target?: string }) {
  const [lines, setLines] = useState<TerminalLine[]>(() =>
    BANNER.map(t => makeLine('system', t))
  );
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [connected, setConnected] = useState(false);
  const [currentTarget, setCurrentTarget] = useState(target ?? '');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  useEffect(() => {
    if (target && target !== currentTarget) {
      setCurrentTarget(target);
      connectTo(target);
    }
  }, [target]);

  const addLines = useCallback((newLines: TerminalLine[]) => {
    setLines(prev => [...prev, ...newLines]);
  }, []);

  const connectTo = useCallback((ip: string) => {
    setConnected(false);
    addLines([
      makeLine('system', `Establishing connection to [${ip}]...`),
    ]);
    setTimeout(() => {
      addLines([makeLine('system', 'Routing through relay nodes...')]);
    }, 300);
    setTimeout(() => {
      addLines([
        makeLine('success', `Connected to ${ip}`),
        makeLine('system', 'Shell session established. Type HELP for commands.'),
        makeLine('output', ''),
      ]);
      setConnected(true);
      setCurrentTarget(ip);
    }, 1000);
  }, [addLines]);

  const execCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const parts = trimmed.toLowerCase().split(/\s+/);
    const name = parts[0];
    const args = parts.slice(1);

    if (!connected) {
      // not connected: allow 'connect'
      if (name === 'connect' && args[0]) {
        connectTo(args[0]);
      } else {
        addLines([makeLine('error', 'No active session. Use CONNECT <ipv6> to connect.')]);
      }
      return;
    }

    const handler = COMMANDS[name];
    if (handler) {
      const result = handler(args);
      if (result.includes('__CLEAR__')) {
        setLines([]);
        return;
      }
      if (result.includes('__DISCONNECT__')) {
        setConnected(false);
        addLines(result.filter(r => r !== '__DISCONNECT__').map(r => makeLine('system', r)));
        return;
      }
      addLines(result.map(r => makeLine('output', r)));
    } else {
      addLines([makeLine('error', `${name}: command not found`)]);
    }
  }, [connected, addLines, connectTo]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = input;
      addLines([makeLine('input', `${prompt} ${cmd}`)]);
      execCommand(cmd);
      setHistory(h => [cmd, ...h.slice(0, 49)]);
      setHistIdx(-1);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setInput(history[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? '' : history[next]);
    }
  };

  const prompt = connected ? `root@${currentTarget.slice(-8) || 'unknown'}:~#` : 'port0:~$';

  const lineColor = {
    output:  'var(--text-primary)',
    input:   'var(--accent-cyan)',
    system:  'var(--text-muted)',
    error:   'var(--accent-red)',
    success: 'var(--accent-green)',
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', gap: '4px', cursor: 'text' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Connection status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
        fontSize: '10px', letterSpacing: '0.08em',
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: connected ? 'var(--accent-green)' : 'var(--accent-red)',
          boxShadow: connected ? 'var(--glow-green)' : 'var(--glow-red)',
          animation: connected ? 'pulse-orange 2s ease infinite' : 'none',
        }} />
        <span style={{ color: 'var(--text-muted)' }}>
          {connected ? (
            <>SESSION <span style={{ color: 'var(--accent-green)' }}>{currentTarget}</span></>
          ) : 'NO SESSION'}
        </span>
        {!connected && (
          <span style={{ color: 'var(--text-dim)', fontSize: '9px' }}>
            // connect &lt;ipv6&gt; to begin
          </span>
        )}
      </div>

      {/* Output area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        lineHeight: '1.55',
        background: 'var(--bg-panel-2)',
        border: '1px solid var(--border)',
        padding: '8px',
        borderRadius: '1px',
      }}>
        {lines.map(line => (
          <div key={line.id} style={{
            color: lineColor[line.type],
            textShadow: line.type === 'success' ? 'var(--glow-green)'
              : line.type === 'error' ? 'var(--glow-red)' : 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {line.text || '\u00A0'}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
        background: 'var(--bg-panel-2)',
        border: '1px solid var(--border)',
        padding: '4px 8px',
      }}>
        <span style={{
          color: connected ? 'var(--accent-green)' : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          whiteSpace: 'nowrap',
          textShadow: connected ? 'var(--glow-green)' : 'none',
          flexShrink: 0,
        }}>
          {prompt}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-green)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            padding: '0',
            outline: 'none',
            caretColor: 'var(--accent-green)',
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="cursor" style={{ flexShrink: 0 }} />
      </div>
    </div>
  );
}
