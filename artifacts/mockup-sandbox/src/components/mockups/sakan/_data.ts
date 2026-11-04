export type Goal = 'rent' | 'live' | 'invest';
export type Destination = {
  id: string; kind: string; label: string; place: string; address: string;
  frequency: number; mode: 'car' | 'metro' | 'walk'; maxMinutes: number;
  required: boolean; preferred: boolean;
};
export type Listing = {
  id: string; name: string; area: string; type: string; beds: number; baths: number;
  sqft: number; price: number; rent: number; service: number; vacancy: number;
  ready: boolean; furnished: boolean; parking: boolean; position: [number,number];
  travel: Record<string, number>; expenses: number; risk: number; fresh: string;
  description: string;
};
export type Brief = {
  rentBudget: number; rentUpfront: number; buyBudget: number; downPayment: number;
  monthlyPayment: number; capital: number; strategy: 'income'|'growth'|'balanced';
  horizon: number; vacancy: number; riskScenario: 'steady'|'soft'|'stress';
  ready: string; beds: number; type: string; furnished: string; parking: string;
};
export const initialBrief: Brief = {
  rentBudget: 115000, rentUpfront: 28000, buyBudget: 1900000, downPayment: 550000,
  monthlyPayment: 12500, capital: 1400000, strategy:'balanced', horizon:7,
  vacancy:6, riskScenario:'soft', ready:'any', beds:1, type:'any', furnished:'any', parking:'any'
};
export const samplePlaces = ['DIFC Gate Avenue','Dubai Internet City','GEMS Wellington International School','Jumeirah Mosque','Dubai Marina Mall','Business Bay Metro Station','Al Barsha South Park'];
export const sampleListings: Listing[] = [
 {id:'s01',name:'Courtyard at Cedar',area:'Jumeirah Village Circle',type:'Apartment',beds:1,baths:2,sqft:818,price:1080000,rent:79000,service:13800,vacancy:7,ready:true,furnished:false,parking:true,position:[49,60],travel:{'DIFC':25,'Dubai Marina':20,'Al Barsha':17,'Business Bay':22,'Dubai Internet City':21,'Jumeirah':28,'JVC':8},expenses:14200,risk:2,fresh:'Sample assumption · 12 days',description:'A bright corner home in a leafy, low-rise pocket. A practical starting point for a couple who values a quieter evening.'},
 {id:'s02',name:'The Courtyard House',area:'Town Square Dubai',type:'Townhouse',beds:2,baths:3,sqft:1460,price:1740000,rent:112000,service:16700,vacancy:8,ready:true,furnished:false,parking:true,position:[25,67],travel:{'DIFC':34,'Dubai Marina':31,'Al Barsha':24,'Business Bay':31,'Dubai Internet City':28,'Jumeirah':37,'JVC':22},expenses:19200,risk:3,fresh:'Sample assumption · 9 days',description:'A family-sized home with a proper front door, small garden and a calm community feel.'},
 {id:'s03',name:'Marina Walk Residences',area:'Dubai Marina',type:'Apartment',beds:1,baths:1,sqft:742,price:1470000,rent:103000,service:18500,vacancy:6,ready:true,furnished:true,parking:true,position:[72,46],travel:{'DIFC':25,'Dubai Marina':7,'Al Barsha':22,'Business Bay':28,'Dubai Internet City':12,'Jumeirah':33,'JVC':21},expenses:16800,risk:3,fresh:'Sample assumption · 6 days',description:'Close to the water and everyday errands, with an active neighborhood right outside.'},
 {id:'s04',name:'Canal Edge Apartment',area:'Business Bay',type:'Apartment',beds:2,baths:2,sqft:1190,price:1980000,rent:136000,service:22100,vacancy:7,ready:true,furnished:false,parking:true,position:[53,40],travel:{'DIFC':13,'Dubai Marina':27,'Al Barsha':22,'Business Bay':6,'Dubai Internet City':25,'Jumeirah':21,'JVC':22},expenses:21300,risk:4,fresh:'Sample assumption · 14 days',description:'A central base with quick access to the canal walk and a busy weekday rhythm.'},
 {id:'s05',name:'Olive Court',area:'Al Barsha South',type:'Apartment',beds:2,baths:2,sqft:1285,price:1420000,rent:98000,service:15500,vacancy:8,ready:true,furnished:false,parking:true,position:[36,49],travel:{'DIFC':27,'Dubai Marina':24,'Al Barsha':13,'Business Bay':25,'Dubai Internet City':20,'Jumeirah':32,'JVC':17},expenses:16500,risk:2,fresh:'Sample assumption · 8 days',description:'A generous, unfussy layout close to schools, parks and the parts of the city that feel like daily life.'},
 {id:'s06',name:'Palm Grove Garden Flat',area:'Dubai Hills Estate',type:'Apartment',beds:2,baths:2,sqft:1310,price:2150000,rent:145000,service:22400,vacancy:6,ready:true,furnished:false,parking:true,position:[43,34],travel:{'DIFC':20,'Dubai Marina':24,'Al Barsha':17,'Business Bay':18,'Dubai Internet City':20,'Jumeirah':25,'JVC':19},expenses:23000,risk:3,fresh:'Sample assumption · 11 days',description:'Open views and a park-side setting, with a little more breathing room in a well-connected district.'},
 {id:'s07',name:'Creekside Living',area:'Dubai Creek Harbour',type:'Apartment',beds:2,baths:2,sqft:1240,price:1870000,rent:128000,service:20500,vacancy:8,ready:true,furnished:true,parking:true,position:[68,31],travel:{'DIFC':19,'Dubai Marina':38,'Al Barsha':34,'Business Bay':20,'Dubai Internet City':34,'Jumeirah':27,'JVC':33},expenses:21900,risk:4,fresh:'Sample assumption · 5 days',description:'A newer waterfront district with long promenades and a more measured pace after work.'},
 {id:'s08',name:'Metroline Studio+',area:'Discovery Gardens',type:'Apartment',beds:1,baths:1,sqft:685,price:850000,rent:65000,service:11200,vacancy:9,ready:true,furnished:true,parking:true,position:[78,69],travel:{'DIFC':33,'Dubai Marina':17,'Al Barsha':25,'Business Bay':34,'Dubai Internet City':15,'Jumeirah':39,'JVC':22},expenses:12300,risk:3,fresh:'Sample assumption · 10 days',description:'An accessible entry point near the metro, with practical amenities and a lively local high street.'},
 {id:'s09',name:'Terrace at Arjan',area:'Arjan',type:'Apartment',beds:1,baths:1,sqft:790,price:960000,rent:72000,service:12400,vacancy:8,ready:true,furnished:false,parking:true,position:[34,61],travel:{'DIFC':29,'Dubai Marina':25,'Al Barsha':16,'Business Bay':27,'Dubai Internet City':23,'Jumeirah':33,'JVC':14},expenses:13100,risk:3,fresh:'Sample assumption · 7 days',description:'A simple, sunny home in a growing residential pocket, with easy access to parks and shops.'},
 {id:'s10',name:'Mira Courtyard Townhome',area:'Reem',type:'Townhouse',beds:3,baths:3,sqft:1900,price:2250000,rent:143000,service:18200,vacancy:8,ready:false,furnished:false,parking:true,position:[18,46],travel:{'DIFC':37,'Dubai Marina':35,'Al Barsha':28,'Business Bay':35,'Dubai Internet City':33,'Jumeirah':40,'JVC':27},expenses:20600,risk:5,fresh:'Illustrative launch · 21 days',description:'A roomy off-plan family layout. Handover timing and payment milestones need careful checking.'}
];
export const formatAED = (n:number) => `AED ${Math.round(Number.isFinite(n)?n:0).toLocaleString('en-AE')}`;
export function areaKey(place:string) {
 const s=place.toLowerCase();
 if(s.includes('marina')) return 'Dubai Marina';
 if(s.includes('barsha')) return 'Al Barsha';
 if(s.includes('business bay')) return 'Business Bay';
 if(s.includes('internet city')) return 'Dubai Internet City';
 if(s.includes('wellington')||s.includes('school')||s.includes('sufouh')) return 'Dubai Internet City';
 if(s.includes('jumeirah')||s.includes('mosque')) return 'Jumeirah';
 if(s.includes('jvc')) return 'JVC';
 if(s.includes('difc')||s.includes('gate')) return 'DIFC';
 return 'DIFC';
}
export function travelFor(listing:Listing,destinations:Destination[]) {
 if(!destinations.length) return 0;
 const total=destinations.reduce((sum,d)=>{
   const modeFactor=d.mode==='metro'?1.16:d.mode==='walk'?1.28:1;
   return sum+Math.round((listing.travel[areaKey(d.place)]??27)*modeFactor)*Math.min(7,Math.max(1,d.frequency));
 },0);
 return Math.round(total/destinations.reduce((sum,d)=>sum+Math.min(7,Math.max(1,d.frequency)),0));
}
export function meetsTravelBoundary(listing:Listing,destinations:Destination[]) {
 return destinations.filter(d=>d.required).every(d=>{
   const modeFactor=d.mode==='metro'?1.16:d.mode==='walk'?1.28:1;
   return Math.round((listing.travel[areaKey(d.place)]??27)*modeFactor)<=d.maxMinutes;
 });
}
export function filterListings(goal:Goal,brief:Brief,hidden:string[]) {
 return sampleListings.filter(l=>{
   if(hidden.includes(l.id)) return false;
   if(l.beds<brief.beds || (brief.type!=='any'&&l.type!==brief.type)) return false;
   if(brief.ready==='ready'&&!l.ready || brief.ready==='offplan'&&l.ready) return false;
   if(goal==='rent') return l.rent<=brief.rentBudget && l.rent*.1<=brief.rentUpfront;
   if(goal==='live') {
     const monthly=(l.price*.8*(.0525/12))/(1-Math.pow(1+.0525/12,-240));
     return l.price<=brief.buyBudget && l.price*.26<=brief.downPayment && monthly<=brief.monthlyPayment;
   }
   return l.price*1.06<=brief.capital;
 });
}
export function scoreListing(l:Listing,goal:Goal,b:Brief,dests:Destination[]) {
 const commute=travelFor(l,dests);
 const annualNet=l.rent*(1-b.vacancy/100)-l.service-l.expenses;
 const netYield=annualNet/(l.price*1.06)*100;
 const downside=goal==='invest' ? (l.risk*(b.riskScenario==='stress'?1.55:b.riskScenario==='soft'?1.15:.82)) + (l.ready?0:1.4) + Math.max(0,b.horizon<5?1.2:0) : l.risk;
 let score=0, why='';
 const preference=(b.furnished==='any'?0:(l.furnished===(b.furnished==='yes')?3:-2))+(b.parking==='yes'?(l.parking?3:-3):0);
  const travelLimitPenalty=dests.reduce((sum,d)=>{
   const factor=d.mode==='metro'?1.16:d.mode==='walk'?1.28:1;
   const minutes=Math.round((l.travel[areaKey(d.place)]??27)*factor);
   return sum+(d.required?0:Math.max(0,minutes-d.maxMinutes)*(d.preferred?0.18:0.1)*Math.min(7,Math.max(1,d.frequency)));
  },0);
  if(goal==='rent') { score=100-(l.rent/b.rentBudget*42)-commute*1.05-l.risk*2+preference-travelLimitPenalty; why=`${formatAED(l.rent)} annual rent · about ${commute} min to your routine`; }
  else if(goal==='live') { score=100-(l.price/b.buyBudget*36)-commute*1.1-l.risk*2+preference-travelLimitPenalty; why=`${formatAED(l.price)} purchase estimate · about ${commute} min to your routine`; }
  else { const strategy=b.strategy==='income'?netYield*6:b.strategy==='growth'?(8-l.risk)*2.1:netYield*3+(8-l.risk)*1.2; score=strategy-downside*2.6+(l.ready?2:0)+preference-travelLimitPenalty; why=`${netYield.toFixed(1)}% illustrative net yield · risk scenario ${b.riskScenario}`; }
 return {score,commute,annualNet,netYield,downside,why};
}
