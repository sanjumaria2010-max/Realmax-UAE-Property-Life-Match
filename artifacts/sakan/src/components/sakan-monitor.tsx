import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, BellRing, Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAED, type Listing } from '../sakan-data';
import { useMonitor } from '../hooks/use-monitor';
import { usePriceAlerts } from '../hooks/use-price-alerts';
import { evaluatePriceAlert } from '../price-alerts-data';
import {
  buildHistory, buildScenarios, scenarioAssumptions, scenarioEndpoints, summarizeHistory, monthAt,
  type MonitorMetric, type ScenarioKey,
} from '../monitor-data';
import './sakan-monitor.css';

export function MonitorToggle({ listing, variant = 'chip', onOpen }: { listing: Listing; variant?: 'chip' | 'ghost'; onOpen: (id: string) => void }) {
  const { isMonitored } = useMonitor();
  const on = isMonitored(listing.id);
  return <button
    type="button"
    className={variant === 'ghost' ? 'rx-ghost rxm-ghost' : `rxm-toggle${on ? ' on' : ''}`}
    aria-label={`Open monitoring for ${listing.name}`}
    data-testid={`button-monitor-${listing.id}`}
    onClick={(event) => { event.stopPropagation(); onOpen(listing.id); }}
  >{on ? <Check size={variant === 'ghost' ? 16 : 13} /> : <Activity size={variant === 'ghost' ? 16 : 13} />}{on ? 'Monitoring' : 'Monitor'}</button>;
}

