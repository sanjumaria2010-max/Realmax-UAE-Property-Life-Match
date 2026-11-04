import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, BedDouble, Bookmark, BriefcaseBusiness, CarFront, Check,
  Church, Clock3, Dumbbell, Eye, Heart, Home, Info, Landmark, MapPin, Pencil, Plus, RotateCcw,
  Scale, School, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Wallet, X,
} from 'lucide-react';
import {
  calculateSakanMatches, createSakanEnquiry, deleteSakanWorkspace, getSakanCatalog,
  getSakanWorkspace, saveSakanWorkspace,
} from '@workspace/api-client-react';
import type { SakanEnquiryInput, SakanWorkspaceInput } from '@workspace/api-client-react';
import {
  areaKey, estimateScore, formatAED, initialBrief, samplePlaces as fallbackPlaces,
  travelFor, type Brief, type Destination, type Enquiry, type Goal, type Listing, type Match, type Priority,
} from '../sakan-data';
import './sakan.css';

type Screen = 'home' | 'results' | 'detail' | 'privacy';
type Modal = 'destination' | 'compare' | 'enquiry' | 'how' | null;
type WorkspaceDraft = { goal: Goal; brief: Brief; destinations: Destination[]; personalUse: boolean; priority: Priority };
type SaveState = 'loading' | 'saved' | 'saving' | 'error';

const firstDestinations: Destination[] = [
  { id: 'd1', kind: 'Work', label: 'My work', place: 'DIFC Gate Avenue', address: 'DIFC, Dubai', frequency: 5, mode: 'car', maxMinutes: 35, required: true, preferred: false },
  { id: 'd2', kind: 'School', label: 'School', place: 'GEMS Wellington International School', address: 'Al Sufouh, Dubai', frequency: 5, mode: 'car', maxMinutes: 30, required: false, preferred: true },
  { id: 'd3', kind: 'Worship', label: 'Friday prayer', place: 'Jumeirah Mosque', address: 'Jumeirah 1, Dubai', frequency: 1, mode: 'car', maxMinutes: 25, required: false, preferred: true },
];
const defaultDraft: WorkspaceDraft = { goal: 'rent', brief: initialBrief, destinations: firstDestinations, personalUse: false, priority: 'balanced' };
const goalCopy: Record<Goal, { title: string; sub: string }> = {
  rent: { title: 'Rent a home', sub: 'A better fit for how your week actually works.' },
  live: { title: 'Buy to live', sub: 'Find a place that feels right beyond the floor plan.' },
  invest: { title: 'Invest thoughtfully', sub: 'See the assumptions, costs and tradeoffs up front.' },
};
const iconFor = (kind: string) => kind.toLowerCase().includes('school') ? School
  : kind.toLowerCase().includes('worship') ? Church
    : kind.toLowerCase().includes('sport') ? Dumbbell
      : kind.toLowerCase().includes('partner') ? Heart : MapPin;
const imageUrl = `${import.meta.env.BASE_URL}images/sakan-neighborhood.jpg`;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const objectValue = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const normalizeDraft = (raw: unknown): WorkspaceDraft => {
  const value = objectValue(raw);
  const goal = (['rent', 'live', 'invest'].includes(String(value.goal)) ? value.goal : defaultDraft.goal) as Goal;
  const brief = { ...initialBrief, ...objectValue(value.brief) } as Brief;
  return {
    goal, brief,
    destinations: Array.isArray(value.destinations) ? value.destinations as Destination[] : firstDestinations,
    personalUse: value.personalUse === true,
    priority: (['balanced', 'commute', 'cost', 'risk'].includes(String(value.priority)) ? value.priority : 'balanced') as Priority,
  };
};
const draftForSave = (draft: WorkspaceDraft) => ({
  goal: draft.goal, brief: draft.brief, destinations: draft.destinations,
  personalUse: draft.personalUse, priority: draft.priority,
});

function DubaiMap({ destinations }: { destinations: Destination[] }) {
  const labels: Array<[string, number, number]> = [['Dubai Marina', 72, 45], ['Downtown', 52, 34], ['DIFC', 56, 30], ['Jumeirah', 43, 48], ['Dubai Hills', 40, 30], ['JVC', 49, 59], ['Creek', 69, 27], ['Palm', 29, 39]];
  const coords: Record<string, [number, number]> = { DIFC: [58, 29], 'Dubai Marina': [72, 47], 'Al Barsha': [40, 48], 'Business Bay': [53, 36], 'Dubai Internet City': [63, 40], Jumeirah: [43, 48], JVC: [49, 59] };
  const colors = ['#d77c5e', '#28756c', '#d9af62', '#586e87', '#a47955'];
  return <div className="sakan-map" role="img" aria-label="Illustrative schematic map of Dubai showing sample areas and destination markers">
    <svg viewBox="0 0 640 300" preserveAspectRatio="xMidYMid slice">
      <rect width="640" height="300" fill="#e5eee4" />
      <path d="M0 182 C50 165 78 180 130 163 C190 144 203 177 250 155 C310 126 325 146 368 121 C415 95 448 109 485 77 C523 44 563 46 640 8 L640 0 L0 0Z" fill="#d7e8e5" />
      <path d="M23 18 C80 59 126 44 166 80 S238 103 273 135 S333 168 375 156 S444 137 479 166 S557 185 610 220" fill="none" stroke="#faf8e9" strokeWidth="17" strokeLinecap="round" />
      <path d="M80 289 C102 245 127 214 180 200 S254 179 278 146 S332 94 385 86 S475 69 543 15" fill="none" stroke="#fffdf5" strokeWidth="10" strokeLinecap="round" />
      <path d="M150 24 L208 92 L259 114 L337 151 L403 178 L456 241" fill="none" stroke="#f8f5e8" strokeWidth="7" strokeLinecap="round" />
      <path d="M320 276 C340 230 344 195 379 170 S429 148 470 121" fill="none" stroke="#d5ad77" strokeWidth="3" strokeDasharray="5 8" />
      <path d="M31 131 Q92 107 154 127 T272 153" fill="none" stroke="#a9d2cf" strokeWidth="13" strokeLinecap="round" />
      <g fill="#c9ddc8"><path d="M112 104 l22-7 22 13-10 13-26-4z" /><path d="M312 52l35-10 17 18-21 14-30-5z" /><path d="M516 199l36-13 25 13-9 26-39 2z" /><path d="M226 221l33-11 17 13-18 18-33-4z" /></g>
      {labels.map(([label, x, y]) => <g key={label} transform={`translate(${x * 6.4},${y * 3})`}><circle r="3" fill="#6e8d7c" /><text x="7" y="3" fill="#587568" fontSize="9" fontFamily="DM Sans, sans-serif">{label}</text></g>)}
      {destinations.slice(0, 5).map((destination, i) => {
        const [x, y] = coords[areaKey(destination.place)] || [55, 40];
        return <g key={destination.id} transform={`translate(${x * 6.4},${y * 3})`}>
          <circle r="13" fill={colors[i % colors.length]} opacity=".16" /><circle r="7" fill={colors[i % colors.length]} stroke="#fffef8" strokeWidth="2" />
          <text x="11" y="-9" fill="#234b47" fontSize="8" fontWeight="700" fontFamily="DM Sans, sans-serif">{destination.label}</text>
        </g>;
      })}
    </svg>
    <div className="sakan-map-caption"><MapPin size={12} /> Dubai, drawn schematically · illustrative locations, not navigation</div>
  </div>;
}

