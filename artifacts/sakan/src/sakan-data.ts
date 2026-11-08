export type Goal = 'rent' | 'live' | 'invest';
export type RentPayment = 'upfront' | 'monthly' | 'any';
export const rentPaymentLabels: Record<RentPayment, string> = {
  upfront: 'Pay upfront', monthly: 'Pay monthly', any: 'No preference',
};
export type Priority = 'balanced' | 'commute' | 'cost' | 'risk';
export type Destination = {
  id: string;
  kind: string;
  label: string;
  place: string;
  address: string;
  frequency: number;
  mode: 'car' | 'metro' | 'walk';
  maxMinutes: number;
  required: boolean;
  preferred: boolean;
};
export type Brief = {
  rentBudget: number;
  rentUpfront: number;
  rentPayment: RentPayment;
  buyBudget: number;
  downPayment: number;
  monthlyPayment: number;
  capital: number;
  strategy: 'income' | 'growth' | 'balanced';
  horizon: number;
  vacancy: number;
  riskScenario: 'steady' | 'soft' | 'stress';
  ready: string;
  beds: number;
  type: string;
  furnished: string;
  parking: string;
};
export type Listing = {
  id: string;
  name: string;
  area: string;
  type: string;
  beds: number;
  baths: number;
  sqft: number;
  price: number;
  rent: number;
  service: number;
  vacancy: number;
  ready: boolean;
  furnished: boolean;
  parking: boolean;
  position: [number, number];
  travel: Record<string, number>;
  expenses: number;
  risk: number;
  fresh: string;
  description: string;
};
export type Match = {
  listing: Listing;
  score: number;
  commute: number;
  annualNet: number;
  netYield: number;
  downside: number;
  why: string;
};
export type Enquiry = {
  id: string;
  listingId: string;
  name: string;
  contact: string;
  message: string;
  status: string;
  createdAt: string;
};

export const initialBrief: Brief = {
  rentBudget: 115000,
  rentUpfront: 28000,
  rentPayment: 'any',
  buyBudget: 1900000,
  downPayment: 550000,
  monthlyPayment: 12500,
  capital: 1400000,
  strategy: 'balanced',
  horizon: 7,
  vacancy: 6,
  riskScenario: 'soft',
  ready: 'any',
  beds: 1,
  type: 'any',
  furnished: 'any',
  parking: 'any',
};

export const samplePlaces = [
  'DIFC Gate Avenue',
  'Dubai Internet City',
  'GEMS Wellington International School',
  'Jumeirah Mosque',
  'Dubai Marina Mall',
  'Business Bay Metro Station',
  'Al Barsha South Park',
];

export const formatAED = (value: number) =>
  `AED ${Math.round(Number.isFinite(value) ? value : 0).toLocaleString('en-AE')}`;

/** Display only: annual rent remains the source for budgets, deposits and ranking. */
export function rentDisplay(annualRent: number, preference: RentPayment) {
  const monthly = preference === 'monthly';
  const amount = monthly ? annualRent / 12 : annualRent;
  const label = monthly ? 'Monthly rent' : preference === 'upfront' ? 'Annual rent · upfront' : 'Annual rent';
  const suffix = monthly ? ' / month' : preference === 'upfront' ? ' / year · upfront' : ' / year';
  return { amount, label, suffix, summary: `${formatAED(amount)} ${label.toLowerCase()}` };
}

export function areaKey(place: string) {
  const value = place.toLowerCase();
  if (value.includes('marina')) return 'Dubai Marina';
  if (value.includes('barsha')) return 'Al Barsha';
  if (value.includes('business bay')) return 'Business Bay';
  if (value.includes('internet city')) return 'Dubai Internet City';
  if (value.includes('wellington') || value.includes('school') || value.includes('sufouh')) return 'Dubai Internet City';
  if (value.includes('jumeirah') || value.includes('mosque')) return 'Jumeirah';
  if (value.includes('jvc')) return 'JVC';
  if (value.includes('difc') || value.includes('gate')) return 'DIFC';
  return 'DIFC';
}

export function travelFor(listing: Listing, destinations: Destination[]) {
  if (!destinations.length) return 0;
  const total = destinations.reduce((sum, destination) => {
    const factor = destination.mode === 'metro' ? 1.16 : destination.mode === 'walk' ? 1.28 : 1;
    return sum + Math.round((listing.travel[areaKey(destination.place)] ?? 27) * factor) * Math.min(7, Math.max(1, destination.frequency));
  }, 0);
  return Math.round(total / destinations.reduce((sum, destination) => sum + Math.min(7, Math.max(1, destination.frequency)), 0));
}

export function meetsTravelBoundary(listing: Listing, destinations: Destination[]) {
  return destinations.filter((destination) => destination.required).every((destination) => {
    const factor = destination.mode === 'metro' ? 1.16 : destination.mode === 'walk' ? 1.28 : 1;
    return Math.round((listing.travel[areaKey(destination.place)] ?? 27) * factor) <= destination.maxMinutes;
  });
}

export function estimateScore(listing: Listing, goal: Goal, brief: Brief, destinations: Destination[]) {
  const commute = travelFor(listing, destinations);
  const annualNet = listing.rent * (1 - brief.vacancy / 100) - listing.service - listing.expenses;
  const netYield = annualNet / (listing.price * 1.06) * 100;
  const downside = goal === 'invest'
    ? listing.risk * (brief.riskScenario === 'stress' ? 1.55 : brief.riskScenario === 'soft' ? 1.15 : 0.82)
      + (listing.ready ? 0 : 1.4) + Math.max(0, brief.horizon < 5 ? 1.2 : 0)
    : listing.risk;
  const preference = (brief.furnished === 'any' ? 0 : listing.furnished === (brief.furnished === 'yes') ? 3 : -2)
    + (brief.parking === 'yes' ? listing.parking ? 3 : -3 : 0);
  const travelPenalty = destinations.reduce((sum, destination) => {
    const factor = destination.mode === 'metro' ? 1.16 : destination.mode === 'walk' ? 1.28 : 1;
    const minutes = Math.round((listing.travel[areaKey(destination.place)] ?? 27) * factor);
    return sum + (destination.required ? 0 : Math.max(0, minutes - destination.maxMinutes)
      * (destination.preferred ? 0.18 : 0.1) * Math.min(7, Math.max(1, destination.frequency)));
  }, 0);
  let score: number;
  let why: string;
  if (goal === 'rent') {
    score = 100 - (listing.rent / brief.rentBudget * 42) - commute * 1.05 - listing.risk * 2 + preference - travelPenalty;
    why = `${formatAED(listing.rent)} annual rent · about ${commute} min to your routine`;
  } else if (goal === 'live') {
    score = 100 - (listing.price / brief.buyBudget * 36) - commute * 1.1 - listing.risk * 2 + preference - travelPenalty;
    why = `${formatAED(listing.price)} purchase estimate · about ${commute} min to your routine`;
  } else {
    const strategy = brief.strategy === 'income' ? netYield * 6 : brief.strategy === 'growth' ? (8 - listing.risk) * 2.1 : netYield * 3 + (8 - listing.risk) * 1.2;
    score = strategy - downside * 2.6 + (listing.ready ? 2 : 0) + preference - travelPenalty;
    why = `${netYield.toFixed(1)}% illustrative net yield · risk scenario ${brief.riskScenario}`;
  }
  return { score, commute, annualNet, netYield, downside, why };
}
