import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Church, Dumbbell, Heart, MapPin, Pencil, School, Search, Sparkles, Trash2, Briefcase, X } from 'lucide-react';
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

const kindIcon = { work: Briefcase, partner: Heart, school: School, worship: Church, sport: Dumbbell, custom: Sparkles } as const;
const defaultLabel = (kind: string) => kind === 'Work' ? 'My work' : kind === 'Custom' ? 'Custom place' : kind;

export function GuidedPlacePicker({ destinations, places, onCommit, onRemove }: GuidedPlacePickerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [candidate, setCandidate] = useState<string | null>(null);
  const [tap, setTap] = useState<[number, number] | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [kind, setKind] = useState<string>('Work');
  const [label, setLabel] = useState('');
  const [localError, setLocalError] = useState('');
  const stepCardRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(0);
  const [token, setToken] = useState(0);
  const bump = () => { tokenRef.current += 1; setToken(tokenRef.current); };

  const editing = editingId ? destinations.find((d) => d.id === editingId) || null : null;
  const mappable = useMemo(() => places.filter((p) => samplePlacePoint(p)), [places]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((p) => !q || p.toLowerCase().includes(q) || areaKey(p).toLowerCase().includes(q));
  }, [places, query]);
  const nearby = useMemo(() => tap ? nearbySamplePlaces(places, tap[0], tap[1]) : null, [tap, places]);
  useEffect(() => {
    if (candidate || confirmed) stepCardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [candidate, confirmed]);

  const resetAll = () => {
    bump();
    setEditingId(null); setQuery(''); setCandidate(null); setTap(null); setConfirmed(null);
    setKind('Work'); setLabel(''); setLocalError('');
  };
  const pick = (place: string) => {
    if (!places.includes(place)) { setLocalError('That is not a supported sample place.'); return; }
    bump(); setCandidate(place); setLocalError('');
  };
  const onMapTap = (lat: number, lng: number) => {
    if (confirmed) return;
    bump(); setTap([lat, lng]); setCandidate(null); setLocalError('');
  };
  const onSearch = (value: string) => {
    bump(); setQuery(value); setCandidate(null); setTap(null); setLocalError('');
  };
  const confirm = (forPlace: string, forToken: number) => {
    if (forToken !== tokenRef.current || forPlace !== candidate || !places.includes(forPlace)) {
      setLocalError('Your selection changed. Choose the place again, then confirm.');
      return;
    }
    bump(); setConfirmed(forPlace); setCandidate(null); setTap(null); setLocalError('');
  };
  const changePlace = () => { bump(); setCandidate(confirmed); setConfirmed(null); setLocalError(''); };
  const chooseKind = (next: string) => { setKind(next); setLocalError(''); };
  const startEdit = (d: Destination) => {
    bump();
    setEditingId(d.id); setQuery(''); setTap(null); setCandidate(null);
    setConfirmed(places.includes(d.place) ? d.place : null);
    const knownKind = (KIND_OPTIONS as readonly string[]).includes(d.kind) ? d.kind : 'Custom';
    setKind(knownKind);
    setLabel(d.label === defaultLabel(knownKind) ? '' : d.label);
    setLocalError(places.includes(d.place) ? '' : 'This saved place is no longer supported. Choose a supported sample place.');
  };
  const save = () => {
    if (!confirmed) { setLocalError('Confirm a supported sample place first.'); return; }
    const finalLabel = label.trim() || defaultLabel(kind);
    const base: Destination = editing
      ? { ...editing }
      : { id: '', kind, label: finalLabel, place: confirmed, address: '', frequency: kind === 'Worship' ? 1 : 5, mode: 'car', maxMinutes: 30, required: false, preferred: true };
    const next: Destination = { ...base, kind, label: finalLabel, place: confirmed, address: editing?.place === confirmed ? editing.address : `${areaKey(confirmed)} area, Dubai` };
    const message = onCommit(next, editing ? editing.id : null);
    if (message) { setLocalError(message); return; }
    resetAll();
  };

  const KindIcon = kindIcon[kindSlug(kind)];
  const stage = confirmed ? 'kind' : candidate ? 'confirm' : 'find';
  const prompt = editing ? `Editing ${editing.label}` : stage === 'kind' ? 'Who is this place for?' : 'Find a place in your week';

  return <div className="gpp" data-testid="guided-place-picker">
    <div className="gpp-prompt">
      <span className="gpp-step" aria-hidden="true">{stage === 'kind' ? '2' : '1'}</span>
      <div>
        <strong data-testid="text-picker-prompt">{prompt}</strong>
        <small>{stage === 'kind' ? 'Tag it, add a short label if you like, then save. Frequency and travel time come next.' : 'Search the supported sample places, pick a marker, or tap the map near where you go.'}</small>
      </div>
    </div>

    {stage !== 'kind' && <label className="gpp-search">
      <Search size={16} aria-hidden="true" />
      <input type="search" value={query} onChange={(e) => onSearch(e.target.value)} placeholder="Search supported sample places" aria-label="Search supported sample places" data-testid="input-place-search" />
      {query && <button type="button" aria-label="Clear search" onClick={() => onSearch('')}><X size={14} /></button>}
    </label>}

    <DubaiStreetMap destinations={destinations} picker={{ places: confirmed ? [confirmed] : mappable, candidate: confirmed || candidate, tap, onPick: (place) => { if (!confirmed) pick(place); }, onMapTap }} />

    <ul className="gpp-legend" aria-label="Map legend">
      {KIND_OPTIONS.map((k) => <li key={k}><i className={`gpp-dot kind-${kindSlug(k)}`} />{k}</li>)}
      <li><i className="gpp-dot sample" />Supported sample place</li>
      <li><i className="gpp-dot candidate" />{confirmed ? 'Confirmed selection, not saved' : 'Selected, not confirmed'}</li>
    </ul>

    <div ref={stepCardRef} className="gpp-card" aria-live="polite" data-testid="card-place-step">
      {stage !== 'kind' && nearby && !candidate && (nearby.length
        ? <div className="gpp-near"><div className="gpp-label">Supported sample places near your tap</div>
          {nearby.map((n) => <button type="button" key={n.place} className="gpp-option" onClick={() => pick(n.place)} data-testid={`button-nearby-${kindSlug(n.place)}-${n.place.replace(/\W+/g, '-').toLowerCase()}`}>
            <MapPin size={14} /><span><strong>{n.place}</strong><small>{n.area} area centre · about {n.km.toFixed(1)} km from tap</small></span></button>)}
        </div>
        : <div className="gpp-none" data-testid="status-no-nearby"><strong>No supported place near here</strong><span>Realmax only has sample travel data for the places listed below. Try another spot or pick from the list.</span></div>)}

      {stage === 'confirm' && candidate && <div className="gpp-confirm">
        <div><div className="gpp-label">Selected · not saved yet</div><strong data-testid="text-candidate-place">{candidate}</strong><small>{areaKey(candidate)} approximate area centre, not an exact address</small></div>
        <div className="gpp-actions">
          <button type="button" className="sakan-secondary" onClick={() => { bump(); setCandidate(null); }} data-testid="button-cancel-candidate">Not this</button>
          <button type="button" className="sakan-primary" onClick={() => confirm(candidate, token)} data-testid="button-confirm-place"><Check size={14} /> Confirm place</button>
        </div>
      </div>}

      {stage === 'find' && !nearby && <div className="gpp-label">Supported sample places{query ? ` matching "${query}"` : ''}</div>}
      {stage !== 'kind' && <ul className="gpp-list" role="listbox" aria-label="Supported sample places">
        {filtered.length === 0 && <li className="gpp-empty" data-testid="status-no-search-results">No supported sample place matches. Realmax cannot add other addresses yet.</li>}
        {filtered.map((p) => <li key={p} role="option" aria-selected={p === candidate}>
          <button type="button" className={`gpp-option${p === candidate ? ' on' : ''}`} onClick={() => pick(p)} data-testid={`option-place-${p.replace(/\W+/g, '-').toLowerCase()}`}>
            <MapPin size={14} /><span><strong>{p}</strong><small>{areaKey(p)} area centre{samplePlacePoint(p) ? '' : ' · not shown on map'}</small></span>{p === candidate && <Check size={14} />}
          </button></li>)}
      </ul>}

      {stage === 'kind' && confirmed && <div className="gpp-kind">
        <div className="gpp-confirmed"><Check size={14} /><span><strong data-testid="text-confirmed-place">{confirmed}</strong><small>{areaKey(confirmed)} approximate area centre</small></span><button type="button" className="sakan-textbutton" onClick={changePlace} data-testid="button-change-place">Change</button></div>
        <div className="gpp-kinds" role="radiogroup" aria-label="What is this place?">
          {KIND_OPTIONS.map((k) => { const I = kindIcon[kindSlug(k)]; return <button type="button" role="radio" aria-checked={kind === k} key={k} className={`gpp-kindbtn kind-${kindSlug(k)}${kind === k ? ' on' : ''}`} onClick={() => chooseKind(k)} data-testid={`button-add-${k.toLowerCase().replace(/\W/g, '-')}`}><I size={14} />{k}</button>; })}
        </div>
        <label className="gpp-labelfield"><span>Short label (optional)</span>
          <input className="sakan-input" maxLength={40} value={label} placeholder={defaultLabel(kind)} onChange={(e) => setLabel(e.target.value)} data-testid="input-destination-label" /></label>
        <div className="gpp-actions">
          <button type="button" className="sakan-secondary" onClick={resetAll} data-testid="button-cancel-place">Cancel</button>
          <button type="button" className="sakan-primary" onClick={save} data-testid="button-save-destination"><KindIcon size={14} /> {editing ? 'Save changes' : 'Add to my week'}</button>
        </div>
      </div>}
      {editing && stage !== 'kind' && <div className="gpp-actions"><button type="button" className="sakan-secondary" onClick={resetAll} data-testid="button-cancel-edit">Cancel editing</button></div>}
      {localError && <div className="sakan-error" role="alert" data-testid="status-picker-error">{localError}</div>}
    </div>

    <div className="gpp-saved">
      <div className="gpp-label">Your places · {destinations.length}</div>
      {destinations.length === 0 ? <div className="gpp-none"><strong>No places yet</strong><span>That is fine. Skip ahead and travel will not affect ranking.</span></div>
        : destinations.map((d, i) => { const I = kindIcon[kindSlug(d.kind)]; return <div key={d.id} className={`gpp-saved-row${d.id === editingId ? ' on' : ''}`} data-testid={`row-destination-${d.id}`}>
          <span className={`gpp-num kind-${kindSlug(d.kind)}`}>{i + 1}</span>
          <span className="gpp-saved-text"><strong><I size={12} /> {d.label}</strong><small>{d.kind} · {d.place} · {areaKey(d.place)} area</small></span>
          <button type="button" className="sakan-icon-button" aria-label={`Edit ${d.label}`} onClick={() => startEdit(d)} data-testid={`button-edit-destination-${d.id}`}><Pencil size={14} /></button>
          <button type="button" className="sakan-icon-button" aria-label={`Remove ${d.label}`} onClick={() => { if (d.id === editingId) resetAll(); onRemove(d.id); }} data-testid={`button-remove-destination-${d.id}`}><Trash2 size={14} /></button>
        </div>; })}
    </div>
  </div>;
}