function Dialog({ titleId, children, onClose, wide = false }: { titleId: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
      if (event.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        const active = document.activeElement;
        if (!dialogRef.current.contains(active)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        else if (event.shiftKey && (active === first || active === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (active === last || active === dialogRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, []);
  return <div className="sakan-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
    <section ref={dialogRef} tabIndex={-1} className={`sakan-modal${wide ? ' sakan-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>{children}</section>
  </div>;
}

export function Sakan() {
  const [catalog, setCatalog] = useState<Listing[]>([]);
  const [places, setPlaces] = useState<string[]>(fallbackPlaces);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [draft, setDraft] = useState<WorkspaceDraft>(defaultDraft);
  const [saved, setSaved] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [step, setStep] = useState(0);
  const [screen, setScreen] = useState<Screen>('home');
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Destination | null>(null);
  const [draftDest, setDraftDest] = useState<Destination>({ id: '', kind: 'Work', label: 'My work', place: fallbackPlaces[0], address: '', frequency: 5, mode: 'car', maxMinutes: 30, required: false, preferred: true });
  const [hidden, setHidden] = useState<string[]>([]);
  const [undoHidden, setUndoHidden] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [calculatedAt, setCalculatedAt] = useState('');
  const [rankingBusy, setRankingBusy] = useState(false);
  const [rankingError, setRankingError] = useState('');
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryContact, setEnquiryContact] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [enquiryBusy, setEnquiryBusy] = useState(false);
  const [enquiryResult, setEnquiryResult] = useState<Enquiry | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const dirtyRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const sequenceRef = useRef(Promise.resolve());
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const enquiryRequestIdRef = useRef<string | null>(null);
  const resetInProgressRef = useRef(false);
  const isInvest = draft.goal === 'invest';
  const activeDests = isInvest && !draft.personalUse ? [] : draft.destinations;

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    const workspace = await getSakanWorkspace({ signal });
    if (dirtyRef.current !== savedRevisionRef.current) return;
    const serverDraft = normalizeDraft(workspace.draft);
    setDraft(serverDraft);
    setSaved(workspace.saved);
    setCompare(workspace.compare);
    setEnquiries(workspace.enquiries);
    setWorkspaceReady(true);
    setSaveState('saved');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    Promise.all([getSakanCatalog({ signal: controller.signal }), loadWorkspace(controller.signal)])
      .then(([result]) => {
        setCatalog(result.listings as unknown as Listing[]);
        setPlaces(result.places);
        setCatalogState('ready');
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogState('error');
        setSaveState('error');
        setError(errorText(loadError));
      });
    return () => { mountedRef.current = false; controller.abort(); abortRef.current?.abort(); };
  }, [loadWorkspace]);

  const persist = useCallback((payload: SakanWorkspaceInput) => {
    const revision = dirtyRef.current;
    setSaveState('saving');
    const task = sequenceRef.current.then(() => {
      if (resetInProgressRef.current) throw new Error('Workspace deletion is in progress.');
      return saveSakanWorkspace(payload);
    });
    sequenceRef.current = task.then(() => undefined, () => undefined);
    return task.then((result) => {
      if (mountedRef.current && revision === dirtyRef.current) {
        setEnquiries(result.enquiries);
        savedRevisionRef.current = revision;
        setSaveState('saved');
        setError('');
      }
    }).catch((saveError: unknown) => {
      if (mountedRef.current && !resetInProgressRef.current) {
        setSaveState('error');
        setError(errorText(saveError));
      }
      throw saveError;
    });
  }, []);
  const snapshot = useCallback((nextDraft = draft, nextSaved = saved, nextCompare = compare): SakanWorkspaceInput => ({
    draft: draftForSave(nextDraft), saved: nextSaved, compare: nextCompare,
  }), [draft, saved, compare]);
  const touch = useCallback(() => { dirtyRef.current += 1; }, []);
  useEffect(() => {
    if (!workspaceReady || resetBusy) return;
    const timer = window.setTimeout(() => {
      if (!resetInProgressRef.current) void persist(snapshot()).catch(() => undefined);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [workspaceReady, resetBusy, draft, saved, compare, persist, snapshot]);
  useEffect(() => {
    const refetch = () => {
      if (document.visibilityState === 'visible' && dirtyRef.current === savedRevisionRef.current && workspaceReady) {
        void loadWorkspace().catch((loadError: unknown) => { setError(errorText(loadError)); setSaveState('error'); });
      }
    };
    window.addEventListener('focus', refetch);
    return () => window.removeEventListener('focus', refetch);
  }, [loadWorkspace, workspaceReady]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateDraft = (patch: Partial<WorkspaceDraft>) => {
    touch();
    setDraft((previous) => ({ ...previous, ...patch }));
  };
  const updateBrief = (key: keyof Brief, value: Brief[keyof Brief]) =>
    updateDraft({ brief: { ...draft.brief, [key]: value } as Brief });
  const saveNow = useCallback(async (payload = snapshot()) => {
    if (!workspaceReady) throw new Error('Your private workspace is still loading. Please try again.');
    await persist(payload);
  }, [workspaceReady, persist, snapshot]);
  const activeStep = step;
  const stepTitles = isInvest && !draft.personalUse ? ['Finance', 'Preferences', 'Review'] : ['Your places', 'Weekly rhythm', 'Budget', 'Preferences', 'Review'];
  const stepCount = stepTitles.length;
  const validate = () => {
    if (draft.goal === 'rent' && draft.brief.rentBudget <= 0) return 'Enter a positive annual rent budget.';
    if (draft.goal === 'live' && (draft.brief.buyBudget <= 0 || draft.brief.monthlyPayment < 0)) return 'Enter a positive purchase budget and non-negative monthly amount.';
    if (draft.goal === 'invest' && (draft.brief.capital <= 0 || draft.brief.horizon < 1)) return 'Enter a positive investment amount and a horizon of at least one year.';
    return '';
  };
  const calculate = useCallback(async (nextHidden = hidden, nextPriority = draft.priority, navigate = true) => {
    const validation = validate();
    if (validation) { setError(validation); return false; }
    setError('');
    setRankingError('');
    setRankingBusy(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await saveNow();
      const response = await calculateSakanMatches({
        goal: draft.goal, brief: draft.brief, destinations: activeDests, hidden: nextHidden, priority: nextPriority,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return false;
      setMatches(response.matches as unknown as Match[]);
      setCalculatedAt(response.calculatedAt);
      if (navigate) setScreen('results');
      return true;
    } catch (calculateError) {
      if (!controller.signal.aborted) setRankingError(errorText(calculateError));
      return false;
    } finally {
      if (!controller.signal.aborted) setRankingBusy(false);
    }
  }, [activeDests, draft, hidden, saveNow]);

  const changePriority = (priority: Priority) => {
    updateDraft({ priority });
    void calculate(hidden, priority, screen === 'results');
  };
  const toggleSave = async (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    touch();
    setSaved(next);
    try { await saveNow(snapshot(draft, next, compare)); setToast(next.includes(id) ? 'Home saved to your private workspace' : 'Home removed from saved'); }
    catch (saveError) { setError(errorText(saveError)); }
  };
  const toggleCompare = async (id: string) => {
    if (!compare.includes(id) && compare.length >= 3) { setToast('Compare up to three homes at a time'); return; }
    const next = compare.includes(id) ? compare.filter((item) => item !== id) : [...compare, id];
    touch();
    setCompare(next);
    try { await saveNow(snapshot(draft, saved, next)); }
    catch (saveError) { setError(errorText(saveError)); }
  };
  const hideListing = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    setUndoHidden(id);
    void calculate(next);
  };
  const undoHide = () => {
    if (!undoHidden) return;
    const next = hidden.filter((id) => id !== undoHidden);
    setHidden(next);
    setUndoHidden(null);
    void calculate(next);
  };
  const flushBeforeLeaving = async () => {
    try { await saveNow(); return true; }
    catch (saveError) { setError(errorText(saveError)); return false; }
  };
  const changeGoal = (goal: Goal) => {
    const brief = { ...draft.brief };
    if (goal === 'rent') brief.rentBudget = Math.max(brief.rentBudget, 70000);
    if (goal === 'live') brief.buyBudget = Math.max(brief.buyBudget, 850000);
    if (goal === 'invest') brief.capital = Math.max(brief.capital, 850000);
    updateDraft({ goal, brief });
    setStep(0);
    setError('');
  };
  const openDestination = (destination?: Destination) => {
    setEditing(destination?.id ? destination : null);
    setDraftDest(destination?.id ? { ...destination } : { id: '', kind: 'Work', label: 'My work', place: places[0] || fallbackPlaces[0], address: '', frequency: 5, mode: 'car', maxMinutes: 30, required: false, preferred: true });
    setModal('destination');
  };
  const saveDestination = () => {
    if (!draftDest.label.trim() || !draftDest.place.trim()) { setError('Add a destination name and place to continue.'); return; }
    if (draftDest.maxMinutes < 5 || draftDest.maxMinutes > 120) { setError('Travel limit must be between 5 and 120 minutes.'); return; }
    const next = editing
      ? draft.destinations.map((destination) => destination.id === editing.id ? draftDest : destination)
      : [...draft.destinations, { ...draftDest, id: crypto.randomUUID() }];
    updateDraft({ destinations: next });
    setModal(null);
    setError('');
    setToast(editing ? 'Destination updated' : 'Destination added');
  };
  const resetWorkspace = async () => {
    if (!window.confirm('Delete this private browser workspace, including saved homes, your brief and enquiry history? This cannot be undone.')) return;
    resetInProgressRef.current = true;
    setResetBusy(true);
    try {
      await sequenceRef.current;
      await deleteSakanWorkspace();
      dirtyRef.current = 0;
      savedRevisionRef.current = 0;
      const freshWorkspace = await getSakanWorkspace();
      setDraft(normalizeDraft(freshWorkspace.draft));
      setSaved(freshWorkspace.saved);
      setCompare(freshWorkspace.compare);
      setEnquiries(freshWorkspace.enquiries);
      setMatches([]);
      setHidden([]);
      setUndoHidden(null);
      setScreen('home');
      setStep(0);
      setModal(null);
      setSaveState('saved');
      setWorkspaceReady(true);
      setToast('Private workspace deleted and reinitialized');
    } catch (resetError) {
      setError(`Could not delete your workspace. ${errorText(resetError)}`);
      setSaveState('error');
    } finally { resetInProgressRef.current = false; setResetBusy(false); }
  };

  const chosen = catalog.find((listing) => listing.id === selected) || null;
  const matchById = new Map(matches.map((match) => [match.listing.id, match]));
  const explainMatch = (why: string) => activeDests.length
    ? why
    : why.replace(/(?:about\s+|~)?0(?:\.0)?\s*(?:min|minutes)(?:\s+to your routine)?/gi, 'personal travel not included');
  const rawDetailScore = chosen ? matchById.get(chosen.id) || estimateScore(chosen, draft.goal, draft.brief, activeDests) : null;
  const detailScore = rawDetailScore ? { ...rawDetailScore, why: explainMatch(rawDetailScore.why) } : null;
  const detailPrincipal = chosen ? Math.max(0, chosen.price * 1.06 - draft.brief.downPayment) : 0;
  const detailMonthlyLoan = detailPrincipal * (.0525 / 12) / (1 - Math.pow(1 + .0525 / 12, -240));
  const detailAnnualOperating = chosen ? chosen.service + chosen.expenses : 0;
  const detailFinancialRows = chosen && detailScore ? draft.goal === 'rent' ? <>
    <div className="sakan-breakdown-row"><span>Annual rent</span><strong>{formatAED(chosen.rent)}</strong></div>
    <div className="sakan-breakdown-row"><span>Illustrative deposit + agency/admin reserve (10%)</span><strong>{formatAED(chosen.rent * .1)}</strong></div>
    <div className="sakan-breakdown-row"><span>Your upfront boundary · first rent cheque excluded</span><strong>{formatAED(draft.brief.rentUpfront)}</strong></div>
  </> : draft.goal === 'live' ? <>
    <div className="sakan-breakdown-row"><span>Sample purchase price</span><strong>{formatAED(chosen.price)}</strong></div>
    <div className="sakan-breakdown-row"><span>Illustrative acquisition costs (6%)</span><strong>{formatAED(chosen.price * .06)}</strong></div>
    <div className="sakan-breakdown-row"><span>Minimum cash boundary · 26% of price</span><strong>{formatAED(chosen.price * .26)}</strong></div>
    <div className="sakan-breakdown-row"><span>Your available cash</span><strong>{formatAED(draft.brief.downPayment)}</strong></div>
    <div className="sakan-breakdown-row"><span>Illustrative financed principal · price + costs − cash</span><strong>{formatAED(detailPrincipal)}</strong></div>
    <div className="sakan-breakdown-row"><span>Illustrative monthly loan · 20 years at 5.25%</span><strong>{formatAED(detailMonthlyLoan)}</strong></div>
    <div className="sakan-breakdown-row"><span>Annual operating costs · service + operating</span><strong>{formatAED(detailAnnualOperating)} / year</strong></div>
    <div className="sakan-breakdown-row"><span>Monthly loan + annual operating costs / 12</span><strong>{formatAED(detailMonthlyLoan + detailAnnualOperating / 12)} / month</strong></div>
  </> : <>
    <div className="sakan-breakdown-row"><span>Annual gross rent assumption</span><strong>{formatAED(chosen.rent)}</strong></div>
    <div className="sakan-breakdown-row"><span>Vacancy allowance ({draft.brief.vacancy}%)</span><strong>− {formatAED(chosen.rent * draft.brief.vacancy / 100)}</strong></div>
    <div className="sakan-breakdown-row"><span>Annual operating costs · service + operating</span><strong>− {formatAED(detailAnnualOperating)} / year</strong></div>
    <div className="sakan-breakdown-row"><span>Net annual income before debt</span><strong>{formatAED(detailScore.annualNet)} / year</strong></div>
    <div className="sakan-breakdown-row"><span>Sample net yield · all-in acquisition costs</span><strong>{detailScore.netYield.toFixed(1)}%</strong></div>
    <div className="sakan-breakdown-row"><span>Downside lens · {draft.brief.riskScenario}</span><strong>{detailScore.downside.toFixed(1)} / 10</strong></div>
  </> : null;
  const currencyInput = (value: number, set: (next: number) => void, stepSize = 5000) =>
    <input className="sakan-input" type="number" min="0" step={stepSize} value={value} onChange={(event) => set(Math.max(0, Number(event.target.value) || 0))} />;
  const openEnquiry = (listing: Listing) => {
    setSelected(listing.id);
    setConsent(false);
    setEnquiryResult(null);
    setEnquiryName('');
    setEnquiryContact('');
    setEnquiryMessage(`Hello, I am interested in learning more about ${listing.name}. Could you share availability, costs and viewing details?`);
    enquiryRequestIdRef.current = crypto.randomUUID();
    setError('');
    setModal('enquiry');
  };
  const submitEnquiry = async () => {
    if (!chosen) return;
    if (!enquiryName.trim()) { setError('Enter your name.'); return; }
    const contact = enquiryContact.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const validPhone = /^\+?[0-9 ()-]{7,20}$/.test(contact) && (contact.match(/\d/g)?.length || 0) >= 7;
    if (!validEmail && !validPhone) { setError('Enter a valid email address or phone number.'); return; }
    if (!enquiryMessage.trim()) { setError('Write a message before submitting.'); return; }
    if (!consent) { setError('Confirm that this enquiry is stored in Sakan and not forwarded.'); return; }
    const input: SakanEnquiryInput = {
      listingId: chosen.id, name: enquiryName.trim(), contact, message: enquiryMessage.trim(),
      consent: true, requestId: enquiryRequestIdRef.current || crypto.randomUUID(),
    };
    setEnquiryBusy(true);
    setError('');
    try {
      const result = await createSakanEnquiry(input);
      setEnquiryResult(result as Enquiry);
      setEnquiries((previous) => [result as Enquiry, ...previous]);
      enquiryRequestIdRef.current = null;
    } catch (submitError) { setError(errorText(submitError)); }
    finally { setEnquiryBusy(false); }
  };

  const goalSelector = <section className="sakan-goal-panel" aria-label="Choose your home goal">
    <h2>What are you looking for?</h2>
    <div className="sakan-goals">{(['rent', 'live', 'invest'] as Goal[]).map((goal, index) => {
      const Icon = index === 0 ? Home : index === 1 ? Heart : Landmark;
      return <button key={goal} onClick={() => changeGoal(goal)} className={`sakan-goal${draft.goal === goal ? ' active' : ''}`} aria-pressed={draft.goal === goal}>
        <span className="sakan-goal-icon"><Icon size={18} /></span><span><strong>{goalCopy[goal].title}</strong><small>{goalCopy[goal].sub}</small></span>
        {draft.goal === goal && <Check size={15} className="goal-check" />}
      </button>;
    })}</div>
  </section>;

  const destinationsStep = <div className="journey-content">
    <p className="sakan-help">Start with the places your week revolves around. We use these to compare sample travel times—not to track you.</p>
    {isInvest && <label className="sakan-checkline"><input type="checkbox" checked={draft.personalUse} onChange={(event) => { updateDraft({ personalUse: event.target.checked }); setStep(0); }} />I may use this investment as a home later, so include personal destinations.</label>}
    {!activeDests.length ? <div className="sakan-empty"><MapPin size={22} /><h3>No destinations yet</h3><p>{isInvest ? 'A pure investment brief can skip personal travel. Add personal-use places if you want them included.' : 'Add places that shape your week to see practical travel tradeoffs.'}</p></div>
      : <div className="sakan-destinations">{activeDests.map((destination) => {
        const Icon = iconFor(destination.kind);
        return <div className="sakan-destination" key={destination.id}>
          <span className="sakan-pin"><Icon size={16} /></span><div><div className="sakan-dest-name">{destination.label}</div><div className="sakan-dest-meta">{destination.place} · {destination.frequency} {destination.frequency === 1 ? 'day' : 'days'}/week · {destination.mode}</div></div>
          <span className="sakan-badge">{destination.required ? 'Required' : 'Preferred'}</span>
          <div className="sakan-dest-actions"><button className="sakan-icon-button" aria-label={`Edit ${destination.label}`} onClick={() => openDestination(destination)}><Pencil size={14} /></button><button className="sakan-icon-button" aria-label={`Remove ${destination.label}`} onClick={() => updateDraft({ destinations: draft.destinations.filter((item) => item.id !== destination.id) })}><Trash2 size={14} /></button></div>
        </div>;
      })}</div>}
    {(!isInvest || draft.personalUse) && <button className="sakan-add-dest" onClick={() => openDestination()}><Plus size={15} /> Add a place in your life</button>}
    <div className="sakan-section-title">Common starting points</div>
    <div className="sakan-toggle-row">{['Work', 'Partner work', 'School', 'Worship', 'Sport', 'Custom'].map((kind) => <button key={kind} className="sakan-chip" onClick={() => openDestination({ id: '', kind, label: kind === 'Work' ? 'My work' : kind, place: places[kind === 'School' ? 2 : kind === 'Worship' ? 3 : kind === 'Sport' ? 6 : 0] || fallbackPlaces[0], address: '', frequency: kind === 'Worship' ? 1 : 5, mode: 'car', maxMinutes: 30, required: false, preferred: true })}><Plus size={11} /> {kind}</button>)}</div>
  </div>;
  const routineStep = <div className="journey-content">
    <p className="sakan-help">A weekday commute and a weekly class are not the same priority. Tune how much each place matters.</p>
    {!activeDests.length ? <div className="sakan-empty"><h3>Nothing to schedule</h3><p>Your investor results are ranked on the assumptions you choose. Personal destinations are currently switched off.</p><button className="sakan-secondary" onClick={() => setStep(0)}>Add personal-use places</button></div>
      : <div className="sakan-destinations">{activeDests.map((destination) => <div className="sakan-destination" key={destination.id}><span className="sakan-pin"><Clock3 size={15} /></span><div><div className="sakan-dest-name">{destination.label}</div><div className="sakan-dest-meta">{destination.place}</div></div>
        <select aria-label={`Days per week at ${destination.label}`} className="sakan-select frequency-select" value={destination.frequency} onChange={(event) => updateDraft({ destinations: draft.destinations.map((item) => item.id === destination.id ? { ...item, frequency: Number(event.target.value) } : item) })}>{[1, 2, 3, 4, 5, 6, 7].map((count) => <option value={count} key={count}>{count} {count === 1 ? 'day' : 'days'} / week</option>)}</select>
        <button className="sakan-icon-button" aria-label={`Edit travel priority for ${destination.label}`} onClick={() => openDestination(destination)}><Pencil size={14} /></button>
      </div>)}</div>}
    <div className="sakan-section-title">How should travel feel?</div><div className="sakan-toggle-row">{['Easy weekday', 'Balanced week', 'Fewer compromises'].map((label, i) => <button key={label} className={`sakan-chip${draft.priority === (i === 0 ? 'commute' : i === 1 ? 'balanced' : 'cost') ? ' active' : ''}`} onClick={() => updateDraft({ priority: i === 0 ? 'commute' : i === 1 ? 'balanced' : 'cost' })}>{label}</button>)}</div>
    <div className="sakan-sample-banner"><Info size={14} />Travel times are invented sample assumptions by area and mode. They are not live traffic or route guidance.</div>
  </div>;

  const financeStep = <div className="journey-content">
    {draft.goal === 'rent' ? <>
      <div className="sakan-sample-banner"><Wallet size={14} />Your rent limit is annual rent. The upfront boundary is an illustrative 10% deposit and agency/admin reserve only; it excludes the first rent cheque and is not total move-in cash.</div>
      <div className="sakan-form-grid"><div className="sakan-field"><label>Annual rent ceiling (AED)</label>{currencyInput(draft.brief.rentBudget, (value) => updateBrief('rentBudget', value), 1000)}<small>Listings above this amount will be filtered out.</small></div><div className="sakan-field"><label>Upfront amount available (AED)</label>{currencyInput(draft.brief.rentUpfront, (value) => updateBrief('rentUpfront', value), 1000)}<small>Illustrative deposit, agency and move-in planning.</small></div></div>
      <div className="sakan-section-title">Illustrative upfront boundary · excludes first rent cheque</div><div className="sakan-breakdown"><div className="sakan-breakdown-row"><span>Security deposit planning (5%)</span><strong>{formatAED(draft.brief.rentBudget * .05)}</strong></div><div className="sakan-breakdown-row"><span>Agency and admin planning (5%)</span><strong>{formatAED(draft.brief.rentBudget * .05)}</strong></div><div className="sakan-breakdown-row"><span>Remaining amount under your upfront limit</span><strong>{formatAED(Math.max(0, draft.brief.rentUpfront - draft.brief.rentBudget * .1))}</strong></div></div>
    </> : draft.goal === 'live' ? <>
      <div className="sakan-sample-banner"><Wallet size={14} />Planning estimates only. Acquisition costs are illustrative at 6%. Financing, where needed, uses an illustrative 20-year loan at 5.25%; sufficient cash can mean no financed amount.</div>
      <div className="sakan-form-grid"><div className="sakan-field"><label>Purchase price ceiling (AED)</label>{currencyInput(draft.brief.buyBudget, (value) => updateBrief('buyBudget', value), 10000)}<small>Properties above the ceiling will not appear.</small></div><div className="sakan-field"><label>Cash available now (AED)</label>{currencyInput(draft.brief.downPayment, (value) => updateBrief('downPayment', value), 10000)}</div><div className="sakan-field"><label>Comfortable monthly payment (AED)</label>{currencyInput(draft.brief.monthlyPayment, (value) => updateBrief('monthlyPayment', value), 500)}<small>Sample 20-year mortgage at 5.25% only for comparison.</small></div><div className="sakan-field"><label>Planning reserve for fees</label><input className="sakan-input" value="6% · sample" readOnly /></div></div>
      <div className="sakan-section-title">Monthly comfort includes illustrative operating costs</div><div className="sakan-breakdown"><div className="sakan-breakdown-row"><span>Sample acquisition cost reserve (6%)</span><strong>{formatAED(draft.brief.buyBudget * .06)}</strong></div><div className="sakan-breakdown-row"><span>Minimum cash boundary (20% deposit + 6% acquisition costs)</span><strong>{formatAED(draft.brief.buyBudget * .26)}</strong></div><div className="sakan-breakdown-row"><span>Illustrative financed principal after cash available</span><strong>{formatAED(Math.max(0, draft.brief.buyBudget * 1.06 - draft.brief.downPayment))}</strong></div><div className="sakan-breakdown-row"><span>Sample monthly payment + typical monthly operating costs</span><strong>Varies by matched home</strong></div></div>
    </> : <>
      <div className="sakan-sample-banner"><Landmark size={14} />An analytical view, not a promise of returns. Sample assumptions make operating cost and downside visible.</div>
      <div className="sakan-form-grid"><div className="sakan-field"><label>Total capital available (AED)</label>{currencyInput(draft.brief.capital, (value) => updateBrief('capital', value), 10000)}<small>Includes a 6% sample purchase-cost reserve.</small></div><div className="sakan-field"><label>Investment horizon (years)</label><input className="sakan-input" type="number" min="1" max="30" value={draft.brief.horizon} onChange={(event) => updateBrief('horizon', Math.max(1, Math.min(30, Number(event.target.value) || 1)))} /></div><div className="sakan-field"><label>Strategy lens</label><select className="sakan-select" value={draft.brief.strategy} onChange={(event) => updateBrief('strategy', event.target.value as Brief['strategy'])}><option value="income">Income first</option><option value="balanced">Balanced tradeoff</option><option value="growth">Growth potential</option></select></div><div className="sakan-field"><label>Vacancy allowance</label><select className="sakan-select" value={draft.brief.vacancy} onChange={(event) => updateBrief('vacancy', Number(event.target.value))}>{[4, 6, 10, 14].map((value) => <option value={value} key={value}>{value}% · sample assumption</option>)}</select></div><div className="sakan-field"><label>Downside scenario</label><select className="sakan-select" value={draft.brief.riskScenario} onChange={(event) => updateBrief('riskScenario', event.target.value as Brief['riskScenario'])}><option value="steady">Steady</option><option value="soft">Soft market</option><option value="stress">Stress case</option></select></div><div className="sakan-field"><label>Debt service</label><input className="sakan-input" value="Not assumed in net yield" readOnly /><small>Debt service is separate from operating-cost net yield.</small></div></div>
    </>}
  </div>;
  const preferencesStep = <div className="journey-content">
    <p className="sakan-help">Set a few real boundaries. Hard requirements filter homes out; preferences help you compare what remains.</p>
    <div className="sakan-form-grid"><div className="sakan-field"><label>At least this many bedrooms</label><select className="sakan-select" value={draft.brief.beds} onChange={(event) => updateBrief('beds', Number(event.target.value))}>{[0, 1, 2, 3].map((value) => <option value={value} key={value}>{value === 0 ? 'Studio or more' : `${value}+ bedrooms`}</option>)}</select></div><div className="sakan-field"><label>Home type</label><select className="sakan-select" value={draft.brief.type} onChange={(event) => updateBrief('type', event.target.value)}><option value="any">Any home type</option><option value="Apartment">Apartment</option><option value="Townhouse">Townhouse</option></select></div><div className="sakan-field"><label>Availability · required</label><select className="sakan-select" value={draft.brief.ready} onChange={(event) => updateBrief('ready', event.target.value)}><option value="any">Ready or off-plan</option><option value="ready">Ready only</option><option value="offplan">Off-plan only</option></select></div><div className="sakan-field"><label>Furnishing · preferred</label><select className="sakan-select" value={draft.brief.furnished} onChange={(event) => updateBrief('furnished', event.target.value)}><option value="any">No preference</option><option value="yes">Furnished</option><option value="no">Unfurnished</option></select></div><div className="sakan-field"><label>Parking · preferred</label><select className="sakan-select" value={draft.brief.parking} onChange={(event) => updateBrief('parking', event.target.value)}><option value="any">No preference</option><option value="yes">Parking included</option></select></div></div>
    <div className="sakan-section-title">Your priorities</div><div className="sakan-toggle-row">{[{ key: 'balanced', label: 'Balanced' }, { key: 'commute', label: 'Closer to routine' }, { key: 'cost', label: 'Lower cost' }, { key: 'risk', label: 'Lower downside' }].map((item) => <button key={item.key} className={`sakan-chip${draft.priority === item.key ? ' active' : ''}`} onClick={() => changePriority(item.key as Priority)}>{item.label}</button>)}</div>
  </div>;
  const reviewStep = <div className="journey-content">
    <div className="sakan-sample-banner"><BadgeCheck size={14} />Your brief and saved homes are stored in a private server-side browser workspace. Destinations are sent only to calculate sample rankings, not shared with households or agents.</div>
    <div className="sakan-review-grid"><div className="sakan-card review-card"><div className="sakan-eyebrow">Your goal</div><strong>{goalCopy[draft.goal].title}</strong><button className="sakan-textbutton" onClick={() => setStep(0)}>Edit journey</button></div><div className="sakan-card review-card"><div className="sakan-eyebrow">Budget limit</div><strong>{formatAED(draft.goal === 'rent' ? draft.brief.rentBudget : draft.goal === 'live' ? draft.brief.buyBudget : draft.brief.capital)}{draft.goal === 'rent' ? ' / year' : ''}</strong><button className="sakan-textbutton" onClick={() => setStep(isInvest && !draft.personalUse ? 0 : 2)}>Edit money</button></div><div className="sakan-card review-card"><div className="sakan-eyebrow">Home boundaries</div><strong>{draft.brief.beds ? `${draft.brief.beds}+ bedrooms` : 'Studio+'} · {draft.brief.type === 'any' ? 'any type' : draft.brief.type}</strong><button className="sakan-textbutton" onClick={() => setStep(isInvest && !draft.personalUse ? 1 : 3)}>Edit preferences</button></div><div className="sakan-card review-card"><div className="sakan-eyebrow">Weekly context</div><strong>{activeDests.length ? `${activeDests.length} destinations · ${draft.priority} priority` : 'No personal travel included'}</strong><button className="sakan-textbutton" onClick={() => { if (isInvest && !draft.personalUse) updateDraft({ personalUse: true }); setStep(0); }}>Edit places</button></div></div>
    {activeDests.length > 0 && <DubaiMap destinations={activeDests} />}
    {isInvest && <p className="sakan-note">Horizon {draft.brief.horizon} years · {draft.brief.strategy} · {draft.brief.vacancy}% vacancy planning · {draft.brief.riskScenario} downside case</p>}
  </div>;

  const goStep = async (direction: number) => {
    if (direction < 0) { setStep(Math.max(0, step + direction)); return; }
    if (activeStep === stepCount - 1) { await calculate(); return; }
    setStep(Math.min(stepCount - 1, step + direction));
    setError('');
  };
  const journeyPane = () => {
    let content = destinationsStep;
    if (isInvest && !draft.personalUse) content = activeStep === 0 ? financeStep : activeStep === 1 ? preferencesStep : reviewStep;
    else if (activeStep === 1) content = routineStep;
    else if (activeStep === 2) content = financeStep;
    else if (activeStep === 3) content = preferencesStep;
    else if (activeStep === 4) content = reviewStep;
    return <div className="sakan-card sakan-journey">
      <div className="sakan-step-head"><div><div className="sakan-eyebrow">{isInvest && !draft.personalUse ? 'Investor brief' : 'Your home brief'} · Step {activeStep + 1} of {stepCount}</div><h2>{stepTitles[activeStep]}</h2></div><div className="step-progress"><span>{Math.round((activeStep + 1) / stepCount * 100)}% shaped</span><div className="sakan-progress" aria-label={`Step ${activeStep + 1} of ${stepCount}`}>{stepTitles.map((title, index) => <i className={index <= activeStep ? 'done' : ''} key={title} />)}</div></div></div>
      {content}
      {error && <div className="sakan-error" role="alert">{error}</div>}
      <div className="sakan-step-actions"><button className="sakan-secondary" onClick={() => activeStep === 0 ? setScreen('home') : void goStep(-1)}><ArrowLeft size={14} /> Back</button><button className="sakan-primary" disabled={rankingBusy || catalogState !== 'ready'} onClick={() => void goStep(1)}>{activeStep === stepCount - 1 ? 'See sample matches' : 'Continue'}<ArrowRight size={14} /></button></div>
    </div>;
  };

  const listingCard = (listing: Listing, rank: number) => {
    const result = matchById.get(listing.id) || estimateScore(listing, draft.goal, draft.brief, activeDests);
    const price = draft.goal === 'rent' ? listing.rent : listing.price;
    return <article className="sakan-card sakan-listing" key={listing.id}>
      <div className="sakan-listing-image"><img src={imageUrl} alt={`Illustrative Dubai neighbourhood home, not a photo of ${listing.name}`} /><span className="sakan-list-badge">{rank === 0 ? 'Closest fit' : listing.ready ? 'Ready' : 'Off-plan'}</span></div>
      <div className="sakan-listing-body"><h3>{listing.name}</h3><div className="sakan-listing-loc"><MapPin size={11} />{listing.area}</div>
        <div className="sakan-listing-price"><strong>{formatAED(price)}</strong><span>{draft.goal === 'rent' ? 'per year' : 'purchase'}{draft.goal === 'invest' ? ` · ${result.netYield.toFixed(1)}% sample net yield` : ''}</span></div>
        <div className="sakan-listing-specs"><span><BedDouble size={12} />{listing.beds} bed</span><span>{listing.sqft.toLocaleString()} sqft</span><span><CarFront size={12} />{listing.parking ? 'Parking' : 'No parking'}</span></div>
        <div className="sakan-fit">{explainMatch(result.why)}</div>{draft.goal === 'invest' && <div className="sakan-listing-loc costs">Operating costs {formatAED(listing.service + listing.expenses)} / yr · vacancy {draft.brief.vacancy}% assumed</div>}
        <div className="sakan-card-buttons"><button className="sakan-secondary" onClick={() => { setSelected(listing.id); setScreen('detail'); }}><Eye size={13} />Details</button><button className={`sakan-secondary${saved.includes(listing.id) ? ' active' : ''}`} aria-pressed={saved.includes(listing.id)} onClick={() => void toggleSave(listing.id)}><Bookmark size={13} />{saved.includes(listing.id) ? 'Saved' : 'Save'}</button><button className={`sakan-secondary${compare.includes(listing.id) ? ' active' : ''}`} aria-pressed={compare.includes(listing.id)} onClick={() => void toggleCompare(listing.id)}><Scale size={13} />{compare.includes(listing.id) ? 'Added' : 'Compare'}</button><button className="sakan-icon-button" aria-label={`Hide ${listing.name}`} onClick={() => hideListing(listing.id)}><X size={14} /></button></div>
      </div>
    </article>;
  };

  const areaGroups = useMemo(() => {
    const groups = new Map<string, Match[]>();
    matches.forEach((match) => groups.set(match.listing.area, [...(groups.get(match.listing.area) || []), match]));
    return [...groups.entries()];
  }, [matches]);
  const resultView = <div className="sakan-results">
    <div className="sakan-result-head"><div><div className="sakan-eyebrow">A considered shortlist · sample data</div><h2>Homes around your life.</h2><p>{matches.length} sample {matches.length === 1 ? 'match' : 'matches'} · ranked for {goalCopy[draft.goal].title.toLowerCase()}</p>{calculatedAt && <small className="sakan-note">Ranking calculated {new Date(calculatedAt).toLocaleString()}</small>}</div>
      <div className="sakan-result-controls"><button onClick={async () => { if (await flushBeforeLeaving()) { setScreen('home'); setStep(isInvest && !draft.personalUse ? 2 : 4); } }}><Pencil size={13} /> Edit brief</button><button onClick={() => setModal('compare')}><Scale size={13} /> Compare {compare.length}</button></div>
    </div>
    <div className="sakan-sample-banner"><Info size={14} />Fictional sample listings and assumptions, not live inventory or current market data. Images are illustrative. Travel times and costs are for comparing, not advice.</div>
    <div className="sakan-priority"><div><strong>Ranking lens</strong><br /><span>{draft.priority === 'commute' ? 'Give more weight to everyday travel' : draft.priority === 'cost' ? 'Give more weight to budget headroom' : draft.priority === 'risk' ? 'Give more weight to downside' : `Balanced ${draft.goal === 'invest' ? 'return and downside' : 'cost and travel'} comparison`}</span></div><select aria-label="Choose ranking priority" value={draft.priority} onChange={(event) => changePriority(event.target.value as Priority)}><option value="balanced">Balanced</option><option value="commute">Closer to routine</option><option value="cost">Lower cost</option><option value="risk">Lower downside</option></select></div>
    {undoHidden && <div className="sakan-sample-banner undo-banner">One sample home hidden.<button className="sakan-textbutton" onClick={undoHide}>Undo</button></div>}
    {rankingError && <div className="sakan-error" role="alert">{rankingError}<button className="sakan-textbutton" onClick={() => void calculate()}>Retry ranking</button></div>}
    {rankingBusy ? <div className="sakan-empty" role="status"><div className="sakan-spinner" /><h3>Recalculating the sample shortlist</h3><p>The server is applying your boundaries and ranking lens.</p></div>
      : matches.length === 0 ? <div className="sakan-empty"><Search size={23} /><h3>No sample homes meet every hard boundary</h3><p>We will not quietly relax your price, bedroom or availability limits. Loosen a boundary or change the budget to see more homes.</p><button className="sakan-primary" onClick={() => setScreen('home')}><SlidersHorizontal size={14} /> Edit brief</button></div>
        : <>
          <section className="area-overview"><div className="sakan-section-title">Area overview · from your matches</div><div className="area-pills">{areaGroups.map(([area, items]) => <button key={area} onClick={() => document.getElementById(`area-${area.replace(/\W/g, '-')}`)?.scrollIntoView({ behavior: 'smooth' })}>{area}<span>{items.length}</span></button>)}</div></section>
          {areaGroups.map(([area, items]) => <section key={area} id={`area-${area.replace(/\W/g, '-')}`} className="result-area"><h3>{area}<span>{items.length} sample {items.length === 1 ? 'home' : 'homes'}</span></h3><div className="sakan-listing-grid">{items.map((item, index) => listingCard(item.listing, index))}</div></section>)}
        </>}
    <div className="result-bottom"><button className="sakan-secondary" onClick={async () => { if (await flushBeforeLeaving()) { setScreen('home'); setStep(isInvest && !draft.personalUse ? 2 : 4); } }}><ArrowLeft size={14} /> Back to brief</button><button className="sakan-secondary" onClick={() => setScreen('privacy')}><Bookmark size={14} /> Saved & privacy ({saved.length})</button></div>
  </div>;

  const detailView = chosen && detailScore ? <div>
    <div className="sakan-result-head"><div><button className="sakan-textbutton" onClick={() => setScreen('results')}><ArrowLeft size={14} /> Back to matches</button><div className="sakan-eyebrow">Sample property · {chosen.fresh}</div></div><div className="sakan-result-controls"><button onClick={() => void toggleSave(chosen.id)}><Bookmark size={13} />{saved.includes(chosen.id) ? 'Saved' : 'Save'}</button><button onClick={() => openEnquiry(chosen)}>Record an enquiry</button></div></div>
     <div className="sakan-detail-layout"><div><div className="sakan-detail-image"><img src={imageUrl} alt="Illustrative Dubai residential architecture, not an actual property photo" /></div><div className="sakan-card detail-context"><div className="sakan-eyebrow">A little context</div><p>{chosen.description}</p><div className="sakan-listing-specs"><span><BedDouble size={13} />{chosen.beds} bed</span><span>{chosen.baths} bath</span><span>{chosen.sqft.toLocaleString()} sqft</span><span>{chosen.ready ? 'Ready' : 'Off-plan'}</span></div></div></div>
      <div className="sakan-card sakan-detail-panel"><div className="sakan-eyebrow">{chosen.area} · fictional sample</div><h2>{chosen.name}</h2><div className="sakan-listing-loc"><MapPin size={12} />{chosen.type} · {chosen.furnished ? 'Furnished' : 'Unfurnished'} · {chosen.parking ? 'Parking included' : 'No parking'}</div><div className="sakan-listing-price"><strong>{formatAED(draft.goal === 'rent' ? chosen.rent : chosen.price)}</strong><span>{draft.goal === 'rent' ? 'annual rent' : 'sample purchase'}</span></div><p>{detailScore.why}. This is one comparison point, not a prediction.</p>
        <div className="sakan-breakdown">{draft.goal === 'rent' ? <><div className="sakan-breakdown-row"><span>Annual rent</span><strong>{formatAED(chosen.rent)}</strong></div><div className="sakan-breakdown-row"><span>Move-in reserve (5% sample)</span><strong>{formatAED(chosen.rent * .05)}</strong></div><div className="sakan-breakdown-row"><span>Your upfront amount</span><strong>{formatAED(draft.brief.rentUpfront)}</strong></div></> : draft.goal === 'live' ? <><div className="sakan-breakdown-row"><span>Sample purchase price</span><strong>{formatAED(chosen.price)}</strong></div><div className="sakan-breakdown-row"><span>Fee / setup reserve (6%)</span><strong>{formatAED(chosen.price * .06)}</strong></div><div className="sakan-breakdown-row"><span>Cash at close · based on your deposit + fees</span><strong>{formatAED(chosen.price * .06 + draft.brief.downPayment)}</strong></div><div className="sakan-breakdown-row"><span>Estimated financed portion after your deposit</span><strong>{formatAED(Math.max(0, chosen.price - draft.brief.downPayment))}</strong></div><div className="sakan-breakdown-row"><span>Sample monthly mortgage¹</span><strong>{formatAED((Math.max(0, chosen.price - draft.brief.downPayment) * (.0525 / 12)) / (1 - Math.pow(1 + .0525 / 12, -240)))}</strong></div><div className="sakan-breakdown-row"><span>Service + operating estimate</span><strong>{formatAED(chosen.service + chosen.expenses)} / yr</strong></div></> : <><div className="sakan-breakdown-row"><span>Annual gross rent assumption</span><strong>{formatAED(chosen.rent)}</strong></div><div className="sakan-breakdown-row"><span>Vacancy allowance ({draft.brief.vacancy}%)</span><strong>− {formatAED(chosen.rent * draft.brief.vacancy / 100)}</strong></div><div className="sakan-breakdown-row"><span>Service + operating costs</span><strong>− {formatAED(chosen.service + chosen.expenses)}</strong></div><div className="sakan-breakdown-row"><span>Net before debt · yield on all-in (6%)</span><strong>{formatAED(detailScore.annualNet)} · {detailScore.netYield.toFixed(1)}%</strong></div><div className="sakan-breakdown-row"><span>Debt service assumption</span><strong>{formatAED(0)} / yr · excluded</strong></div><div className="sakan-breakdown-row"><span>Downside lens · {draft.brief.riskScenario}</span><strong>{detailScore.downside.toFixed(1)} / 10</strong></div></>}<div className="sakan-breakdown-row"><span>Routine travel estimate</span><strong>{activeDests.length ? `~${detailScore.commute} min` : 'Not included'}</strong></div></div>
        <div className="sakan-breakdown accurate-breakdown">{detailFinancialRows}<div className="sakan-breakdown-row"><span>Routine travel estimate</span><strong>{activeDests.length ? `~${detailScore.commute} min` : 'Not included'}</strong></div></div>
        {draft.goal === 'live' && <small className="sakan-note">¹ Illustrative 20-year loan at 5.25% on remaining amount after available cash and acquisition costs. Financing eligibility and fees are not assessed; monthly comfort includes annual operating costs / 12.</small>}{!chosen.ready && <div className="sakan-sample-banner">Off-plan sample: confirm payment plan, progress and handover timing; figures exclude milestone financing and delay risk.</div>}<button className="sakan-primary full-button" onClick={() => openEnquiry(chosen)}>Record an enquiry in Sakan <ArrowRight size={14} /></button>
      </div></div>
  </div> : <div className="sakan-empty"><h2>Choose a sample home from your shortlist</h2><button className="sakan-secondary" onClick={() => setScreen('results')}>Back to matches</button></div>;

  const privacyView = <div className="sakan-card sakan-journey">
    <div className="sakan-result-head"><div><div className="sakan-eyebrow">Your private browser workspace</div><h2>Saved homes & privacy</h2><p>No account, login or household sharing.</p></div><button className="sakan-secondary" onClick={() => setScreen('home')}><ArrowLeft size={14} /> Back</button></div>
    <div className="sakan-sample-banner"><ShieldCheck size={14} />Your brief, saved homes, comparison and enquiry history are stored server-side in a private workspace identified by an HttpOnly same-site browser cookie—not just local storage. Destinations are used to calculate rankings only and are never shared with a household or agent. If you lose the browser cookie, this workspace cannot be recovered.</div>
    <div className="sakan-section-title">Your saved homes · {saved.length}</div>
    {!saved.length ? <div className="sakan-empty"><Bookmark size={22} /><h3>No saved homes yet</h3><p>Save sample homes to keep them in this private browser workspace.</p><button className="sakan-primary" onClick={() => { setScreen('results'); if (!matches.length) void calculate(); }}>Browse sample homes</button></div>
      : <div className="sakan-listing-grid">{saved.map((id, index) => { const listing = catalog.find((item) => item.id === id); return listing ? listingCard(listing, index) : null; })}</div>}
    <div className="sakan-section-title">Current saved search · your brief</div><div className="sakan-destination"><span className="sakan-pin"><Search size={15} /></span><div><div className="sakan-dest-name">{goalCopy[draft.goal].title} · {formatAED(draft.goal === 'rent' ? draft.brief.rentBudget : draft.goal === 'live' ? draft.brief.buyBudget : draft.brief.capital)}</div><div className="sakan-dest-meta">{draft.destinations.length} destinations · {draft.brief.beds}+ bedrooms · {draft.priority} priority</div></div><button className="sakan-secondary" onClick={async () => { if (await flushBeforeLeaving()) { setScreen('home'); setStep(0); } }}>Edit brief</button></div>
    <div className="sakan-section-title">Enquiry history · {enquiries.length}</div>
    {!enquiries.length ? <p className="sakan-note">No enquiries recorded.</p> : <div className="enquiry-history">{enquiries.map((entry) => <article key={entry.id} className="sakan-destination"><span className="sakan-pin"><Check size={15} /></span><div><div className="sakan-dest-name">{catalog.find((listing) => listing.id === entry.listingId)?.name || entry.listingId}</div><div className="sakan-dest-meta">{entry.name} · {entry.contact} · {new Date(entry.createdAt).toLocaleString()}</div><p>{entry.message}</p><strong>Recorded in Sakan · not forwarded to an agent</strong></div></article>)}</div>}
    <div className="sakan-section-title">Privacy choices</div>
    <div className="sakan-destination"><span className="sakan-pin"><MapPin size={15} /></span><div><div className="sakan-dest-name">Remove destination locations</div><div className="sakan-dest-meta">Delete all saved places from this draft.</div></div><button className="sakan-secondary" onClick={() => updateDraft({ destinations: [] })}>Remove</button></div>
    <div className="sakan-destination privacy-clear"><span className="sakan-pin"><RotateCcw size={15} /></span><div><div className="sakan-dest-name">Delete private workspace</div><div className="sakan-dest-meta">Delete saved homes, brief, comparisons and enquiry history; clear the browser cookie.</div></div><button className="sakan-secondary" disabled={resetBusy} onClick={() => void resetWorkspace()}>{resetBusy ? 'Deleting…' : 'Delete workspace'}</button></div>
  </div>;

  const compareListings = compare.flatMap((id) => {
    const listing = catalog.find((item) => item.id === id);
    return listing ? [listing] : [];
  });
  const scoreForListing = (listing: Listing) =>
    matchById.get(listing.id) || estimateScore(listing, draft.goal, draft.brief, activeDests);
  const monthlyLoanFor = (listing: Listing) => {
    const principal = Math.max(0, listing.price * 1.06 - draft.brief.downPayment);
    return principal * (.0525 / 12) / (1 - Math.pow(1 + .0525 / 12, -240));
  };
  const comparisonRows: Array<[string, (listing: Listing) => string]> = [
    ['Area', (listing) => listing.area],
    ['Bedrooms & size', (listing) => `${listing.beds} bed · ${listing.sqft.toLocaleString()} sqft`],
    ['Availability', (listing) => listing.ready ? 'Ready' : 'Off-plan'],
    ['Routine travel', (listing) => activeDests.length ? `~${travelFor(listing, activeDests)} min avg.` : 'Not included'],
    ...(draft.goal === 'rent' ? [
      ['Annual rent', (listing: Listing) => formatAED(listing.rent)],
      ['Deposit + agency/admin reserve · excludes first rent cheque', (listing: Listing) => formatAED(listing.rent * .1)],
    ] as Array<[string, (listing: Listing) => string]> : []),
    ...(draft.goal === 'live' ? [
      ['Sample purchase price', (listing: Listing) => formatAED(listing.price)],
      ['Illustrative acquisition costs (6%)', (listing: Listing) => formatAED(listing.price * .06)],
      ['Minimum cash boundary · 26% of price', (listing: Listing) => formatAED(listing.price * .26)],
      ['Illustrative financed principal after available cash', (listing: Listing) => formatAED(Math.max(0, listing.price * 1.06 - draft.brief.downPayment))],
      ['Illustrative monthly loan · 20 years at 5.25%', (listing: Listing) => formatAED(monthlyLoanFor(listing))],
      ['Annual operating costs', (listing: Listing) => `${formatAED(listing.service + listing.expenses)} / yr`],
      ['Monthly loan + operating costs / 12', (listing: Listing) => formatAED(monthlyLoanFor(listing) + (listing.service + listing.expenses) / 12)],
    ] as Array<[string, (listing: Listing) => string]> : []),
    ...(draft.goal === 'invest' ? [
      ['Sample net yield', (listing: Listing) => `${scoreForListing(listing).netYield.toFixed(1)}%`],
      ['Net annual income · before debt', (listing: Listing) => `${formatAED(scoreForListing(listing).annualNet)} / yr`],
      ['Downside · selected case', (listing: Listing) => `${scoreForListing(listing).downside.toFixed(1)} / 10`],
      ['Annual operating costs', (listing: Listing) => `${formatAED(listing.service + listing.expenses)} / yr`],
    ] as Array<[string, (listing: Listing) => string]> : []),
  ];
  const saveStatus = saveState === 'loading' ? 'Loading private workspace…' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Could not save';
  return <div className="sakan-root"><div className="sakan-shell">
    <header className="sakan-topbar"><button className="sakan-brand" onClick={() => { setScreen('home'); setStep(0); }} aria-label="Sakan home"><span className="sakan-mark"><Home size={19} /></span><span className="sakan-wordmark">sakan</span></button><nav className="sakan-toplinks" aria-label="Main navigation"><span className={`save-status ${saveState}`} role="status">{saveStatus}{saveState === 'error' && <button onClick={() => void saveNow().catch((saveError) => setError(errorText(saveError)))}>Retry</button>}</span><button onClick={async () => { if (await flushBeforeLeaving()) setScreen('privacy'); }}>Saved & privacy {saved.length > 0 && <span className="sakan-badge">{saved.length}</span>}</button><button onClick={() => setModal('how')}>How it works</button></nav></header>
    {catalogState === 'loading' ? <div className="sakan-empty loading-card" role="status"><div className="sakan-spinner" /><h2>Preparing your sample homes</h2><p>Loading the catalog and private browser workspace.</p></div>
      : catalogState === 'error' ? <div className="sakan-empty" role="alert"><h2>Could not load Sakan</h2><p>{error}</p><button className="sakan-primary" onClick={() => window.location.reload()}>Try again</button></div>
        : <>
          {screen === 'home' && <><section className="sakan-hero"><div><div className="sakan-eyebrow">A more human way to find home · UAE</div><h1>Find a home that fits <em>your actual life.</em></h1><p>Start with your people, places and budget. Then see the tradeoffs clearly—without the sales gloss.</p><div className="sakan-hero-note"><Sparkles size={15} /> A calmer way to decide, whether you rent, buy or invest.</div></div><DubaiMap destinations={activeDests} /></section>
            {goalSelector}<div className="sakan-workspace"><main>{journeyPane()}</main><aside className="sakan-card sakan-side-note"><div className="sakan-eyebrow">A little reassurance</div><h3>Start with life. Let the numbers follow.</h3><p>Sakan brings everyday travel, comfort and costs into one decision. Nothing here is a listing feed or financial promise.</p><div className="sakan-side-list"><div className="sakan-side-item"><MapPin size={15} />Your destination brief is private; the map is illustrative.</div><div className="sakan-side-item"><Scale size={15} />Compare cost, commute and downside on equal terms.</div><div className="sakan-side-item"><Info size={15} />Every property and assumption is clearly labelled sample data.</div></div><div className="side-explore"><button className="sakan-textbutton" onClick={() => void calculate()} disabled={rankingBusy}>Explore a sample shortlist <ArrowRight size={13} /></button><div>Preview without completing this brief.</div></div></aside></div></>}
          {screen === 'results' && resultView}{screen === 'detail' && detailView}{screen === 'privacy' && privacyView}
          <footer className="sakan-footer">Sakan is a decision-making prototype. Listings, prices, rents, travel times, yields and images are illustrative sample data—not live market information or financial advice.</footer>
        </>}
  </div>

    {modal === 'destination' && <Dialog titleId="destination-title" onClose={() => { setModal(null); setError(''); }}><div className="sakan-modal-head"><div><div className="sakan-eyebrow">Make your map feel like yours</div><h2 id="destination-title">{editing ? 'Edit place' : 'Add a place'}</h2></div><button className="sakan-modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={16} /></button></div><div className="sakan-form-grid"><div className="sakan-field"><label htmlFor="destination-kind">Place in your life</label><select id="destination-kind" className="sakan-select" value={draftDest.kind} onChange={(event) => setDraftDest({ ...draftDest, kind: event.target.value, label: event.target.value === 'Work' ? 'My work' : event.target.value })}>{['Work', 'Partner work', 'School', 'Worship', 'Sport', 'Custom'].map((kind) => <option key={kind}>{kind}</option>)}</select></div><div className="sakan-field"><label htmlFor="destination-label">Short label</label><input id="destination-label" className="sakan-input" value={draftDest.label} onChange={(event) => setDraftDest({ ...draftDest, label: event.target.value })} placeholder="My office" /></div><div className="sakan-field"><label htmlFor="destination-place">Sample place</label><select id="destination-place" className="sakan-select" value={draftDest.place} onChange={(event) => setDraftDest({ ...draftDest, place: event.target.value, address: event.target.value.split(',').slice(-1)[0] })}>{places.map((place) => <option key={place}>{place}</option>)}</select></div><div className="sakan-field"><label htmlFor="destination-address">Area note (optional)</label><input id="destination-address" className="sakan-input" value={draftDest.address} onChange={(event) => setDraftDest({ ...draftDest, address: event.target.value })} placeholder="Neighbourhood or building" /></div><div className="sakan-field"><label htmlFor="destination-mode">Travel mode</label><select id="destination-mode" className="sakan-select" value={draftDest.mode} onChange={(event) => setDraftDest({ ...draftDest, mode: event.target.value as Destination['mode'] })}><option value="car">Car</option><option value="metro">Metro</option><option value="walk">Walk / cycle</option></select></div><div className="sakan-field"><label htmlFor="destination-frequency">Visits per week</label><select id="destination-frequency" className="sakan-select" value={draftDest.frequency} onChange={(event) => setDraftDest({ ...draftDest, frequency: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map((count) => <option value={count} key={count}>{count} days / week</option>)}</select></div><div className="sakan-field"><label htmlFor="destination-time">Maximum travel time (minutes)</label><input id="destination-time" className="sakan-input" type="number" min="5" max="120" value={draftDest.maxMinutes} onChange={(event) => setDraftDest({ ...draftDest, maxMinutes: Number(event.target.value) || 0 })} /></div></div><div className="sakan-section-title">How much should this matter?</div><div className="sakan-toggle-row"><button className={`sakan-chip${draftDest.required ? ' active' : ''}`} onClick={() => setDraftDest({ ...draftDest, required: true, preferred: false })}>Required boundary</button><button className={`sakan-chip${draftDest.preferred ? ' active' : ''}`} onClick={() => setDraftDest({ ...draftDest, preferred: true, required: false })}>Preferred</button></div>{error && <div className="sakan-error" role="alert">{error}</div>}<div className="sakan-modal-actions"><button className="sakan-secondary" onClick={() => setModal(null)}>Cancel</button><button className="sakan-primary" onClick={saveDestination}>{editing ? 'Save place' : 'Add place'}</button></div></Dialog>}
    {modal === 'compare' && <Dialog titleId="compare-title" onClose={() => setModal(null)} wide>
      <div className="sakan-modal-head"><div><div className="sakan-eyebrow">Tradeoffs, side by side</div><h2 id="compare-title">Compare sample homes</h2></div><button className="sakan-modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={16} /></button></div>
      {!compareListings.length ? <div className="sakan-empty"><Scale size={22} /><h3>Choose homes to compare</h3><p>Add up to three homes from the results.</p></div>
        : <div className="sakan-compare-table"><div className="sakan-compare-grid" style={{ gridTemplateColumns: `130px repeat(${compareListings.length}, minmax(160px, 1fr))` }}>
          <div className="sakan-compare-label">Your comparison</div>
          {compareListings.map((listing) => <div className="sakan-compare-heading" key={listing.id}>{listing.name}<button className="sakan-icon-button" aria-label={`Remove ${listing.name} from compare`} onClick={() => void toggleCompare(listing.id)}><X size={13} /></button></div>)}
          {comparisonRows.map(([label, render]) => <div className="compare-row" key={label}><div className="sakan-compare-label">{label}</div>{compareListings.map((listing) => <div key={`${label}-${listing.id}`}>{render(listing)}</div>)}</div>)}
        </div></div>}
      <div className="sakan-modal-actions"><button className="sakan-secondary" onClick={() => setModal(null)}>Done</button></div>
    </Dialog>}
    {modal === 'enquiry' && chosen && <Dialog titleId="enquiry-title" onClose={() => setModal(null)}><div className="sakan-modal-head"><div><div className="sakan-eyebrow">No contact is forwarded</div><h2 id="enquiry-title">{enquiryResult ? 'Enquiry recorded' : 'Record an enquiry'}</h2></div><button className="sakan-modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={16} /></button></div>{enquiryResult ? <><div className="sakan-sample-banner"><Check size={15} />This message is recorded in Sakan only. It was not sent to an agent.</div><div className="enquiry-receipt"><strong>{chosen.name}</strong><p>{enquiryResult.message}</p><small>Reference {enquiryResult.id} · {new Date(enquiryResult.createdAt).toLocaleString()}</small></div></> : <><p>This record stays in your private Sakan workspace. It will not be sent to an agent or third party.</p><div className="sakan-card enquiry-listing"><div className="sakan-eyebrow">Sample property</div><strong>{chosen.name}</strong><div className="sakan-dest-meta">{chosen.area} · {formatAED(draft.goal === 'rent' ? chosen.rent : chosen.price)}</div></div><div className="sakan-form-grid"><div className="sakan-field"><label htmlFor="enquiry-name">Your name</label><input id="enquiry-name" className="sakan-input" required value={enquiryName} onChange={(event) => setEnquiryName(event.target.value)} /></div><div className="sakan-field"><label htmlFor="enquiry-contact">Email or phone</label><input id="enquiry-contact" className="sakan-input" required autoComplete="email" value={enquiryContact} onChange={(event) => setEnquiryContact(event.target.value)} /></div><div className="sakan-field enquiry-message"><label htmlFor="enquiry-message">Message</label><textarea id="enquiry-message" className="sakan-input" rows={4} value={enquiryMessage} onChange={(event) => setEnquiryMessage(event.target.value)} /></div></div><label className="sakan-checkline consent-line"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I agree to store this enquiry in my private workspace. This does not share household destinations and does not forward anything to an agent.</label>{error && <div className="sakan-error" role="alert">{error}</div>}</>}<div className="sakan-modal-actions">{enquiryResult ? <button className="sakan-primary" onClick={() => setModal(null)}>Done</button> : <><button className="sakan-secondary" onClick={() => setModal(null)}>Cancel</button><button className="sakan-primary" disabled={enquiryBusy} onClick={() => void submitEnquiry()}>{enquiryBusy ? 'Recording…' : 'Record in Sakan'}</button></>}</div></Dialog>}
    {modal === 'how' && <Dialog titleId="how-title" onClose={() => setModal(null)}><div className="sakan-modal-head"><div><div className="sakan-eyebrow">A tool, not a broker</div><h2 id="how-title">How Sakan works</h2></div><button className="sakan-modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={16} /></button></div><p>Sakan starts with routines, finances and home boundaries, then compares a small, fictional sample set. It does not connect to listing feeds, navigation, banks or agencies.</p><div className="sakan-side-list"><div className="sakan-side-item"><MapPin size={15} />Map, locations and travel assumptions are schematic and illustrative.</div><div className="sakan-side-item"><Wallet size={15} />Financial figures are scenario arithmetic from sample assumptions.</div><div className="sakan-side-item"><ShieldCheck size={15} />Your server-side workspace belongs to this browser cookie; losing the cookie means it cannot be recovered.</div></div><div className="sakan-modal-actions"><button className="sakan-secondary" onClick={() => setModal(null)}>Close</button><button className="sakan-primary" onClick={async () => { if (await flushBeforeLeaving()) { setModal(null); setScreen('privacy'); } }}>Privacy choices</button></div></Dialog>}
    {toast && <div className="sakan-toast" role="status">{toast}{undoHidden && <button onClick={undoHide}>Undo</button>}</div>}
  </div>;
}
