import { initialBrief, places, type Brief, type Destination, type Goal } from "./sakan-engine";

export function validateBrief(raw: Record<string, unknown>): Brief {
  const b = { ...initialBrief, ...raw };
  const bounds: Record<string,[number,number]> = {
    rentBudget:[1,100000000],rentUpfront:[0,100000000],buyBudget:[1,1000000000],
    downPayment:[0,1000000000],monthlyPayment:[0,100000000],capital:[1,1000000000],
    horizon:[1,50],vacancy:[0,100],beds:[0,10],
  };
  for (const [field,[min,max]] of Object.entries(bounds)) {
    const value = b[field as keyof Brief];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${field}: use a number between ${min} and ${max}.`);
  }
  const enums: Record<string,string[]> = {
    strategy:["income","growth","balanced"],riskScenario:["steady","soft","stress"],
    ready:["any","ready","offplan"],type:["any","Apartment","Townhouse"],
    furnished:["any","yes","no"],parking:["any","yes","no"],
  };
  for (const [field,values] of Object.entries(enums)) if (!values.includes(String(b[field as keyof Brief]))) throw new Error(`Invalid ${field}.`);
  return Object.fromEntries(Object.keys(initialBrief).map(k => [k,b[k as keyof Brief]])) as unknown as Brief;
}
export function validateDestinations(raw: unknown[]): Destination[] {
  if (raw.length > 20) throw new Error("Use at most 20 destinations.");
  return raw.map(value => {
    if (!value || typeof value !== "object") throw new Error("Invalid destination.");
    const d = value as Record<string, unknown>;
    for (const key of ["id","kind","label","place","address"]) if (typeof d[key] !== "string" || (d[key] as string).length > 250) throw new Error(`Invalid destination ${key}.`);
    if (!(d.label as string).trim() || !places.includes(d.place as string)) throw new Error("Select a supported sample destination.");
    if (typeof d.frequency !== "number" || !Number.isInteger(d.frequency) || d.frequency < 1 || d.frequency > 7) throw new Error("Travel frequency must be 1–7 days.");
    if (typeof d.maxMinutes !== "number" || !Number.isFinite(d.maxMinutes) || d.maxMinutes < 5 || d.maxMinutes > 120) throw new Error("Travel limit must be 5–120 minutes.");
    if (!["car","metro","walk"].includes(String(d.mode)) || typeof d.required !== "boolean" || typeof d.preferred !== "boolean") throw new Error("Invalid travel preferences.");
    return Object.fromEntries(["id","kind","label","place","address","frequency","mode","maxMinutes","required","preferred"].map(k => [k,d[k]])) as unknown as Destination;
  });
}
export function validateDraft(raw: Record<string, unknown>): Record<string, unknown> {
  if (!Object.keys(raw).length) return {};
  if (!["rent","live","invest"].includes(String(raw.goal))) throw new Error("Select a valid property goal.");
  if (!raw.brief || typeof raw.brief !== "object" || Array.isArray(raw.brief) || !Array.isArray(raw.destinations)) throw new Error("Invalid property brief.");
  if (raw.personalUse !== undefined && typeof raw.personalUse !== "boolean") throw new Error("Invalid personal-use option.");
  const priority = raw.priority ?? "balanced";
  if (!["balanced","commute","cost","risk"].includes(String(priority))) throw new Error("Invalid ranking priority.");
  return {goal: raw.goal as Goal, brief: validateBrief(raw.brief as Record<string, unknown>),destinations:validateDestinations(raw.destinations),personalUse:raw.personalUse ?? false,priority};
}
