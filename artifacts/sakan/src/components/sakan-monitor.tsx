import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Check, Plus, Table2, LineChart as LineIcon, Trash2, X } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAED, type Listing } from '../sakan-data';
import { useMonitor } from '../hooks/use-monitor';
import {
  buildHistory, buildScenarios, scenarioAssumptions, scenarioEndpoints, summarizeHistory, monthAt,
  type MonitorMetric, type ScenarioKey,
} from '../monitor-data';
import { imageUrl, posterStyle } from './sakan-ui';
import './sakan-monitor.css';

export function MonitorToggle({ listing, variant = 'chip' }: { listing: Listing; variant?: 'chip' | 'ghost' }) {
  const { isMonitored, toggle } = useMonitor();
  const on = isMonitored(listing.id);
  return <button
    type="button"
    className={variant === 'ghost' ? 'rx-ghost rxm-ghost' : `rxm-toggle${on ? ' on' : ''}`}
    aria-pressed={on}
    aria-label={on ? `Stop monitoring ${listing.name}` : `Monitor ${listing.name}`}
    data-testid={`button-monitor-${listing.id}`}
    onClick={(event) => { event.stopPropagation(); toggle(listing.id); }}
  >{on ? <Check size={variant === 'ghost' ? 16 : 13} /> : <Activity size={variant === 'ghost' ? 16 : 13} />}{on ? 'Monitoring' : 'Monitor'}</button>;
}