const scenarioCopy: Record<ScenarioKey, { label: string; color: string }> = {
  downside: { label: 'Downside', color: '#ffb48a' },
  base: { label: 'Base', color: '#4cc9ff' },
  upside: { label: 'Upside', color: '#b7f0c8' },
};
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`;
const signedAED = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatAED(Math.abs(n))}`;
const compactAED = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1000)}K`;
const parseBound = (s: string): number | null | 'bad' => {
  const t = s.trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : 'bad';
};

type ChartRow = { label: string; history?: number; downside?: number; base?: number; upside?: number };
const MetricSeg = Seg<MonitorMetric>;
const RangeSeg = Seg<2 | 3>;
const HorizonSeg = Seg<1 | 2 | 3>;

export function MonitorDashboard({ catalog, propertyId, onPropertyChange, onOpenDetail, onBack }: { catalog: Listing[]; propertyId: string | null; onPropertyChange: (id: string) => void; onOpenDetail: (id: string) => void; onBack: () => void }) {
  const { ids, error, add, remove, dismissError } = useMonitor();
  const alerts = usePriceAlerts();
  const monitored = useMemo(() => ids.flatMap((id) => { const l = catalog.find((x) => x.id === id); return l ? [l] : []; }), [ids, catalog]);
  const missing = ids.filter((id) => !catalog.some((x) => x.id === id));
  const available = catalog.filter((l) => !ids.includes(l.id));
  const [metric, setMetric] = useState<MonitorMetric>('sale');
  const [range, setRange] = useState<2 | 3>(3);
  const [horizon, setHorizon] = useState<1 | 2 | 3>(2);
  const [showForecast, setShowForecast] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const active = catalog.find((l) => l.id === propertyId) || monitored[0] || catalog[0] || null;
  const isMonitored = !!active && ids.includes(active.id);

  const model = useMemo(() => {
    if (!active) return null;
    const current = metric === 'sale' ? active.price : active.rent;
    const history = buildHistory(active.id, metric, current).slice(-range * 12);
    const assumptions = scenarioAssumptions(active.id, metric);
    const projection = buildScenarios(current, assumptions, horizon);
    const endpoints = scenarioEndpoints(current, assumptions, horizon);
    const summary = summarizeHistory(history);
    const low = Math.min(...history.map((p) => p.value));
    const high = Math.max(...history.map((p) => p.value));
    return { current, history, assumptions, projection, endpoints, summary, low, high };
  }, [active, metric, range, horizon]);

  const rows: ChartRow[] = useMemo(() => {
    if (!model) return [];
    const hist = model.history.map((p, i) => showForecast && i === model.history.length - 1
      ? { label: p.label, history: p.value, downside: p.value, base: p.value, upside: p.value }
      : { label: p.label, history: p.value });
    return showForecast ? [...hist, ...model.projection.slice(1).map((p) => ({ label: p.label, downside: p.downside, base: p.base, upside: p.upside }))] : hist;
  }, [model, showForecast]);

  const unit = metric === 'sale' ? 'AED' : 'AED/year';
  const asOf = monthAt(0).label;
  const ruleKey = active ? `${active.id}:${metric}` : '';
  const rule = active ? alerts.rules[ruleKey] : undefined;

  const [minStr, setMinStr] = useState('');
  const [maxStr, setMaxStr] = useState('');
  const [formMsg, setFormMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [simStr, setSimStr] = useState('');
  const [simResult, setSimResult] = useState<{ state: string; message: string } | null>(null);
  const ruleMin = rule?.min ?? null;
  const ruleMax = rule?.max ?? null;
  useEffect(() => {
    setMinStr(ruleMin === null ? '' : String(ruleMin));
    setMaxStr(ruleMax === null ? '' : String(ruleMax));
  }, [ruleKey, ruleMin, ruleMax]);
  useEffect(() => { setFormMsg(null); setSimResult(null); setSimStr(''); }, [ruleKey]);
  useEffect(() => { setSimResult(null); }, [ruleKey, ruleMin, ruleMax]);

  const saveAlert = () => {
    if (!active) return;
    const min = parseBound(minStr);
    const max = parseBound(maxStr);
    if (min === 'bad' || max === 'bad') { setFormMsg({ tone: 'bad', text: 'Enter amounts above zero, or leave a bound empty.' }); return; }
    if (min === null && max === null) { setFormMsg({ tone: 'bad', text: 'Set a minimum, a maximum, or both.' }); return; }
    if (min !== null && max !== null && min >= max) { setFormMsg({ tone: 'bad', text: 'Minimum must be lower than maximum.' }); return; }
    const err = alerts.save(active.id, metric, min, max);
    if (err) { setFormMsg({ tone: 'bad', text: err }); return; }
    if (!isMonitored) add(active.id);
    setFormMsg({ tone: 'ok', text: `Alert saved in this browser${isMonitored ? '' : ' and property added to Monitor'}.` });
  };
  const removeAlert = () => {
    if (!active) return;
    const err = alerts.remove(active.id, metric);
    setFormMsg(err ? { tone: 'bad', text: err } : { tone: 'ok', text: 'Alert removed.' });
  };
  const runSim = () => {
    const v = parseBound(simStr);
    if (v === null || v === 'bad') { setSimResult({ state: 'bad', message: 'Enter a test amount above zero.' }); return; }
    setSimResult(evaluatePriceAlert(rule, v));
  };
  const currentStatus = model ? evaluatePriceAlert(rule, model.current) : null;

  if (!active || !model) return <div className="rx-page rxm">
    <div className="rxm-card rxm-empty" data-testid="empty-monitor"><Activity size={26} /><h3>No sample properties available</h3>
      <button className="rxm-btn" onClick={onBack} data-testid="button-monitor-back">Back</button></div>
  </div>;

  const up = model.summary.change >= 0;

  return <div className="rx-page rxm">
    <header className="rxm-bar">
      <button className="rxm-icon" onClick={onBack} aria-label="Back" data-testid="button-monitor-back"><ArrowLeft size={16} /></button>
      <label className="rxm-select">
        <span className="rxm-sr">Property</span>
        <select value={active.id} onChange={(e) => onPropertyChange(e.target.value)} data-testid="select-monitor-property">
          {monitored.length > 0 && <optgroup label={`Monitoring (${monitored.length})`}>
            {monitored.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.area}</option>)}
          </optgroup>}
          {available.length > 0 && <optgroup label="Sample catalogue">
            {available.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.area}</option>)}
          </optgroup>}
        </select>
        <ChevronDown size={15} aria-hidden />
      </label>
      <MetricSeg label="Metric" value={metric} onChange={setMetric} options={[['sale', 'Sale'], ['rent', 'Rent']]} />
      <RangeSeg label="History range" value={range} onChange={setRange} options={[[2, '2y'], [3, '3y']]} />
      <div className="rxm-bar-end">
        {isMonitored
          ? <button className="rxm-btn ghost" onClick={() => remove(active.id)} data-testid={`button-monitor-remove-${active.id}`}><Trash2 size={14} /> Stop monitoring</button>
          : <button className="rxm-btn" onClick={() => add(active.id)} data-testid="button-monitor-add"><Plus size={14} /> Monitor</button>}
      </div>
    </header>

    {error && <div className="rxm-note bad" role="alert" data-testid="status-monitor-storage"><AlertTriangle size={14} /><span>{error}</span><button onClick={dismissError} aria-label="Dismiss storage message"><X size={13} /></button></div>}
    {missing.length > 0 && <div className="rxm-note">{missing.length} monitored ID{missing.length > 1 ? 's are' : ' is'} no longer in the sample catalogue. <button className="rxm-link" onClick={() => missing.forEach(remove)} data-testid="button-monitor-remove-missing">Remove</button></div>}

    <div className="rxm-grid">
      <section className="rxm-card rxm-graph" aria-labelledby="rxm-title">
        <div className="rxm-graph-head">
          <div>
            <div className="rxm-tags">
              <span className="rxm-tag sample" data-testid="text-monitor-disclaimer">Sample data</span>
              {!isMonitored && <span className="rxm-tag preview" data-testid="status-monitor-preview">Sample preview · not monitored</span>}
            </div>
            <h2 id="rxm-title" data-testid="text-monitor-title">{active.name}</h2>
          </div>
          <div className="rxm-now">
            <strong data-testid="text-monitor-current">{formatAED(model.current)}{metric === 'rent' ? <small> /yr</small> : null}</strong>
            <span className={up ? 'up' : 'down'} data-testid="text-monitor-change">{signedAED(model.summary.change)} · {pct(model.summary.changePct)} in {range}y</span>
          </div>
        </div>

        <div className="rxm-chart" role="img" aria-label={`Line chart of ${active.name} ${metric === 'sale' ? 'sale price' : 'annual rent'}: fictional sample history from ${model.history[0].label} to ${asOf}${showForecast ? `, then dashed downside, base and upside scenarios for ${horizon} year${horizon > 1 ? 's' : ''}` : ''}.`} data-testid="chart-monitor">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#28617e" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#d5eaf5', fontSize: 11 }} interval="preserveStartEnd" minTickGap={36} tickLine={false} axisLine={{ stroke: '#28617e' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#d5eaf5', fontSize: 11 }} tickFormatter={compactAED} width={54} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#032b46', border: '1px solid #28617e', borderRadius: 10, fontSize: 12, color: '#fff' }} labelStyle={{ color: '#fff', fontWeight: 700 }}
                formatter={(value: number, name: string) => [`${formatAED(value)}${metric === 'rent' ? ' / year' : ''}`, name]} />
              {rule?.min != null && <ReferenceLine y={rule.min} stroke="#ffb48a" strokeDasharray="3 4" label={{ value: 'Min alert', fill: '#ffb48a', fontSize: 10, position: 'insideBottomRight' }} />}
              {rule?.max != null && <ReferenceLine y={rule.max} stroke="#b7f0c8" strokeDasharray="3 4" label={{ value: 'Max alert', fill: '#b7f0c8', fontSize: 10, position: 'insideTopRight' }} />}
              {showForecast && <ReferenceLine x={asOf} stroke="#ffffff" strokeOpacity={0.3} />}
              <Line name="Sample history" type="linear" dataKey="history" stroke="#ffffff" strokeWidth={2.6} dot={false} connectNulls={false} isAnimationActive={false} />
              {showForecast && (['upside', 'base', 'downside'] as ScenarioKey[]).map((key) => <Line key={key} name={`${scenarioCopy[key].label} (${pct(model.assumptions[key])}/yr)`} dataKey={key} stroke={scenarioCopy[key].color} strokeWidth={key === 'base' ? 2 : 1.5} strokeDasharray="6 5" dot={false} connectNulls={false} isAnimationActive={false} />)}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="rxm-chart-foot">Fictional sample history in {unit}, as of {asOf}. Not recorded transactions.</p>

        <div className="rxm-subbar">
          <button className="rxm-btn ghost sm" aria-expanded={showForecast} onClick={() => setShowForecast((v) => !v)} data-testid="button-monitor-forecast">{showForecast ? 'Hide' : 'Show'} future scenarios</button>
          {showForecast && <HorizonSeg label="Scenario horizon" value={horizon} onChange={setHorizon} options={[[1, '1y'], [2, '2y'], [3, '3y']]} />}
        </div>
        {showForecast && <div className="rxm-scenarios">
          {model.endpoints.map((e) => <div key={e.key} className="rxm-scenario" data-testid={`text-scenario-${e.key}`}>
            <span className="rxm-swatch" style={{ borderColor: scenarioCopy[e.key].color }} />
            <div><small>{scenarioCopy[e.key].label} · {pct(e.annualRate)}/yr</small>
              <strong>{formatAED(e.value)}</strong>
              <em>{pct(e.changePct)} by {monthAt(horizon * 12).label}</em></div>
          </div>)}
        </div>}
      </section>

      <aside className="rxm-side">
        <section className="rxm-card rxm-alerts" aria-labelledby="rxm-alert-title">
          <h3 id="rxm-alert-title"><BellRing size={15} /> Price alert</h3>
          <p className="rxm-muted">Checked against the sample {metric === 'sale' ? 'price' : 'rent'} while this page is open. Stored in this browser only; no email or push.</p>
          {alerts.error && <p className="rxm-msg bad" role="alert">{alerts.error}</p>}
          <form onSubmit={(e) => { e.preventDefault(); saveAlert(); }} noValidate>
            <label className="rxm-field"><span>Minimum ({unit})</span>
              <input inputMode="numeric" value={minStr} onChange={(e) => setMinStr(e.target.value)} placeholder={String(Math.round(model.low))} data-testid="input-alert-min" /></label>
            <label className="rxm-field"><span>Maximum ({unit})</span>
              <input inputMode="numeric" value={maxStr} onChange={(e) => setMaxStr(e.target.value)} placeholder={String(Math.round(model.high))} data-testid="input-alert-max" /></label>
            <div className="rxm-row">
              <button type="submit" className="rxm-btn" data-testid="button-alert-save">Save alert</button>
              {rule && <button type="button" className="rxm-btn ghost" onClick={removeAlert} data-testid="button-alert-remove"><Trash2 size={13} /> Remove</button>}
            </div>
          </form>
          <div role="status" aria-live="polite" data-testid="status-alert">
            {formMsg && <p className={`rxm-msg ${formMsg.tone}`}>{formMsg.text}</p>}
            {currentStatus && rule && <p className={`rxm-state ${currentStatus.state}`} data-testid="status-alert-current">{currentStatus.message}</p>}
          </div>
          <details className="rxm-sim" open={simOpen} onToggle={(e) => setSimOpen((e.target as HTMLDetailsElement).open)}>
            <summary data-testid="button-alert-sim-toggle">Try a sample price</summary>
            <p className="rxm-muted">Tests your thresholds only. The chart and sample price do not change.</p>
            <div className="rxm-row">
              <input aria-label={`Test amount in ${unit}`} inputMode="numeric" value={simStr} onChange={(e) => setSimStr(e.target.value)} placeholder={String(model.current)} data-testid="input-alert-sample" />
              <button type="button" className="rxm-btn ghost" onClick={runSim} data-testid="button-alert-test">Check</button>
            </div>
            {simResult && <p className={`rxm-state ${simResult.state}`} role="status" data-testid="status-alert-sample">{simResult.message}</p>}
          </details>
        </section>

        <section className="rxm-card rxm-meta" aria-label="Property details">
          <dl>
            <div><dt>Area</dt><dd>{active.area}</dd></div>
            <div><dt>Type</dt><dd>{active.type}</dd></div>
            <div><dt>Beds / baths</dt><dd>{active.beds} / {active.baths}</dd></div>
            <div><dt>Size</dt><dd>{active.sqft.toLocaleString('en-AE')} sqft</dd></div>
            <div><dt>Sale</dt><dd>{formatAED(active.price)}</dd></div>
            <div><dt>Rent</dt><dd>{formatAED(active.rent)}/yr</dd></div>
            <div><dt>Status</dt><dd>{active.ready ? 'Ready' : 'Off-plan'}</dd></div>
          </dl>
          <button className="rxm-btn ghost full" onClick={() => onOpenDetail(active.id)} data-testid="button-monitor-open-detail">Open details <ArrowRight size={13} /></button>
        </section>
      </aside>
    </div>

    <section className="rxm-card rxm-history" aria-label="Historical information">
      <dl className="rxm-facts">
        <div><dt>{range}y low</dt><dd>{formatAED(model.low)}</dd></div>
        <div><dt>{range}y high</dt><dd>{formatAED(model.high)}</dd></div>
        <div><dt>Largest monthly rise</dt><dd className="up">{model.summary.maxRise ? `${pct(model.summary.maxRise.pct)} · ${model.summary.maxRise.label}` : '—'}</dd></div>
        <div><dt>Largest monthly fall</dt><dd className="down">{model.summary.maxFall ? `${pct(model.summary.maxFall.pct)} · ${model.summary.maxFall.label}` : '—'}</dd></div>
        <div><dt>Avg monthly move</dt><dd>{model.summary.avgAbsPct.toFixed(2)}%</dd></div>
      </dl>

      <details className="rxm-disc" open={showTable} onToggle={(e) => setShowTable((e.target as HTMLDetailsElement).open)}>
        <summary data-testid="button-monitor-table">Monthly data table</summary>
        {showTable && <div className="rxm-table-wrap" tabIndex={0}>
          <table className="rxm-table" data-testid="table-monitor">
            <caption>{active.name} · {metric === 'sale' ? 'sale price' : 'annual rent'} in {unit}. Fictional sample history{showForecast ? '; projected rows are scenario arithmetic' : ''}.</caption>
            <thead><tr><th scope="col">Month</th><th scope="col">Type</th><th scope="col">Sample history</th>{showForecast && <><th scope="col">Downside</th><th scope="col">Base</th><th scope="col">Upside</th></>}</tr></thead>
            <tbody>
              {[...model.history].reverse().map((p) => <tr key={p.month}><th scope="row">{p.label}</th><td>History</td><td>{formatAED(p.value)}</td>{showForecast && <><td>—</td><td>—</td><td>—</td></>}</tr>)}
              {showForecast && model.projection.slice(1).map((p) => <tr key={p.month} className="proj"><th scope="row">{p.label}</th><td>Projected</td><td>—</td><td>{formatAED(p.downside)}</td><td>{formatAED(p.base)}</td><td>{formatAED(p.upside)}</td></tr>)}
            </tbody>
          </table>
        </div>}
      </details>
      <details className="rxm-disc">
        <summary data-testid="button-monitor-method">Methodology and disclosure</summary>
        <ul>
          <li>History: fictional monthly figures generated from the property ID, ending at the current sample {metric === 'sale' ? 'price' : 'annual rent'} in {asOf}. The same property always shows the same history.</li>
          <li>Scenarios (opt-in): current figure × (1 + annual rate)<sup>months / 12</sup>, using a fixed sample rate per property. Not machine learning predictions or probabilities.</li>
          <li>Alerts compare thresholds to the sample figure in this browser while the page is open. They are not live market alerts.</li>
          <li>Not a valuation, market index, or investment advice. Check real transaction data before any decision.</li>
        </ul>
      </details>
    </section>
  </div>;
}

function Seg<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return <div className="rxm-seg" role="radiogroup" aria-label={label}>
    {options.map(([v, text]) => <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)} data-testid={`button-monitor-${label.toLowerCase().replace(/\s/g, '-')}-${v}`}>{text}</button>)}
  </div>;
}
