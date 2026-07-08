import { useState, useRef, useEffect, useCallback } from 'react';
import type { HackSession } from '../../hooks/useHackSession';

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
  'Connect to a target from SERVER LIST, or type HELP.',
  '',
];

const LOCAL_HELP = [
  'Available commands (when connected, most commands are sent to remote shell):',
  '  help             show this message',
  '  clear            clear terminal',
  '  disconnect       end session',
  '',
  'Remote shell commands are forwarded to the connected machine.',
];

let lineId = 0;

function makeLine(type: TerminalLine['type'], text: string): TerminalLine {
  return { id: lineId++, type, text };
}

function splitOutput(output: string): TerminalLine[] {
  if (!output.trim()) return [makeLine('output', '')];
  return output.split('\n').map(line => makeLine('output', line));
}

interface Props {
  session: HackSession;
}

export function Terminal({ session }: Props) {
  const [lines, setLines] = useState<TerminalLine[]>(() =>
    BANNER.map(t => makeLine('system', t))
  );
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const connected = session.phase === 'connected';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const addLines = useCallback((newLines: TerminalLine[]) => {
    setLines(prev => [...prev, ...newLines]);
  }, []);

  useEffect(() => {
    return session.subscribe((event) => {
      switch (event.type) {
        case 'started':
          addLines([
            makeLine('success', `Connected to ${event.ipv6}`),
            makeLine('system', 'Shell session established. Type HELP for commands.'),
            makeLine('output', ''),
          ]);
          break;
        case 'shell_output':
          addLines(splitOutput(event.output));
          break;
        case 'ended':
          addLines([
            makeLine('system', event.message ?? 'Session terminated.'),
            makeLine('output', ''),
          ]);
          break;
        case 'error':
          addLines([makeLine('error', event.message)]);
          break;
      }
    });
  }, [session, addLines]);

  const execCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const parts = trimmed.toLowerCase().split(/\s+/);
    const name = parts[0];

    if (name === 'help') {
      addLines(LOCAL_HELP.map(t => makeLine('output', t)));
      return;
    }

    if (name === 'clear') {
      setLines([]);
      return;
    }

    if (name === 'disconnect') {
      if (connected) {
        session.disconnect();
      } else {
        addLines([makeLine('error', 'No active session.')]);
      }
      return;
    }

    if (!connected) {
      addLines([makeLine('error', 'No active session. Use SERVER LIST to connect.')]);
      return;
    }

    session.sendShellCommand(trimmed);
  }, [connected, addLines, session]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = input;
      addLines([makeLine('input', `${session.shellPrompt} ${cmd}`)]);
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
          {session.shellPrompt}
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
