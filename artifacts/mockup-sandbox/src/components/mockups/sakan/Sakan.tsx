import './_group.css';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, BriefcaseBusiness, Check, Clock3, Heart, Home, Info, Landmark, MapPin, Plus, School, SlidersHorizontal, Sparkles, Trash2, X, RotateCcw, BedDouble, CarFront, Scale, ShieldCheck, Pencil, Search, Eye, Wallet, Church, Dumbbell, Users, BadgeCheck } from 'lucide-react';
import { areaKey, filterListings, formatAED, initialBrief, meetsTravelBoundary, sampleListings, samplePlaces, scoreListing, travelFor, type Brief, type Destination, type Goal, type Listing } from './_data';

const makeDestinations = ():Destination[] => [
  {id:'d1',kind:'Work',label:'My work',place:'DIFC Gate Avenue',address:'DIFC, Dubai',frequency:5,mode:'car',maxMinutes:35,required:true,preferred:false},
  {id:'d2',kind:'School',label:'School',place:'GEMS Wellington International School',address:'Al Sufouh, Dubai',frequency:5,mode:'car',maxMinutes:30,required:false,preferred:true},
  {id:'d3',kind:'Worship',label:'Friday prayer',place:'Jumeirah Mosque',address:'Jumeirah 1, Dubai',frequency:1,mode:'car',maxMinutes:25,required:false,preferred:true},
];
type ModalState = 'destination'|'compare'|'enquiry'|'privacy'|'adjust'|null;
const goalCopy:Record<Goal,{title:string;sub:string}> = {
 rent:{title:'Rent a home',sub:'A better fit for how your week actually works.'},
 live:{title:'Buy to live',sub:'Find a place that feels right beyond the floor plan.'},
 invest:{title:'Invest thoughtfully',sub:'See the assumptions, costs and tradeoffs up front.'}
};
const iconFor=(kind:string)=>{
 if(kind.toLowerCase().includes('school'))return School;
 if(kind.toLowerCase().includes('worship'))return Church;
 if(kind.toLowerCase().includes('sport'))return Dumbbell;
 if(kind.toLowerCase().includes('partner'))return Users;
 if(kind.toLowerCase().includes('custom'))return MapPin;
 return BriefcaseBusiness;
};
const safeRead=(key:string,fallback:string[])=>{
 try { const v=localStorage.getItem(key); return v?JSON.parse(v):fallback; } catch { return fallback; }
};
const readDraft=()=>{
 try {
  const raw=localStorage.getItem('sakan-draft');
  if(!raw)return null;
  const value=JSON.parse(raw);
  return {goal:(['rent','live','invest'].includes(value.goal)?value.goal:'rent') as Goal,
   destinations:Array.isArray(value.destinations)?value.destinations as Destination[]:makeDestinations(),
   brief:{...initialBrief,...(value.brief||{})} as Brief};
 } catch { return null; }
};
const currencyInput=(value:number,set:(n:number)=>void,step=5000)=> <input className="sakan-input" type="number" min="0" step={step} value={value} onChange={e=>set(Math.max(0,Number(e.target.value)||0))} />;

function DubaiMap({destinations}:{destinations:Destination[]}) {
  const labels=[['Dubai Marina',72,45],['Downtown',52,34],['DIFC',56,30],['Jumeirah',43,48],['Dubai Hills',40,30],['JVC',49,59],['Creek',69,27],['Palm',29,39]];
  const colors=['#d77c5e','#28756c','#d9af62','#586e87','#a47955'];
  return <div className="sakan-map" role="img" aria-label="Illustrative schematic map of Dubai showing sample areas and your destination markers">
    <svg viewBox="0 0 640 300" preserveAspectRatio="xMidYMid slice">
      <rect width="640" height="300" fill="#e5eee4"/>
      <path d="M0 182 C50 165 78 180 130 163 C190 144 203 177 250 155 C310 126 325 146 368 121 C415 95 448 109 485 77 C523 44 563 46 640 8 L640 0 L0 0Z" fill="#d7e8e5"/>
      <path d="M23 18 C80 59 126 44 166 80 S238 103 273 135 S333 168 375 156 S444 137 479 166 S557 185 610 220" fill="none" stroke="#faf8e9" strokeWidth="17" strokeLinecap="round"/>
      <path d="M80 289 C102 245 127 214 180 200 S254 179 278 146 S332 94 385 86 S475 69 543 15" fill="none" stroke="#fffdf5" strokeWidth="10" strokeLinecap="round"/>
      <path d="M150 24 L208 92 L259 114 L337 151 L403 178 L456 241" fill="none" stroke="#f8f5e8" strokeWidth="7" strokeLinecap="round"/>
      <path d="M320 276 C340 230 344 195 379 170 S429 148 470 121" fill="none" stroke="#d5ad77" strokeWidth="3" strokeDasharray="5 8"/>
      <path d="M31 131 Q92 107 154 127 T272 153" fill="none" stroke="#a9d2cf" strokeWidth="13" strokeLinecap="round"/>
      <g fill="#c9ddc8">
        <path d="M112 104 l22-7 22 13-10 13-26-4z"/><path d="M312 52l35-10 17 18-21 14-30-5z"/>
        <path d="M516 199l36-13 25 13-9 26-39 2z"/><path d="M226 221l33-11 17 13-18 18-33-4z"/>
      </g>
      {labels.map(([label,x,y])=><g key={label as string} transform={`translate(${x},${y})`}>
        <circle r="3" fill="#6e8d7c"/><text x="7" y="3" fill="#587568" fontSize="9" fontFamily="DM Sans, sans-serif">{label}</text>
      </g>)}
      {destinations.slice(0,5).map((d,i)=>{
        const t=areaKey(d.place);
        const coords:Record<string,[number,number]>={DIFC:[58,29],'Dubai Marina':[72,47],'Al Barsha':[40,48],'Business Bay':[53,36],'Dubai Internet City':[63,40],Jumeirah:[43,48],JVC:[49,59]};
        const [x,y]=coords[t]||[55,40]; const px=x*6.4,py=y*3;
        return <g key={d.id} transform={`translate(${px},${py})`}>
          <circle r="13" fill={colors[i%colors.length]} opacity=".16"/><circle r="7" fill={colors[i%colors.length]} stroke="#fffef8" strokeWidth="2"/>
          <text x="11" y="-9" fill="#234b47" fontSize="8" fontWeight="700" fontFamily="DM Sans, sans-serif">{d.label}</text>
        </g>;
      })}
    </svg>
    <div className="sakan-map-caption"><MapPin size={12}/> Dubai, drawn schematically · illustrative locations, not navigation</div>
  </div>;
}

