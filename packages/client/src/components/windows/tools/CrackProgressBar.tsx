import { useMemo } from 'react';
import { fakeThroughputKh } from '../../../utils/crackTiming';

const SEGMENTS = 20;

export type ProgressTone = 'neutral' | 'danger' | 'safe';

interface Props {
  percent: number;
  tone?: ProgressTone;
  seed?: string;
}

export function CrackProgressBar({ percent, tone = 'neutral', seed = '' }: Props) {
  const filled = Math.min(SEGMENTS, Math.round(percent / (100 / SEGMENTS)));
  const throughput = useMemo(
    () => (seed ? fakeThroughputKh(percent, seed) : 0),
    [percent, seed],
  );

  return (
    <div className="cracker-progress-row">
      <div className="cracker-progress-track" role="progressbar" aria-label="Crack progress" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const on = i < filled;
          const leading = on && i === filled - 1;
          const classes = [
            'cracker-progress-seg',
            on ? 'on' : '',
            leading ? 'leading' : '',
            on && tone !== 'neutral' ? tone : '',
          ].filter(Boolean).join(' ');
          return <div key={i} className={classes} />;
        })}
      </div>
      <div className="cracker-progress-meta">
        <strong>{percent}%</strong>
        {seed && <span>{throughput} kH/s</span>}
      </div>
    </div>
  );
}
