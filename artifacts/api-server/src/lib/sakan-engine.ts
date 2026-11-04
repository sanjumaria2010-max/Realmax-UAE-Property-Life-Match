// All listings and travel matrices below are illustrative, not live market data.
export type Goal = "rent" | "live" | "invest";
export interface Destination {
  id: string; kind: string; label: string; place: string; address: string;
  frequency: number; mode: "car" | "metro" | "walk"; maxMinutes: number;
  required: boolean; preferred: boolean;
}
export interface Brief {
  rentBudget: number; rentUpfront: number; buyBudget: number; downPayment: number;
  monthlyPayment: number; capital: number; strategy: "income" | "growth" | "balanced";
  horizon: number; vacancy: number; riskScenario: "steady" | "soft" | "stress";
  ready: string; beds: number; type: string; furnished: string; parking: string;
}
export interface Listing {
  id: string; name: string; area: string; type: string; beds: number; baths: number;
  sqft: number; price: number; rent: number; service: number; vacancy: number;
  ready: boolean; furnished: boolean; parking: boolean; position: [number, number];
  travel: Record<string, number>; expenses: number; risk: number; fresh: string;
  description: string;
}
export const places = ["DIFC Gate Avenue", "Dubai Internet City", "GEMS Wellington International School", "Jumeirah Mosque", "Dubai Marina Mall", "Business Bay Metro Station", "Al Barsha South Park"];
const rows: Array<[string,string,string,number,number,number,number,number,number,number,boolean,boolean,number[],number[],number,string]> = [
  ["s01","Courtyard at Cedar","Jumeirah Village Circle",1,2,818,1080000,79000,13800,14200,true,false,[49,60],[25,20,17,22,21,28,8],2,"A bright corner home in a leafy, low-rise pocket. A practical starting point for a couple who values a quieter evening."],
  ["s02","The Courtyard House","Town Square Dubai",2,3,1460,1740000,112000,16700,19200,true,false,[25,67],[34,31,24,31,28,37,22],3,"A family-sized home with a proper front door, small garden and a calm community feel."],
  ["s03","Marina Walk Residences","Dubai Marina",1,1,742,1470000,103000,18500,16800,true,true,[72,46],[25,7,22,28,12,33,21],3,"Close to the water and everyday errands, with an active neighborhood right outside."],
  ["s04","Canal Edge Apartment","Business Bay",2,2,1190,1980000,136000,22100,21300,true,false,[53,40],[13,27,22,6,25,21,22],4,"A central base with quick access to the canal walk and a busy weekday rhythm."],
  ["s05","Olive Court","Al Barsha South",2,2,1285,1420000,98000,15500,16500,true,false,[36,49],[27,24,13,25,20,32,17],2,"A generous, unfussy layout close to schools, parks and the parts of the city that feel like daily life."],
  ["s06","Palm Grove Garden Flat","Dubai Hills Estate",2,2,1310,2150000,145000,22400,23000,true,false,[43,34],[20,24,17,18,20,25,19],3,"Open views and a park-side setting, with a little more breathing room in a well-connected district."],
  ["s07","Creekside Living","Dubai Creek Harbour",2,2,1240,1870000,128000,20500,21900,true,true,[68,31],[19,38,34,20,34,27,33],4,"A newer waterfront district with long promenades and a more measured pace after work."],
  ["s08","Metroline Studio+","Discovery Gardens",1,1,685,850000,65000,11200,12300,true,true,[78,69],[33,17,25,34,15,39,22],3,"An accessible entry point near the metro, with practical amenities and a lively local high street."],
  ["s09","Terrace at Arjan","Arjan",1,1,790,960000,72000,12400,13100,true,false,[34,61],[29,25,16,27,23,33,14],3,"A simple, sunny home in a growing residential pocket, with easy access to parks and shops."],
  ["s10","Mira Courtyard Townhome","Reem",3,3,1900,2250000,143000,18200,20600,false,false,[18,46],[37,35,28,35,33,40,27],5,"A roomy off-plan family layout. Handover timing and payment milestones need careful checking."],
];
const keys = ["DIFC", "Dubai Marina", "Al Barsha", "Business Bay", "Dubai Internet City", "Jumeirah", "JVC"];
export const listings: Listing[] = rows.map(([id,name,area,beds,baths,sqft,price,rent,service,expenses,ready,furnished,position,travel,risk,description]) => ({
  id,name,area,beds,baths,sqft,price,rent,service,expenses,ready,furnished,risk,description,
  type: id === "s02" || id === "s10" ? "Townhouse" : "Apartment",
  position: position as [number, number], travel: Object.fromEntries(keys.map((key,i) => [key,travel[i]])),
  parking: true, vacancy: 8, fresh: "Illustrative sample assumptions · not live inventory",
}));
export const initialBrief: Brief = {
  rentBudget:115000,rentUpfront:28000,buyBudget:1900000,downPayment:550000,monthlyPayment:12500,
  capital:1400000,strategy:"balanced",horizon:7,vacancy:6,riskScenario:"soft",ready:"any",beds:1,
  type:"any",furnished:"any",parking:"any",
};
export function areaKey(place: string): string | null {
  const s = place.toLowerCase();
  if (s.includes("marina")) return "Dubai Marina";
  if (s.includes("barsha")) return "Al Barsha";
  if (s.includes("business bay")) return "Business Bay";
  if (s.includes("internet city") || s.includes("wellington") || s.includes("school") || s.includes("sufouh")) return "Dubai Internet City";
  if (s.includes("jumeirah") || s.includes("mosque")) return "Jumeirah";
  if (s.includes("jvc")) return "JVC";
  if (s.includes("difc") || s.includes("gate")) return "DIFC";
  return null;
}
export function minutes(l: Listing, d: Destination): number | null {
  const key = areaKey(d.place);
  if (!key || l.travel[key] == null) return null;
  // These factors are synthetic scenario assumptions, never real routing.
  return Math.round(l.travel[key] * (d.mode === "metro" ? 1.16 : d.mode === "walk" ? 1.28 : 1));
}
export function mortgagePayment(principal: number): number {
  const monthlyRate = .0525 / 12;
  return principal <= 0 ? 0 : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -240));
}
export function computeScore(l: Listing, goal: Goal, b: Brief, destinations: Destination[]) {
  const weighted = destinations.reduce((sum,d) => sum + (minutes(l,d) ?? 0) * d.frequency,0);
  const commute = destinations.length ? Math.round(weighted / destinations.reduce((sum,d) => sum + d.frequency,0)) : 0;
  const annualNet = l.rent * (1 - b.vacancy / 100) - l.service - l.expenses;
  const netYield = annualNet / (l.price * 1.06) * 100;
  const downside = goal === "invest" ? l.risk * (b.riskScenario === "stress" ? 1.55 : b.riskScenario === "soft" ? 1.15 : .82) + (l.ready ? 0 : 1.4) + (b.horizon < 5 ? 1.2 : 0) : l.risk;
  const pref = (b.furnished === "any" ? 0 : l.furnished === (b.furnished === "yes") ? 3 : -2) + (b.parking === "yes" ? l.parking ? 3 : -3 : 0);
  const penalty = destinations.reduce((sum,d) => sum + (d.required ? 0 : Math.max(0,(minutes(l,d) ?? 0) - d.maxMinutes) * (d.preferred ? .18 : .1) * d.frequency),0);
  const strategy = b.strategy === "income" ? netYield * 6 : b.strategy === "growth" ? (8-l.risk)*2.1 : netYield*3+(8-l.risk)*1.2;
  const score = goal === "rent" ? 100-l.rent/b.rentBudget*42-commute*1.05-l.risk*2+pref-penalty
    : goal === "live" ? 100-l.price/b.buyBudget*36-commute*1.1-l.risk*2+pref-penalty
    : strategy-downside*2.6+(l.ready?2:0)+pref-penalty;
  const why = goal === "invest" ? `${netYield.toFixed(1)}% illustrative net yield · risk scenario ${b.riskScenario}`
    : `${goal === "rent" ? "Annual rent" : "Purchase"} AED ${Math.round(goal === "rent" ? l.rent : l.price).toLocaleString("en")} · ${destinations.length ? `about ${commute} min to your routine` : "no travel preferences added"}`;
  return {score,commute,annualNet,netYield,downside,why};
}
export function calculateMatches(goal: Goal, brief: Brief, destinations: Destination[], hidden: string[], priority: string) {
  const eligible = listings.filter(l => {
    if (hidden.includes(l.id) || l.beds < brief.beds || (brief.type !== "any" && l.type !== brief.type)) return false;
    if (brief.ready === "ready" && !l.ready || brief.ready === "offplan" && l.ready) return false;
    if (!destinations.filter(d => d.required).every(d => { const t = minutes(l,d); return t !== null && t <= d.maxMinutes; })) return false;
    if (goal === "rent") return l.ready && l.rent <= brief.rentBudget && l.rent*.1 <= brief.rentUpfront;
    if (goal === "live") {
      const principal = Math.max(0,l.price*1.06-brief.downPayment);
      return l.price <= brief.buyBudget && brief.downPayment >= l.price*.26 &&
        mortgagePayment(principal) + (l.service+l.expenses)/12 <= brief.monthlyPayment;
    }
    return l.price*1.06 <= brief.capital;
  });
  const ranked = eligible.map(listing => ({listing,...computeScore(listing,goal,brief,destinations)}));
  const adjusted = (m: typeof ranked[number]) => m.score - (priority === "commute" ? m.commute*.8 : priority === "cost" ? (goal === "rent" ? m.listing.rent/5000 : m.listing.price/90000) : priority === "risk" ? m.downside*1.1 : 0);
  return ranked.sort((a,b) => adjusted(b)-adjusted(a) || a.listing.id.localeCompare(b.listing.id));
}
