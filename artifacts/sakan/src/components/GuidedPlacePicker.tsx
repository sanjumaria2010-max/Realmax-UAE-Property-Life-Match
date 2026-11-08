import { useMemo, useRef, useState } from 'react';
import { Briefcase, Check, Church, Dumbbell, Heart, MapPin, Pencil, Plus, School, Search, Sparkles, Trash2, X } from 'lucide-react';
import { areaKey, type Destination } from '../sakan-data';
import { KIND_OPTIONS, kindSlug, nearbySamplePlaces, samplePlacePoint } from '../sample-place-geometry';
import { DubaiStreetMap } from './DubaiStreetMap';
import './GuidedPlacePicker.css';

export type GuidedPlacePickerProps = {
  destinations: Destination[];
  /** Supported sample places from the catalog. Only these can be chosen. */
  places: string[];
  /** Validate + persist. Returns an error message, or '' on success. */
  onCommit: (destination: Destination, editingId: string | null) => string;
  onRemove: (id: string) => void;
};

type Row = { key: string; id: string | null; kind: string; label: string; query: string; place: string | null };

const kindIcon = { work: Briefcase, partner: Heart, school: School, worship: Church, sport: Dumbbell, custom: Sparkles } as const;
const defaultLabel: Record<string, string> = { Work: 'My work', 'Partner work': 'Partner work', School: 'School', Worship: 'Prayer', Sport: 'Sport', Custom: 'Custom place' };
const roleName: Record<string, string> = { Work: 'Work', 'Partner work': 'Partner', School: 'Child school', Worship: 'Prayer', Sport: 'Sport', Custom: 'Other' };
const CORE = ['Work', 'Partner work', 'School'] as const;
const slugId = (s: string) => s.replace(/\W+/g, '-').toLowerCase();