export function Sakan() {
 const [goal,setGoal]=useState<Goal>(()=>readDraft()?.goal||'rent');
 const [destinations,setDestinations]=useState<Destination[]>(()=>readDraft()?.destinations||makeDestinations());
 const [personalUse,setPersonalUse]=useState(false);
 const [brief,setBrief]=useState<Brief>(()=>readDraft()?.brief||initialBrief);
 const [step,setStep]=useState(0);
 const [screen,setScreen]=useState<'home'|'results'|'detail'|'privacy'>('home');
 const [selected,setSelected]=useState<string|null>(null);
 const [modal,setModal]=useState<ModalState>(null);
 const [editing,setEditing]=useState<Destination|null>(null);
 const [draftDest,setDraftDest]=useState<Destination>({id:'',kind:'Work',label:'Work',place:samplePlaces[0],address:'',frequency:5,mode:'car',maxMinutes:30,required:false,preferred:true});
 const [saved,setSaved]=useState<string[]>(()=>safeRead('sakan-saved',[]));
 const [hidden,setHidden]=useState<string[]>([]);
 const [undoHidden,setUndoHidden]=useState<string|null>(null);
 const [compare,setCompare]=useState<string[]>([]);
 const [priority,setPriority]=useState('balanced');
 const [toast,setToast]=useState('');
 const [error,setError]=useState('');
 const [consent,setConsent]=useState(false);
 const [enquirySent,setEnquirySent]=useState(false);

 useEffect(()=>{try{localStorage.setItem('sakan-saved',JSON.stringify(saved));}catch{}},[saved]);
 useEffect(()=>{try{localStorage.setItem('sakan-draft',JSON.stringify({goal,destinations,brief}));}catch{}},[goal,destinations,brief]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2800);return()=>clearTimeout(t);},[toast]);
 const isInvest=goal==='invest';
 const activeDests=isInvest&&!personalUse?[]:destinations;
 const filtered=useMemo(()=>filterListings(goal,brief,hidden).filter(l=>meetsTravelBoundary(l,activeDests)),[goal,brief,hidden,activeDests]);
 const matches=useMemo(()=>filtered.map(l=>({listing:l,...scoreListing(l,goal,brief,activeDests)})).sort((a,b)=>{
   const p=priority==='commute' ? b.score+(b.commute-a.commute)*.8 : priority==='cost' ? b.score+(a.listing.price-b.listing.price)/90000 : priority==='risk' ? b.score+(a.downside-b.downside)*1.1 : b.score-a.score;
   return p;
 }),[filtered,goal,brief,activeDests,priority]);
 const chosen=sampleListings.find(l=>l.id===selected)||null;
 const detailScore=chosen?scoreListing(chosen,goal,brief,activeDests):null;
 const updateBrief=(key:keyof Brief,value:Brief[keyof Brief])=>setBrief(prev=>({...prev,[key]:value}));
 const showToast=(message:string)=>setToast(message);
 const setGoalSafely=(next:Goal)=>{
   if(next===goal)return;
   setGoal(next);setError('');
   setBrief(prev=>({...prev, rentBudget:next==='rent'?Math.max(prev.rentBudget,70000):prev.rentBudget,buyBudget:next==='live'?Math.max(prev.buyBudget,850000):prev.buyBudget,capital:next==='invest'?Math.max(prev.capital,850000):prev.capital}));
   setStep(next==='invest'&&!personalUse?1:0);
 };
 const openDestination=(dest?:Destination)=>{
   const d=dest||{...draftDest,id:'',kind:'Work',label:'Work',place:samplePlaces[0],address:'',frequency:5,mode:'car' as const,maxMinutes:30,required:false,preferred:true};
   setEditing(dest||null);setDraftDest({...d});setModal('destination');
 };
 const saveDestination=()=>{
   if(!draftDest.label.trim()||!draftDest.place.trim()){setError('Add a destination name and place to continue.');return;}
   if(draftDest.maxMinutes<5||draftDest.maxMinutes>120){setError('Travel limit must be between 5 and 120 minutes.');return;}
   setDestinations(prev=>editing?prev.map(d=>d.id===editing.id?draftDest:d):[...prev,{...draftDest,id:`d${Date.now()}`}]);
   setModal(null);setError('');showToast(editing?'Destination updated':'Destination added');
 };
 const removeDestination=(id:string)=>{setDestinations(prev=>prev.filter(d=>d.id!==id));showToast('Destination removed');};
 const switchStep=(next:number)=>{
   if(next<0){setStep(0);return;}
   if(next===5){calculate();}
   else {setStep(Math.min(4,next));setError('');setScreen('home');}
 };
 const validate=()=>{
   if(goal==='rent'&&brief.rentBudget<=0){setError('Enter a positive annual rent budget.');return false;}
   if(goal==='live'&&(brief.buyBudget<=0||brief.monthlyPayment<0)){setError('Enter a positive purchase budget and a non-negative monthly amount.');return false;}
   if(goal==='invest'&&(brief.capital<=0||brief.horizon<1)){setError('Enter a positive investment amount and a horizon of at least one year.');return false;}
   if(!isInvest&&!activeDests.length){setError('Add at least one destination, or switch to an investor brief.');return false;}
   return true;
 };
 const calculate=()=>{
   if(!validate())return;
   setError('');
   setHidden([]);
   setScreen('results');
 };
 const begin=()=>{setScreen('home');setStep(isInvest&&!personalUse?1:0);setError('');};
 const toggleSave=(id:string)=>setSaved(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
 const toggleCompare=(id:string)=>{
   setCompare(prev=>prev.includes(id)?prev.filter(x=>x!==id):prev.length>=3?(showToast('Compare up to three homes at a time'),prev):[...prev,id]);
 };
 const hideListing=(id:string)=>{setHidden(prev=>[...prev,id]);setUndoHidden(id);showToast('Home hidden from these results');};
 const undoHide=()=>{if(undoHidden)setHidden(prev=>prev.filter(x=>x!==undoHidden));setUndoHidden(null);setToast('');};
 const resultBack=()=>{setScreen('home');setStep(4);};
 const closeModal=()=>{setModal(null);setError('');};
 const openEnquiry=(listing:Listing)=>{setSelected(listing.id);setConsent(false);setEnquirySent(false);setModal('enquiry');};
 const simulateEnquiry=()=>{if(!consent){setError('Please confirm before previewing this simulated enquiry.');return;}setEnquirySent(true);setError('');};
 const resetLocal=()=>{
   setSaved([]);setHidden([]);setCompare([]);setDestinations([]);setBrief(initialBrief);setPersonalUse(false);setGoal('rent');setStep(0);setScreen('home');setModal(null);
   try{localStorage.removeItem('sakan-saved');localStorage.removeItem('sakan-draft');}catch{}
   showToast('Saved items and local brief cleared');
 };
 const stepTitles=isInvest&&!personalUse?['Finance','Preferences','Review']:['Your places','Weekly rhythm','Budget','Preferences','Review'];
 const visibleStep=isInvest&&!personalUse?Math.max(0,step-1):step;

 const header=<header className="sakan-topbar">
   <button className="sakan-brand" onClick={()=>{setScreen('home');setStep(0);}} aria-label="Sakan home">
     <span className="sakan-mark"><Home size={19}/></span><span className="sakan-wordmark">sakan</span>
   </button>
   <nav className="sakan-toplinks" aria-label="Main navigation">
     <button onClick={()=>{setScreen('privacy');setModal(null);}}>Saved & privacy {saved.length>0&&<span className="sakan-badge" style={{marginLeft:5}}>{saved.length}</span>}</button>
     <button onClick={()=>setModal('privacy')}>How it works</button>
   </nav>
 </header>;

 const goalSelector=<section className="sakan-goal-panel" aria-label="Choose your home goal">
   <h2>What are you looking for?</h2>
   <div className="sakan-goals">
    {(['rent','live','invest'] as Goal[]).map((g,i)=>{
      const Icon=i===0?Home:i===1?Heart:Landmark;
      return <button key={g} onClick={()=>setGoalSafely(g)} className={`sakan-goal ${goal===g?'active':''}`} aria-pressed={goal===g}>
       <span className="sakan-goal-icon"><Icon size={18}/></span><span><strong>{goalCopy[g].title}</strong><small>{goalCopy[g].sub}</small></span>{goal===g&&<Check size={15} style={{marginLeft:'auto',color:'var(--teal)'}}/>}
      </button>;
    })}
   </div>
 </section>;

 const stepHeader=<div className="sakan-step-head">
   <div><div className="sakan-eyebrow">{isInvest&&!personalUse?'Investor brief':'Your home brief'} · Step {visibleStep+1} of {stepTitles.length}</div><h2>{stepTitles[visibleStep]||'Your places'}</h2></div>
   <div style={{display:'flex',alignItems:'center',gap:10}}><span className="sakan-stepper-label">{Math.round((visibleStep+1)/stepTitles.length*100)}% shaped</span><div className="sakan-progress" aria-label={`Step ${visibleStep+1} of ${stepTitles.length}`}>{stepTitles.map((t,i)=><span key={t} className={i<=visibleStep?'done':''}/>)}</div></div>
 </div>;

 const destinationStep=<>
   <p style={{fontSize:11,color:'var(--muted)',lineHeight:1.6,margin:'-5px 0 14px'}}>Start with the places your week revolves around. We use these to compare sample travel times—not to track you.</p>
   {isInvest&&<label className="sakan-checkline" style={{marginBottom:12}}><input type="checkbox" checked={personalUse} onChange={e=>{setPersonalUse(e.target.checked);setStep(e.target.checked?0:1);}}/>I may use this investment as a home later, so include my personal destinations.</label>}
   {activeDests.length===0?<div className="sakan-empty"><MapPin size={22} color="var(--teal)"/><h3>No destinations yet</h3><p>{isInvest?'A pure investment brief can skip personal travel. Add a personal-use destination if you want it included.':'Add the places that shape your week to see practical travel tradeoffs.'}</p></div>:
    <div className="sakan-destinations">{activeDests.map(d=>{const Icon=iconFor(d.kind);return <div className="sakan-destination" key={d.id}>
      <span className="sakan-pin"><Icon size={16}/></span><div><div className="sakan-dest-name">{d.label}</div><div className="sakan-dest-meta">{d.place} · {d.frequency} {d.frequency===1?'day':'days'}/week · {d.mode}</div></div>
      <span className="sakan-badge">{d.required?'Required':'Preferred'}</span>
      <div className="sakan-dest-actions"><button className="sakan-icon-button" aria-label={`Edit ${d.label}`} onClick={()=>openDestination(d)}><Pencil size={14}/></button><button className="sakan-icon-button" aria-label={`Remove ${d.label}`} onClick={()=>removeDestination(d.id)}><Trash2 size={14}/></button></div>
     </div>;})}</div>}
   {(!isInvest||personalUse)&&<button className="sakan-add-dest" onClick={()=>openDestination()}><Plus size={15}/> Add a place in your life</button>}
   <div className="sakan-section-title">Common starting points</div>
   <div className="sakan-toggle-row">{['Work','Partner work','School','Worship','Sport','Custom'].map(kind=><button key={kind} className="sakan-chip" onClick={()=>openDestination({id:'',kind,label:kind==='Work'?'My work':kind,place:samplePlaces[kind==='School'?2:kind==='Worship'?3:kind==='Sport'?6:0],address:'',frequency:kind==='Worship'?1:5,mode:'car',maxMinutes:30,required:false,preferred:true})}><Plus size={11} style={{verticalAlign:'-2px'}}/> {kind}</button>)}</div>
 </>;

 const routineStep=<>
   <p style={{fontSize:11,color:'var(--muted)',lineHeight:1.6,margin:'-5px 0 14px'}}>A weekday commute and a weekly class are not the same priority. Tune how much each place matters.</p>
   {activeDests.length===0?<div className="sakan-empty"><h3>Nothing to schedule</h3><p>Your investor results are ranked on the assumptions you choose. Personal destinations are currently switched off.</p><button className="sakan-secondary" onClick={()=>setStep(0)}>Add personal-use places</button></div>:
   <div className="sakan-destinations">{activeDests.map(d=><div className="sakan-destination" key={d.id}><span className="sakan-pin"><Clock3 size={15}/></span><div><div className="sakan-dest-name">{d.label}</div><div className="sakan-dest-meta">{d.place}</div></div>
     <select aria-label={`Days per week at ${d.label}`} className="sakan-select" style={{width:112,padding:'8px'}} value={d.frequency} onChange={e=>setDestinations(prev=>prev.map(x=>x.id===d.id?{...x,frequency:Number(e.target.value)}:x))}>{[1,2,3,4,5,6,7].map(n=><option value={n} key={n}>{n} {n===1?'day':'days'} / week</option>)}</select>
     <button className="sakan-icon-button" aria-label={`Edit travel priority for ${d.label}`} onClick={()=>openDestination(d)}><Pencil size={14}/></button>
   </div>)}</div>}
   <div className="sakan-section-title">How should travel feel?</div><div className="sakan-toggle-row">{['Easy weekday','Balanced week','Fewer compromises'].map((x,i)=><button key={x} className={`sakan-chip ${priority===(i===0?'commute':i===1?'balanced':'cost')?'active':''}`} onClick={()=>setPriority(i===0?'commute':i===1?'balanced':'cost')}>{x}</button>)}</div>
   <div className="sakan-sample-banner" style={{marginTop:14}}><Info size={14}/>Travel times are invented sample assumptions by area and mode. They are not live traffic or route guidance.</div>
 </>;

 const financeStep=<>
   {goal==='rent'?<>
    <div className="sakan-sample-banner"><Wallet size={14}/>Your rent limit is the annual amount you feel comfortable committing to. Estimates below are sample planning figures.</div>
    <div className="sakan-form-grid" style={{marginTop:16}}>
      <div className="sakan-field"><label>Annual rent ceiling (AED)</label>{currencyInput(brief.rentBudget,n=>updateBrief('rentBudget',n),1000)}<small>Listings above this amount will be filtered out.</small></div>
      <div className="sakan-field"><label>Upfront amount available (AED)</label>{currencyInput(brief.rentUpfront,n=>updateBrief('rentUpfront',n),1000)}<small>Illustrative deposit, agency and move-in planning.</small></div>
    </div>
    <div className="sakan-section-title">What the sample move-in estimate includes</div><div className="sakan-breakdown"><div className="sakan-breakdown-row"><span>Security deposit planning (5%)</span><strong>{formatAED(brief.rentBudget*.05)}</strong></div><div className="sakan-breakdown-row"><span>Agency and admin planning (5%)</span><strong>{formatAED(brief.rentBudget*.05)}</strong></div><div className="sakan-breakdown-row"><span>Move-in reserve</span><strong>{formatAED(Math.max(0,brief.rentUpfront-brief.rentBudget*.1))}</strong></div></div>
   </>:goal==='live'?<>
    <div className="sakan-sample-banner"><Wallet size={14}/>These are planning estimates, not a mortgage offer. Purchase costs use a sample 6% reserve for transfer, fees and initial setup.</div>
    <div className="sakan-form-grid" style={{marginTop:16}}>
     <div className="sakan-field"><label>Purchase price ceiling (AED)</label>{currencyInput(brief.buyBudget,n=>updateBrief('buyBudget',n),10000)}<small>Properties above the ceiling will not appear.</small></div>
     <div className="sakan-field"><label>Cash available now (AED)</label>{currencyInput(brief.downPayment,n=>updateBrief('downPayment',n),10000)}</div>
     <div className="sakan-field"><label>Comfortable monthly payment (AED)</label>{currencyInput(brief.monthlyPayment,n=>updateBrief('monthlyPayment',n),500)}<small>Sample 20-year mortgage at 5.25% only for comparison.</small></div>
     <div className="sakan-field"><label>Planning reserve for fees</label><input className="sakan-input" value="6% · sample" readOnly/></div>
    </div>
    <div className="sakan-section-title">A quick monthly picture</div><div className="sakan-breakdown"><div className="sakan-breakdown-row"><span>Cash toward sample 20% down payment</span><strong>{formatAED(brief.buyBudget*.2)}</strong></div><div className="sakan-breakdown-row"><span>Purchase costs reserve (6%)</span><strong>{formatAED(brief.buyBudget*.06)}</strong></div><div className="sakan-breakdown-row"><span>Estimated financed portion</span><strong>{formatAED(brief.buyBudget*.8)}</strong></div></div>
   </>:<>
    <div className="sakan-sample-banner"><Landmark size={14}/>An analytical view, not a promise of returns. Sample assumptions make operating cost and downside visible.</div>
    <div className="sakan-form-grid" style={{marginTop:16}}>
     <div className="sakan-field"><label>Total capital available (AED)</label>{currencyInput(brief.capital,n=>updateBrief('capital',n),10000)}<small>Includes a 6% sample purchase-cost reserve.</small></div>
     <div className="sakan-field"><label>Investment horizon (years)</label><input className="sakan-input" type="number" min="1" max="30" value={brief.horizon} onChange={e=>updateBrief('horizon',Math.max(1,Math.min(30,Number(e.target.value)||1)))}/></div>
     <div className="sakan-field"><label>Strategy lens</label><select className="sakan-select" value={brief.strategy} onChange={e=>updateBrief('strategy',e.target.value as Brief['strategy'])}><option value="income">Income first</option><option value="balanced">Balanced tradeoff</option><option value="growth">Growth potential</option></select></div>
     <div className="sakan-field"><label>Vacancy allowance</label><select className="sakan-select" value={brief.vacancy} onChange={e=>updateBrief('vacancy',Number(e.target.value))}><option value="4">4% · steady letting</option><option value="6">6% · balanced</option><option value="10">10% · cautious</option><option value="14">14% · stress planning</option></select></div>
     <div className="sakan-field"><label>Downside scenario</label><select className="sakan-select" value={brief.riskScenario} onChange={e=>updateBrief('riskScenario',e.target.value as Brief['riskScenario'])}><option value="steady">Steady</option><option value="soft">Soft market</option><option value="stress">Stress case</option></select></div>
     <div className="sakan-field"><label>Debt service</label><input className="sakan-input" value="Not assumed in net yield" readOnly/><small>Debt service is separate from operating-cost net yield.</small></div>
    </div>
   </>}
 </>;

 const preferencesStep=<>
   <p style={{fontSize:11,color:'var(--muted)',lineHeight:1.6,margin:'-5px 0 15px'}}>Set a few real boundaries. Hard requirements filter homes out; preferences help you compare what remains.</p>
   <div className="sakan-form-grid">
     <div className="sakan-field"><label>At least this many bedrooms</label><select className="sakan-select" value={brief.beds} onChange={e=>updateBrief('beds',Number(e.target.value))}>{[0,1,2,3].map(n=><option value={n} key={n}>{n===0?'Studio or more':`${n}+ bedrooms`}</option>)}</select></div>
     <div className="sakan-field"><label>Home type</label><select className="sakan-select" value={brief.type} onChange={e=>updateBrief('type',e.target.value)}><option value="any">Any home type</option><option value="Apartment">Apartment</option><option value="Townhouse">Townhouse</option></select></div>
     <div className="sakan-field"><label>Availability · required</label><select className="sakan-select" value={brief.ready} onChange={e=>updateBrief('ready',e.target.value)}><option value="any">Ready or off-plan</option><option value="ready">Ready only</option><option value="offplan">Off-plan only</option></select></div>
     <div className="sakan-field"><label>Furnishing · preferred</label><select className="sakan-select" value={brief.furnished} onChange={e=>updateBrief('furnished',e.target.value)}><option value="any">No preference</option><option value="yes">Furnished</option><option value="no">Unfurnished</option></select></div>
     <div className="sakan-field"><label>Parking · preferred</label><select className="sakan-select" value={brief.parking} onChange={e=>updateBrief('parking',e.target.value)}><option value="any">No preference</option><option value="yes">Parking included</option></select></div>
   </div>
   <div className="sakan-section-title">Your priorities</div><div className="sakan-toggle-row">{[{k:'balanced',v:'Balanced'},{k:'commute',v:'Closer to routine'},{k:'cost',v:'Lower cost'},{k:'risk',v:'Lower downside'}].map(x=><button key={x.k} className={`sakan-chip ${priority===x.k?'active':''}`} onClick={()=>setPriority(x.k)}>{x.v}</button>)}</div>
 </>;

 const reviewStep=<>
   <div className="sakan-sample-banner"><BadgeCheck size={14}/>A private brief on this device. We only use these inputs to rank the fictional sample homes below.</div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:11,marginTop:15}}>
    <div className="sakan-card" style={{padding:14}}><div className="sakan-eyebrow">Your goal</div><strong style={{display:'block',marginTop:6,fontSize:14}}>{goalCopy[goal].title}</strong><button className="sakan-textbutton" onClick={()=>{setScreen('home');setStep(0);}}>Edit journey</button></div>
    <div className="sakan-card" style={{padding:14}}><div className="sakan-eyebrow">Budget limit</div><strong style={{display:'block',marginTop:6,fontSize:14}}>{formatAED(goal==='rent'?brief.rentBudget:goal==='live'?brief.buyBudget:brief.capital)}{goal==='rent'?' / year':''}</strong><button className="sakan-textbutton" onClick={()=>setStep(isInvest&&!personalUse?0:2)}>Edit money</button></div>
    <div className="sakan-card" style={{padding:14}}><div className="sakan-eyebrow">Home boundaries</div><strong style={{display:'block',marginTop:6,fontSize:14}}>{brief.beds?`${brief.beds}+ bedrooms`:'Studio+'} · {brief.type==='any'?'any type':brief.type}</strong><button className="sakan-textbutton" onClick={()=>setStep(isInvest&&!personalUse?1:3)}>Edit preferences</button></div>
    <div className="sakan-card" style={{padding:14}}><div className="sakan-eyebrow">Weekly context</div><strong style={{display:'block',marginTop:6,fontSize:14}}>{activeDests.length?`${activeDests.length} destinations · ${priority} priority`:'No personal travel included'}</strong><button className="sakan-textbutton" onClick={()=>{if(isInvest&&!personalUse){setPersonalUse(true);setStep(0);}else setStep(0);}}>Edit places</button></div>
   </div>
   {activeDests.length>0&&<div style={{marginTop:15}}><DubaiMap destinations={activeDests}/></div>}
   {goal==='invest'&&<p style={{fontSize:10,color:'var(--muted)',lineHeight:1.5}}>Horizon {brief.horizon} years · {brief.strategy} · {brief.vacancy}% vacancy planning · {brief.riskScenario} downside case</p>}
 </>;

 const journeyPane=()=>{
   let content:ReactNode;
   const effectiveStep=isInvest&&!personalUse?Math.max(0,step-1):step;
   if(isInvest&&!personalUse) {
     if(effectiveStep===0)content=financeStep;
     else if(effectiveStep===1)content=preferencesStep;
     else content=reviewStep;
   } else if(effectiveStep===0)content=destinationStep;
   else if(effectiveStep===1)content=routineStep;
   else if(effectiveStep===2)content=financeStep;
   else if(effectiveStep===3)content=preferencesStep;
   else content=reviewStep;
   const count=stepTitles.length;
   const nextText=effectiveStep===count-1?'See sample matches':'Continue';
   return <div className="sakan-card sakan-journey">{stepHeader}{content}
     {error&&<div className="sakan-error" role="alert">{error}</div>}
     <div className="sakan-step-actions">
       <button className="sakan-secondary" onClick={()=>effectiveStep===0?setScreen('home'):switchStep(step-1)}><ArrowLeft size={14}/> Back</button>
       <button className="sakan-primary" onClick={()=>effectiveStep===count-1?calculate():switchStep(step+1)}>{nextText}<ArrowRight size={14}/></button>
     </div>
   </div>;
 };

 const listingCard=(l:Listing,rank:number)=>{
   const sc=scoreListing(l,goal,brief,activeDests);
   const price=goal==='rent'?l.rent:l.price;
   const label=goal==='rent'?'per year':goal==='invest'?'purchase':'purchase';
   return <article className="sakan-card sakan-listing" key={l.id}>
    <div className="sakan-listing-image"><img src="/__mockup/images/sakan-neighborhood.jpg" alt={`Illustrative Dubai neighbourhood home, not a photo of ${l.name}`} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/><span className="sakan-list-badge">{rank===0?'Closest fit':l.ready?'Ready':'Off-plan'}</span></div>
    <div className="sakan-listing-body">
      <h3>{l.name}</h3><div className="sakan-listing-loc"><MapPin size={11}/>{l.area}</div>
      <div className="sakan-listing-price"><strong>{formatAED(price)}</strong><span>{label}{goal==='invest'?` · ${sc.netYield.toFixed(1)}% sample net yield`:''}</span></div>
      <div className="sakan-listing-specs"><span><BedDouble size={12}/>{l.beds} bed</span><span>{l.sqft.toLocaleString()} sqft</span><span><CarFront size={12}/>{l.parking?'Parking':'No parking'}</span></div>
      <div className="sakan-fit">{sc.why}</div>
      {goal==='invest'&&<div className="sakan-listing-loc" style={{marginTop:5}}>Operating costs {formatAED(l.service+l.expenses)} / yr · vacancy {brief.vacancy}% assumed</div>}
      <div className="sakan-card-buttons">
       <button className="sakan-secondary" onClick={()=>{setSelected(l.id);setScreen('detail');}}><Eye size={13}/>Details</button>
       <button className={`sakan-secondary ${saved.includes(l.id)?'active':''}`} aria-pressed={saved.includes(l.id)} onClick={()=>toggleSave(l.id)}><Bookmark size={13}/>{saved.includes(l.id)?'Saved':'Save'}</button>
       <button className={`sakan-secondary ${compare.includes(l.id)?'active':''}`} aria-pressed={compare.includes(l.id)} onClick={()=>toggleCompare(l.id)}><Scale size={13}/>{compare.includes(l.id)?'Added':'Compare'}</button>
       <button className="sakan-icon-button" aria-label={`Hide ${l.name}`} onClick={()=>hideListing(l.id)}><X size={14}/></button>
      </div>
    </div>
   </article>;
 };

 const resultsView=<>
   <div className="sakan-result-head">
    <div><div className="sakan-eyebrow">A considered shortlist · sample data</div><h2>Homes around your life.</h2><p>{matches.length} sample {matches.length===1?'match':'matches'} · ranked for {goalCopy[goal].title.toLowerCase()}</p></div>
    <div className="sakan-result-controls"><button onClick={resultBack}><Pencil size={13}/> Edit brief</button><button onClick={()=>setModal('adjust')}><SlidersHorizontal size={13}/> Priorities</button>{compare.length>0&&<button onClick={()=>setModal('compare')}><Scale size={13}/> Compare {compare.length}</button>}</div>
   </div>
   <div className="sakan-sample-banner"><Info size={14}/>Fictional sample listings and assumptions, not live inventory or current market data. Images are illustrative. Travel times and costs are for comparing, not advice.</div>
   <div className="sakan-priority"><div><strong>Ranking lens</strong><br/><span>{priority==='commute'?'Give more weight to everyday travel':priority==='cost'?'Give more weight to budget headroom':priority==='risk'?'Give more weight to downside':`Balanced ${goal==='invest'?'return and downside':'cost and travel'} comparison`}</span></div><select aria-label="Choose ranking priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="balanced">Balanced</option><option value="commute">Closer to routine</option><option value="cost">Lower cost</option><option value="risk">Lower downside</option></select></div>
   {undoHidden&&<div className="sakan-sample-banner" style={{marginBottom:13}}><span>One sample home hidden.</span><button className="sakan-textbutton" onClick={undoHide}>Undo</button></div>}
   {matches.length===0?<div className="sakan-empty"><Search size={23} color="var(--teal)"/><h3>No sample homes meet every hard boundary</h3><p>We will not quietly relax your price, bedroom or availability limits. Loosen one boundary or change the budget to see more homes.</p><button className="sakan-primary" onClick={resultBack}><SlidersHorizontal size={14}/> Edit brief</button></div>:
   <>
    {matches.length<3&&<div className="sakan-empty" style={{margin:'14px 0',padding:16}}><h3>Only {matches.length} sample {matches.length===1?'home':'homes'} fit so far</h3><p>This list is intentionally not padded. Try a wider budget or fewer hard requirements.</p><button className="sakan-secondary" onClick={()=>{setScreen('home');setStep(isInvest&&!personalUse?1:3);}}>Adjust filters</button></div>}
    <div className="sakan-listing-grid" style={{marginTop:15}}>{matches.map((item,i)=>listingCard(item.listing,i))}</div>
   </>}
   <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginTop:17,flexWrap:'wrap'}}>
     <button className="sakan-secondary" onClick={resultBack}><ArrowLeft size={14}/> Back to brief</button>
     <button className="sakan-secondary" onClick={()=>setScreen('privacy')}><Bookmark size={14}/> Saved on this device ({saved.length})</button>
   </div>
 </>;

 const detailView=chosen&&detailScore?<>
  <div className="sakan-result-head"><div><button className="sakan-textbutton" onClick={()=>setScreen('results')}><ArrowLeft size={14}/> Back to matches</button><div className="sakan-eyebrow" style={{marginTop:7}}>Sample property · {chosen.fresh}</div></div><div className="sakan-result-controls"><button onClick={()=>toggleSave(chosen.id)}><Bookmark size={13}/>{saved.includes(chosen.id)?'Saved':'Save'}</button><button onClick={()=>openEnquiry(chosen)}><ArrowRight size={13}/> Simulate enquiry</button></div></div>
  <div className="sakan-detail-layout">
   <div><div className="sakan-detail-image"><img src="/__mockup/images/sakan-neighborhood.jpg" alt="Illustrative Dubai residential architecture, not an actual property photo" onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/></div>
    <div className="sakan-card" style={{padding:20,marginTop:14}}><div className="sakan-eyebrow">A little context</div><p style={{fontSize:13,lineHeight:1.7,color:'var(--ink)'}}>{chosen.description}</p><div className="sakan-listing-specs"><span><BedDouble size={13}/>{chosen.beds} bed</span><span>{chosen.baths} bath</span><span>{chosen.sqft.toLocaleString()} sqft</span><span>{chosen.ready?'Ready':'Off-plan'}</span></div></div>
   </div>
   <div className="sakan-card sakan-detail-panel"><div className="sakan-eyebrow">{chosen.area} · fictional sample</div><h2>{chosen.name}</h2><div className="sakan-listing-loc"><MapPin size={12}/>{chosen.type} · {chosen.furnished?'Furnished':'Unfurnished'} · {chosen.parking?'Parking included':'No parking'}</div>
    <div className="sakan-listing-price"><strong>{formatAED(goal==='rent'?chosen.rent:chosen.price)}</strong><span>{goal==='rent'?'annual rent':'sample purchase'}</span></div>
    <p>{detailScore.why}. This is one comparison point, not a prediction.</p>
    <div className="sakan-breakdown">
     {goal==='rent'?<><div className="sakan-breakdown-row"><span>Annual rent</span><strong>{formatAED(chosen.rent)}</strong></div><div className="sakan-breakdown-row"><span>Move-in reserve (5% sample)</span><strong>{formatAED(chosen.rent*.05)}</strong></div><div className="sakan-breakdown-row"><span>Your upfront amount</span><strong>{formatAED(brief.rentUpfront)}</strong></div></>:
      goal==='live'?<><div className="sakan-breakdown-row"><span>Sample purchase price</span><strong>{formatAED(chosen.price)}</strong></div><div className="sakan-breakdown-row"><span>Fee / setup reserve (6%)</span><strong>{formatAED(chosen.price*.06)}</strong></div><div className="sakan-breakdown-row"><span>Sample cash at close (20% + 6%)</span><strong>{formatAED(chosen.price*.26)}</strong></div><div className="sakan-breakdown-row"><span>Sample monthly mortgage¹</span><strong>{formatAED((chosen.price*.8*(.0525/12))/(1-Math.pow(1+.0525/12,-240)))}</strong></div><div className="sakan-breakdown-row"><span>Service + operating estimate</span><strong>{formatAED(chosen.service+chosen.expenses)} / yr</strong></div></>:
      <><div className="sakan-breakdown-row"><span>Annual gross rent assumption</span><strong>{formatAED(chosen.rent)}</strong></div><div className="sakan-breakdown-row"><span>Vacancy allowance ({brief.vacancy}%)</span><strong>− {formatAED(chosen.rent*brief.vacancy/100)}</strong></div><div className="sakan-breakdown-row"><span>Service + operating costs</span><strong>− {formatAED(chosen.service+chosen.expenses)}</strong></div><div className="sakan-breakdown-row"><span>Net before debt · yield on all-in (6%)</span><strong>{formatAED(detailScore.annualNet)} · {detailScore.netYield.toFixed(1)}%</strong></div><div className="sakan-breakdown-row"><span>Debt service assumption</span><strong>{formatAED(0)} / yr · excluded</strong></div><div className="sakan-breakdown-row"><span>Downside lens · {brief.riskScenario}</span><strong>{detailScore.downside.toFixed(1)} / 10</strong></div></>}
     <div className="sakan-breakdown-row"><span>Routine travel estimate</span><strong>{activeDests.length?`~${detailScore.commute} min`:'Not included'}</strong></div>
    </div>
    {goal==='live'&&<small style={{display:'block',color:'var(--muted)',marginTop:11,lineHeight:1.5}}>¹ Illustrative 20-year, 5.25% payment. Financing eligibility and actual fees are not assessed.</small>}
    {!chosen.ready&&<div className="sakan-sample-banner" style={{marginTop:13}}><Info size={14}/>Off-plan sample: confirm payment plan, construction progress and handover timing; figures exclude milestone financing and delay risk.</div>}
    <button className="sakan-primary" style={{width:'100%',marginTop:15}} onClick={()=>openEnquiry(chosen)}>Simulate an enquiry <ArrowRight size={14}/></button>
   </div>
  </div>
 </>:null;

 const compareRows:Array<[string,(l:Listing)=>string]>=[
    ['Area',l=>l.area],
    [goal==='rent'?'Annual rent':'Sample purchase',l=>formatAED(goal==='rent'?l.rent:l.price)],
    ['Bedrooms & size',l=>`${l.beds} bed · ${l.sqft.toLocaleString()} sqft`],
    ['Availability',l=>l.ready?'Ready':'Off-plan'],
    ['Routine travel',l=>activeDests.length?`~${travelFor(l,activeDests)} min avg.`:'Not included'],
    ...(goal==='invest'?[['Sample net yield',l=>`${scoreListing(l,goal,brief,activeDests).netYield.toFixed(1)}%`],['Net before debt',l=>`${formatAED(scoreListing(l,goal,brief,activeDests).annualNet)} / yr`],['Downside · selected case',l=>`${scoreListing(l,goal,brief,activeDests).downside.toFixed(1)} / 10`]] as [string,(l:Listing)=>string][]:[]),
    ...(goal==='live'?[['Sample cash at close',l=>formatAED(l.price*.26)],['Sample monthly mortgage',l=>formatAED((l.price*.8*(.0525/12))/(1-Math.pow(1+.0525/12,-240)))]] as [string,(l:Listing)=>string][]:[]),
    ...(goal==='rent'?[['Move-in planning reserve',l=>formatAED(l.rent*.1)]] as [string,(l:Listing)=>string][]:[]),
    ['Service + operating',l=>`${formatAED(l.service+l.expenses)} / yr`],
 ];
 const privacyView=<div className="sakan-card sakan-journey">
   <div className="sakan-result-head"><div><div className="sakan-eyebrow">Your space, on this device</div><h2>Saved homes & privacy</h2><p>No account, authentication or network sharing in this prototype.</p></div><button className="sakan-secondary" onClick={()=>setScreen('home')}><ArrowLeft size={14}/> Back</button></div>
   <div className="sakan-sample-banner"><ShieldCheck size={14}/>Your saved homes and draft brief stay in this browser's local storage. No destination is sent anywhere. Clearing browser data also removes them.</div>
   <div className="sakan-section-title">Your saved homes · {saved.length}</div>
   {saved.length===0?<div className="sakan-empty"><Bookmark size={22} color="var(--teal)"/><h3>No saved homes yet</h3><p>Save a sample property to keep it here while you explore. Saved items are only on this device.</p><button className="sakan-primary" onClick={()=>{setScreen('results');setGoal('rent')}}>Browse sample homes</button></div>:<div className="sakan-listing-grid">{saved.map((id,i)=>{const l=sampleListings.find(x=>x.id===id);return l?listingCard(l,i):null})}</div>}
   <div className="sakan-section-title">Privacy choices</div>
   <div className="sakan-destination"><span className="sakan-pin"><MapPin size={15}/></span><div><div className="sakan-dest-name">Remove destination locations</div><div className="sakan-dest-meta">Delete all saved places from this draft.</div></div><button className="sakan-secondary" onClick={()=>{setDestinations([]);showToast('All destinations removed')}}>Remove</button></div>
   <div className="sakan-destination" style={{marginTop:8}}><span className="sakan-pin"><RotateCcw size={15}/></span><div><div className="sakan-dest-name">Clear local prototype data</div><div className="sakan-dest-meta">Remove saved homes, places and your current brief.</div></div><button className="sakan-secondary" onClick={resetLocal}>Clear & reset</button></div>
 </div>;

 return <div className="sakan-root"><div className="sakan-shell">{header}
  {screen==='home'&&<><section className="sakan-hero">
    <div><div className="sakan-eyebrow">A more human way to find home · UAE</div><h1>Find a home that fits <em>your actual life.</em></h1><p>Start with your people, places and budget. Then see the tradeoffs clearly—without the sales gloss.</p><div className="sakan-hero-note"><Sparkles size={15}/> A calmer way to decide, whether you rent, buy or invest.</div></div>
    <DubaiMap destinations={activeDests}/>
   </section>
   {goalSelector}
   <div className="sakan-workspace"><main>{journeyPane()}</main><aside className="sakan-card sakan-side-note">
    <div className="sakan-eyebrow">A little reassurance</div><h3>Start with life. Let the numbers follow.</h3><p>Sakan brings everyday travel, comfort and costs into one decision. Nothing here is a listing feed or financial promise.</p>
    <div className="sakan-side-list"><div className="sakan-side-item"><MapPin size={15}/>Your destinations stay in this browser; the map is illustrative.</div><div className="sakan-side-item"><Scale size={15}/>Compare cost, commute and downside on equal terms.</div><div className="sakan-side-item"><Info size={15}/>Every property and assumption is clearly labelled sample data.</div></div>
    <div style={{borderTop:'1px solid var(--line)',marginTop:18,paddingTop:13}}><button className="sakan-textbutton" onClick={()=>{setScreen('results');setError('');setHidden([]);}}>Explore a sample shortlist <ArrowRight size={13}/></button><div style={{fontSize:9,color:'var(--muted)',paddingLeft:8}}>Preview without completing this brief.</div></div>
   </aside></div>
   </>}
  {screen==='results'&&resultsView}
  {screen==='detail'&&detailView}
  {screen==='privacy'&&privacyView}
  <footer className="sakan-footer">Sakan is a decision-making prototype. Listings, prices, rents, travel times, yields and images are illustrative sample data—not live market information or financial advice.</footer>
 </div>

 {modal==='destination'&&<div className="sakan-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal();}}><section className="sakan-modal" role="dialog" aria-modal="true" aria-labelledby="dest-title">
  <div className="sakan-modal-head"><div><div className="sakan-eyebrow">Make your map feel like yours</div><h2 id="dest-title">{editing?'Edit place':'Add a place'}</h2></div><button className="sakan-modal-close" onClick={closeModal} aria-label="Close"><X size={16}/></button></div>
  <div className="sakan-form-grid">
   <div className="sakan-field"><label>Place in your life</label><select className="sakan-select" value={draftDest.kind} onChange={e=>setDraftDest({...draftDest,kind:e.target.value,label:e.target.value==='Work'?'My work':e.target.value})}>{['Work','Partner work','School','Worship','Sport','Custom'].map(x=><option key={x}>{x}</option>)}</select></div>
   <div className="sakan-field"><label>Short label</label><input className="sakan-input" value={draftDest.label} onChange={e=>setDraftDest({...draftDest,label:e.target.value})} placeholder="My office"/></div>
   <div className="sakan-field"><label>Sample place</label><select className="sakan-select" value={draftDest.place} onChange={e=>setDraftDest({...draftDest,place:e.target.value,address:e.target.value.split(',').slice(-1)[0]})}>{samplePlaces.map(x=><option key={x}>{x}</option>)}</select></div>
   <div className="sakan-field"><label>Area note (optional)</label><input className="sakan-input" value={draftDest.address} onChange={e=>setDraftDest({...draftDest,address:e.target.value})} placeholder="Neighbourhood or building"/></div>
   <div className="sakan-field"><label>Travel mode</label><select className="sakan-select" value={draftDest.mode} onChange={e=>setDraftDest({...draftDest,mode:e.target.value as Destination['mode']})}><option value="car">Car</option><option value="metro">Metro</option><option value="walk">Walk / cycle</option></select></div>
   <div className="sakan-field"><label>Visits per week</label><select className="sakan-select" value={draftDest.frequency} onChange={e=>setDraftDest({...draftDest,frequency:Number(e.target.value)})}>{[1,2,3,4,5,6,7].map(n=><option value={n} key={n}>{n} days / week</option>)}</select></div>
   <div className="sakan-field"><label>Maximum travel time (minutes)</label><input className="sakan-input" type="number" min="5" max="120" value={draftDest.maxMinutes} onChange={e=>setDraftDest({...draftDest,maxMinutes:Math.max(0,Number(e.target.value)||0)})}/></div>
  </div>
  <div className="sakan-section-title">How much should this matter?</div><div className="sakan-toggle-row"><button className={`sakan-chip ${draftDest.required?'active':''}`} onClick={()=>setDraftDest({...draftDest,required:!draftDest.required,preferred:false})}>Required boundary</button><button className={`sakan-chip ${draftDest.preferred?'active':''}`} onClick={()=>setDraftDest({...draftDest,preferred:!draftDest.preferred,required:false})}>Preferred</button></div>
  {error&&<div className="sakan-error" role="alert">{error}</div>}
  <div className="sakan-modal-actions"><button className="sakan-secondary" onClick={closeModal}>Cancel</button><button className="sakan-primary" onClick={saveDestination}>{editing?'Save place':'Add place'}</button></div>
 </section></div>}

 {modal==='compare'&&<div className="sakan-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal();}}><section className="sakan-modal" style={{width:'min(100%,960px)'}} role="dialog" aria-modal="true" aria-labelledby="compare-title">
  <div className="sakan-modal-head"><div><div className="sakan-eyebrow">Tradeoffs, side by side</div><h2 id="compare-title">Compare sample homes</h2></div><button className="sakan-modal-close" onClick={closeModal} aria-label="Close"><X size={16}/></button></div>
  {compare.length===0?<div className="sakan-empty"><Scale size={22} color="var(--teal)"/><h3>Choose homes to compare</h3><p>Add up to three homes from the results. No rankings are hidden behind a score.</p><button className="sakan-secondary" onClick={closeModal}>Back to homes</button></div>:<div className="sakan-compare-table"><div className="sakan-compare-grid">
   <div className="sakan-compare-label">Your comparison</div>{compare.slice(0,3).map(id=>{const l=sampleListings.find(x=>x.id===id)!;return <div className="sakan-compare-heading" key={id}>{l.name}<button className="sakan-icon-button" aria-label={`Remove ${l.name} from compare`} onClick={()=>toggleCompare(id)}><X size={13}/></button></div>})}{compare.length<3&&Array.from({length:3-compare.length},(_,i)=><div key={`blank${i}`} className="sakan-compare-label">Add up to {3-compare.length} more</div>)}
   {compareRows.map(([label,render])=><Fragment key={label}><div className="sakan-compare-label">{label}</div>{compare.slice(0,3).map(id=>{const l=sampleListings.find(x=>x.id===id)!;return <div key={`${label}-${id}`}>{render(l)}</div>})}{compare.length<3&&Array.from({length:3-compare.length},(_,i)=><div key={`${label}-blank${i}`}>—</div>)}</Fragment>)}
  </div></div>}
  {error&&<div className="sakan-error">{error}</div>}
  <div className="sakan-modal-actions"><button className="sakan-secondary" onClick={closeModal}>Done</button></div>
 </section></div>}

 {modal==='adjust'&&<div className="sakan-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal();}}><section className="sakan-modal" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
  <div className="sakan-modal-head"><div><div className="sakan-eyebrow">A living shortlist</div><h2 id="adjust-title">What matters most right now?</h2></div><button className="sakan-modal-close" onClick={closeModal} aria-label="Close"><X size={16}/></button></div>
  <p>Change this lens any time. We re-rank the same sample homes; hard boundaries remain in place.</p>
  <div className="sakan-toggle-row">{[{k:'balanced',v:'Balanced'},{k:'commute',v:'Everyday travel'},{k:'cost',v:'Budget headroom'},{k:'risk',v:'Downside' }].map(x=><button key={x.k} className={`sakan-chip ${priority===x.k?'active':''}`} onClick={()=>setPriority(x.k)}>{x.v}</button>)}</div>
  <div className="sakan-modal-actions"><button className="sakan-secondary" onClick={closeModal}>Cancel</button><button className="sakan-primary" onClick={closeModal}>Apply ranking</button></div>
 </section></div>}

 {modal==='enquiry'&&chosen&&<div className="sakan-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal();}}><section className="sakan-modal" role="dialog" aria-modal="true" aria-labelledby="enquiry-title">
  <div className="sakan-modal-head"><div><div className="sakan-eyebrow">No contact is sent</div><h2 id="enquiry-title">{enquirySent?'Your preview is ready':'Preview a simulated enquiry'}</h2></div><button className="sakan-modal-close" onClick={closeModal} aria-label="Close"><X size={16}/></button></div>
  {enquirySent?<><div className="sakan-sample-banner"><Check size={15}/>Nothing was sent. No real agency, agent or contact details are connected.</div><p style={{marginTop:16}}>Your sample message preview for <strong>{chosen.name}</strong> in {chosen.area}:</p><div className="sakan-card" style={{padding:14,fontSize:12,lineHeight:1.65}}>Hello, I am interested in learning more about {chosen.name}. Could you share availability, costs and viewing details? This message is a local prototype preview only.</div></>:
  <><p>This fictional agency preview shows the information that would be shared. No phone number or email is required.</p><div className="sakan-card" style={{padding:14,marginBottom:14}}><div className="sakan-eyebrow">Sample agency · Pearl Key Homes</div><strong style={{display:'block',marginTop:5,fontSize:14}}>{chosen.name}</strong><div className="sakan-dest-meta">{chosen.area} · {formatAED(goal==='rent'?chosen.rent:chosen.price)}</div></div><div className="sakan-form-grid"><div className="sakan-field"><label>Your name (optional)</label><input className="sakan-input" placeholder="First name"/></div><div className="sakan-field"><label>Contact (optional, not sent)</label><input className="sakan-input" placeholder="Email or phone"/></div></div><label className="sakan-checkline" style={{marginTop:14}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I understand this only previews sample information locally. Nothing will be sent or stored as a real enquiry.</label>{error&&<div className="sakan-error" role="alert">{error}</div>}</>}
  <div className="sakan-modal-actions">{enquirySent?<button className="sakan-primary" onClick={closeModal}>Close preview</button>:<><button className="sakan-secondary" onClick={closeModal}>Cancel</button><button className="sakan-primary" onClick={simulateEnquiry}>Simulate enquiry</button></>}</div>
 </section></div>}

 {modal==='privacy'&&<div className="sakan-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal();}}><section className="sakan-modal" role="dialog" aria-modal="true" aria-labelledby="how-title"><div className="sakan-modal-head"><div><div className="sakan-eyebrow">A tool, not a broker</div><h2 id="how-title">How Sakan works</h2></div><button className="sakan-modal-close" onClick={closeModal} aria-label="Close"><X size={16}/></button></div><p>Sakan starts with your routines, finances and home boundaries, then compares a small, fictional sample set. It does not connect to listing feeds, navigation, banks or agencies.</p><div className="sakan-side-list"><div className="sakan-side-item"><MapPin size={15}/>Map, locations and travel assumptions are schematic and illustrative.</div><div className="sakan-side-item"><Wallet size={15}/>Financial figures are scenario arithmetic from clearly labelled assumptions.</div><div className="sakan-side-item"><ShieldCheck size={15}/>Your draft and saves are stored locally on this browser only.</div></div><div className="sakan-modal-actions"><button className="sakan-secondary" onClick={closeModal}>Close</button><button className="sakan-primary" onClick={()=>{closeModal();setScreen('privacy')}}>Privacy choices</button></div></section></div>}
 {toast&&<div className="sakan-toast" role="status">{toast}{undoHidden&&<button onClick={undoHide} style={{marginLeft:12,border:0,background:'transparent',color:'#dcece3',fontWeight:700}}>Undo</button>}</div>}
 </div>;
}
