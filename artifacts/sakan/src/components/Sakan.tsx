import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, BedDouble, Bookmark, BookmarkCheck, Building2, CarFront, Check,
  Church, Clock3, Dumbbell, EyeOff, Heart, Home, Info, Landmark, MapPin, Pencil, Play, Plus, RotateCcw,
  Scale, School, Search, ShieldCheck, Trash2, Wallet, X,
} from 'lucide-react';
import {
  calculateSakanMatches, createSakanEnquiry, deleteSakanWorkspace, getSakanCatalog,
  getSakanWorkspace, saveSakanWorkspace,
} from '@workspace/api-client-react';
import type { SakanEnquiryInput, SakanWorkspaceInput } from '@workspace/api-client-react';
import {
  estimateScore, formatAED, initialBrief, samplePlaces as fallbackPlaces,
  travelFor, type Brief, type Destination, type Enquiry, type Goal, type Listing, type Match, type Priority,
} from '../sakan-data';
import { Choice, Dialog, MoneyField, Row, cityImages, imageUrl, posterStyle } from './sakan-ui';
import { MonitorDashboard, MonitorToggle } from './sakan-monitor';
import { rentPaymentLabels } from '../sakan-data';
import { clearAllMonitors, useMonitor } from '../hooks/use-monitor';
import { canMonitorGoal, isMonitorHash, monitorHash, monitorPropertyFromHash, monitorScopeFromHash } from '../monitor-navigation';
import { clearAllPriceAlerts } from '../hooks/use-price-alerts';
import { GuidedPlacePicker } from './GuidedPlacePicker';
import { reorderDestinations } from '../life-place-order';
import './sakan.css';

