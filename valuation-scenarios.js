'use strict';
/* UNITY 0.15.3.9 – research-only, source-checked forecast and value scenarios.
   No private holdings, real orders, simulated orders, or trading permissions. */
let unityIssuerGuidance=null,unityValuationAssumptions=null,unityGuidanceFetchError='';
async function unityLoadValuationEvidence(){
 const load=async url=>{
  let r;
  try{r=await fetch(url+'?t='+Date.now(),{cache:'no-store',credentials:'omit'})}
  catch(_){r=await fetch(url,{cache:'default',credentials:'omit'})}
  if(!r.ok)throw Error('HTTP '+r.status);
  const v=await r.json();
  if(v.schemaVersion!==1||!v.items||typeof v.items!=='object'||Array.isArray(v.items))
   throw Error('Ungültige öffentliche Prognosedatei');
  return v;
 };
 const [guide,assumptions]=await Promise.allSettled([
  load('./data/issuer-guidance.json'),
  load('./data/valuation-assumptions.json')
 ]);
 unityIssuerGuidance=guide.status==='fulfilled'?guide.value:null;
 unityValuationAssumptions=assumptions.status==='fulfilled'?assumptions.value:null;
 unityGuidanceFetchError=[guide,assumptions].filter(x=>x.status==='rejected').map(x=>String(x.reason)).join(' · ');
 if(typeof render==='function'&&typeof db!=='undefined'&&db)render();
}
function unityValuationDateAge(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return null;
 const ms=Date.parse(date+'T12:00:00Z');
 if(!Number.isFinite(ms))return null;
 return (Date.now()-ms)/86400000;
}
function unityValuationUrlValid(value,host){
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname===host}
 catch(_){return false}
}
function unityGuidanceEvidence(s,registry){
 const g=(registry===undefined?unityIssuerGuidance?.items:registry)?.[s?.isin];
 if(!g||g.isin!==s?.isin||!g.ticker||!!s?.ticker&&g.ticker!==s.ticker||
   !g.sourceUrl||!g.sourceHost)return null;
 const pubAge=unityValuationDateAge(g.publishedAt);
 const reviewAge=unityValuationDateAge(g.reviewedAt);
 if(pubAge===null||reviewAge===null||pubAge < -1||pubAge>180||reviewAge < -1||reviewAge>180||
   pubAge<reviewAge||!unityValuationUrlValid(g.sourceUrl,g.sourceHost)||
   !Array.isArray(g.guidance)||g.guidance.length===0)return null;
 return g;
}
function unityScenarioNumber(v){return typeof v==='number'&&Number.isFinite(v)?v:null}
function unityModelDiscountedEquityCashFlow(fcfPerShare,growthPct,discountPct,terminalPct,years){
 const g=growthPct/100,r=discountPct/100,t=terminalPct/100;
 if(!(r>t+0.04)||!(r>0)||!(years>=3&&years<=8)||!(fcfPerShare>0))return null;
 let flow=fcfPerShare,present=0;
 for(let n=1;n<=years;n++){
  flow*=1+g;
  if(!(flow>0))return null;
  present+=flow/Math.pow(1+r,n);
 }
 present+=flow*(1+t)/(r-t)/Math.pow(1+r,years);
 return Number.isFinite(present)&&present>0?present:null;
}
function unityScenarioValuation(s,options={}){
 const financial=options.financial===undefined?
   (typeof unityFinancialStockSnapshot==='function'?unityFinancialStockSnapshot(s):null):options.financial;
 const rawGuidance=options.guidance===undefined?unityGuidanceEvidence(s):options.guidance;
 const guidance=rawGuidance?unityGuidanceEvidence(s,{[s?.isin]:rawGuidance}):null;
 const assumptions=options.assumptions===undefined?
   unityValuationAssumptions?.items?.[s?.isin]:options.assumptions;
 const missing=[];
 const result={schemaVersion:1,kind:'unity-equity-cash-flow-scenarios',
   isin:String(s?.isin||''),ticker:String(s?.ticker||''),method:'illustrative-equity-fcf-proxy',
   status:'blocked',guidance:guidance||null,modelValues:null,
   indicativeEntryZone:null,marginOfSafetyPct:null,
   tradeApproved:false,decision:'Keine operative Kauf-Freigabe',
   missing};
 if(!financial?.coreComplete)missing.push('Fünf einheitliche geprüfte Abschlusskennzahlen');
 const fcf=financial?.valuation?.freeCashFlow;
 const shares=financial?.valuation?.sharesOutstanding;
 if(!(typeof fcf==='number'&&Number.isFinite(fcf)&&fcf>0))
   missing.push('Belegter positiver operativer Cashflow nach Capex');
 if(!(typeof shares==='number'&&Number.isFinite(shares)&&shares>0))
   missing.push('Stichtagsbezogene Aktienzahl');
 if(!guidance)missing.push('Aktuelle belegte Unternehmensprognose');
 if(!assumptions||assumptions.isin!==s?.isin||assumptions.periodEnd!==financial?.period||
   assumptions.currency!==financial?.reportCurrency)
   missing.push('Emittenten- und periodenrichtige Bewertungsannahmen');
 if(missing.length)return result;
 const review=assumptions.debtRiskReview||{};
 const reviewAge=unityValuationDateAge(review.asOf);
 const debtComplete=review.status==='reviewed'&&review.isin===s?.isin&&
   review.periodEnd===financial.period&&review.currency===financial.reportCurrency&&
   unityScenarioNumber(review.grossDebt)!==null&&review.grossDebt>=0&&
   unityScenarioNumber(review.cashAndEquivalents)!==null&&review.cashAndEquivalents>=0&&
   review.cashFlowBasisVerified===true&&
   ['acceptable','elevated'].includes(review.outcome);
 if(!debtComplete||reviewAge===null||reviewAge < -1||reviewAge>550||
   !unityValuationUrlValid(review.sourceUrl,review.sourceHost)){
   missing.push('Vollständig geprüfte und identitätsgleiche Gesamtverschuldung, Liquidität und Risikobewertung');
 }
 const analystAge=unityValuationDateAge(assumptions.analystReviewedAt);
 if(!assumptions.reviewed||!assumptions.reviewedBy||analystAge===null||
   analystAge < -1||analystAge>180||assumptions.guidanceSourceUrl!==guidance.sourceUrl)
   missing.push('Verifizierte, dokumentierte und zeitnahe Analysten-Szenarien');
 const band=assumptions.scenarios||{};
 const ids=['bear','base','bull'];
 if(ids.some(id=>{
  const x=band[id],g=unityScenarioNumber(x?.growthPct),
    d=unityScenarioNumber(x?.discountPct),t=unityScenarioNumber(x?.terminalGrowthPct);
  return g===null||g< -30||g>40||d===null||d<6||d>30||
    t===null||t< -2||t>4||d-t<4.01||!x?.rationale||x.rationale.length<12;
 }))missing.push('Drei begründete Szenarien mit zulässigem Wachstum und Kapitalkostensatz');
 const horizon=assumptions.years;
 if(!Number.isInteger(horizon)||horizon<3||horizon>8)
   missing.push('Expliziter Prognosezeitraum von drei bis acht Jahren');
 const mos=unityScenarioNumber(assumptions.marginOfSafetyPct);
 if(mos===null||mos<15||mos>50)missing.push('Explizite Sicherheitsmarge 15 bis 50 Prozent');
 if(missing.length)return result;
 const perShare=fcf/shares;
 const scenarios={};
 for(const id of ids){
  const x=band[id];
  const value=unityModelDiscountedEquityCashFlow(perShare,x.growthPct,
    x.discountPct,x.terminalGrowthPct,horizon);
  if(value===null){missing.push('Szenario nicht mathematisch berechenbar: '+id);return result}
  scenarios[id]={valueReportCurrency:value,growthPct:x.growthPct,
    discountPct:x.discountPct,terminalGrowthPct:x.terminalGrowthPct};
 }
 if(!(scenarios.bear.valueReportCurrency<=scenarios.base.valueReportCurrency&&
      scenarios.base.valueReportCurrency<=scenarios.bull.valueReportCurrency)){
  missing.push('Szenariowerte sind nicht monoton (vorsichtig ≤ Basis ≤ optimistisch)');
  return result;
 }
 // Historical OCF minus Capex is an equity FCF approximation AFTER interest for
 // US-GAAP companies, but BEFORE debt repayments; DO NOT subtract debt again.
 // A full reviewed debt-risk assessment is therefore mandatory above.
 result.status='scenario-only';result.modelValues=scenarios;result.marginOfSafetyPct=mos;
 const fx=financial?.fx;
 const quotePrice=financial?.priceRef?.price;
 const quoteAge=unityValuationDateAge(financial?.priceRef?.date);
 if(!(fx?.value>0)||!(quotePrice>0)||quoteAge===null||quoteAge < -1||quoteAge>5.5){
  missing.push('Aktueller geprüfter Kurs und zeitgleicher EUR-Cross-FX für Kursvergleich');
  return result;
 }
 const low=scenarios.bear.valueReportCurrency*(1-mos/100)/fx.value;
 const high=scenarios.base.valueReportCurrency*(1-mos/100)/fx.value;
 result.indicativeEntryZone={low,high,currency:String(s?.currency||''),
   quoteDate:financial.priceRef.date,referencePrice:quotePrice,
   inZone:quotePrice>=low&&quotePrice<=high};
 // Never promote a scenario to a real trade, even when price crosses a band.
 result.decision='Modellhafte Preiszone – Marktregime, Earnings und UNITY-Vetos separat prüfen';
 return result;
}
function unityScenarioValuationPanel(s){
 const g=unityGuidanceEvidence(s),m=unityScenarioValuation(s);
 let h='<h4>Zukunftserwartungen und Szenariobewertung · UNITY</h4>';
 if(g){
  h+='<p class="tiny muted"><b>Unternehmensprognose '+g.fiscalYear+':</b> Quelle vom '+esc(g.publishedAt)+
    ', geprüft '+esc(g.reviewedAt)+' · nur die konkret angegebenen Prognosegrößen, keine 5-Jahres-Schätzung.</p>';
  for(const line of g.guidance){
   let range=typeof line.text==='string'?line.text:
    line.lower!==undefined&&line.upper!==undefined?
      (line.lower+' – '+line.upper):line.mid!==undefined?String(line.mid):
      line.lower!==undefined?('mindestens '+line.lower):'offen';
   if(line.unit==='USD'&&typeof line.lower==='number')range=
      new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(line.lower/1e6)+' – '+
      new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(line.upper/1e6)+' Mio. USD';
   h+='<div class="home-data-row"><span>'+esc(line.label||line.metric)+'</span><b>'+
     esc(String(range))+(line.unit==='percent'?' %':line.unit==='USD/shares'?' USD je Aktie':'')+
     '</b><small>'+(line.nonGAAP?'Nicht-GAAP · ':'')+'Prognose des Unternehmens, keine Gewinnzusage</small></div>';
  }
  h+='<p><a href="'+esc(g.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Offizielle Prognosequelle lesen</a></p>';
 }else h+='<p class="tiny muted">Keine ausreichend aktuelle und geprüfte Unternehmensprognose hinterlegt.</p>';
 if(m.status==='scenario-only'){
  const reportCurrency=typeof unityFinancialStockSnapshot==='function'?
   unityFinancialStockSnapshot(s)?.reportCurrency||'':'';
  h+='<p><b>Bewertungsband (nur Szenariomodell):</b> '+
    new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(m.modelValues.bear.valueReportCurrency)+
    ' – '+new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(m.modelValues.bull.valueReportCurrency)+
    ' '+esc(reportCurrency)+' je Aktie</p>';
  if(m.indicativeEntryZone){
   h+='<p class="tiny muted">Rechnerische Preiszone nach Sicherheitsmarge: '+
    new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(m.indicativeEntryZone.low)+
    ' – '+new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(m.indicativeEntryZone.high)+
    ' '+esc(m.indicativeEntryZone.currency)+' · nicht operativ freigegeben.</p>';
  }
 }else h+='<p class="tiny muted">Innerer Wert und Einstiegszone bleiben gesperrt: '+esc(m.missing.join(' · '))+
   '. Keine stillen Annahmen und kein automatischer Testkauf.</p>';
 return h;
}
if(typeof fetch==='function')unityLoadValuationEvidence();
