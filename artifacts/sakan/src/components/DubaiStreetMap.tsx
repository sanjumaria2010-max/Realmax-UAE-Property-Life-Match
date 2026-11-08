import { useEffect, useRef, useState } from 'react';
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
  /** Pending (unconfirmed) candidate place, drawn distinctly. */
  candidate: string | null;
  /** Last tapped point, if any. */
  tap: [number, number] | null;
  onPick: (place: string) => void;
  onMapTap: (lat: number, lng: number) => void;
};

export function DubaiStreetMap({ destinations, picker }: { destinations: Destination[]; picker?: MapPicker }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const sampleLayer = useRef<L.LayerGroup | null>(null);
  const bounds = useRef<L.LatLngBounds | null>(null);
  const errors = useRef(0);
  const pickRef = useRef(picker?.onPick);
  const tapRef = useRef(picker?.onMapTap);
  pickRef.current = picker?.onPick;
  tapRef.current = picker?.onMapTap;
  const [failed, setFailed] = useState(false);
  const [zoomVersion, setZoomVersion] = useState(0);
  const picking = !!picker;
  const placesKey = picker ? picker.places.join('|') : '';

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
    sampleLayer.current = L.layerGroup().addTo(m);
    layer.current = L.layerGroup().addTo(m);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => m.invalidateSize()) : null;
    ro?.observe(el.current);
    return () => { ro?.disconnect(); m.remove(); map.current = null; };
  }, []);

  // Saved destinations (by kind) + fit bounds when the set of saved places or supported places changes.
  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const offsets: Record<string, number> = {};
    const pts: L.LatLng[] = [];
    destinations.forEach((d, i) => {
      const area = areaKey(d.place);
      const base = AREA_CENTRES[area] ?? AREA_CENTRES.DIFC;
      const n = offsets[area] = (offsets[area] ?? -1) + 1;
      const ll = L.latLng(base[0] + n * 0.0022, base[1] + n * 0.0026);
      pts.push(ll);
      const icon = L.divIcon({ className: `sakan-geo-pin kind-${kindSlug(d.kind)}`, html: `<span>${i + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
      L.marker(ll, { icon, title: `${i + 1}. ${d.label} (${d.kind}) — ${area} area centre`, alt: `${i + 1}. ${d.label}`, keyboard: true, zIndexOffset: 400 })
        .bindPopup(`<div class="sakan-geo-pop"><strong>${i + 1}. ${esc(d.label)}</strong><span>${esc(area)} · approximate area centre</span><em>Your travel limit: ${d.maxMinutes} min ${modeLabel[d.mode]}. This is a preference, not a measured journey time.</em></div>`)
        .addTo(g);
    });
    if (picking) placesKey.split('|').forEach((place) => { const p = samplePlacePoint(place); if (p) pts.push(L.latLng(p.lat, p.lng)); });
    bounds.current = pts.length ? L.latLngBounds(pts).pad(0.2) : null;
    if (bounds.current) m.fitBounds(bounds.current, { maxZoom: 13 });
  }, [destinations, picking, placesKey]);

  // Supported sample markers, candidate and tap point.
  const candidate = picker?.candidate ?? null;
  const tap = picker?.tap ?? null;
  useEffect(() => {
    const g = sampleLayer.current, m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    if (!picking) return;
    const points = placesKey.split('|').flatMap((place) => {
      const point = samplePlacePoint(place);
      return point ? [point] : [];
    });
    const pixels = points.map((point) => m.project([point.lat, point.lng], m.getZoom()));
    const separated = separateMarkerPixels(pixels);
    points.forEach((p, index) => {
      const place = p.place;
      const displayed = m.unproject(L.point(separated[index].x, separated[index].y), m.getZoom());
      if (Math.hypot(pixels[index].x - separated[index].x, pixels[index].y - separated[index].y) > 1) {
        L.polyline([[p.lat, p.lng], displayed], { color: '#087db7', weight: 2, dashArray: '3 3', interactive: false }).addTo(g);
      }
      const on = place === candidate;
      const icon = L.divIcon({ className: `sakan-geo-sample${on ? ' is-candidate' : ''}`, html: '<span></span>', iconSize: on ? [34, 34] : [22, 22], iconAnchor: on ? [17, 17] : [11, 11] });
      L.marker(displayed, { icon, title: `Supported sample place: ${place} — ${p.area} approximate area centre${on ? ' (selected)' : ''}`, alt: place, keyboard: true, zIndexOffset: on ? 900 : 700 })
        .on('click', () => pickRef.current?.(place))
        .addTo(g);
    });
    if (tap) {
      L.marker(tap, { icon: L.divIcon({ className: 'sakan-geo-tap', html: '<span></span>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, keyboard: false }).addTo(g);
    }
  }, [picking, placesKey, candidate, tap, zoomVersion]);

  useEffect(() => {
    const m = map.current;
    if (!m || !candidate) return;
    const p = samplePlacePoint(candidate);
    if (p && !m.getBounds().pad(-0.1).contains([p.lat, p.lng])) m.panTo([p.lat, p.lng]);
  }, [candidate]);

  const reset = () => { const m = map.current; if (!m) return; if (bounds.current) m.fitBounds(bounds.current, { maxZoom: 13 }); else m.setView([25.15, 55.22], 11); };
  const retry = () => { errors.current = 0; setFailed(false); tiles.current?.redraw(); };

  return <div className={`sakan-geo${picking ? ' is-picking' : ''}`} data-testid="map-dubai">
    <div ref={el} className="sakan-geo-canvas" role="region" aria-label={picking
      ? `Street map of Dubai. ${destinations.length} saved places and supported sample places at approximate area centres. Tap the map to see nearby supported places, or use the list below.`
      : `Street map of Dubai with ${destinations.length} numbered destination pins at approximate area centres`} />
    <div className="sakan-geo-controls" role="group" aria-label="Map controls">
      <button type="button" aria-label="Zoom in" data-testid="button-map-zoom-in" onClick={() => map.current?.zoomIn()}><Plus size={16} /></button>
      <button type="button" aria-label="Zoom out" data-testid="button-map-zoom-out" onClick={() => map.current?.zoomOut()}><Minus size={16} /></button>
      <button type="button" aria-label="Reset map view to all places" data-testid="button-map-reset" onClick={reset}><Crosshair size={16} /></button>
    </div>
    {failed && <div className="sakan-geo-fail" role="alert" data-testid="status-map-error">
      <strong>Map tiles could not load</strong>
      <span>Check your connection. Your destinations are still saved{picking ? ' and you can still choose from the list below' : ''}.</span>
      <button type="button" className="sakan-primary" data-testid="button-map-retry" onClick={retry}><RefreshCw size={14} /> Retry</button>
    </div>}
    <ol className="sr-only">{destinations.map((d, i) => <li key={d.id}>{i + 1}. {d.label}, {areaKey(d.place)} area</li>)}</ol>
    <div className="sakan-map-caption sakan-geo-caption"><MapPin size={12} /> Pins mark approximate area centres, not building addresses · travel times are sample estimates</div>
  </div>;
}