const scenarioCopy: Record<ScenarioKey, { label: string; color: string }> = {
  downside: { label: 'Downside', color: '#ffb48a' },
  base: { label: 'Base', color: '#9be5ff' },
  upside: { label: 'Upside', color: '#b7f0c8' },
};
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`;
const signedAED = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatAED(Math.abs(n))}`;
const compactAED = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1000)}K`;

type ChartRow = { label: string; history?: number; downside?: number; base?: number; upside?: number };
const MetricSeg = Seg<MonitorMetric>;
const RangeSeg = Seg<2 | 3>;
const HorizonSeg = Seg<1 | 2 | 3>;

export function MonitorDashboard({ catalog, onOpenDetail, onBack }: { catalog: Listing[]; onOpenDetail: (id: string) => void; onBack: () => void }) {
  const { ids, error, add, remove, dismissError } = useMonitor();
  const monitored = useMemo(() => ids.flatMap((id) => { const l = catalog.find((x) => x.id === id); return l ? [l] : []; }), [ids, catalog]);
  const missing = ids.filter((id) => !catalog.some((x) => x.id === id));
  const [picked, setPicked] = useState<string | null>(null);
  const [metric, setMetric] = useState<MonitorMetric>('sale');
  const [range, setRange] = useState<2 | 3>(3);
  const [horizon, setHorizon] = useState<1 | 2 | 3>(2);
  const [showTable, setShowTable] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const active = monitored.find((l) => l.id === picked) || monitored[0] || null;
  const available = catalog.filter((l) => !ids.includes(l.id));

  const model = useMemo(() => {
    if (!active) return null;
    const current = metric === 'sale' ? active.price : active.rent;
    const history = buildHistory(active.id, metric, current).slice(-range * 12);
    const assumptions = scenarioAssumptions(active.id, metric);
    const projection = buildScenarios(current, assumptions, horizon);
    const endpoints = scenarioEndpoints(current, assumptions, horizon);
    const summary = summarizeHistory(history);
    const rows: ChartRow[] = [
      ...history.map((p, i) => i === history.length - 1
        ? { label: p.label, history: p.value, downside: p.value, base: p.value, upside: p.value }
        : { label: p.label, history: p.value }),
      ...projection.slice(1).map((p) => ({ label: p.label, downside: p.downside, base: p.base, upside: p.upside })),
    ];
    return { current, history, assumptions, projection, endpoints, summary, rows };
  }, [active, metric, range, horizon]);
  const unit = metric === 'sale' ? 'AED' : 'AED/year';
  const asOf = monthAt(0).label;

  return <div className="rx-page rxm">
    <div className="rx-toolbar">
      <div>
        <div className="sakan-eyebrow">Sample data · fictional prices</div>
        <h2>Monitor</h2>
        <p>Track illustrative price paths for sample properties. Your monitored list is kept only in this browser, not in your server workspace.</p>
      </div>
      <div className="rx-toolbar-controls">
        <button className="rx-cta" data-testid="button-monitor-add" onClick={() => setPickerOpen((v) => !v)} aria-expanded={pickerOpen}><Plus size={15} /> Add from sample catalogue</button>
        <button className="rx-ghost sm" data-testid="button-monitor-back" onClick={onBack}>Back</button>
      </div>
    </div>

    {error && <div className="sakan-error rxm-alert" role="alert" data-testid="status-monitor-storage"><AlertTriangle size={14} /><span>{error}</span><button onClick={dismissError} aria-label="Dismiss storage message"><X size={13} /></button></div>}
    <div className="sakan-sample-banner" data-testid="text-monitor-disclaimer"><AlertTriangle size={14} />Clearly labelled sample data. History is generated fictional figures for each sample property, not recorded transactions. Scenarios are simple compounding from the current sample figure at stated annual rates. They are not machine learning predictions, verified valuations or probabilities.</div>

    {pickerOpen && <section className="rxm-picker" aria-label="Sample catalogue" data-testid="section-monitor-picker">
      <div className="rxm-picker-head"><strong>Sample catalogue · {available.length} not yet monitored</strong><button className="sakan-icon-button" onClick={() => setPickerOpen(false)} aria-label="Close catalogue"><X size={15} /></button></div>
      {available.length === 0 ? <p className="sakan-note">Every sample property is already monitored.</p>
        : <div className="rxm-picker-grid">{available.map((l) => <button key={l.id} className="rxm-pick" data-testid={`button-monitor-pick-${l.id}`} onClick={() => { add(l.id); setPicked(l.id); }}>
          <span><strong>{l.name}</strong><small>{l.area} · {formatAED(l.price)} · {formatAED(l.rent)}/yr</small></span><Plus size={15} />
        </button>)}</div>}
    </section>}

    {missing.length > 0 && <div className="sakan-sample-banner">{missing.length} monitored ID{missing.length > 1 ? 's are' : ' is'} no longer in the sample catalogue. <button className="sakan-textbutton" onClick={() => missing.forEach(remove)}>Remove</button></div>}

    {!active || !model ? <div className="sakan-empty rxm-empty" data-testid="empty-monitor">
      <Activity size={26} /><h3>Nothing monitored yet</h3>
      <p>Pick any sample property to see three years of fictional monthly history and downside, base and upside scenarios. Nothing is added automatically.</p>
      <button className="rx-cta" onClick={() => setPickerOpen(true)}><Plus size={15} /> Browse the sample catalogue</button>
    </div> : <div className="rxm-layout">
      <aside className="rxm-list" aria-label="Monitored properties">
        <div className="rxm-list-head">Monitoring · {monitored.length}</div>
        {monitored.map((l) => {
          const s = summarizeHistory(buildHistory(l.id, metric, metric === 'sale' ? l.price : l.rent).slice(-range * 12));
          return <div key={l.id} className={`rxm-item${l.id === active.id ? ' on' : ''}`} data-testid={`row-monitor-${l.id}`}>
            <button className="rxm-item-main" aria-current={l.id === active.id} onClick={() => setPicked(l.id)} data-testid={`button-monitor-select-${l.id}`}>
              <span className="rxm-thumb"><img src={imageUrl} alt="" style={posterStyle(l.id).img} /></span>
              <span className="rxm-item-text"><strong>{l.name}</strong><small>{formatAED(metric === 'sale' ? l.price : l.rent)}{metric === 'rent' ? '/yr' : ''} · <em className={s.changePct >= 0 ? 'up' : 'down'}>{pct(s.changePct)}</em> {range}y</small></span>
            </button>
            <button className="sakan-icon-button" aria-label={`Remove ${l.name} from monitoring`} data-testid={`button-monitor-remove-${l.id}`} onClick={() => remove(l.id)}><Trash2 size={14} /></button>
          </div>;
        })}
      </aside>

      <section className="rxm-main" aria-labelledby="rxm-title">
        <div className="rxm-head">
          <div><div className="sakan-eyebrow">{active.area} · {active.type} · sample as of {asOf}</div><h3 id="rxm-title" data-testid="text-monitor-title">{active.name}</h3></div>
          <button className="rx-ghost sm" onClick={() => onOpenDetail(active.id)} data-testid="button-monitor-open-detail">Open details <ArrowRight size={13} /></button>
        </div>

        <div className="rxm-controls">
          <MetricSeg label="Metric" value={metric} onChange={setMetric} options={[['sale', 'Sale price'], ['rent', 'Annual rent']]} />
          <RangeSeg label="History range" value={range} onChange={setRange} options={[[2, '2y'], [3, '3y']]} />
          <HorizonSeg label="Scenario horizon" value={horizon} onChange={setHorizon} options={[[1, '1 year'], [2, '2 years'], [3, '3 years']]} />
        </div>

        <div className="rxm-stats">
          <Stat label={`Current sample ${metric === 'sale' ? 'price' : 'rent'}`} value={`${formatAED(model.current)}${metric === 'rent' ? ' / year' : ''}`} sub={asOf} testId="text-monitor-current" />
          <Stat label={`Change over ${range} years`} value={signedAED(model.summary.change)} sub={`${pct(model.summary.changePct)} since ${model.history[0].label}`} tone={model.summary.change >= 0 ? 'up' : 'down'} testId="text-monitor-change" />
          <Stat label="Largest monthly rise" value={model.summary.maxRise ? pct(model.summary.maxRise.pct) : '—'} sub={model.summary.maxRise ? `${model.summary.maxRise.label} · ${signedAED(model.summary.maxRise.change)}` : ''} />
          <Stat label="Largest monthly fall" value={model.summary.maxFall ? pct(model.summary.maxFall.pct) : '—'} sub={model.summary.maxFall ? `${model.summary.maxFall.label} · ${signedAED(model.summary.maxFall.change)}` : ''} />
          <Stat label="Average monthly move" value={`${model.summary.avgAbsPct.toFixed(2)}%`} sub="absolute, month to month" />
        </div>

        <div className="rxm-chart-head">
          <strong>{metric === 'sale' ? 'Sample sale price' : 'Sample annual rent'} · {unit}</strong>
          <button className="rx-ghost sm" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)} data-testid="button-monitor-table">{showTable ? <><LineIcon size={13} /> Show chart</> : <><Table2 size={13} /> Show data table</>}</button>
        </div>

        {showTable ? <div className="rxm-table-wrap" tabIndex={0}>
          <table className="rxm-table" data-testid="table-monitor">
            <caption>{active.name} · {metric === 'sale' ? 'sale price' : 'annual rent'} in {unit}. History is fictional sample data; projected rows are scenario arithmetic.</caption>
            <thead><tr><th scope="col">Month</th><th scope="col">Type</th><th scope="col">Sample history</th><th scope="col">Downside</th><th scope="col">Base</th><th scope="col">Upside</th></tr></thead>
            <tbody>
              {model.history.map((p) => <tr key={p.month}><th scope="row">{p.label}</th><td>History</td><td>{formatAED(p.value)}</td><td>—</td><td>—</td><td>—</td></tr>)}
              {model.projection.slice(1).map((p) => <tr key={p.month} className="proj"><th scope="row">{p.label}</th><td>Projected</td><td>—</td><td>{formatAED(p.downside)}</td><td>{formatAED(p.base)}</td><td>{formatAED(p.upside)}</td></tr>)}
            </tbody>
          </table>
        </div> : <div className="rxm-chart" role="img" aria-label={`Line chart of ${active.name} ${metric === 'sale' ? 'sale price' : 'annual rent'}: solid sample history from ${model.history[0].label} to ${asOf}, then dashed downside, base and upside scenarios for ${horizon} year${horizon > 1 ? 's' : ''}.`} data-testid="chart-monitor">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.rows} margin={{ top: 12, right: 14, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="rgba(155,229,255,.12)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#d5eaf5', fontSize: 10 }} interval="preserveStartEnd" minTickGap={28} tickLine={false} axisLine={{ stroke: '#28617e' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#d5eaf5', fontSize: 10 }} tickFormatter={compactAED} width={52} tickLine={false} axisLine={false} label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#d5eaf5', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#032b46', border: '1px solid #28617e', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#fff', fontWeight: 700 }}
                formatter={(value: number, name: string) => [`${formatAED(value)}${metric === 'rent' ? ' / year' : ''}`, name]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#d5eaf5' }} />
              <ReferenceLine x={asOf} stroke="#ffffff" strokeOpacity={0.45} label={{ value: 'Sample as of', fill: '#d5eaf5', fontSize: 10, position: 'insideTopLeft' }} />
              <Line name="Sample history" dataKey="history" stroke="#ffffff" strokeWidth={2.4} dot={false} connectNulls={false} isAnimationActive={false} />
              {(['upside', 'base', 'downside'] as ScenarioKey[]).map((key) => <Line key={key} name={`${scenarioCopy[key].label} scenario (${pct(model.assumptions[key])}/yr)`} dataKey={key} stroke={scenarioCopy[key].color} strokeWidth={key === 'base' ? 2.2 : 1.6} strokeDasharray="6 5" dot={false} connectNulls={false} isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>}

        <div className="rxm-scenarios">
          {model.endpoints.map((e) => <div key={e.key} className={`rxm-scenario ${e.key}`} data-testid={`text-scenario-${e.key}`}>
            <span className="rxm-swatch" style={{ borderColor: scenarioCopy[e.key].color }} />
            <div><small>{scenarioCopy[e.key].label} · assumes {pct(e.annualRate)} per year</small>
              <strong>{formatAED(e.value)}{metric === 'rent' ? ' / year' : ''}</strong>
              <em>{signedAED(e.change)} · {pct(e.changePct)} by {monthAt(horizon * 12).label}</em></div>
          </div>)}
        </div>
        <details className="rxm-method">
          <summary>How these numbers are made</summary>
          <ul>
            <li>History: 36 fictional monthly figures generated from the property ID, ending exactly at the current sample {metric === 'sale' ? 'price' : 'annual rent'} in {asOf}. The same property always shows the same history.</li>
            <li>Scenarios: current figure × (1 + annual rate)<sup>months / 12</sup>. Each rate is a fixed sample assumption for this property, shown beside its scenario.</li>
            <li>Solid line is sample history; dashed lines are projected scenario arithmetic. No scenario is more likely than another and no probability is implied.</li>
            <li>Not a valuation, market index, or investment advice. Check real transaction data before any decision.</li>
          </ul>
        </details>
      </section>
    </div>}
  </div>;
}

function Seg<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return <div className="rxm-seg-wrap"><span>{label}</span><div className="rx-seg" role="radiogroup" aria-label={label}>
    {options.map(([v, text]) => <button key={String(v)} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)} data-testid={`button-monitor-${label.toLowerCase().replace(/\s/g, '-')}-${v}`}>{text}</button>)}
  </div></div>;
}
function Stat({ label, value, sub, tone, testId }: { label: string; value: string; sub?: string; tone?: 'up' | 'down'; testId?: string }) {
  return <div className="rxm-stat" data-testid={testId}><small>{label}</small><strong className={tone}>{value}</strong>{sub && <span>{sub}</span>}</div>;
}
