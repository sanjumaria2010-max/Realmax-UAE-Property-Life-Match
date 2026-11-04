import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, MapPin, type LucideIcon } from 'lucide-react';
import { areaKey, type Destination } from '../sakan-data';

export const imageUrl = `${import.meta.env.BASE_URL}images/sakan-neighborhood.jpg`;
/** Decorative Dubai night photography (Pexels). Never used as listing imagery. */
export const cityImages = {
  marina: `${import.meta.env.BASE_URL}images/dubai-marina-night.jpg`,
  skyline: `${import.meta.env.BASE_URL}images/dubai-skyline-lights.jpg`,
};

const hash = (value: string) => [...value].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
const tints = ['rgba(10,123,180,.22)', 'rgba(5,65,115,.3)', 'rgba(45,175,220,.18)', 'rgba(5,45,85,.36)', 'rgba(15,125,175,.25)', 'rgba(20,75,130,.3)'];

/** Varies the crop of the single illustrative photograph so each poster reads differently. Not real property imagery. */
export function posterStyle(id: string): { img: CSSProperties; tint: CSSProperties } {
  const h = hash(id);
  return {
    img: { objectPosition: `${h % 100}% ${(h >> 7) % 100}%`, transform: `scale(${1.15 + ((h >> 3) % 40) / 100})` },
    tint: { background: `linear-gradient(${(h >> 5) % 360}deg, ${tints[h % tints.length]}, transparent 70%)` },
  };
}

