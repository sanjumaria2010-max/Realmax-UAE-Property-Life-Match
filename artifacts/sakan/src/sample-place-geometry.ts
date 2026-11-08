import { areaKey } from './sakan-data';

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

/**
 * Fixed table of the supported sample places. Each marker sits at the approximate centre of the
 * area the sample travel engine uses (areaKey). Places sharing an area get a small visual offset.
 * Unknown names deliberately return null — they are never snapped to a nearby area.
 */
const OFFSETS: Record<string, [number, number]> = {
  'DIFC Gate Avenue': [0, 0],
  'Dubai Internet City': [0, 0],
  'GEMS Wellington International School': [0.0045, 0.0052],
  'Jumeirah Mosque': [0, 0],
  'Dubai Marina Mall': [0, 0],
  'Business Bay Metro Station': [0, 0],
  'Al Barsha South Park': [0, 0],
};

export type SamplePlacePoint = { place: string; area: string; lat: number; lng: number };

export function samplePlacePoint(place: string): SamplePlacePoint | null {
  const offset = OFFSETS[place];
  if (!offset) return null;
  const area = areaKey(place);
  const base = AREA_CENTRES[area];
  if (!base) return null;
  return { place, area, lat: base[0] + offset[0], lng: base[1] + offset[1] };
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => d * Math.PI / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Supported sample places within radiusKm of a tapped point, nearest first. */
export function nearbySamplePlaces(places: string[], lat: number, lng: number, radiusKm = 3) {
  return places
    .map((place) => samplePlacePoint(place))
    .filter((point): point is SamplePlacePoint => point !== null)
    .map((point) => ({ ...point, km: distanceKm(lat, lng, point.lat, point.lng) }))
    .filter((point) => point.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

export const KIND_OPTIONS = ['Work', 'Partner work', 'School', 'Worship', 'Sport', 'Custom'] as const;
/** Separate clickable map symbols in screen pixels without changing stored sample coordinates. */
export function separateMarkerPixels(points: Array<{ x: number; y: number }>, gap = 34) {
  const placed: Array<{ x: number; y: number }> = [];
  return points.map((point) => {
    let display = { ...point };
    for (let step = 0; step < 200; step++) {
      const overlaps = placed.some((other) => Math.hypot(display.x - other.x, display.y - other.y) < gap);
      if (!overlaps) break;
      const angle = step * 2.399963229728653;
      const radius = gap * Math.sqrt(step + 1);
      display = { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
    }
    placed.push(display);
    return display;
  });
}
export const kindSlug = (kind: string) => {
  const k = kind.toLowerCase();
  if (k.includes('partner')) return 'partner';
  if (k.includes('school')) return 'school';
  if (k.includes('worship')) return 'worship';
  if (k.includes('sport')) return 'sport';
  if (k.includes('work')) return 'work';
  return 'custom';
};
