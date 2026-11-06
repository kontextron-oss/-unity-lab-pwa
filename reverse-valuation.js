'use strict';
/* UNITY 0.16.0 – standardized, read-only reverse valuation.
   We solve for the annual 5-year FCF growth IMPLIED by a sourced market quote.
   An implied market expectation is NOT an independently reviewed forecast or
   proof of intrinsic/fair value. No entry zones, paper trades or broker actions. */
const UNITY_REVERSE_RATE_CASES=[
 {id:'r8',discountPct:8,label:'8 % Eigenkapitalkosten'},
 {id:'r10',discountPct:10,label:'10 % Eigenkapitalkosten'},
 {id:'r12',discountPct:12,label:'12 % Eigenkapitalkosten'}
];
function unityReverseNumber(v){
 return typeof v==='number'&&Number.isFinite(v)?v:null;
}
function unityReverseAge(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return null;
 const v=Date.parse(date+'T12:00:00Z');
 return Number.isFinite(v)?(Date.now()-v)/86400000:null;
}
function unityReverseDcfPerShare(fcfPerShare,growthPct,discountPct,terminalPct=2,years=5){
 if(!(Number.isFinite(fcfPerShare)&&fcfPerShare>0&&
      Number.isFinite(growthPct)&&growthPct>-99&&growthPct<=85&&
      Number.isFinite(discountPct)&&discountPct>terminalPct+3.99&&
      Number.isFinite(terminalPct)&&terminalPct>=-2&&terminalPct<=4&&
      Number.isInteger(years)&&years>=3&&years<=8))return null;
 let value=0,flow=fcfPerShare;
 const g=1+growthPct/100,r=1+discountPct/100,t=terminalPct/100;
 for(let year=1;year<=years;year++){
  flow*=g;
  if(!Number.isFinite(flow)||flow<=0)return null;
  value+=flow/Math.pow(r,year);
 }
 const terminal=flow*(1+t)/(discountPct/100-t);
 value+=terminal/Math.pow(r,years);
 return Number.isFinite(value)&&value>0?value:null;
}
function unityReverseImpliedGrowth(fcfPerShare,price,discountPct,terminalPct=2,years=5){
 if(!(Number.isFinite(price)&&price>0&&fcfPerShare>0))return null;
 let lo=-35,hi=70;
 const low=unityReverseDcfPerShare(fcfPerShare,lo,discountPct,terminalPct,years);
 const high=unityReverseDcfPerShare(fcfPerShare,hi,discountPct,terminalPct,years);
 if(low===null||high===null||!(low<=price&&price<=high))return null;
 for(let i=0;i<70;i++){
  const mid=(lo+hi)/2,valuation=unityReverseDcfPerShare(fcfPerShare,mid,discountPct,terminalPct,years);
  if(valuation===null)return null;
  if(valuation<price)lo=mid;
  else hi=mid;
 }
 return Math.round(100*(lo+hi)/2)/100;
}
function unityReverseEpsGuidance(g){
 if(!g||!Array.isArray(g.guidance))return null;
 const matches=g.guidance.filter(x=>x.metric==='dilutedEPS'&&x.horizon==='FY2026'&&
   x.unit==='USD/shares'&&x.nonGAAP!==true);
 if(matches.length!==1)return null;
 const row=matches[0],lo=unityReverseNumber(row.lower??row.mid),
   hi=unityReverseNumber(row.upper??row.mid);
 if(lo===null||hi===null||lo<=0||hi<lo||hi>1e3)return null;
 return {low:lo,high:hi,currency:'USD',fiscalYear:2026,sourceUrl:g.sourceUrl,
         basis:'issuer-guidance-GAAP-diluted-EPS'};
}
function unityReverseValuation(s,options={}){
 const m=options.financial===undefined?
   (typeof unityFinancialStockSnapshot==='function'?unityFinancialStockSnapshot(s):null):options.financial;
 const rawG=options.guidance===undefined?
   (typeof unityGuidanceEvidence==='function'?unityGuidanceEvidence(s):null):options.guidance;
 const g=rawG&&typeof unityGuidanceEvidence==='function'?
   unityGuidanceEvidence(s,{[s?.isin]:rawG}):null;
 const missing=[];
 const result={schemaVersion:1,kind:'unity-reverse-dcf-diagnostics',
  isin:String(s?.isin||''),ticker:String(s?.ticker||''),
  status:'blocked',underlyingPeriod:String(m?.period||''),
  guidanceSource:g?.sourceUrl||null,
  fcfPerShare:null,priceReportCurrency:null,priceDate:null,
  forwardGaapPE:null,assumptions:{
    horizonYears:5,terminalGrowthPct:2,
    rateCases:UNITY_REVERSE_RATE_CASES.map(c=>({...c})),
    nature:'unreviewed sensitivity – NOT a company forecast'
  },impliedAnnualFcfGrowth:null,
  decision:'Beobachten: noch keine operative Kauf-Freigabe',
  entryZone:null,tradeApproved:false,missing};
 if(!s?.isin||m?.instrument?.isin!==s.isin)
  missing.push('Identität von Aktie und Bericht nicht bestätigt');
 if(!m?.coreComplete||!['issuer-pdf','sec','esef'].includes(m.sourceKind))
  missing.push('Fünf geprüfte Kernkennzahlen aus verifizierter Quelle');
 const fcf=unityReverseNumber(m?.valuation?.freeCashFlow);
 const shares=unityReverseNumber(m?.valuation?.sharesOutstanding);
 if(fcf===null||fcf<=0)missing.push('Positiver, belegter OCF minus Capex');
 if(shares===null||shares<=0)missing.push('Stichtagsbezogene Aktienzahl');
 const periodAge=unityReverseAge(m?.period);
 if(periodAge===null||periodAge < -1||periodAge>540)
  missing.push('Ausreichend aktuelles geprüftes Geschäftsjahr');
 const quoteAge=unityReverseAge(m?.priceRef?.date);
 const price=unityReverseNumber(m?.quoteInReportCurrency);
 if(price===null||price<=0||quoteAge===null||quoteAge < -1||quoteAge>5.5)
  missing.push('Aktueller geprüfter Börsenkurs und erforderlicher EUR-FX-Abgleich');
 if(missing.length)return result;
 result.fcfPerShare=fcf/shares;
 result.priceReportCurrency=price;
 result.priceDate=m.priceRef.date;
 const eps=unityReverseEpsGuidance(g);
 if(eps&&m.reportCurrency==='USD'){
  result.forwardGaapPE={low:Math.round(100*price/eps.high)/100,
    high:Math.round(100*price/eps.low)/100,
    fiscalYear:2026,sourceUrl:eps.sourceUrl,method:'unadjusted GAAP EPS guidance'};
 }else missing.push('Aktuelle GAAP-EPS-Prognose aus verifizierter Originalquelle');
 const assumptions=result.assumptions;
 result.impliedAnnualFcfGrowth=assumptions.rateCases.map(c=>({
  ...c,
  impliedGrowthPct:unityReverseImpliedGrowth(result.fcfPerShare,price,c.discountPct,
    assumptions.terminalGrowthPct,assumptions.horizonYears)
 }));
 const valid=result.impliedAnnualFcfGrowth.filter(x=>x.impliedGrowthPct!==null);
 result.status=valid.length?'diagnostic':'limited';
 if(!valid.length)missing.push('Implied-growth liegt außerhalb der konservativen Rechengrenzen');
 // Missing EPS does not invent a P/E. It does not erase the independently
 // calculable, historical-FCF-based implied-growth sensitivities.
 result.decision='Beobachten: Marktanforderung prüfen – kein fairer Wert, keine Kaufzone';
 return result;
}
function unityReverseValuationPanel(s){
 const r=unityReverseValuation(s);
 let h='<h4>UNITY 0.16 · Erwartungen im Aktienkurs</h4>';
 if(r.status==='blocked'){
  h+='<p class="tiny muted">Umgekehrte Unternehmensbewertung derzeit nicht möglich: '+
   esc(r.missing.join(' · '))+'. Keine Kaufempfehlung.</p>';
  return h;
 }
 const de=n=>new Intl.NumberFormat('de-DE',{minimumFractionDigits:1,maximumFractionDigits:2}).format(n);
 h+='<p class="tiny muted">Prüfbare Basis: OCF minus Capex je Stichtagsaktie aus Konzernjahr '+esc(r.underlyingPeriod)+
   ' · '+de(r.fcfPerShare)+' '+esc(s?.currency||'')+
   ' (Berechnung in Konzernberichtswährung). Kursreferenz: '+esc(r.priceDate)+
   '. Dies ist keine normalisierte 2026-FCF-Prognose.</p>';
 if(r.forwardGaapPE){
  h+='<div class="home-data-row"><span>2026er KGV nach offizieller GAAP-EPS-Prognose</span><b>'+
    de(r.forwardGaapPE.low)+(r.forwardGaapPE.low===r.forwardGaapPE.high?'':' – '+de(r.forwardGaapPE.high))+
    '</b><small>Rechnerisch aus Kurs und berichteter GAAP-Prognose; nicht bereinigt</small></div>';
 }else h+='<p class="tiny muted">Kein belastbares 2026er KGV: GAAP-EPS-Prognose oder Quelle fehlt.</p>';
 for(const caseValue of r.impliedAnnualFcfGrowth||[]){
  h+='<div class="home-data-row"><span>Im Kurs unterstellt · '+esc(caseValue.label)+'</span><b>'+
    (caseValue.impliedGrowthPct===null?'Außerhalb Rechenbereich':de(caseValue.impliedGrowthPct)+' % p. a.')+
    '</b><small>5 Jahre, Endwertwachstum 2 %. Annahme zur Sensitivität, nicht Unternehmensprognose.</small></div>';
 }
 h+='<p class="tiny muted">**Keine freigegebene Einstiegszone:** Für einen inneren Wert fehlen unabhängig geprüfte Wachstums- und Diskontannahmen, aktuelle Schuldenprüfung und die vollständigen UNITY-5.1-Marktveto-Daten. Ein hoher unterstellter Zuwachs zeigt Bewertungsanfälligkeit, kein automatisches Verkaufssignal.</p>';
 return h;
}