type Screen = 'questions' | 'results' | 'detail' | 'privacy' | 'monitor';
type Modal = 'destination' | 'compare' | 'enquiry' | 'how' | null;
type WorkspaceDraft = { goal: Goal; brief: Brief; destinations: Destination[]; personalUse: boolean; priority: Priority };
type SaveState = 'loading' | 'saved' | 'saving' | 'error';
type QKey = 'goal' | 'use' | 'places' | 'rhythm' | 'money' | 'strategy' | 'risk' | 'home' | 'comfort' | 'review';

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
const priorityLabel: Record<Priority, string> = { balanced: 'Balanced', commute: 'Closer to routine', cost: 'Lower cost', risk: 'Lower downside' };
const iconFor = (kind: string) => kind.toLowerCase().includes('school') ? School
  : kind.toLowerCase().includes('worship') ? Church
    : kind.toLowerCase().includes('sport') ? Dumbbell
      : kind.toLowerCase().includes('partner') ? Heart : MapPin;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const objectValue = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const normalizeDraft = (raw: unknown): WorkspaceDraft => {
  const value = objectValue(raw);
  const goal = (['rent', 'live', 'invest'].includes(String(value.goal)) ? value.goal : defaultDraft.goal) as Goal;
  const brief = { ...initialBrief, ...objectValue(value.brief) } as Brief;
  if (!['upfront', 'monthly', 'any'].includes(brief.rentPayment)) brief.rentPayment = 'any';
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
const keyFor = (goal: Goal, brief: Brief, destinations: Destination[], priority: Priority) => JSON.stringify({ goal, brief, destinations, priority });
const monthlyLoan = (principal: number) => principal * (.0525 / 12) / (1 - Math.pow(1 + .0525 / 12, -240));

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
  const [qKey, setQKey] = useState<QKey>(() => typeof window !== 'undefined' && window.location.hash === '#places' ? 'places' : 'goal');
  const [screen, setScreen] = useState<Screen>(() => typeof window !== 'undefined' && isMonitorHash(window.location.hash) ? 'monitor' : 'questions');
  const initialMonitorRoute = useRef(typeof window !== 'undefined' ? window.location.hash : '');
  const monitorScope = draft.goal === 'invest' ? 'invest' : 'live';
  const monitor = useMonitor(monitorScope);
  const monitorPropertyId = monitor.view.propertyId;
  const setMonitorPropertyId = (id: string) => monitor.setView({ propertyId: id });
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Destination | null>(null);
  const [draftDest, setDraftDest] = useState<Destination>({ id: '', kind: 'Work', label: 'My work', place: fallbackPlaces[0], address: '', frequency: 5, mode: 'car', maxMinutes: 30, required: false, preferred: true });
  const [hidden, setHidden] = useState<string[]>([]);
  const [undoHidden, setUndoHidden] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchedKey, setMatchedKey] = useState('');
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
  const canMonitor = canMonitorGoal(draft.goal);
  const activeDests = isInvest && !draft.personalUse ? [] : draft.destinations;
  const resultsFresh = matchedKey !== '' && matchedKey === keyFor(draft.goal, draft.brief, activeDests, draft.priority);

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    const workspace = await getSakanWorkspace({ signal });
    if (dirtyRef.current !== savedRevisionRef.current) return;
    setDraft(normalizeDraft(workspace.draft));
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
  useEffect(() => { window.scrollTo({ top: 0 }); }, [screen, qKey]);
  useEffect(() => {
    if (!workspaceReady || catalogState !== 'ready') return;
    const route = initialMonitorRoute.current;
    initialMonitorRoute.current = '';
    if (!canMonitor || !isMonitorHash(route)) return;
    const scope = monitorScopeFromHash(route);
    const id = monitorPropertyFromHash(route);
    // A link from another journey must not overwrite this journey's selection.
    if ((!scope || scope === monitorScope) && id && catalog.some((listing) => listing.id === id)) {
      monitor.setView({ propertyId: id });
    }
  }, [workspaceReady, catalogState, canMonitor, monitorScope, catalog, monitor.setView]);
  useEffect(() => {
    if (workspaceReady && !canMonitor && screen === 'monitor') {
      setScreen('questions');
      setQKey('goal');
    }
  }, [workspaceReady, canMonitor, screen]);
  useEffect(() => {
    const url = window.location.pathname + window.location.search;
    if (screen === 'monitor' && workspaceReady && canMonitor && window.location.hash !== monitorHash(monitorPropertyId, monitorScope)) window.history.replaceState(null, '', url + monitorHash(monitorPropertyId, monitorScope));
    else if ((screen !== 'monitor' && isMonitorHash(window.location.hash)) || (window.location.hash === '#places' && (screen !== 'questions' || qKey !== 'places'))) window.history.replaceState(null, '', url);
  }, [screen, qKey, workspaceReady, canMonitor, monitorPropertyId, monitorScope]);

  const updateDraft = (patch: Partial<WorkspaceDraft>) => {
    touch();
    setDraft((previous) => ({ ...previous, ...patch }));
  };
  const updateBrief = (key: keyof Brief, value: Brief[keyof Brief]) => {
    touch();
    setDraft((previous) => ({ ...previous, brief: { ...previous.brief, [key]: value } as Brief }));
  };
  const saveNow = useCallback(async (payload = snapshot()) => {
    if (!workspaceReady) throw new Error('Your private workspace is still loading. Please try again.');
    await persist(payload);
  }, [workspaceReady, persist, snapshot]);

  // ---------- Question flow ----------
  const questionKeys = useMemo(() => {
    const keys: QKey[] = ['goal'];
    if (isInvest) keys.push('use');
    if (!isInvest || draft.personalUse) { keys.push('places'); if (draft.destinations.length) keys.push('rhythm'); }
    keys.push('money');
    if (isInvest) keys.push('strategy', 'risk');
    keys.push('home', 'comfort', 'review');
    return keys;
  }, [isInvest, draft.personalUse, draft.destinations.length]);
  const current: QKey = questionKeys.includes(qKey) ? qKey : qKey === 'rhythm' || qKey === 'places' ? 'money' : 'goal';
  const qIndex = questionKeys.indexOf(current);

  const questionError = (key: QKey) => {
    const b = draft.brief;
    if (key === 'money') {
      if (draft.goal === 'rent') {
        if (!(b.rentBudget > 0)) return 'Enter your annual rent ceiling in AED to continue.';
        if (!(b.rentUpfront > 0)) return 'Enter your deposit and fees budget in AED.';
      } else if (draft.goal === 'live') {
        if (!(b.buyBudget > 0)) return 'Enter your purchase price ceiling in AED to continue.';
        if (!(b.downPayment > 0)) return 'Enter the cash you have available now in AED.';
        if (!(b.monthlyPayment > 0)) return 'Enter a comfortable monthly amount in AED.';
      } else if (!(b.capital > 0)) return 'Enter the capital you can invest in AED to continue.';
    }
    if (key === 'strategy' && (b.horizon < 1 || b.horizon > 30)) return 'Choose a horizon between 1 and 30 years.';
    return '';
  };
  const validate = () => {
    for (const key of questionKeys) {
      const message = questionError(key);
      if (message) return { key, message };
    }
    return null;
  };

  const calculate = async (nextHidden = hidden, nextPriority = draft.priority, navigate = true) => {
    const invalid = validate();
    if (invalid) { setError(invalid.message); setQKey(invalid.key); setScreen('questions'); return false; }
    setError('');
    setRankingError('');
    setRankingBusy(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestKey = keyFor(draft.goal, draft.brief, activeDests, nextPriority);
    try {
      await saveNow();
      const response = await calculateSakanMatches({
        goal: draft.goal, brief: draft.brief, destinations: activeDests, hidden: nextHidden, priority: nextPriority,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return false;
      setMatches(response.matches as unknown as Match[]);
      setCalculatedAt(response.calculatedAt);
      setMatchedKey(requestKey);
      if (navigate) setScreen('results');
      return true;
    } catch (calculateError) {
      if (!controller.signal.aborted) setRankingError(errorText(calculateError));
      return false;
    } finally {
      if (!controller.signal.aborted) setRankingBusy(false);
    }
  };

  const goNext = () => {
    const message = questionError(current);
    if (message) { setError(message); return; }
    setError('');
    if (qIndex < questionKeys.length - 1) setQKey(questionKeys[qIndex + 1]);
  };
  const goBack = () => {
    setError('');
    if (qIndex > 0) setQKey(questionKeys[qIndex - 1]);
    else if (resultsFresh) setScreen('results');
  };
  const editFromResults = async (key: QKey = 'review') => {
    try { await saveNow(); } catch (saveError) { setError(errorText(saveError)); }
    setRankingError('');
    setQKey(key);
    setScreen('questions');
  };

  const changePriority = (priority: Priority) => {
    updateDraft({ priority });
    void calculate(hidden, priority, true);
  };
  const toggleSave = async (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    touch();
    setSaved(next);
    try { await saveNow(snapshot(draft, next, compare)); setToast(next.includes(id) ? 'Saved to My list' : 'Removed from My list'); }
    catch (saveError) { setError(errorText(saveError)); }
  };
  const toggleCompare = async (id: string) => {
    if (!compare.includes(id) && compare.length >= 3) { setToast('Compare up to three homes at a time'); return; }
    const next = compare.includes(id) ? compare.filter((item) => item !== id) : [...compare, id];
    touch();
    setCompare(next);
    try { await saveNow(snapshot(draft, saved, next)); setToast(next.includes(id) ? `Added to compare (${next.length}/3)` : 'Removed from compare'); }
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
  const goHome = async () => {
    if (!(await flushBeforeLeaving())) return;
    abortRef.current?.abort();
    setRankingBusy(false);
    setRankingError('');
    setError('');
    setModal(null);
    setQKey('goal');
    setScreen('questions');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const changeGoal = (goal: Goal) => {
    updateDraft({ goal });
    setError('');
  };
  const openDestination = (destination?: Destination) => {
    setError('');
    setEditing(destination?.id ? destination : null);
    setDraftDest(destination ? { ...destination } : { id: '', kind: 'Work', label: 'My work', place: places[0] || fallbackPlaces[0], address: '', frequency: 5, mode: 'car', maxMinutes: 30, required: false, preferred: true });
    setModal('destination');
  };
  const saveDestination = () => {
    if (!draftDest.label.trim() || !draftDest.place.trim()) { setError('Add a destination name and place to continue.'); return; }
    if (!places.includes(draftDest.place)) { setError('Choose one of the supported sample places.'); return; }
    if (draftDest.maxMinutes < 5 || draftDest.maxMinutes > 120) { setError('Travel limit must be between 5 and 120 minutes.'); return; }
    const next = editing
      ? draft.destinations.map((destination) => destination.id === editing.id ? draftDest : destination)
      : [...draft.destinations, { ...draftDest, id: crypto.randomUUID() }];
    updateDraft({ destinations: next });
    setModal(null);
    setError('');
    setToast(editing ? 'Place updated' : 'Place added');
  };
  const commitDestination = (destination: Destination, editingId: string | null) => {
    if (editingId && !draft.destinations.some((item) => item.id === editingId)) return 'This place no longer exists. Add it again instead.';
    if (!destination.label.trim() || !destination.place.trim()) return 'Add a destination name and place to continue.';
    if (!places.includes(destination.place)) return 'Choose one of the supported sample places.';
    if (destination.maxMinutes < 5 || destination.maxMinutes > 120) return 'Travel limit must be between 5 and 120 minutes.';
    const next = editingId
      ? draft.destinations.map((item) => item.id === editingId ? { ...destination, id: editingId } : item)
      : [...draft.destinations, { ...destination, id: crypto.randomUUID() }];
    updateDraft({ destinations: next });
    setError('');
    setToast(editingId ? 'Place updated' : 'Place added');
    return '';
  };
  const resetWorkspace = async () => {
    if (!window.confirm('Delete this private browser workspace, including saved homes, your brief, enquiry history, monitored properties and price alerts in this browser? This cannot be undone.')) return;
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
      setMatchedKey('');
      setHidden([]);
      setUndoHidden(null);
      setScreen('questions');
      setQKey('goal');
      setModal(null);
      setSaveState('saved');
      setWorkspaceReady(true);
      const monitorClearError = clearAllMonitors();
      const alertClearError = clearAllPriceAlerts();
      if (monitorClearError || alertClearError) setError([monitorClearError, alertClearError].filter(Boolean).join(' '));
      setToast('Private workspace deleted and reinitialized · browser monitoring cleared');
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
  const chosenMatch = chosen ? matchById.get(chosen.id) : undefined;
  const rawDetailScore = chosen ? chosenMatch || estimateScore(chosen, draft.goal, draft.brief, activeDests) : null;
  const detailScore = rawDetailScore ? { ...rawDetailScore, why: explainMatch(rawDetailScore.why) } : null;
  const detailPrincipal = chosen ? Math.max(0, chosen.price * 1.06 - draft.brief.downPayment) : 0;
  const detailMonthlyLoan = monthlyLoan(detailPrincipal);
  const detailAnnualOperating = chosen ? chosen.service + chosen.expenses : 0;
  const detailFinancialRows = chosen && detailScore ? draft.goal === 'rent' ? <>
    <div className="sakan-breakdown-row"><span>Annual rent</span><strong>{formatAED(chosen.rent)}</strong></div>
    <div className="sakan-breakdown-row"><span>Illustrative deposit + agency/admin reserve (10%)</span><strong>{formatAED(chosen.rent * .1)}</strong></div>
    <div className="sakan-breakdown-row"><span>Your deposit & fees budget · rent payments excluded</span><strong>{formatAED(draft.brief.rentUpfront)}</strong></div>
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
    if (!consent) { setError('Confirm that this enquiry is stored in Realmax and not forwarded.'); return; }
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
  const openDetail = (id: string) => { setSelected(id); setScreen('detail'); };
  const openPropertyMonitor = (id: string) => {
    if (!canMonitor || !catalog.some((listing) => listing.id === id)) return;
    monitor.add(id);
    setMonitorPropertyId(id);
    setScreen('monitor');
  };

  // ---------- Question content ----------
  const b = draft.brief;
  const moneyInvalid = error !== '' && current === 'money';
  const qText: Record<QKey, { kicker: string; title: string; sub: string }> = {
    goal: { kicker: 'Let us start with the story', title: 'What brings you to Realmax?', sub: 'Pick one. You can change it later without losing your other answers.' },
    use: { kicker: 'Investor brief', title: 'Will you ever live in it yourself?', sub: 'A pure investment can skip personal travel entirely.' },
    places: { kicker: 'Your week', title: 'Add your everyday places', sub: 'Work, partner, kids. Each one shows up on the map. All optional.' },
    rhythm: { kicker: 'Your weekly rhythm', title: 'How often, and how far?', sub: 'A daily commute and a weekly class are not the same priority. Required places become hard travel limits.' },
    money: {
      kicker: 'The numbers',
      title: draft.goal === 'rent' ? 'What can you spend on rent?' : draft.goal === 'live' ? 'What can you put toward buying?' : 'How much capital is in play?',
      sub: 'These are hard boundaries. Homes above them will not appear, and we never quietly raise them.',
    },
    strategy: { kicker: 'Investor lens', title: 'What should this investment do?', sub: 'Strategy shapes the ranking, not the boundaries.' },
    risk: { kicker: 'Stress test', title: 'How hard should we push the numbers?', sub: 'Sample net yield is after vacancy, service and operating costs, on all-in price including 6% acquisition costs.' },
    home: { kicker: 'The home itself', title: 'What kind of place?', sub: 'Bedrooms, type and readiness are hard filters.' },
    comfort: { kicker: 'Finishing touches', title: 'Nice-to-haves, and what matters most', sub: 'Furnishing and parking are preferences that nudge ranking. They never remove homes.' },
    review: { kicker: 'Before the reveal', title: 'Your brief, at a glance', sub: 'Check your answers. Edit anything, then let us find your matches.' },
  };

  const placesQuestion = <div className="rx-q-body">
    <GuidedPlacePicker destinations={draft.destinations} places={places} onCommit={commitDestination} onRemove={(id) => updateDraft({ destinations: draft.destinations.filter((item) => item.id !== id) })} onReorder={(ids) => {
      const destinations = reorderDestinations(draft.destinations, ids);
      if (destinations) updateDraft({ destinations });
    }} />
  </div>;

  const rhythmQuestion = <div className="rx-q-body">
    <div className="sakan-destinations">{draft.destinations.map((destination) => <div className="sakan-destination rx-rhythm" key={destination.id}>
      <span className="sakan-pin"><Clock3 size={15} /></span>
      <div><div className="sakan-dest-name">{destination.label}</div><div className="sakan-dest-meta">{destination.place} · {destination.mode}</div></div>
      <select aria-label={`Days per week at ${destination.label}`} className="sakan-select" value={destination.frequency} onChange={(event) => updateDraft({ destinations: draft.destinations.map((item) => item.id === destination.id ? { ...item, frequency: Number(event.target.value) } : item) })}>{[1, 2, 3, 4, 5, 6, 7].map((count) => <option value={count} key={count}>{count} {count === 1 ? 'day' : 'days'} / week</option>)}</select>
      <div className="rx-seg" role="radiogroup" aria-label={`How strict is ${destination.label}`}>
        <button role="radio" aria-checked={destination.required} className={destination.required ? 'on' : ''} onClick={() => updateDraft({ destinations: draft.destinations.map((item) => item.id === destination.id ? { ...item, required: true, preferred: false } : item) })}>Required · {destination.maxMinutes} min</button>
        <button role="radio" aria-checked={!destination.required} className={!destination.required ? 'on' : ''} onClick={() => updateDraft({ destinations: draft.destinations.map((item) => item.id === destination.id ? { ...item, required: false, preferred: true } : item) })}>Preferred</button>
      </div>
      <button className="sakan-icon-button" aria-label={`Edit travel limit for ${destination.label}`} onClick={() => openDestination(destination)}><Pencil size={14} /></button>
    </div>)}</div>
    <div className="sakan-sample-banner"><Info size={14} />Travel times are invented sample assumptions by area and mode. They are not live traffic or route guidance.</div>
  </div>;

  const moneyQuestion = <div className="rx-q-body">
    {draft.goal === 'rent' ? <>
      <div className="rx-money-grid">
        <MoneyField id="rent-budget" label="Annual rent ceiling" hint="Listings above this will be filtered out." value={b.rentBudget} step={1000} invalid={moneyInvalid && !(b.rentBudget > 0)} onChange={(value) => updateBrief('rentBudget', value)} />
        <MoneyField id="rent-upfront" label="Deposit & fees budget" hint="Illustrative 10% deposit + agency/admin reserve. Excludes rent payments." value={b.rentUpfront} step={1000} invalid={moneyInvalid && !(b.rentUpfront > 0)} onChange={(value) => updateBrief('rentUpfront', value)} />
      </div>
      <Choice label="How would you prefer to pay rent?" value={b.rentPayment} onChange={(value) => updateBrief('rentPayment', value)} options={[
        { value: 'upfront', label: 'Pay upfront', sub: 'Annual rent in one payment' },
        { value: 'monthly', label: 'Pay monthly', sub: 'Split rent across 12 payments' },
        { value: 'any', label: 'No preference', sub: 'Open to either option' },
      ]} />
      <small className="sakan-note">Preference only—payment terms and any extra fees need landlord confirmation.</small>
      <div className="sakan-breakdown"><div className="sakan-breakdown-row"><span>Deposit + agency/admin planning at your ceiling (10%)</span><strong>{formatAED(b.rentBudget * .1)}</strong></div><div className="sakan-breakdown-row"><span>Remaining under your upfront limit</span><strong>{formatAED(Math.max(0, b.rentUpfront - b.rentBudget * .1))}</strong></div></div>
    </> : draft.goal === 'live' ? <>
      <div className="rx-money-grid three">
        <MoneyField id="buy-budget" label="Purchase price ceiling" value={b.buyBudget} step={10000} invalid={moneyInvalid && !(b.buyBudget > 0)} onChange={(value) => updateBrief('buyBudget', value)} />
        <MoneyField id="cash-now" label="Cash available now" hint="Must cover at least 26% of price (20% deposit + 6% costs)." value={b.downPayment} step={10000} invalid={moneyInvalid && !(b.downPayment > 0)} onChange={(value) => updateBrief('downPayment', value)} />
        <MoneyField id="monthly" label="Comfortable monthly amount" hint="Loan + operating costs / 12." value={b.monthlyPayment} step={500} invalid={moneyInvalid && !(b.monthlyPayment > 0)} onChange={(value) => updateBrief('monthlyPayment', value)} />
      </div>
      <div className="sakan-breakdown"><div className="sakan-breakdown-row"><span>Minimum cash at your ceiling · 26%</span><strong>{formatAED(b.buyBudget * .26)}</strong></div><div className="sakan-breakdown-row"><span>Illustrative financed principal at ceiling · price × 1.06 − cash</span><strong>{formatAED(Math.max(0, b.buyBudget * 1.06 - b.downPayment))}</strong></div><div className="sakan-breakdown-row"><span>Illustrative monthly loan at ceiling · 20 years at 5.25%</span><strong>{formatAED(monthlyLoan(Math.max(0, b.buyBudget * 1.06 - b.downPayment)))}</strong></div></div>
    </> : <>
      <div className="rx-money-grid">
        <MoneyField id="capital" label="Total capital available" hint="Must cover the all-in price including a 6% sample acquisition reserve." value={b.capital} step={10000} invalid={moneyInvalid && !(b.capital > 0)} onChange={(value) => updateBrief('capital', value)} />
      </div>
      <div className="sakan-sample-banner"><Landmark size={14} />An analytical view, not a promise of returns. Debt service is not assumed in net yield.</div>
    </>}
  </div>;

  const renderQuestion = () => {
    switch (current) {
      case 'goal': return <Choice label="Home goal" value={draft.goal} onChange={changeGoal} options={[
        { value: 'rent', label: goalCopy.rent.title, sub: goalCopy.rent.sub, icon: Home },
        { value: 'live', label: goalCopy.live.title, sub: goalCopy.live.sub, icon: Heart },
        { value: 'invest', label: goalCopy.invest.title, sub: goalCopy.invest.sub, icon: Landmark },
      ]} />;
      case 'use': return <Choice label="Personal use" value={draft.personalUse ? 'yes' : 'no'} onChange={(value) => updateDraft({ personalUse: value === 'yes' })} options={[
        { value: 'no', label: 'No, purely an investment', sub: 'Skip personal places. Rank on returns, costs and downside.', icon: Landmark },
        { value: 'yes', label: 'Maybe, include my places', sub: 'Factor in travel to the places in your week.', icon: MapPin },
      ]} />;
      case 'places': return placesQuestion;
      case 'rhythm': return rhythmQuestion;
      case 'money': return moneyQuestion;
      case 'strategy': return <div className="rx-q-body">
        <Choice label="Strategy lens" value={b.strategy} onChange={(value) => updateBrief('strategy', value)} options={[
          { value: 'income', label: 'Income first', sub: 'Weight sample net yield most.' },
          { value: 'balanced', label: 'Balanced tradeoff', sub: 'Yield and downside together.' },
          { value: 'growth', label: 'Growth potential', sub: 'Favour lower-risk sample areas.' },
        ]} />
        <div className="rx-horizon"><label htmlFor="horizon">Investment horizon</label><div className="rx-horizon-row"><input id="horizon" data-testid="input-horizon" type="range" min="1" max="30" value={b.horizon} onChange={(event) => updateBrief('horizon', Number(event.target.value))} /><strong>{b.horizon} {b.horizon === 1 ? 'year' : 'years'}</strong></div><small>Under 5 years adds a downside penalty in the sample model.</small></div>
      </div>;
      case 'risk': return <div className="rx-q-body">
        <div className="sakan-section-title">Downside scenario</div>
        <Choice compact label="Downside scenario" value={b.riskScenario} onChange={(value) => updateBrief('riskScenario', value)} options={[
          { value: 'steady', label: 'Steady', sub: 'Mild sample risk weighting.' },
          { value: 'soft', label: 'Soft market', sub: 'Moderate stress on risk.' },
          { value: 'stress', label: 'Stress case', sub: 'Heaviest sample penalty.' },
        ]} />
        <div className="sakan-section-title">Vacancy allowance</div>
        <Choice compact label="Vacancy allowance" value={b.vacancy} onChange={(value) => updateBrief('vacancy', value)} options={[4, 6, 10, 14].map((value) => ({ value, label: `${value}%`, sub: 'sample assumption' }))} />
      </div>;
      case 'home': return <div className="rx-q-body">
        <div className="sakan-section-title">Bedrooms, at least</div>
        <Choice compact label="Minimum bedrooms" value={b.beds} onChange={(value) => updateBrief('beds', value)} options={[0, 1, 2, 3].map((value) => ({ value, label: value === 0 ? 'Studio+' : `${value}+ bed` }))} />
        <div className="sakan-section-title">Home type</div>
        <Choice compact label="Home type" value={b.type} onChange={(value) => updateBrief('type', value)} options={[{ value: 'any', label: 'Any type' }, { value: 'Apartment', label: 'Apartment' }, { value: 'Townhouse', label: 'Townhouse' }]} />
        <div className="sakan-section-title">Readiness</div>
        <Choice compact label="Readiness" value={b.ready} onChange={(value) => updateBrief('ready', value)} options={[{ value: 'any', label: 'Ready or off-plan' }, { value: 'ready', label: 'Ready only' }, { value: 'offplan', label: 'Off-plan only' }]} />
      </div>;
      case 'comfort': return <div className="rx-q-body">
        <div className="sakan-section-title">Furnishing · preference</div>
        <Choice compact label="Furnishing" value={b.furnished} onChange={(value) => updateBrief('furnished', value)} options={[{ value: 'any', label: 'No preference' }, { value: 'yes', label: 'Furnished' }, { value: 'no', label: 'Unfurnished' }]} />
        <div className="sakan-section-title">Parking · preference</div>
        <Choice compact label="Parking" value={b.parking} onChange={(value) => updateBrief('parking', value)} options={[{ value: 'any', label: 'No preference' }, { value: 'yes', label: 'Parking included' }]} />
        <div className="sakan-section-title">What should rank highest?</div>
        <Choice compact label="Ranking priority" value={draft.priority} onChange={(value) => updateDraft({ priority: value })} options={(['balanced', 'commute', 'cost', 'risk'] as Priority[]).map((value) => ({ value, label: priorityLabel[value] }))} />
      </div>;
      case 'review': {
        const budget = draft.goal === 'rent' ? `${formatAED(b.rentBudget)} / year · ${formatAED(b.rentUpfront)} deposit & fees reserve` : draft.goal === 'live' ? `${formatAED(b.buyBudget)} · ${formatAED(b.downPayment)} cash · ${formatAED(b.monthlyPayment)}/mo` : formatAED(b.capital);
        const items: Array<[string, string, QKey]> = [
          ['Goal', goalCopy[draft.goal].title + (isInvest ? draft.personalUse ? ' · may live in it' : ' · pure investment' : ''), 'goal'],
          ...(!isInvest || draft.personalUse ? [['Places', draft.destinations.length ? draft.destinations.map((item) => item.label).join(', ') : 'Skipped · travel not included', 'places'] as [string, string, QKey]] : []),
          ['Budget', budget, 'money'],
          ...(draft.goal === 'rent' ? [['Rent payments', rentPaymentLabels[b.rentPayment], 'money'] as [string, string, QKey]] : []),
          ...(isInvest ? [['Investor lens', `${b.strategy} · ${b.horizon} years · ${b.vacancy}% vacancy · ${b.riskScenario}`, 'strategy'] as [string, string, QKey]] : []),
          ['Home', `${b.beds ? `${b.beds}+ bed` : 'Studio+'} · ${b.type === 'any' ? 'any type' : b.type} · ${b.ready === 'any' ? 'ready or off-plan' : b.ready === 'ready' ? 'ready only' : 'off-plan only'}`, 'home'],
          ['Preferences', `Furnishing ${b.furnished === 'any' ? 'any' : b.furnished === 'yes' ? 'furnished' : 'unfurnished'} · parking ${b.parking === 'yes' ? 'wanted' : 'any'} · ${priorityLabel[draft.priority]}`, 'comfort'],
        ];
        return <div className="rx-q-body">
          <div className="rx-review">{items.map(([label, value, key]) => <div className="rx-review-item" key={label}><span>{label}</span><strong>{value}</strong><button className="sakan-textbutton" data-testid={`button-edit-${key}${label === 'Rent payments' ? '-payment' : ''}`} onClick={() => { setError(''); setQKey(key); }}><Pencil size={12} /> Edit</button></div>)}</div>
          <div className="sakan-sample-banner"><BadgeCheck size={14} />Your brief is stored in a private server-side browser workspace. Places are only used to calculate sample rankings.</div>
          {rankingError && <div className="sakan-error" role="alert">Could not calculate matches. {rankingError}</div>}
        </div>;
      }
    }
  };

  const questionView = <div className={`rx-question rx-goal-${draft.goal}${current === 'places' ? ' rx-question-places' : ''}`}>
    <div className="rx-question-bg" aria-hidden="true"><img src={draft.goal === 'invest' ? cityImages.skyline : cityImages.marina} alt="" /><span className="rx-city-glow" /></div>
    <div className="rx-question-layout rx-question-layout-no-rail">
    <div className="rx-question-inner" key={current}>
      <div className="rx-progress" aria-label={`Question ${qIndex + 1} of ${questionKeys.length}`}>
        <div className="rx-progress-label"><span>{String(qIndex + 1).padStart(2, '0')}</span> / {String(questionKeys.length).padStart(2, '0')} · {qText[current].kicker}</div>
        <div className="rx-progress-bar">{questionKeys.map((key, index) => <button key={key} type="button" aria-label={`Go to question ${index + 1}`} disabled={index >= qIndex} className={index < qIndex ? 'done' : index === qIndex ? 'now' : ''} onClick={() => { setError(''); setQKey(key); }} />)}</div>
      </div>
      <h1 className="rx-q-title" data-testid="text-question-title">{qText[current].title}</h1>
      <p className="rx-q-sub">{qText[current].sub}</p>
      {renderQuestion()}
      {error && current !== 'review' && <div className="sakan-error" role="alert">{error}</div>}
      <div className="rx-q-actions">
        <button className="sakan-secondary" data-testid="button-back" disabled={qIndex === 0 && !resultsFresh} onClick={goBack}><ArrowLeft size={15} /> {qIndex === 0 && resultsFresh ? 'Back to matches' : 'Back'}</button>
        {current === 'review'
          ? <button className="rx-cta" data-testid="button-show-matches" disabled={rankingBusy || catalogState !== 'ready'} onClick={() => void calculate(hidden, draft.priority, true)}>{rankingBusy ? <><span className="rx-dot" /> Finding your matches</> : rankingError ? <><RotateCcw size={16} /> Retry matching</> : <><Play size={16} fill="currentColor" /> Show my matches</>}</button>
          : <button className="rx-cta" data-testid="button-next" onClick={goNext}>{current === 'places' && draft.destinations.length === 0 ? 'Skip places' : 'Next'} <ArrowRight size={16} /></button>}
      </div>
    </div>
    </div>
  </div>;

  // ---------- Results ----------
  const poster = (listing: Listing, opts: { rank?: number; inMatches: boolean }) => {
    const result = matchById.get(listing.id);
    const price = draft.goal === 'rent' ? listing.rent : listing.price;
    const style = posterStyle(listing.id);
    const isSaved = saved.includes(listing.id);
    return <article key={listing.id} className={`rx-poster${opts.rank !== undefined ? ' ranked' : ''}`} data-testid={`card-listing-${listing.id}`}>
      {opts.rank !== undefined && <span className="rx-rank" aria-hidden="true">{opts.rank + 1}</span>}
      <div className="rx-poster-card">
        <button className="rx-poster-media" onClick={() => openDetail(listing.id)} aria-label={`View details for ${listing.name}`}>
          <img src={imageUrl} alt="" style={style.img} /><span className="rx-tint" style={style.tint} />
          <span className="rx-tag">{listing.ready ? 'Ready' : 'Off-plan'}</span>
          <span className="rx-poster-title">{listing.name}</span>
        </button>
        {canMonitor && <MonitorToggle listing={listing} scope={monitorScope} onOpen={openPropertyMonitor} />}
        <div className="rx-poster-body">
          <div className="rx-meta">{listing.area} · {listing.beds === 0 ? 'Studio' : `${listing.beds} bed`} · {listing.type}</div>
          <div className="rx-price">{formatAED(price)}<small>{draft.goal === 'rent' ? ' / year' : draft.goal === 'invest' && result ? ` · ${result.netYield.toFixed(1)}% sample net` : ''}</small></div>
          {opts.inMatches && result ? <p className="rx-why">{explainMatch(result.why)}</p> : <p className="rx-why muted">Saved earlier · not in your current matches</p>}
          <div className="rx-actions">
            <button className={isSaved ? 'on' : ''} aria-pressed={isSaved} aria-label={isSaved ? `Remove ${listing.name} from My list` : `Save ${listing.name}`} data-testid={`button-save-${listing.id}`} onClick={() => void toggleSave(listing.id)}>{isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}</button>
            <button className={compare.includes(listing.id) ? 'on' : ''} aria-pressed={compare.includes(listing.id)} aria-label={`Compare ${listing.name}`} data-testid={`button-compare-${listing.id}`} onClick={() => void toggleCompare(listing.id)}><Scale size={15} /></button>
            {opts.inMatches && <button aria-label={`Hide ${listing.name}`} data-testid={`button-hide-${listing.id}`} onClick={() => hideListing(listing.id)}><EyeOff size={15} /></button>}
            <button className="rx-more" onClick={() => openDetail(listing.id)} data-testid={`button-details-${listing.id}`}>Details <ArrowRight size={13} /></button>
          </div>
        </div>
      </div>
    </article>;
  };

  const areaGroups = useMemo(() => {
    const groups = new Map<string, Match[]>();
    matches.forEach((match) => groups.set(match.listing.area, [...(groups.get(match.listing.area) || []), match]));
    return [...groups.entries()];
  }, [matches]);
  const readyMatches = matches.filter((match) => match.listing.ready);
  const offplanMatches = matches.filter((match) => !match.listing.ready);
  const savedOutside = saved.filter((id) => !matchById.has(id)).flatMap((id) => { const listing = catalog.find((item) => item.id === id); return listing ? [listing] : []; });
  const featured = matches[0];

  const billboard = (listing: Listing, match: Match | undefined, label: string) => {
    const style = posterStyle(listing.id);
    return <section className="rx-billboard" data-testid="section-featured">
      <img className="rx-billboard-img" src={imageUrl} alt="" style={{ objectPosition: style.img.objectPosition }} />
      <div className="rx-billboard-shade" />
      <div className="rx-billboard-content">
        <div className="rx-kicker"><span className="rx-r">R</span> {label}</div>
        <h1>{listing.name}</h1>
        <div className="rx-billboard-meta"><strong>{listing.area}</strong><span>{listing.beds === 0 ? 'Studio' : `${listing.beds} bed`}</span><span>{listing.baths} bath</span><span>{listing.sqft.toLocaleString()} sqft</span><span className="rx-pill">{listing.ready ? 'Ready' : 'Off-plan'}</span><span>{listing.type}</span></div>
        <div className="rx-billboard-price">{formatAED(draft.goal === 'rent' ? listing.rent : listing.price)} <small>{draft.goal === 'rent' ? 'annual rent' : 'sample purchase price'}</small></div>
        <p>{match ? explainMatch(match.why) : 'Saved earlier · not in your current matches'}. {listing.description}</p>
        <div className="rx-billboard-actions">
          {screen !== 'detail' && <button className="rx-cta" data-testid="button-featured-details" onClick={() => openDetail(listing.id)}><Info size={16} /> Full details</button>}
          <button className="rx-ghost" data-testid="button-featured-save" aria-pressed={saved.includes(listing.id)} onClick={() => void toggleSave(listing.id)}>{saved.includes(listing.id) ? <><BookmarkCheck size={16} /> On My list</> : <><Plus size={16} /> My list</>}</button>
          <button className="rx-ghost" aria-pressed={compare.includes(listing.id)} onClick={() => void toggleCompare(listing.id)}><Scale size={16} /> {compare.includes(listing.id) ? 'In compare' : 'Compare'}</button>
          {canMonitor && <MonitorToggle listing={listing} scope={monitorScope} variant="ghost" onOpen={openPropertyMonitor} />}
          {screen === 'detail' && <button className="rx-ghost" data-testid="button-detail-enquiry" onClick={() => openEnquiry(listing)}>Record an enquiry</button>}
        </div>
      </div>
      <span className="rx-illustrative">Illustrative photo · not this property</span>
    </section>;
  };

  const skeleton = <div aria-busy="true" role="status" aria-label="Loading recommendations">
    <div className="rx-billboard rx-skel-bill"><div className="rx-billboard-content"><div className="rx-skel w40" /><div className="rx-skel h1" /><div className="rx-skel w60" /><div className="rx-skel w30" /></div></div>
    {[0, 1].map((row) => <div className="rx-row" key={row}><div className="rx-skel w20" /><div className="rx-track">{[0, 1, 2, 3, 4].map((card) => <div className="rx-poster" key={card}><div className="rx-skel poster" /></div>)}</div></div>)}
  </div>;

  const resultView = <div className="rx-results">
    {rankingBusy ? skeleton : rankingError ? <div className="rx-page"><div className="sakan-empty" role="alert"><h2>Could not refresh your matches</h2><p>{rankingError}</p><button className="rx-cta" onClick={() => void calculate()}><RotateCcw size={15} /> Retry</button></div></div>
      : matches.length === 0 ? <div className="rx-page"><div className="sakan-empty rx-empty-big" data-testid="status-no-matches"><Search size={26} /><h2>No sample homes meet every hard boundary</h2><p>We will not quietly relax your price, cash, bedroom, readiness or required travel limits. Loosen one and run the match again.</p><div className="rx-empty-actions"><button className="rx-cta" onClick={() => void editFromResults('money')}><Wallet size={15} /> Adjust budget</button><button className="sakan-secondary" onClick={() => void editFromResults('home')}>Adjust home boundaries</button>{undoHidden && <button className="sakan-secondary" onClick={undoHide}>Undo last hide</button>}</div></div>
        {savedOutside.length > 0 && <Row testId="row-saved-outside" title="Saved earlier" sub="Not in your current matches">{savedOutside.map((listing) => poster(listing, { inMatches: false }))}</Row>}</div>
        : <>
          {featured && billboard(featured.listing, featured, 'Strongest match for your brief · fictional sample')}
          <div className="rx-rows">
            <div className="rx-toolbar">
              <div><h2>Recommended for you</h2><p>{matches.length} sample {matches.length === 1 ? 'home' : 'homes'} pass every boundary · {goalCopy[draft.goal].title.toLowerCase()}{calculatedAt && ` · ranked ${new Date(calculatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</p></div>
              <div className="rx-toolbar-controls">
                <label className="rx-lens"><span>Rank by</span><select aria-label="Ranking priority" data-testid="select-priority" value={draft.priority} onChange={(event) => changePriority(event.target.value as Priority)}>{(['balanced', 'commute', 'cost', 'risk'] as Priority[]).map((value) => <option value={value} key={value}>{priorityLabel[value]}</option>)}</select></label>
                <button className="rx-ghost sm" data-testid="button-open-compare" onClick={() => setModal('compare')}><Scale size={14} /> Compare {compare.length}/3</button>
                <button className="rx-ghost sm" data-testid="button-edit-brief" onClick={() => void editFromResults('review')}><Pencil size={14} /> Edit brief</button>
              </div>
            </div>
            {undoHidden && <div className="sakan-sample-banner undo-banner">One sample home hidden from your matches.<button className="sakan-textbutton" data-testid="button-undo-hide" onClick={undoHide}>Undo</button></div>}
            <Row testId="row-top3" title="Top 3 for your brief" sub="Ranked by your lens">{matches.slice(0, 3).map((match, index) => poster(match.listing, { rank: index, inMatches: true }))}</Row>
            {areaGroups.map(([area, items]) => <Row key={area} testId={`row-area-${area.replace(/\W/g, '-')}`} title={`In ${area}`} sub={`${items.length} ${items.length === 1 ? 'match' : 'matches'}`}>{items.map((match) => poster(match.listing, { inMatches: true }))}</Row>)}
            {readyMatches.length > 0 && offplanMatches.length > 0 && <>
              <Row testId="row-ready" title="Ready to move in" sub={`${readyMatches.length}`}>{readyMatches.map((match) => poster(match.listing, { inMatches: true }))}</Row>
              <Row testId="row-offplan" title="Off-plan · handover later" sub={`${offplanMatches.length}`}>{offplanMatches.map((match) => poster(match.listing, { inMatches: true }))}</Row>
            </>}
            {savedOutside.length > 0 && <Row testId="row-saved-outside" title="Saved earlier" sub="Not in your current matches">{savedOutside.map((listing) => poster(listing, { inMatches: false }))}</Row>}
            <div className="sakan-sample-banner"><Info size={14} />Fictional sample listings and assumptions, not live inventory, availability or market data. Photos are illustrative crops of one neighbourhood image. Travel times and costs are for comparison, not advice.</div>
          </div>
        </>}
  </div>;

  const detailView = chosen && detailScore ? <div className="rx-detail">
    <div className="rx-page rx-detail-top"><button className="rx-ghost sm" data-testid="button-back-to-matches" onClick={() => setScreen(resultsFresh ? 'results' : 'privacy')}><ArrowLeft size={14} /> {resultsFresh ? 'Back to matches' : 'Back to My list'}</button></div>
    {billboard(chosen, chosenMatch, `${chosenMatch ? 'In your matches' : 'Not in your current matches'} · ${chosen.fresh}`)}
    <div className="rx-page rx-detail-grid">
      <div className="rx-panel">
        <h3>The numbers</h3>
        <div className="sakan-breakdown">{detailFinancialRows}<div className="sakan-breakdown-row"><span>Routine travel estimate</span><strong>{activeDests.length ? `~${detailScore.commute} min` : 'Not included'}</strong></div></div>
        {draft.goal === 'live' && <small className="sakan-note">Illustrative 20-year loan at 5.25% on price + 6% costs − available cash. Financing eligibility and fees are not assessed.</small>}
        {!chosen.ready && <div className="sakan-sample-banner">Off-plan sample: confirm payment plan, progress and handover timing; figures exclude milestone financing and delay risk.</div>}
      </div>
      <div className="rx-panel">
        <h3>The home</h3>
        <div className="rx-specs"><span><BedDouble size={14} />{chosen.beds} bed</span><span>{chosen.baths} bath</span><span>{chosen.sqft.toLocaleString()} sqft</span><span><Building2 size={14} />{chosen.type}</span><span>{chosen.furnished ? 'Furnished' : 'Unfurnished'}</span><span><CarFront size={14} />{chosen.parking ? 'Parking' : 'No parking'}</span></div>
        <p className="rx-detail-why">{detailScore.why}. One comparison point, not a prediction.</p>
        <button className="rx-cta full" onClick={() => openEnquiry(chosen)} data-testid="button-record-enquiry">Record an enquiry in Realmax <ArrowRight size={14} /></button>
        <small className="sakan-note">Recorded in your workspace only. Not sent to an agent.</small>
      </div>
    </div>
  </div> : <div className="rx-page"><div className="sakan-empty"><h2>Choose a sample home</h2><button className="sakan-secondary" onClick={() => setScreen(resultsFresh ? 'results' : 'questions')}>Back</button></div></div>;

  const privacyView = <div className="rx-page rx-privacy">
    <div className="rx-toolbar"><div><div className="sakan-eyebrow">Private browser workspace</div><h2>My list & privacy</h2><p>No account, login or household sharing.</p></div><button className="rx-ghost sm" data-testid="button-privacy-back" onClick={() => setScreen(resultsFresh ? 'results' : 'questions')}><ArrowLeft size={14} /> {resultsFresh ? 'Back to matches' : 'Back to questions'}</button></div>
    {saved.length === 0 ? <div className="sakan-empty"><Bookmark size={22} /><h3>Nothing on your list yet</h3><p>Save homes from your recommendations to keep them here.</p><button className="rx-cta" onClick={() => setScreen(resultsFresh ? 'results' : 'questions')}>{resultsFresh ? 'Browse my matches' : 'Finish my brief'}</button></div>
      : <Row testId="row-saved" title={`Saved · ${saved.length}`} sub={resultsFresh ? 'Matches and earlier saves' : 'Run your brief to see which still match'}>{saved.flatMap((id) => { const listing = catalog.find((item) => item.id === id); return listing ? [poster(listing, { inMatches: resultsFresh && matchById.has(id) })] : []; })}</Row>}
    <div className="sakan-sample-banner"><ShieldCheck size={14} />Your brief, saved homes, comparison and enquiry history are stored server-side in a private workspace identified by an HttpOnly same-site browser cookie. Places are used for rankings only and never shared. If you lose the cookie, this workspace cannot be recovered.</div>
    <div className="sakan-section-title">Current brief</div><div className="sakan-destination"><span className="sakan-pin"><Search size={15} /></span><div><div className="sakan-dest-name">{goalCopy[draft.goal].title} · {formatAED(draft.goal === 'rent' ? b.rentBudget : draft.goal === 'live' ? b.buyBudget : b.capital)}</div><div className="sakan-dest-meta">{activeDests.length} places · {b.beds}+ bedrooms · {priorityLabel[draft.priority]}</div></div><button className="sakan-secondary" onClick={() => void editFromResults('review')}>Edit brief</button></div>
    <div className="sakan-section-title">Enquiry history · {enquiries.length}</div>
    {!enquiries.length ? <p className="sakan-note">No enquiries recorded.</p> : <div className="enquiry-history">{enquiries.map((entry) => <article key={entry.id} className="sakan-destination"><span className="sakan-pin"><Check size={15} /></span><div><div className="sakan-dest-name">{catalog.find((listing) => listing.id === entry.listingId)?.name || entry.listingId}</div><div className="sakan-dest-meta">{entry.name} · {entry.contact} · {new Date(entry.createdAt).toLocaleString()}</div><p>{entry.message}</p><strong>Recorded in Realmax · not sent to an agent</strong></div></article>)}</div>}
    <div className="sakan-section-title">Privacy choices</div>
    <div className="sakan-destination"><span className="sakan-pin"><MapPin size={15} /></span><div><div className="sakan-dest-name">Remove destination locations</div><div className="sakan-dest-meta">Delete all saved places from this brief.</div></div><button className="sakan-secondary" data-testid="button-remove-places" onClick={() => { updateDraft({ destinations: [] }); setToast('Places removed'); }}>Remove</button></div>
    <div className="sakan-destination privacy-clear"><span className="sakan-pin"><RotateCcw size={15} /></span><div><div className="sakan-dest-name">Delete private workspace</div><div className="sakan-dest-meta">Delete saved homes, brief, comparisons and enquiry history. Also clears monitored properties kept in this browser.</div></div><button className="sakan-secondary" data-testid="button-delete-workspace" disabled={resetBusy} onClick={() => void resetWorkspace()}>{resetBusy ? 'Deleting…' : 'Delete workspace'}</button></div>
  </div>;

  const compareListings = compare.flatMap((id) => {
    const listing = catalog.find((item) => item.id === id);
    return listing ? [listing] : [];
  });
  const scoreForListing = (listing: Listing) =>
    matchById.get(listing.id) || estimateScore(listing, draft.goal, draft.brief, activeDests);
  const monthlyLoanFor = (listing: Listing) => monthlyLoan(Math.max(0, listing.price * 1.06 - draft.brief.downPayment));
  const comparisonRows: Array<[string, (listing: Listing) => string]> = [
    ['Area', (listing) => listing.area],
    ['Bedrooms & size', (listing) => `${listing.beds} bed · ${listing.sqft.toLocaleString()} sqft`],
    ['Availability', (listing) => listing.ready ? 'Ready' : 'Off-plan'],
    ['In current matches', (listing) => resultsFresh && matchById.has(listing.id) ? 'Yes' : 'No'],
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
  const saveStatus = saveState === 'loading' ? 'Loading workspace' : saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved' : 'Could not save';
  return <div className={`sakan-root rx-screen-${screen}`}>
    <header className="rx-topbar">
      <button className="rx-brand" data-testid="button-brand" onClick={() => void goHome()} aria-label="Realmax home">REALMAX</button>
      <nav className="rx-nav" aria-label="Main navigation">
        <button data-testid="button-go-home" onClick={() => void goHome()} disabled={!workspaceReady || resetBusy}><Home size={15} aria-hidden="true" />Home</button>
        {resultsFresh && screen !== 'results' && <button data-testid="link-matches" onClick={() => setScreen('results')}>My matches</button>}
        <button data-testid="link-my-list" className={screen === 'privacy' ? 'active' : ''} onClick={async () => { if (await flushBeforeLeaving()) setScreen('privacy'); }}>My list{saved.length > 0 && <span className="rx-count">{saved.length}</span>}</button>
        {workspaceReady && canMonitor && <button data-testid="link-monitor" className={screen === 'monitor' ? 'active' : ''} disabled={catalogState !== 'ready'} onClick={async () => { if (await flushBeforeLeaving()) setScreen('monitor'); }}>Monitor<span className="rx-count rxm-nav-count" data-testid="text-monitor-count">{monitor.ids.length}</span></button>}
        <button data-testid="link-how" onClick={() => setModal('how')}>How it works</button>
        <span className={`save-status ${saveState}`} role="status" data-testid="status-save">{saveStatus}{saveState === 'error' && <button onClick={() => void saveNow().catch((saveError) => setError(errorText(saveError)))}>Retry</button>}</span>
      </nav>
    </header>
    <main>
      {canMonitor && monitor.error && screen !== 'monitor' && <div className="sakan-error" role="alert">{monitor.error} <button className="sakan-textbutton" onClick={monitor.dismissError}>Dismiss</button></div>}
      {catalogState === 'loading' ? <div className="rx-page"><div className="sakan-empty loading-card" role="status"><div className="sakan-spinner" /><h2>Preparing Realmax</h2><p>Loading the sample catalogue and your private workspace.</p></div></div>
        : catalogState === 'error' ? <div className="rx-page"><div className="sakan-empty" role="alert"><h2>Could not load Realmax</h2><p>{error}</p><button className="rx-cta" onClick={() => window.location.reload()}>Try again</button></div></div>
          : <>
            {screen === 'questions' && questionView}
            {screen === 'results' && resultView}
            {screen === 'detail' && detailView}
            {screen === 'privacy' && privacyView}
            {screen === 'monitor' && canMonitor && <MonitorDashboard key={monitorScope} scope={monitorScope} catalog={catalog} propertyId={monitorPropertyId} onPropertyChange={setMonitorPropertyId} onOpenDetail={openDetail} onBack={() => setScreen(resultsFresh ? 'results' : 'questions')} />}
          </>}
    </main>
    <footer className="sakan-footer">Realmax is a decision-making prototype. Listings, prices, rents, travel times, yields and images are illustrative sample data, not live market information or financial advice. <span className="rx-credit">City photography: <a href="https://www.pexels.com/photo/6535465/" target="_blank" rel="noreferrer">Pexels 6535465</a> and <a href="https://www.pexels.com/photo/3680908/" target="_blank" rel="noreferrer">Pexels 3680908</a>, decorative only, not listings.</span></footer>

    {modal === 'destination' && <Dialog titleId="destination-title" onClose={() => { setModal(null); setError(''); }}><div className="sakan-modal-head"><div><div className="sakan-eyebrow">A place in your week</div><h2 id="destination-title">{editing ? 'Edit place' : 'Add a place'}</h2></div><button className="sakan-modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={16} /></button></div><div className="sakan-form-grid"><div className="sakan-field"><label htmlFor="destination-kind">Place in your life</label><select id="destination-kind" className="sakan-select" value={draftDest.kind} onChange={(event) => setDraftDest({ ...draftDest, kind: event.target.value, label: event.target.value === 'Work' ? 'My work' : event.target.value })}>{['Work', 'Partner work', 'School', 'Worship', 'Sport', 'Custom'].map((kind) => <option key={kind}>{kind}</option>)}</select></div><div className="sakan-field"><label htmlFor="destination-label">Short label</label><input id="destination-label" className="sakan-input" value={draftDest.label} onChange={(event) => setDraftDest({ ...draftDest, label: event.target.value })} placeholder="My office" /></div><div className="sakan-field"><label htmlFor="destination-place">Supported sample place</label><select id="destination-place" className="sakan-select" value={draftDest.place} onChange={(event) => setDraftDest({ ...draftDest, place: event.target.value, address: event.target.value.split(',').slice(-1)[0] })}>{places.map((place) => <option key={place}>{place}</option>)}</select></div><div className="sakan-field"><label htmlFor="destination-address">Area note (optional)</label><input id="destination-address" className="sakan-input" value={draftDest.address} onChange={(event) => setDraftDest({ ...draftDest, address: event.target.value })} placeholder="Neighbourhood or building" /></div><div className="sakan-field"><label htmlFor="destination-mode">Travel mode</label><select id="destination-mode" className="sakan-select" value={draftDest.mode} onChange={(event) => setDraftDest({ ...draftDest, mode: event.target.value as Destination['mode'] })}><option value="car">Car</option><option value="metro">Metro</option><option value="walk">Walk / cycle</option></select></div><div className="sakan-field"><label htmlFor="destination-frequency">Visits per week</label><select id="destination-frequency" className="sakan-select" value={draftDest.frequency} onChange={(event) => setDraftDest({ ...draftDest, frequency: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map((count) => <option value={count} key={count}>{count} days / week</option>)}</select></div><div className="sakan-field"><label htmlFor="destination-time">Maximum travel time (minutes)</label><input id="destination-time" className="sakan-input" type="number" min="5" max="120" value={draftDest.maxMinutes} onChange={(event) => setDraftDest({ ...draftDest, maxMinutes: Number(event.target.value) || 0 })} /></div></div><div className="sakan-section-title">How much should this matter?</div><div className="sakan-toggle-row"><button className={`sakan-chip${draftDest.required ? ' active' : ''}`} aria-pressed={draftDest.required} onClick={() => setDraftDest({ ...draftDest, required: true, preferred: false })}>Required boundary</button><button className={`sakan-chip${!draftDest.required ? ' active' : ''}`} aria-pressed={!draftDest.required} onClick={() => setDraftDest({ ...draftDest, preferred: true, required: false })}>Preferred</button></div>{error && <div className="sakan-error" role="alert">{error}</div>}<div className="sakan-modal-actions"><button className="sakan-secondary" onClick={() => { setModal(null); setError(''); }}>Cancel</button><button className="sakan-primary" data-testid="button-save-destination" onClick={saveDestination}>{editing ? 'Save place' : 'Add place'}</button></div></Dialog>}
    {modal === 'compare' && <Dialog titleId="compare-title" onClose={() => setModal(null)} wide>
      <div className="sakan-modal-head"><div><div className="sakan-eyebrow">Tradeoffs, side by side</div><h2 id="compare-title">Compare sample homes</h2></div><button className="sakan-modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={16} /></button></div>
      {!compareListings.length ? <div className="sakan-empty"><Scale size={22} /><h3>Choose homes to compare</h3><p>Add up to three homes from your recommendations.</p></div>
        : <div className="sakan-compare-table"><div className="sakan-compare-grid" style={{ gridTemplateColumns: `130px repeat(${compareListings.length}, minmax(160px, 1fr))` }}>
          <div className="sakan-compare-label">Your comparison</div>
          {compareListings.map((listing) => <div className="sakan-compare-heading" key={listing.id}>{listing.name}<button className="sakan-icon-button" aria-label={`Remove ${listing.name} from compare`} onClick={() => void toggleCompare(listing.id)}><X size={13} /></button></div>)}
          {comparisonRows.map(([label, render]) => <div className="compare-row" key={label}><div className="sakan-compare-label">{label}</div>{compareListings.map((listing) => <div key={`${label}-${listing.id}`}>{render(listing)}</div>)}</div>)}
        </div></div>}
      <div className="sakan-modal-actions"><button className="sakan-secondary" onClick={() => setModal(null)}>Done</button></div>
    </Dialog>}
    {modal === 'enquiry' && chosen && <Dialog titleId="enquiry-title" onClose={() => setModal(null)}><div className="sakan-modal-head"><div><div className="sakan-eyebrow">Nothing is forwarded</div><h2 id="enquiry-title">{enquiryResult ? 'Enquiry recorded' : 'Record an enquiry'}</h2></div><button className="sakan-modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={16} /></button></div>{enquiryResult ? <><div className="sakan-sample-banner"><Check size={15} />This message is recorded in Realmax only. It was not sent to an agent.</div><div className="enquiry-receipt"><strong>{chosen.name}</strong><p>{enquiryResult.message}</p><small>Reference {enquiryResult.id} · {new Date(enquiryResult.createdAt).toLocaleString()}</small></div></> : <><p>This record stays in your private Realmax workspace. It will not be sent to an agent or third party.</p><div className="sakan-card enquiry-listing"><div className="sakan-eyebrow">Sample property</div><strong>{chosen.name}</strong><div className="sakan-dest-meta">{chosen.area} · {formatAED(draft.goal === 'rent' ? chosen.rent : chosen.price)}</div></div><div className="sakan-form-grid"><div className="sakan-field"><label htmlFor="enquiry-name">Your name</label><input id="enquiry-name" data-testid="input-enquiry-name" className="sakan-input" required value={enquiryName} onChange={(event) => setEnquiryName(event.target.value)} /></div><div className="sakan-field"><label htmlFor="enquiry-contact">Email or phone</label><input id="enquiry-contact" data-testid="input-enquiry-contact" className="sakan-input" required autoComplete="email" value={enquiryContact} onChange={(event) => setEnquiryContact(event.target.value)} /></div><div className="sakan-field enquiry-message"><label htmlFor="enquiry-message">Message</label><textarea id="enquiry-message" className="sakan-input" rows={4} value={enquiryMessage} onChange={(event) => setEnquiryMessage(event.target.value)} /></div></div><label className="sakan-checkline consent-line"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I agree to store this enquiry in my private workspace. This does not share household destinations and does not forward anything to an agent.</label>{error && <div className="sakan-error" role="alert">{error}</div>}</>}<div className="sakan-modal-actions">{enquiryResult ? <button className="sakan-primary" onClick={() => setModal(null)}>Done</button> : <><button className="sakan-secondary" onClick={() => setModal(null)}>Cancel</button><button className="sakan-primary" data-testid="button-submit-enquiry" disabled={enquiryBusy} onClick={() => void submitEnquiry()}>{enquiryBusy ? 'Recording…' : 'Record in Realmax'}</button></>}</div></Dialog>}
    {modal === 'how' && <Dialog titleId="how-title" onClose={() => setModal(null)}><div className="sakan-modal-head"><div><div className="sakan-eyebrow">A tool, not a broker</div><h2 id="how-title">How Realmax works</h2></div><button className="sakan-modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={16} /></button></div><p>Answer a short series of questions about your goal, places, money and home. Realmax then ranks a small, fictional sample set against your hard boundaries. It does not connect to listing feeds, navigation, banks or agencies.</p><div className="sakan-side-list"><div className="sakan-side-item"><MapPin size={15} />The map uses real street tiles, but pins mark sample area centres, not exact addresses. Travel times are illustrative assumptions.</div><div className="sakan-side-item"><Wallet size={15} />Financial figures are scenario arithmetic from sample assumptions.</div><div className="sakan-side-item"><ShieldCheck size={15} />Your server-side workspace belongs to this browser cookie; losing it means it cannot be recovered.</div></div><div className="sakan-modal-actions"><button className="sakan-secondary" onClick={() => setModal(null)}>Close</button><button className="sakan-primary" onClick={async () => { if (await flushBeforeLeaving()) { setModal(null); setScreen('privacy'); } }}>Privacy choices</button></div></Dialog>}
    {toast && <div className="sakan-toast" role="status">{toast}{undoHidden && toast.includes('hidden') && <button onClick={undoHide}>Undo</button>}</div>}
  </div>;
}
