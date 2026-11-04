import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, Minus, Plus, RefreshCw } from 'lucide-react';
import { areaKey, type Destination } from '../sakan-data';

/** Approximate area centres only — not exact addresses. */
export const AREA_CENTRES: Record<string, [number, number]> = {
  DIFC: [25.2128, 55.2799],
  'Dubai Marina': [25.0805, 55.1403],
  'Al Barsha': [25.0985, 55.2005],
  'Business Bay': [25.1857, 55.2650],
  'Dubai Internet City': [25.0957, 55.1585],
  Jumeirah: [25.2048, 55.2470],
  JVC: [25.0587, 55.2093],
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const modeLabel = { car: 'by car', metro: 'by metro', walk: 'on foot' } as const;

export function DubaiStreetMap({ destinations }: { destinations: Destination[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const bounds = useRef<L.LatLngBounds | null>(null);
  const errors = useRef(0);
  const [failed, setFailed] = useState(false);

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
    map.current = m; tiles.current = t; layer.current = L.layerGroup().addTo(m);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => m.invalidateSize()) : null;
    ro?.observe(el.current);
    return () => { ro?.disconnect(); m.remove(); map.current = null; };
  }, []);

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
      const icon = L.divIcon({ className: 'sakan-geo-pin', html: `<span>${i + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
      L.marker(ll, { icon, title: `${i + 1}. ${d.label} — ${area} area centre`, alt: `${i + 1}. ${d.label}`, keyboard: true })
        .bindPopup(`<div class="sakan-geo-pop"><strong>${i + 1}. ${esc(d.label)}</strong><span>${esc(area)} · approximate area centre</span><em>Your travel limit: ${d.maxMinutes} min ${modeLabel[d.mode]}. This is a preference, not a measured journey time.</em></div>`)
        .addTo(g);
    });
    bounds.current = pts.length ? L.latLngBounds(pts).pad(0.25) : null;
    if (bounds.current) m.fitBounds(bounds.current, { maxZoom: 13 });
  }, [destinations]);

  const reset = () => { const m = map.current; if (!m) return; if (bounds.current) m.fitBounds(bounds.current, { maxZoom: 13 }); else m.setView([25.15, 55.22], 11); };
  const retry = () => { errors.current = 0; setFailed(false); tiles.current?.redraw(); };

  return <div className="sakan-geo" data-testid="map-dubai">
    <div ref={el} className="sakan-geo-canvas" role="region" aria-label={`Street map of Dubai with ${destinations.length} numbered destination pins at approximate area centres`} />
    <div className="sakan-geo-controls" role="group" aria-label="Map controls">
      <button type="button" aria-label="Zoom in" data-testid="button-map-zoom-in" onClick={() => map.current?.zoomIn()}><Plus size={16} /></button>
      <button type="button" aria-label="Zoom out" data-testid="button-map-zoom-out" onClick={() => map.current?.zoomOut()}><Minus size={16} /></button>
      <button type="button" aria-label="Reset map view to all destinations" data-testid="button-map-reset" onClick={reset}><Crosshair size={16} /></button>
    </div>
    {failed && <div className="sakan-geo-fail" role="alert" data-testid="status-map-error">
      <strong>Map tiles could not load</strong>
      <span>Check your connection. Your destinations are still saved.</span>
      <button type="button" className="sakan-primary" data-testid="button-map-retry" onClick={retry}><RefreshCw size={14} /> Retry</button>
    </div>}
    <ol className="sr-only">{destinations.map((d, i) => <li key={d.id}>{i + 1}. {d.label}, {areaKey(d.place)} area</li>)}</ol>
    <div className="sakan-map-caption sakan-geo-caption"><MapPin size={12} /> Pins mark approximate area centres · travel times are sample estimates, not live routing</div>
  </div>;
}
