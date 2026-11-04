import { Check } from 'lucide-react';

export type JourneyStep = { key: string; label: string };
export type BriefLine = { label: string; value: string; stepKey: string };

/** Desktop "storyboard" rail: the brief builds up visibly as the user answers. Read-only except jumping back to completed steps. */
export function JourneyRail({ steps, index, lines, onJump }: { steps: JourneyStep[]; index: number; lines: BriefLine[]; onJump: (key: string) => void }) {
  const remaining = steps.length - index - 1;
  const pct = Math.round((index / Math.max(1, steps.length - 1)) * 100);
  return <aside className="rx-rail" aria-label="Your brief so far">
    <div className="rx-rail-head">
      <span className="rx-rail-kicker">Your storyboard</span>
      <strong>{remaining === 0 ? 'Ready for the reveal' : `${remaining} ${remaining === 1 ? 'scene' : 'scenes'} to go`}</strong>
      <div className="rx-rail-meter" aria-hidden="true"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>
    </div>
    <ol className="rx-rail-steps">
      {steps.map((step, i) => {
        const state = i < index ? 'done' : i === index ? 'now' : 'next';
        return <li key={step.key} className={state}>
          {state === 'done'
            ? <button type="button" onClick={() => onJump(step.key)} data-testid={`button-rail-${step.key}`} aria-label={`Revisit ${step.label}`}><span className="rx-rail-dot"><Check size={11} strokeWidth={3} /></span>{step.label}</button>
            : <span aria-current={state === 'now' ? 'step' : undefined}><span className="rx-rail-dot">{i + 1}</span>{step.label}</span>}
        </li>;
      })}
    </ol>
    <div className="rx-rail-ticket">
      {lines.map((line) => <div key={line.label} className="rx-rail-line"><span>{line.label}</span><strong>{line.value}</strong></div>)}
    </div>
  </aside>;
}
