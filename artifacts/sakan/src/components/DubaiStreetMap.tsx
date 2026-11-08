import { useEffect, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, Minus, Plus, RefreshCw } from 'lucide-react';
import { areaKey, type Destination } from '../sakan-data';
import { AREA_CENTRES, kindSlug, samplePlacePoint, separateMarkerPixels } from '../sample-place-geometry';

export { AREA_CENTRES };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const modeLabel = { car: 'by car', metro: 'by metro', walk: 'on foot' } as const;

export type MapPicker = {
  /** Supported sample places to draw as selectable markers. */
  places: string[];
  /** Selected but unsaved candidate place, drawn distinctly. */
  candidate: string | null;
  /** Last tapped point, if any. */
  tap: [number, number] | null;
  onPick: (place: string) => void;
  onMapTap: (lat: number, lng: number) => void;
  /** Saved destination currently being edited (highlighted). */
  activeId?: string | null;
  /** Kind of the row being edited; tints the candidate marker. */
  activeKind?: string | null;
  /** Place to pan to. Map only moves when focusKey changes. */
  focusPlace?: string | null;
  focusKey?: string | null;
  /** Click on a saved pin while no row is active. */
  onSelectSaved?: (id: string) => void;
};

const pointFor = (d: Destination) => {
  const p = samplePlacePoint(d.place);
  if (p) return L.latLng(p.lat, p.lng);
  const base = AREA_CENTRES[areaKey(d.place)] ?? AREA_CENTRES.DIFC;
  return L.latLng(base[0], base[1]);
};