export function Dialog({ titleId, children, onClose, wide = false }: { titleId: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
      if (event.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        const active = document.activeElement;
        if (!dialogRef.current.contains(active)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        else if (event.shiftKey && (active === first || active === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (active === last || active === dialogRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, []);
  return <div className="sakan-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
    <section ref={dialogRef} tabIndex={-1} className={`sakan-modal${wide ? ' sakan-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>{children}</section>
  </div>;
}

export function DubaiMap({ destinations }: { destinations: Destination[] }) {
  const labels: Array<[string, number, number]> = [['Dubai Marina', 72, 45], ['Downtown', 52, 34], ['DIFC', 56, 30], ['Jumeirah', 43, 48], ['Dubai Hills', 40, 30], ['JVC', 49, 59], ['Creek', 69, 27], ['Palm', 29, 39]];
  const coords: Record<string, [number, number]> = { DIFC: [58, 29], 'Dubai Marina': [72, 47], 'Al Barsha': [40, 48], 'Business Bay': [53, 36], 'Dubai Internet City': [63, 40], Jumeirah: [43, 48], JVC: [49, 59] };
  const colors = ['#4cc9ff', '#91e4ff', '#d1f6ff', '#54a9ef', '#43e0e5'];
  return <div className="sakan-map" role="img" aria-label="Illustrative schematic map of Dubai showing sample areas and destination markers">
    <svg viewBox="0 0 640 300" preserveAspectRatio="xMidYMid slice">
      <rect width="640" height="300" fill="#073650" />
      <path d="M0 182 C50 165 78 180 130 163 C190 144 203 177 250 155 C310 126 325 146 368 121 C415 95 448 109 485 77 C523 44 563 46 640 8 L640 0 L0 0Z" fill="#0a4a6e" />
      <path d="M23 18 C80 59 126 44 166 80 S238 103 273 135 S333 168 375 156 S444 137 479 166 S557 185 610 220" fill="none" stroke="#21668a" strokeWidth="17" strokeLinecap="round" />
      <path d="M80 289 C102 245 127 214 180 200 S254 179 278 146 S332 94 385 86 S475 69 543 15" fill="none" stroke="#3595c2" strokeWidth="10" strokeLinecap="round" />
      <path d="M320 276 C340 230 344 195 379 170 S429 148 470 121" fill="none" stroke="#9be5ff" strokeWidth="3" strokeDasharray="5 8" />
      {labels.map(([label, x, y]) => <g key={label} transform={`translate(${x * 6.4},${y * 3})`}><circle r="3" fill="#80c6e7" /><text x="7" y="3" fill="#ffffff" fontSize="9" fontFamily="DM Sans, sans-serif">{label}</text></g>)}
      {destinations.slice(0, 5).map((destination, i) => {
        const [x, y] = coords[areaKey(destination.place)] || [55, 40];
        return <g key={destination.id} transform={`translate(${x * 6.4},${y * 3})`}>
          <circle r="13" fill={colors[i % colors.length]} opacity=".18" /><circle r="7" fill={colors[i % colors.length]} stroke="#032b46" strokeWidth="2" />
          <text x="11" y="-9" fill="#ffffff" fontSize="8" fontWeight="700" fontFamily="DM Sans, sans-serif">{destination.label}</text>
        </g>;
      })}
    </svg>
    <div className="sakan-map-caption"><MapPin size={12} /> Schematic Dubai · illustrative locations, not navigation</div>
  </div>;
}

export type Option<T> = { value: T; label: string; sub?: string; icon?: LucideIcon };
export function Choice<T extends string | number>({ label, options, value, onChange, compact = false }: { label: string; options: Option<T>[]; value: T; onChange: (value: T) => void; compact?: boolean }) {
  const slug = label.toLowerCase().replace(/\W+/g, '-');
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const dir = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
    const at = Math.max(0, options.findIndex((option) => option.value === value));
    const nextIndex = (at + dir + options.length) % options.length;
    onChange(options[nextIndex].value);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role=radio]');
    buttons[nextIndex]?.focus();
  };
  return <div className={`rx-choices${compact ? ' compact' : ''}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
    {options.map((option, index) => {
      const on = option.value === value;
      const Icon = option.icon;
      return <button type="button" key={String(option.value)} role="radio" aria-checked={on} tabIndex={on || (index === 0 && !options.some((item) => item.value === value)) ? 0 : -1} className={`rx-choice${on ? ' on' : ''}`} onClick={() => onChange(option.value)} data-testid={`option-${slug}-${String(option.value)}`}>
        {Icon && <span className="rx-choice-icon"><Icon size={18} /></span>}
        <span className="rx-choice-text"><strong>{option.label}</strong>{option.sub && <small>{option.sub}</small>}</span>
        <span className="rx-choice-check" aria-hidden="true">{on && <Check size={14} strokeWidth={3} />}</span>
      </button>;
    })}
  </div>;
}

export function MoneyField({ id, label, hint, value, onChange, step = 1000, invalid = false }: { id: string; label: string; hint?: string; value: number; onChange: (value: number) => void; step?: number; invalid?: boolean }) {
  return <div className={`rx-money${invalid ? ' invalid' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <div className="rx-money-input"><span>AED</span><input id={id} data-testid={`input-${id}`} type="number" inputMode="numeric" min="0" step={step} value={value || ''} placeholder="0" aria-invalid={invalid} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} /></div>
    {hint && <small>{hint}</small>}
  </div>;
}

export function Row({ title, sub, children, testId }: { title: string; sub?: string; children: ReactNode; testId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [can, setCan] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setCan((prev) => prev.left === left && prev.right === right ? prev : { left, right });
  }, []);
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  });
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * .85, behavior: 'smooth' });
  return <section className="rx-row" data-testid={testId}>
    <div className="rx-row-head">
      <h3>{title}{sub && <span>{sub}</span>}</h3>
      {(can.left || can.right) && <div className="rx-row-controls">
        <button type="button" aria-label={`Scroll ${title} left`} disabled={!can.left} onClick={() => scroll(-1)}><ChevronLeft size={18} /></button>
        <button type="button" aria-label={`Scroll ${title} right`} disabled={!can.right} onClick={() => scroll(1)}><ChevronRight size={18} /></button>
      </div>}
    </div>
    <div ref={ref} className="rx-track" role="region" aria-label={`${title} — scrollable row`} tabIndex={0} onScroll={update}>{children}</div>
  </section>;
}
