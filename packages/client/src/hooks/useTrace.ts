import { useState, useEffect, useRef } from 'react';

export interface TraceState {
  active: boolean;
  /** 0–100 */
  percent: number;
  /** seconds remaining */
  secondsLeft: number;
  level: 'safe' | 'warning' | 'critical' | 'caught';
}

const TRACE_DURATION_S = 120;

export function useTrace(active: boolean) {
  const [trace, setTrace] = useState<TraceState>({
    active: false,
    percent: 0,
    secondsLeft: TRACE_DURATION_S,
    level: 'safe',
  });
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
      setTrace({ active: false, percent: 0, secondsLeft: TRACE_DURATION_S, level: 'safe' });
      return;
    }

    startRef.current = Date.now();

    const tick = () => {
      if (!startRef.current) return;
      const elapsed = (Date.now() - startRef.current) / 1000;
      const percent = Math.min(100, (elapsed / TRACE_DURATION_S) * 100);
      const secondsLeft = Math.max(0, TRACE_DURATION_S - elapsed);
      let level: TraceState['level'] = 'safe';
      if (percent >= 100) level = 'caught';
      else if (percent >= 75) level = 'critical';
      else if (percent >= 50) level = 'warning';

      setTrace({ active: true, percent, secondsLeft, level });

      if (percent < 100) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active]);

  return trace;
}