export function GuidedPlacePicker({ destinations, places, onCommit, onRemove }: GuidedPlacePickerProps) {
  const [row, setRow] = useState<Row | null>(null);
  const [tap, setTap] = useState<[number, number] | null>(null);
  const [focus, setFocus] = useState<{ key: string; place: string } | null>(null);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const nextKey = () => { seq.current += 1; return `r${seq.current}`; };

  const nearby = useMemo(() => tap ? nearbySamplePlaces(places, tap[0], tap[1]) : null, [tap, places]);
  const filtered = useMemo(() => {
    const q = (row?.query || '').trim().toLowerCase();
    return places.filter((p) => !q || p.toLowerCase().includes(q) || areaKey(p).toLowerCase().includes(q));
  }, [places, row?.query]);
  const missingCore = CORE.filter((k) => !destinations.some((d) => d.kind === k));

  const focusOn = (place: string | null) => { if (place && samplePlacePoint(place)) setFocus({ key: nextKey(), place }); };
  const canSwitch = () => {
    if (!row) return true;
    const original = destinations.find((d) => d.id === row.id);
    const dirty = original
      ? row.kind !== original.kind || row.label !== original.label || row.place !== original.place || !!row.query.trim()
      : !!(row.label.trim() || row.place || row.query.trim());
    return !dirty || window.confirm('Discard the unsaved changes to this place? Your saved places will not change.');
  };
  const start = (kind: string, place: string | null = null) => {
    if (!canSwitch()) return;
    setRow({ key: nextKey(), id: null, kind, label: '', query: '', place });
    setTap(null); setError(''); focusOn(place);
  };
  const edit = (d: Destination) => {
    if (row?.id === d.id || !canSwitch()) return;
    const kind = (KIND_OPTIONS as readonly string[]).includes(d.kind) ? d.kind : 'Custom';
    const ok = places.includes(d.place);
    setRow({ key: nextKey(), id: d.id, kind, label: d.label, query: '', place: ok ? d.place : null });
    setTap(null);
    setError(ok ? '' : 'This saved place is no longer supported. Choose a supported sample place.');
    focusOn(d.place);
  };
  const cancel = () => { setRow(null); setTap(null); setError(''); };
  const choose = (place: string) => {
    if (!places.includes(place)) { setError('That is not a supported sample place.'); return; }
    setTap(null); setError('');
    if (!row) { start(missingCore[0] || 'Custom', place); return; }
    setRow({ ...row, place, query: '' });
    focusOn(place);
  };
  const patch = (p: Partial<Row>) => setRow((r) => r ? { ...r, ...p } : r);
  const save = () => {
    if (!row) return;
    if (!row.place || !places.includes(row.place)) { setError('Choose one of the supported places first.'); return; }
    const editing = row.id ? destinations.find((d) => d.id === row.id) || null : null;
    if (row.id && !editing) { setError('This place no longer exists. Add it again instead.'); return; }
    const label = row.label.trim() || defaultLabel[row.kind] || row.kind;
    const base: Destination = editing ? { ...editing } : { id: '', kind: row.kind, label, place: row.place, address: '', frequency: row.kind === 'Worship' ? 1 : 5, mode: 'car', maxMinutes: 30, required: false, preferred: true };
    const next: Destination = { ...base, kind: row.kind, label, place: row.place, address: editing && editing.place === row.place ? editing.address : `${areaKey(row.place)} area, Dubai` };
    const message = onCommit(next, editing ? editing.id : null);
    if (message) { setError(message); return; }
    setRow(null); setTap(null); setError('');
  };
  const onSelectSaved = (id: string) => {
    const d = destinations.find((x) => x.id === id);
    if (!d) return;
    if (row) choose(d.place); else edit(d);
  };

  const editor = (r: Row) => {
    const I = kindIcon[kindSlug(r.kind)];
    return <div className={`gpp-editor kind-${kindSlug(r.kind)}`} data-testid="card-place-editor">
      <div className="gpp-editor-head">
        <span className="gpp-ico"><I size={15} /></span>
        <select className="gpp-kindselect" aria-label="Type of place" value={r.kind} onChange={(e) => patch({ kind: e.target.value })} data-testid="select-destination-kind">
          {KIND_OPTIONS.map((k) => <option key={k} value={k}>{roleName[k]}</option>)}
        </select>
        <input className="gpp-labelinput" maxLength={40} value={r.label} placeholder={defaultLabel[r.kind]} aria-label="Label (optional)" onChange={(e) => patch({ label: e.target.value })} data-testid="input-destination-label" />
      </div>
      {r.place
        ? <div className="gpp-cand" data-testid="status-candidate">
          <MapPin size={15} />
          <span><strong data-testid="text-candidate-place">{r.place}</strong><small>{areaKey(r.place)} approx. area centre · not saved yet</small></span>
          <button type="button" className="sakan-textbutton" onClick={() => patch({ place: null })} data-testid="button-change-place">Change</button>
        </div>
        : <>
          <label className="gpp-search">
            <Search size={15} aria-hidden="true" />
            <input type="search" autoFocus value={r.query} onChange={(e) => patch({ query: e.target.value })} placeholder="Search supported places" aria-label="Search supported places" data-testid="input-place-search" />
            {r.query && <button type="button" aria-label="Clear search" onClick={() => patch({ query: '' })}><X size={14} /></button>}
          </label>
          <ul className="gpp-list" role="listbox" aria-label="Supported sample places">
            {filtered.length === 0 && <li className="gpp-empty" data-testid="status-no-search-results">No match. Realmax only supports these sample places, not live addresses.</li>}
            {filtered.map((p) => <li key={p} role="option" aria-selected={false}>
              <button type="button" className="gpp-option" onClick={() => choose(p)} data-testid={`option-place-${slugId(p)}`}>
                <MapPin size={13} /><span><strong>{p}</strong><small>{areaKey(p)}{samplePlacePoint(p) ? '' : ' · not on map'}</small></span>
              </button></li>)}
          </ul>
          <p className="gpp-hint">Or tap a pin on the map.</p>
        </>}
      <div className="gpp-actions">
        <button type="button" className="sakan-secondary" onClick={cancel} data-testid="button-cancel-place">Cancel</button>
        <button type="button" className="sakan-primary" disabled={!r.place} onClick={save} data-testid="button-save-destination"><Check size={14} /> {r.id ? 'Save changes' : 'Save'}</button>
      </div>
    </div>;
  };

  return <div className="gpp" data-testid="guided-place-picker">
    <div className="gpp-panel">
      <div className="gpp-rows" aria-live="polite">
        {destinations.map((d, i) => {
          const I = kindIcon[kindSlug(d.kind)];
          if (row && row.id === d.id) return <div key={d.id} data-testid={`row-destination-${d.id}`}>{editor(row)}</div>;
          return <div key={d.id} className={`gpp-row kind-${kindSlug(d.kind)}`} data-testid={`row-destination-${d.id}`}>
            <button type="button" className="gpp-row-main" onClick={() => focusOn(d.place)} aria-label={`Show ${d.label} on map`} data-testid={`button-focus-destination-${d.id}`}>
              <span className="gpp-num">{i + 1}</span>
              <span className="gpp-row-text"><small><I size={11} /> {roleName[d.kind] || d.kind}</small><strong>{d.label}</strong><em>{d.place}</em></span>
            </button>
            <button type="button" className="sakan-icon-button" aria-label={`Edit ${d.label}`} onClick={() => edit(d)} data-testid={`button-edit-destination-${d.id}`}><Pencil size={14} /></button>
            <button type="button" className="sakan-icon-button" aria-label={`Remove ${d.label}`} onClick={() => { if (row?.id === d.id) cancel(); onRemove(d.id); }} data-testid={`button-remove-destination-${d.id}`}><Trash2 size={14} /></button>
          </div>;
        })}
        {row && !row.id && editor(row)}
        {missingCore.filter((k) => !(row && !row.id && row.kind === k)).map((k) => {
          const I = kindIcon[kindSlug(k)];
          return <button type="button" key={k} className={`gpp-slot kind-${kindSlug(k)}`} onClick={() => start(k)} data-testid={`button-add-${slugId(k)}`}>
            <span className="gpp-ico"><I size={15} /></span><span><strong>{k === 'Work' ? 'Where do you work?' : k === 'Partner work' ? 'Partner\u2019s work' : 'Children\u2019s school'}</strong><small>Optional · tap to add</small></span><Plus size={16} />
          </button>;
        })}
      </div>
      <div className="gpp-more">
        <span className="gpp-label">Add another</span>
        <div className="gpp-chips">
          {(['School', 'Worship', 'Sport', 'Custom', 'Work', 'Partner work'] as const).filter((k) => k !== 'Work' && k !== 'Partner work' ? true : !missingCore.includes(k)).map((k) => {
            const I = kindIcon[kindSlug(k)];
            return <button type="button" key={k} className={`gpp-chip kind-${kindSlug(k)}`} onClick={() => start(k)} data-testid={`button-add-more-${slugId(k)}`}><I size={13} />{k === 'School' ? 'Another child' : roleName[k]}</button>;
          })}
        </div>
      </div>
      {error && <div className="sakan-error" role="alert" data-testid="status-picker-error">{error}</div>}
      <p className="gpp-note">Seven sample places are supported. Pins are approximate area centres, not live address lookup.</p>
    </div>

    <div className="gpp-mapwrap">
      <DubaiStreetMap destinations={destinations} mono picker={{
        places, candidate: row && row.place && !(row.id && destinations.some((d) => d.id === row.id && d.place === row.place)) ? row.place : null, tap, onPick: choose,
        onMapTap: (lat, lng) => { setTap([lat, lng]); setError(''); },
        activeId: row ? row.id : destinations.find((d) => d.place === focus?.place)?.id ?? null, activeKind: row?.kind ?? null,
        focusPlace: focus?.place ?? null, focusKey: focus?.key ?? null, onSelectSaved,
      }}>
        {nearby && <div className="gpp-nearby" data-testid="card-nearby">
          <div className="gpp-nearby-head"><span>{nearby.length ? 'Supported places nearby' : 'No supported place here'}</span><button type="button" aria-label="Close nearby places" onClick={() => setTap(null)} data-testid="button-close-nearby"><X size={14} /></button></div>
          {nearby.length === 0 && <small data-testid="status-no-nearby">Only the seven sample places can be added. Try nearer a pin.</small>}
          {nearby.map((n) => <button type="button" key={n.place} className="gpp-option" onClick={() => choose(n.place)} data-testid={`button-nearby-${slugId(n.place)}`}>
            <MapPin size={13} /><span><strong>{n.place}</strong><small>{n.area} · {n.km.toFixed(1)} km</small></span></button>)}
        </div>}
      </DubaiStreetMap>
    </div>
  </div>;
}