export function DubaiStreetMap({ destinations, picker, mono = false, children }: { destinations: Destination[]; picker?: MapPicker; mono?: boolean; children?: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const bounds = useRef<L.LatLngBounds | null>(null);
  const fitted = useRef(false);
  const errors = useRef(0);
  const pickRef = useRef(picker?.onPick);
  const tapRef = useRef(picker?.onMapTap);
  const savedRef = useRef(picker?.onSelectSaved);
  pickRef.current = picker?.onPick;
  tapRef.current = picker?.onMapTap;
  savedRef.current = picker?.onSelectSaved;
  const [failed, setFailed] = useState(false);
  const [zoomVersion, setZoomVersion] = useState(0);
  const picking = !!picker;
  const placesKey = picker ? picker.places.join('|') : '';
  const candidate = picker?.candidate ?? null;
  const tap = picker?.tap ?? null;
  const activeId = picker?.activeId ?? null;
  const activeKind = picker?.activeKind ?? null;
  const destKey = destinations.map((d) => `${d.id}~${d.place}~${d.label}~${d.kind}~${d.maxMinutes}~${d.mode}`).join('|');

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    m.attributionControl.setPrefix(false);
    const t = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, minZoom: 9,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });
    t.on('tileerror', () => { errors.current += 1; if (errors.current >= 4) setFailed(true); });
    t.on('loading', () => { errors.current = 0; });
    t.on('load', () => { setFailed(errors.current >= 4); });
    t.addTo(m);
    m.setView([25.15, 55.22], 11);
    m.on('click', (e: L.LeafletMouseEvent) => tapRef.current?.(e.latlng.lat, e.latlng.lng));
    m.on('zoomend', () => setZoomVersion((value) => value + 1));
    map.current = m; tiles.current = t;
    layer.current = L.layerGroup().addTo(m);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => m.invalidateSize()) : null;
    ro?.observe(el.current);
    return () => { ro?.disconnect(); m.remove(); map.current = null; };
  }, []);

  // Bounds: picker fits once (never on every edit); read-only map refits when destinations change.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const pts: L.LatLng[] = destinations.map(pointFor);
    if (picking) placesKey.split('|').forEach((place) => { const p = samplePlacePoint(place); if (p) pts.push(L.latLng(p.lat, p.lng)); });
    bounds.current = pts.length ? L.latLngBounds(pts).pad(0.15) : null;
    if (picking && fitted.current) return;
    if (bounds.current) { m.fitBounds(bounds.current, { maxZoom: 13 }); fitted.current = true; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey, picking, placesKey]);

  // All markers in one pass so saved pins, sample places and candidate never overlap.
  useEffect(() => {
    const g = layer.current, m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    type Item = { lat: number; lng: number; build: (at: L.LatLng) => void };
    const items: Item[] = [];
    const savedPlaces = new Set(destinations.map((d) => d.place));
    destinations.forEach((d, i) => {
      const ll = pointFor(d);
      const area = areaKey(d.place);
      const on = d.id === activeId;
      items.push({ lat: ll.lat, lng: ll.lng, build: (at) => {
        const icon = L.divIcon({
          className: `sakan-geo-pin kind-${kindSlug(d.kind)}${on ? ' is-active' : ''}${activeId && !on ? ' is-dim' : ''}`,
          html: `<span>${i + 1}</span>${picking ? `<b>${esc(d.label)}</b>` : ''}`,
          iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14],
        });
        const mk = L.marker(at, { icon, title: `${i + 1}. ${d.label} (${d.kind}) - ${area} area centre`, alt: `${i + 1}. ${d.label}`, keyboard: true, zIndexOffset: on ? 1000 : 600 });
        if (picking) mk.on('click', () => { if (savedRef.current) savedRef.current(d.id); else pickRef.current?.(d.place); });
        else mk.bindPopup(`<div class="sakan-geo-pop"><strong>${i + 1}. ${esc(d.label)}</strong><span>${esc(area)} · approximate area centre</span><em>Your travel limit: ${d.maxMinutes} min ${modeLabel[d.mode]}. This is a preference, not a measured journey time.</em></div>`);
        mk.addTo(g);
      } });
    });
    if (picking) {
      placesKey.split('|').forEach((place) => {
        const p = samplePlacePoint(place);
        if (!p) return;
        const isCand = place === candidate;
        if (savedPlaces.has(place) && !isCand) return;
        items.push({ lat: p.lat, lng: p.lng, build: (at) => {
          const icon = L.divIcon({
            className: isCand ? `sakan-geo-sample is-candidate kind-${kindSlug(activeKind || 'Custom')}` : 'sakan-geo-sample',
            html: isCand ? `<span></span><b>${esc(place)} · not saved</b>` : `<span></span><b>${esc(place)}</b>`,
            iconSize: isCand ? [34, 34] : [22, 22], iconAnchor: isCand ? [17, 17] : [11, 11],
          });
          L.marker(at, { icon, title: `Supported sample place: ${place} - ${p.area} approximate area centre${isCand ? ' (selected, not saved)' : ''}`, alt: place, keyboard: true, zIndexOffset: isCand ? 1100 : 500 })
            .on('click', () => pickRef.current?.(place))
            .addTo(g);
        } });
      });
    }
    const z = m.getZoom();
    const pixels = items.map((it) => m.project([it.lat, it.lng], z));
    const separated = separateMarkerPixels(pixels);
    items.forEach((it, index) => {
      const at = m.unproject(L.point(separated[index].x, separated[index].y), z);
      if (Math.hypot(pixels[index].x - separated[index].x, pixels[index].y - separated[index].y) > 1) {
        L.polyline([[it.lat, it.lng], at], { color: '#1b1f23', weight: 1.5, dashArray: '3 3', interactive: false }).addTo(g);
      }
      it.build(at);
    });
    if (picking && tap) {
      L.marker(tap, { icon: L.divIcon({ className: 'sakan-geo-tap', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, keyboard: false }).addTo(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey, picking, placesKey, candidate, tap, activeId, activeKind, zoomVersion]);

  const focusKey = picker?.focusKey ?? null;
  const focusPlace = picker?.focusPlace ?? null;
  useEffect(() => {
    const m = map.current;
    if (!m || !focusKey || !focusPlace) return;
    const p = samplePlacePoint(focusPlace);
    if (!p) return;
    m.flyTo([p.lat, p.lng], Math.max(m.getZoom(), 13), { duration: 0.6 });
  }, [focusKey, focusPlace]);

  const reset = () => { const m = map.current; if (!m) return; if (bounds.current) m.fitBounds(bounds.current, { maxZoom: 13 }); else m.setView([25.15, 55.22], 11); };
  const retry = () => { errors.current = 0; setFailed(false); tiles.current?.redraw(); };

  return <div className={`sakan-geo${picking ? ' is-picking' : ''}${mono ? ' is-mono' : ''}`} data-testid="map-dubai">
    <div ref={el} className="sakan-geo-canvas" role="region" aria-label={picking
      ? `Street map of Dubai. ${destinations.length} saved places and supported sample places at approximate area centres. Tap the map to see nearby supported places, or use the list.`
      : `Street map of Dubai with ${destinations.length} numbered destination pins at approximate area centres`} />
    <div className="sakan-geo-controls" role="group" aria-label="Map controls">
      <button type="button" aria-label="Zoom in" data-testid="button-map-zoom-in" onClick={() => map.current?.zoomIn()}><Plus size={16} /></button>
      <button type="button" aria-label="Zoom out" data-testid="button-map-zoom-out" onClick={() => map.current?.zoomOut()}><Minus size={16} /></button>
      <button type="button" aria-label="Reset map view to all places" data-testid="button-map-reset" onClick={reset}><Crosshair size={16} /></button>
    </div>
    {children}
    {failed && <div className="sakan-geo-fail" role="alert" data-testid="status-map-error">
      <strong>Map tiles could not load</strong>
      <span>Check your connection. Your places are still saved{picking ? ' and you can still search and choose from the list' : ''}.</span>
      <button type="button" className="sakan-primary" data-testid="button-map-retry" onClick={retry}><RefreshCw size={14} /> Retry</button>
    </div>}
    <ol className="sr-only">{destinations.map((d, i) => <li key={d.id}>{i + 1}. {d.label}, {areaKey(d.place)} area</li>)}</ol>
    <div className="sakan-map-caption sakan-geo-caption"><MapPin size={12} /> Approximate area centres, not addresses · sample travel data</div>
  </div>;
}
