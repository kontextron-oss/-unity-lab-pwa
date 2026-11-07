'use strict';
/* UNITY 0.15.3.9 – research-only, source-checked forecast and value scenarios.
   No private holdings, real orders, simulated orders, or trading permissions. */
let unityIssuerGuidance=null,unityValuationAssumptions=null,unityQuarterDebtPilot=null,unityNormalizationPilot=null,unityGuidanceFetchError='';
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
 const [guide,assumptions,debtQuarter,normalization]=await Promise.allSettled([
  load('./data/issuer-guidance.json'),
  load('./data/valuation-assumptions.json'),
  load('./data/debt-pilot-evidence.json'),
  load('./data/normalization-evidence.json')
 ]);
 unityIssuerGuidance=guide.status==='fulfilled'?guide.value:null;
 unityValuationAssumptions=assumptions.status==='fulfilled'?assumptions.value:null;
 unityQuarterDebtPilot=debtQuarter.status==='fulfilled'?debtQuarter.value:null;
 unityNormalizationPilot=normalization.status==='fulfilled'?normalization.value:null;
 unityGuidanceFetchError=[guide,assumptions,debtQuarter,normalization].filter(x=>x.status==='rejected').map(x=>String(x.reason)).join(' · ');
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
 // ISIN identifies the exact security across exchange-specific ticker aliases
 // (e.g. ABBN on SIX and ABBN.SW in the delayed quote provider).
 if(!g||!s?.isin||g.isin!==s.isin||!g.ticker||
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
/* UNITY 0.17: point-in-time unaudited SEC 10-Q financial debt review.
 * These issuer numbers are independent of the audited FY2025 cash-flow base;
 * they NEVER make the DCF debt-risk reviewer gate true. */
function unityQuarterDebtEvidence(s,registry){
 const data=(registry===undefined?unityQuarterDebtPilot?.items:registry)?.[s?.isin];
 const isin=String(s?.isin||''),cik=String(data?.cik||'');
 if(!['IE00B8KQN827','US92537N1081'].includes(isin)||
    data?.isin!==isin||!/^0{0,9}[1-9]\d{5,9}$/.test(cik)||
    data.filingType!=='10-Q'||data.audited!==false||
    data.periodEnd!=='2026-09-30'||data.reportCurrency!=='USD'||
    data.unit!=='USD millions'||data.sourceHost!=='www.sec.gov'||
    !unityValuationUrlValid(data.sourceUrl,'www.sec.gov')||
    !String(data.sourceUrl).startsWith('https://www.sec.gov/Archives/edgar/data/'+Number(cik)+'/'))
  return null;
 const day=unityValuationDateAge(data.filedAt);
 if(day===null||day< -1||day>180||data.filedAt<data.periodEnd)return null;
 const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
 const nonNegative=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 if(!positive(data.cashAndEquivalents)||!nonNegative(data.shortTermInvestments)||
    !Array.isArray(data.debtComponents)||!Array.isArray(data.priorYearComparison?.debtComponents))
  return null;
 const expected=isin==='IE00B8KQN827'?
   ['shortTermDebt','currentLongTermDebt','noncurrentLongTermDebt']:
   ['currentLongTermDebt','noncurrentLongTermDebt'];
 const checkComponents=list=>list.length===expected.length&&
   expected.every(key=>list.filter(row=>row?.key===key&&nonNegative(row.amount)).length===1);
 const prior=data.priorYearComparison;
 if(!checkComponents(data.debtComponents)||!checkComponents(prior.debtComponents)||
    prior.periodEnd!=='2025-12-31'||
    !positive(prior.cashAndEquivalents)||!nonNegative(prior.shortTermInvestments))
  return null;
 const ytd=data.yearToDate||{},priorYtd=data.priorYearToDate||{};
 if(ytd.period!=='2026-01-01/2026-09-30'||!positive(ytd.operatingCashFlow)||
    !nonNegative(ytd.capitalExpenditure)||
    priorYtd.period!=='2025-01-01/2025-09-30'||
    !positive(priorYtd.operatingCashFlow)||!nonNegative(priorYtd.capitalExpenditure))return null;
 const total=rows=>Math.round(rows.reduce((sum,x)=>sum+x.amount,0)*100)/100;
 const grossDebt=total(data.debtComponents),priorDebt=total(prior.debtComponents);
 if(!(grossDebt>0&&priorDebt>0))return null;
 return {
  kind:'unity-unaudited-10q-debt-evidence-v1',
  isin,periodEnd:data.periodEnd,filedAt:data.filedAt,sourceUrl:data.sourceUrl,
  currency:data.reportCurrency,unit:data.unit,audited:false,
  debtComponents:data.debtComponents,
  grossFinancialDebt: grossDebt,
  cashAndEquivalents:data.cashAndEquivalents,
  shortTermInvestments:data.shortTermInvestments,
  debtLessCash:Math.round((grossDebt-data.cashAndEquivalents)*100)/100,
  debtChangePct:Math.round(10000*(grossDebt/priorDebt-1))/100,
  yearToDate:{...ytd,fcfProxy:Math.round((ytd.operatingCashFlow-ytd.capitalExpenditure)*100)/100},
  priorYearToDate:{...priorYtd,fcfProxy:Math.round((priorYtd.operatingCashFlow-priorYtd.capitalExpenditure)*100)/100},
  tradeApproved:false,reviewGateSatisfied:false
 };
}
function unityQuarterDebtPanel(s,registry){
 const d=unityQuarterDebtEvidence(s,registry);
 if(!d)return '<p class="tiny muted">Neuer SEC-Quartalsabgleich derzeit nicht quellensicher verfügbar; '+
   'die Schuldendienst-/Bewertungsprüfung bleibt offen.</p>';
 const fmt=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
 let h='<div class="unity-quarter-debt"><p class="tiny muted"><b>Aktualisierte Liquiditäts- und Schuldenbasis '+
   esc(d.periodEnd)+'</b> · SEC 10-Q, <b>ungeprüfter Quartalsbericht</b> vom '+
   esc(d.filedAt)+'. Die bisherige geprüfte Cashflow-Basis bleibt FY2025; '+
   'Jahres-/Quartalszeiträume werden nicht vermischt.</p>';
 for(const row of d.debtComponents)
  h+='<div class="home-data-row"><span>'+esc(row.label)+'</span><b>'+
   esc(fmt(row.amount))+' Mio. USD</b></div>';
 for(const [label,n] of [
  ['Ausgewiesene Finanzschulden (Summe der Bilanzpositionen)',d.grossFinancialDebt],
  ['Liquide Mittel',d.cashAndEquivalents],
  ['Kurzfristige Anlagen (separat; nicht mit Cash vermischt)',d.shortTermInvestments],
  ['Finanzschulden abzüglich liquider Mittel (Teilkennzahl)',d.debtLessCash],
  ['Operativer Cashflow 9 Monate 2026',d.yearToDate.operatingCashFlow],
  ['Sachinvestitionen 9 Monate 2026',d.yearToDate.capitalExpenditure],
  ['OCF − Sachinvestitionen, 9 Monate 2026 (nicht annualisiert)',d.yearToDate.fcfProxy]
 ])h+='<div class="home-data-row"><span>'+esc(label)+'</span><b>'+esc(fmt(n))+
   ' Mio. USD</b></div>';
 h+='<p class="tiny muted">Finanzschulden gegenüber 31.12.2025: '+
   (d.debtChangePct>0?'+':'')+esc(fmt(d.debtChangePct))+
   ' %. Keine Gesamtverschuldung einschließlich Leasing, keine abschließende Nettoverschuldungs- oder Ratingprüfung. '+
   'Insbesondere 9-Monats-Cashflow darf nicht als Jahres-FCF für den DCF eingesetzt werden.</p>'+
   '<p class="tiny muted"><a href="'+esc(d.sourceUrl)+
   '" target="_blank" rel="noopener noreferrer">Originaler SEC-Quartalsbericht</a> · '+
   '<b>Risikofreigabe bleibt offen.</b></p></div>';
 return h;
}

/* UNITY 0.17 research pilot – evidence readiness, not an investment approval.
 * Display the exact missing gate without fabricating valuations or changing orders. */
function unityPilotValuationAudit(s,options={}){
 const isin=String(s?.isin||'');
 if(!['IE00B8KQN827','US92537N1081'].includes(isin))return null;
 const resolve=(key,get)=>Object.prototype.hasOwnProperty.call(options,key)?options[key]:get();
 const financial=resolve('financial',()=>typeof unityFinancialStockSnapshot==='function'?
   unityFinancialStockSnapshot(s):null);
 const rawGuidance=resolve('guidance',()=>unityGuidanceEvidence(s));
 const guidance=rawGuidance?unityGuidanceEvidence(s,{[isin]:rawGuidance}):null;
 const assumptions=resolve('assumptions',()=>unityValuationAssumptions?.items?.[isin]);
 const model=resolve('model',()=>unityScenarioValuation(s,{financial,guidance,assumptions}));
 const calendar=resolve('calendar',()=>typeof unityIssuerCalendarItem==='function'?
   unityIssuerCalendarItem(s):null);
 const calendarFresh=resolve('calendarFresh',()=>typeof unityIssuerCalendarFresh==='function'?
   unityIssuerCalendarFresh()===true:false);
 const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
 const nonNegative=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const sameIssuer=!!assumptions&&assumptions.isin===isin&&
   assumptions.periodEnd===financial?.period&&
   assumptions.currency===financial?.reportCurrency&&
   !!guidance&&assumptions.guidanceSourceUrl===guidance.sourceUrl;
 const debt=assumptions?.debtRiskReview||null;
 const debtAge=unityValuationDateAge(debt?.asOf);
 const debtReady=sameIssuer&&debt?.status==='reviewed'&&
   debt.isin===isin&&debt.periodEnd===financial.period&&
   debt.currency===financial.reportCurrency&&
   nonNegative(debt.grossDebt)&&nonNegative(debt.cashAndEquivalents)&&
   debt.cashFlowBasisVerified===true&&
   ['acceptable','elevated'].includes(debt.outcome)&&
   debtAge!==null&&debtAge>=-1&&debtAge<=550&&
   unityValuationUrlValid(debt.sourceUrl,debt.sourceHost);
 const scenarioReady=!!debtReady&&model?.status==='scenario-only'&&
   model.tradeApproved===false&&!!model.modelValues&&
   Number.isFinite(model.marginOfSafetyPct);
 const priceZone=scenarioReady?model.indicativeEntryZone:null;
 const marketReady=!!priceZone&&positive(priceZone.referencePrice)&&
   priceZone.currency===String(s?.currency||'');
 const earningsDate=String(calendar?.nextEarnings||'');
 const earningsAt=/^\d{4}-\d{2}-\d{2}$/.test(earningsDate)?
   Date.parse(earningsDate+'T12:00:00Z'):NaN;
 const earningsReady=calendarFresh&&calendar?.status==='confirmed-future-earnings'&&
   Number.isFinite(earningsAt)&&earningsAt>Date.now()&&
   /^https:\/\//.test(String(calendar.sourceUrl||''));
 const gates=[
  {key:'annual',label:'Aktueller geprüfter Konzernabschluss',
   ready:financial?.coreComplete===true,
   next:'Geprüften Konzernabschluss für das passende Geschäftsjahr vervollständigen'},
  {key:'cashflow',label:'Free Cashflow und passende Aktienzahl',
   ready:financial?.coreComplete===true&&
     positive(financial?.valuation?.freeCashFlow)&&
     positive(financial?.valuation?.sharesOutstanding),
   next:'Free-Cashflow-Basis und stichtagsbezogene Aktienzahl aus Originalquellen überprüfen'},
  {key:'guidance',label:'Aktuelle offizielle Unternehmensprognose',
   ready:!!guidance,
   next:'Veröffentlichungsdatum, Geschäftsjahr und Originalquelle der Guidance prüfen'},
  {key:'debt',label:'Gesamtverschuldung und Liquidität bewertet',
   ready:!!debtReady,
   next:'Schulden, Liquidität und Cashflow-Basis quellengebunden und unabhängig prüfen'},
  {key:'valuation',label:'Drei begründete, unabhängig geprüfte Szenarien',
   ready:!!scenarioReady,
   next:'Bear/Base/Bull mit begründeten Wachstum-/Diskontsätzen und Sicherheitsmarge dokumentieren'},
  {key:'market',label:'Aktueller Kurs- und Währungsvergleich',
   ready:!!marketReady,
   next:'Datierte Börsen- und Währungskurse für den Modellvergleich prüfen'},
  {key:'earnings',label:'Nächster Ergebnis-Termin bestätigt',
   ready:!!earningsReady,
   next:'Nächsten Earnings-Termin aus aktueller offizieller Quelle bestätigen'}
 ];
 const open=gates.filter(g=>!g.ready);
 return {kind:'unity-valuation-evidence-audit-v1',isin,readyCount:gates.length-open.length,
  total:gates.length,gates,nextSteps:open.map(x=>x.next),
  sourceReady:open.length===0,tradeApproved:false,
  action:'Forschungsprüfung – keine Handelsfreigabe'};
}
function unityPilotValuationAuditPanel(s,options={}){
 const result=unityPilotValuationAudit(s,options);
 if(!result)return '';
 let h='<details class="unity-secondary-check"><summary>UNITY 0.17 · Bewertungsnachweise '+
   result.readyCount+' / '+result.total+'</summary>'+
   '<p class="tiny muted">Eaton-/Vertiv-Pilot: Quellenstand und offene Nachweise. Fehlende Nachweise sind kein negatives Unternehmensurteil. '+
   'Auch alle sieben Nachweise allein sind keine Handelsfreigabe; UNITY-Vetos und Chance/Risiko bleiben gesondert bindend.</p>';
 h+=unityQuarterDebtPanel(s);
 for(const gate of result.gates)
  h+='<div class="home-data-row"><span>'+esc(gate.label)+'</span><b>'+
    (gate.ready?'Belegt':'Offen')+'</b></div>';
 if(result.nextSteps.length)
  h+='<p class="tiny muted"><b>Nächste Aufgaben:</b> '+result.nextSteps.slice(0,3).map(esc).join(' · ')+'</p>';
 h+='</details>';
 return h;
}


/* UNITY 0.17 – source-reconciled trailing twelve months (TTM), not an
 * annualization or intrinsic valuation. FY2025 SEC 10-K and SEC 10-Q figures
 * for Jan–Sep 2025/2026 are from compatible periods; acquisition accounting
 * and working-capital swings are not normalized away. */
function unityPilotTrailingCashFlow(s,options={}){
 const isin=String(s?.isin||''),expectedCik=isin==='IE00B8KQN827'?'0001551182':
   isin==='US92537N1081'?'0001674101':null;
 if(!expectedCik)return null;
 const financial=options.financial===undefined?
   (typeof unityFinancialStockSnapshot==='function'?unityFinancialStockSnapshot(s):null):options.financial;
 const q=options.debt===undefined?unityQuarterDebtEvidence(s):options.debt;
 const problems=[],r={kind:'unity-rolling-ttm-fcf-bridge-v1',isin,status:'blocked',
  asOf:'2026-09-30',currency:'USD',unit:'USD millions',
  ttmOperatingCashFlow:null,ttmCapitalExpenditure:null,ttmFcfProxy:null,
  bridge:null,sourceRefs:[],normalised:false,
  fairValue:null,entryZone:null,tradeApproved:false,missing:problems};
 if(financial?.instrument?.isin!==isin||financial?.coreComplete!==true||
    financial?.sourceKind!=='sec'||financial?.period!=='2025-12-31'||
    financial?.reportCurrency!=='USD'||
    financial?.sourceUrl!=='https://data.sec.gov/api/xbrl/companyfacts/CIK'+expectedCik+'.json')
   problems.push('Quellenrichtiger, geprüfter FY2025-SEC-Bericht erforderlich');
 if(q?.isin!==isin||q.kind!=='unity-unaudited-10q-debt-evidence-v1'||
    q.periodEnd!=='2026-09-30'||q.audited!==false||
    q.currency!=='USD'||q.unit!=='USD millions'||q.tradeApproved!==false||
    q.reviewGateSatisfied!==false||
    !String(q.sourceUrl||'').startsWith('https://www.sec.gov/Archives/edgar/data/'+Number(expectedCik)+'/'))
   problems.push('Quellenrichtige, unauditierte Vergleichszeiträume aus SEC 10-Q fehlen');
 const annualOCF=financial?.core?.operatingCashFlow;
 const annualCapex=financial?.valuation?.capitalExpenditure;
 const yearOCF=q?.yearToDate?.operatingCashFlow;
 const yearCapex=q?.yearToDate?.capitalExpenditure;
 const previousOCF=q?.priorYearToDate?.operatingCashFlow;
 const previousCapex=q?.priorYearToDate?.capitalExpenditure;
 const finitePositive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
 const finiteNonNegative=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 if(!finitePositive(annualOCF)||!finiteNonNegative(annualCapex)||
    !finitePositive(yearOCF)||!finiteNonNegative(yearCapex)||
    !finitePositive(previousOCF)||!finiteNonNegative(previousCapex)||
    q?.yearToDate?.period!=='2026-01-01/2026-09-30'||
    q?.priorYearToDate?.period!=='2025-01-01/2025-09-30')
   problems.push('Gleich definierte OCF-/CapEx-Werte für FY2025, 9M2025 und 9M2026 fehlen');
 if(problems.length)return r;
 const mn=n=>Math.round(n/1e4)/100; // USD absolute to USD millions, rounded to 0.01
 const fyOCF=mn(annualOCF),fyCapex=mn(annualCapex);
 const ttmOCF=Math.round((fyOCF-previousOCF+yearOCF)*100)/100;
 const ttmCapex=Math.round((fyCapex-previousCapex+yearCapex)*100)/100;
 if(ttmOCF<=0||ttmCapex<0){
   problems.push('TTM-Überleitung nicht mathematisch plausibel');return r;
 }
 r.status='reported-ttm-only';
 r.bridge={fy2025:{operatingCashFlow:fyOCF,capitalExpenditure:fyCapex},
  minus9m2025:{operatingCashFlow:previousOCF,capitalExpenditure:previousCapex},
  plus9m2026:{operatingCashFlow:yearOCF,capitalExpenditure:yearCapex}};
 r.ttmOperatingCashFlow=ttmOCF;
 r.ttmCapitalExpenditure=ttmCapex;
 r.ttmFcfProxy=Math.round((ttmOCF-ttmCapex)*100)/100;
 r.sourceRefs=[{period:'FY2025',url:financial.sourceUrl},
  {period:'9M2025 and 9M2026',url:q.sourceUrl}];
 return r;
}
function unityPilotTrailingCashFlowPanel(s,options={}){
 const r=unityPilotTrailingCashFlow(s,options);
 if(!r)return '';
 const de=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
 if(r.status!=='reported-ttm-only')
  return '<p class="tiny muted">TTM-Cashflow-Überleitung nicht belegt: '+
   esc(r.missing.join(' · '))+'. Keine Bewertung.</p>';
 let h='<details class="unity-secondary-check"><summary>Rollierender 12-Monats-Cashflow bis 30.09.2026</summary>'+
  '<p class="tiny muted">TTM = geprüfter FY2025-Jahreswert − SEC 9M2025 + SEC 9M2026. '+
  '2026er Quartalsdaten sind unauditiert; keine bloße Hochrechnung und keine Prognose.</p>';
 for(const [label,values] of [
  ['FY2025',r.bridge.fy2025],['abzüglich 9M2025',r.bridge.minus9m2025],
  ['zuzüglich 9M2026',r.bridge.plus9m2026]])
  h+='<div class="home-data-row"><span>'+esc(label)+
   ' · OCF / Sachinvestitionen</span><b>'+esc(de(values.operatingCashFlow))+' / '+
   esc(de(values.capitalExpenditure))+' Mio. USD</b></div>';
 for(const [label,num] of [
  ['TTM operativer Cashflow',r.ttmOperatingCashFlow],
  ['TTM Sachinvestitionen',r.ttmCapitalExpenditure],
  ['TTM FCF-Proxy (OCF − Sachinvestitionen)',r.ttmFcfProxy]])
  h+='<div class="home-data-row"><span>'+esc(label)+'</span><b>'+
   esc(de(num))+' Mio. USD</b></div>';
 h+='<p class="tiny muted">Vorläufiger historischer Istwert: nicht normalisiert für Übernahmen, '+
  'Working-Capital-Effekte, Aktienzahl oder künftige Kapitalausgaben; bei Vertiv sind '+
  'separate Investitionen in aktivierte Software nicht in der Sachinvestitionsreihe enthalten. '+
  '<b>Kein fairer Wert, keine Einstiegszone und keine Kauf-Freigabe.</b></p></details>';
 return h;
}

/* UNITY 0.17 – Acquisition/working-capital/financing disclosure audit.
 * No add-back, annualization or normalized fair value is generated. Acquired
 * companies' post-acquisition incremental OCF is not disclosed here; even a
 * quantified WC swing is not a reliable recurring FCF adjustment. */
function unityPilotNormalizationReview(s,options={}){
 const isin=String(s?.isin||'');
 const expectedCik=isin==='IE00B8KQN827'?'0001551182':
   isin==='US92537N1081'?'0001674101':null;
 if(!expectedCik)return null;
 const raw=options.evidence===undefined?unityNormalizationPilot?.items?.[isin]:options.evidence;
 const q=options.quarter===undefined?unityQuarterDebtEvidence(s):options.quarter;
 const ttm=options.ttm===undefined?unityPilotTrailingCashFlow(s,{debt:q}):options.ttm;
 const missing=[];
 const result={kind:'unity-fcf-normalization-gate-v1',isin,
  periodEnd:'2026-09-30',status:'blocked',sourceRefs:[],
  reportedTTMFcfProxy:null,normalizedTTMFcf:null,
  potentialDistortions:null,comparisonScope:null,
  completeness:'insufficient-for-forward-normalization',
  blockers:[],missing,tradeApproved:false,investmentReady:false,
  fairValue:null,entryZone:null};
 const validMoney=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const validDelta=n=>typeof n==='number'&&Number.isFinite(n);
 const validPair=(pair,allowNegative=false)=>pair&&
   (allowNegative?validDelta(pair.in9m2026):validMoney(pair.in9m2026))&&
   (allowNegative?validDelta(pair.in9m2025):validMoney(pair.in9m2025))&&
   typeof pair.scope==='string'&&pair.scope.length>=24;
 if(!raw||raw.isin!==isin||raw.cik!==expectedCik||
    raw.periodEnd!=='2026-09-30'||raw.comparisonPeriodEnd!=='2025-09-30'||
    raw.unit!=='USD millions'||raw.audited!==false||
    !String(raw.sourceUrl||'').startsWith(
      'https://www.sec.gov/Archives/edgar/data/'+Number(expectedCik)+'/')||
    q?.sourceUrl!==raw.sourceUrl||raw.filedAt!==q?.filedAt)
    missing.push('Exakt zugeordneter SEC-Quartalsbericht und einheitlicher 2025/2026-Zeitraum fehlen');
 if(q?.isin!==isin||q.kind!=='unity-unaudited-10q-debt-evidence-v1'||
    q.reviewGateSatisfied!==false||q.tradeApproved!==false)
    missing.push('Unveränderte geprüfte Quartalsdatenbasis fehlt');
 if(ttm?.isin!==isin||ttm.status!=='reported-ttm-only'||
    ttm.tradeApproved!==false||ttm.normalised!==false||
    ttm.asOf!=='2026-09-30'||!validMoney(ttm.ttmFcfProxy))
    missing.push('Nicht normalisierte zwölfmonatige Cashflow-Überleitung fehlt');
 const wc=raw?.operatingWorkingCapitalMovement,acq=raw?.acquisitionCashPaid;
 if(!validPair(wc,true)||!validPair(acq,false))
    missing.push('Belegte Veränderungen des Umlaufvermögens und Akquisitionszahlungen fehlen');
 if(isin==='IE00B8KQN827'&&
   (!validPair(raw?.financingBorrowingsProceeds,false)||
    !validPair(raw?.financingShortTermDebtNet,true)||
    raw?.expected2026PpeCapex?.horizon!=='FY2026'||
    !validMoney(raw?.expected2026PpeCapex?.value)))
    missing.push('Eaton: Finanzierungskomponenten oder explizite CapEx-Erwartung fehlen');
 if(isin==='US92537N1081'&&!validPair(raw?.softwareCapitalized,false))
    missing.push('Vertiv: separat ausgewiesene Softwareinvestitionen fehlen');
 if(missing.length)return result;
 result.status='disclosure-complete-normalization-open';
 result.sourceRefs=[{type:'SEC-10Q-9M2026-and-2025',url:raw.sourceUrl},
  ...(ttm.sourceRefs||[])];
 result.reportedTTMFcfProxy=ttm.ttmFcfProxy;
 result.comparisonScope=isin==='IE00B8KQN827'?
   'Total consolidated changes in working capital':
   'Trade working capital disclosed in management discussion (not total working capital)';
 result.potentialDistortions={
  workingCapital:{in9m2026:wc.in9m2026,in9m2025:wc.in9m2025,
   yearOnYearChange:Math.round((wc.in9m2026-wc.in9m2025)*100)/100,
   classification:'operating-cash-flow-component',
   automaticAdjustmentAllowed:false,scope:wc.scope},
  acquisitions:{in9m2026:acq.in9m2026,in9m2025:acq.in9m2025,
   classification:'investing-cash-flow-not-ocf',
   automaticAdjustmentAllowed:false,scope:acq.scope},
  ...(isin==='IE00B8KQN827'?{
    borrowings:{in9m2026:raw.financingBorrowingsProceeds.in9m2026,
     in9m2025:raw.financingBorrowingsProceeds.in9m2025,
     classification:'financing-not-operating-cash-flow',
     automaticAdjustmentAllowed:false},
    expectedFullYearCapex:{value:raw.expected2026PpeCapex.value,
     fiscalYear:2026,classification:'company-outlook-not-executed',
     automaticAdjustmentAllowed:false}
   }:{
    softwareCapitalized:{in9m2026:raw.softwareCapitalized.in9m2026,
     in9m2025:raw.softwareCapitalized.in9m2025,
     classification:'separate-investing-item-not-ppe-capex',
     automaticAdjustmentAllowed:false}
   })
 };
 result.blockers=[
  'Akquisitionsbeiträge zum eigenständigen zukünftigen operativen Cashflow nicht nachgewiesen',
  'Wiederkehrender und nur temporärer Working-Capital-Effekt nicht unabhängig getrennt',
  'Nachhaltiger Erhaltungs- und Wachstums-CapEx nach 2026 nicht normalisiert',
  'Künftige Cash-Zinslast, Refinanzierung, Steuern und Finanzierungsänderungen nicht vollständig abgestimmt',
  'Mehrjähriger FCF nach Aktienzahl und Verwässerung nicht plausibilisiert'
 ];
 return result;
}
function unityPilotNormalizationReviewPanel(s,options={}){
 const a=unityPilotNormalizationReview(s,options);
 if(!a)return '';
 let h='<details class="unity-secondary-check"><summary>UNITY 0.17 · Cashflow-Bereinigung und offene Risiken</summary>';
 if(a.status!=='disclosure-complete-normalization-open')
  return h+'<p class="tiny muted">SEC-Abgleich noch nicht vollständig: '+
    esc(a.missing.join(' · '))+'. Keine automatische Normalisierung.</p></details>';
 const fmt=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
 h+='<p class="tiny muted"><b>Berichteter TTM-Cashflow-Proxy</b> '+
   esc(fmt(a.reportedTTMFcfProxy))+
   ' Mio. USD. Ein nachhaltig bereinigter zukünftiger Cashflow liegt nicht vor.</p>';
 const x=a.potentialDistortions;
 h+='<div class="home-data-row"><span>9M2026 Umlaufvermögenseffekt</span><b>'+
   esc(fmt(x.workingCapital.in9m2026))+' Mio. USD</b></div>'+
   '<p class="tiny muted">'+esc(a.comparisonScope)+
   '. Ein positiver oder negativer Effekt wird <b>nicht automatisch hinzu- oder abgerechnet</b>.</p>'+
   '<div class="home-data-row"><span>9M2026 Akquisitionszahlungen (Investitions-Cashflow)</span><b>'+
   esc(fmt(x.acquisitions.in9m2026))+' Mio. USD</b></div>';
 if(x.borrowings)
  h+='<div class="home-data-row"><span>9M2026 Kreditaufnahmen (Finanzierungs-Cashflow)</span><b>'+
   esc(fmt(x.borrowings.in9m2026))+' Mio. USD</b></div>';
 if(x.expectedFullYearCapex)
  h+='<div class="home-data-row"><span>Sachinvestitionen 2026, Unternehmensausblick (kein Istwert)</span><b>'+
   esc(fmt(x.expectedFullYearCapex.value))+' Mio. USD</b></div>';
 if(x.softwareCapitalized)
  h+='<div class="home-data-row"><span>9M2026 separat aktivierte Software</span><b>'+
   esc(fmt(x.softwareCapitalized.in9m2026))+' Mio. USD</b></div>';
 h+='<p class="tiny muted"><b>Offene Bewertungsprüfungen:</b> '+
   a.blockers.slice(0,5).map(esc).join(' · ')+
   '. <b>Keine Bereinigung, kein fairer Wert und keine Kauf-Freigabe.</b></p>'+
   '<p class="tiny muted"><a href="'+esc(a.sourceRefs[0].url)+
   '" target="_blank" rel="noopener noreferrer">SEC-Originalbericht</a> · Angaben aus 2026 unauditiert.</p></details>';
 return h;
}

/* UNITY 0.17 – deliberately UNVALIDATED scenario sensitivity.
 * A constant-growth hypothetical owner-cashflow proxy is not a verified
 * future cash-flow forecast, intrinsic value, buy zone, or source-backed
 * discount rate. Q3 2026 debt facts are kept as separate risk context;
 * do not mix 9M cash flow into the FY2025 annual DCF baseline. */
const UNITY_PILOT_SENSITIVITY_CASES=Object.freeze([
 {id:'bear',label:'Vorsichtiges Stressszenario',growthPct:-5,discountPct:12,
  terminalGrowthPct:1,explanation:'Jährlich rückläufiger Cashflow als Stresstest'},
 {id:'base',label:'Mittlere Sensitivität',growthPct:5,discountPct:10,
  terminalGrowthPct:2,explanation:'Gleichmäßiger Modellanstieg, nicht Unternehmensprognose'},
 {id:'bull',label:'Hohe Wachstumsannahme',growthPct:15,discountPct:8,
  terminalGrowthPct:3,explanation:'Hohe FCF-Zuwächse als Gegenprobe; besonders unsicher'}
]);
function unityPilotScenarioSensitivity(s,options={}){
 const isin=String(s?.isin||'');
 if(!['IE00B8KQN827','US92537N1081'].includes(isin))return null;
 const financial=options.financial===undefined?
   (typeof unityFinancialStockSnapshot==='function'?unityFinancialStockSnapshot(s):null):
   options.financial;
 const debt=options.debt===undefined?unityQuarterDebtEvidence(s):options.debt;
 const missing=[];
 const result={kind:'unity-illustrative-fcf-sensitivity-v1',isin,
  status:'blocked',assumptionStatus:'hypothetical-not-reviewed',
  fiscalCashFlowPeriod:'2025-12-31',quarterRiskPeriod:'2026-09-30',
  cashFlowPerShare:null,scenarios:null,
  referencePrice:null,referenceDate:null,reportCurrency:null,
  financingChangePct:null,quarterRisk:null,sourceRefs:[],
  fairValue:null,entryZone:null,tradeApproved:false,
  verdict:'Nur Sensitivitätsrechnung; keine Marktwert- oder Kaufempfehlung.',
  missing};
 const expectedCik=isin==='IE00B8KQN827'?'0001551182':'0001674101';
 if(!financial||financial.instrument?.isin!==isin||financial.coreComplete!==true||
    financial.sourceKind!=='sec'||financial.reportCurrency!=='USD'||
    financial.period!=='2025-12-31'||
    financial.sourceUrl!=='https://data.sec.gov/api/xbrl/companyfacts/CIK'+expectedCik+'.json')
  missing.push('Identischer, geprüfter FY2025-Konzernabschluss fehlt');
 const fcf=financial?.valuation?.freeCashFlow,shares=financial?.valuation?.sharesOutstanding;
 if(!(typeof fcf==='number'&&Number.isFinite(fcf)&&fcf>0&&
      typeof shares==='number'&&Number.isFinite(shares)&&shares>0))
  missing.push('Belegter FY2025-Cashflow nach Capex und echte Stichtags-Aktienzahl fehlen');
 if(!(debt&&debt.kind==='unity-unaudited-10q-debt-evidence-v1'&&debt.isin===isin&&
      debt.periodEnd==='2026-09-30'&&debt.currency==='USD'&&
      debt.audited===false&&debt.tradeApproved===false&&
      debt.reviewGateSatisfied===false&&
      typeof debt.grossFinancialDebt==='number'&&debt.grossFinancialDebt>0&&
      typeof debt.cashAndEquivalents==='number'&&debt.cashAndEquivalents>0&&
      /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(String(debt.sourceUrl||''))))
  missing.push('Getrennter und zugeordneter SEC-Quartalsabgleich September 2026 fehlt');
 if(missing.length)return result;
 const fcfPerShare=fcf/shares;
 const scenarios=UNITY_PILOT_SENSITIVITY_CASES.map(row=>{
  const value=unityModelDiscountedEquityCashFlow(fcfPerShare,row.growthPct,
    row.discountPct,row.terminalGrowthPct,5);
  return {...row,years:5,modelBarValuePerShare:value,
   isIssuerForecast:false,investmentReady:false};
 });
 if(scenarios.some(x=>!(x.modelBarValuePerShare>0))||
    !(scenarios[0].modelBarValuePerShare<=scenarios[1].modelBarValuePerShare&&
      scenarios[1].modelBarValuePerShare<=scenarios[2].modelBarValuePerShare)){
   missing.push('Illustrative Szenarien mathematisch unzulässig');
   return result;
 }
 result.status='sensitivity-only';
 result.cashFlowPerShare=fcfPerShare;
 result.reportCurrency=financial.reportCurrency;
 result.sourceRefs=[{type:'FY2025',url:financial.sourceUrl},
  {type:'Q3-2026',url:debt.sourceUrl}];
 result.financingChangePct=debt.debtChangePct;
 result.quarterRisk={grossDebt:debt.grossFinancialDebt,
  cashAndEquivalents:debt.cashAndEquivalents,
  debtLessCash:debt.debtLessCash,
  nineMonthOperatingCashFlow:debt.yearToDate?.operatingCashFlow??null,
  nineMonthCapitalExpenditure:debt.yearToDate?.capitalExpenditure??null,
  audited:false};
 const price=financial?.quoteInReportCurrency,quote=financial?.priceRef;
 const age=unityValuationDateAge(quote?.date);
 const priceOk=typeof price==='number'&&Number.isFinite(price)&&price>0&&
   quote&&typeof quote.exchange==='string'&&quote.exchange.trim()&&
   typeof financial.fx?.value==='number'&&Number.isFinite(financial.fx.value)&&
   financial.fx.value>0&&age!==null&&age>=-1&&age<=5.5;
 if(priceOk){
  result.referencePrice=price;
  result.referenceDate=quote.date;
 }
 result.scenarios=scenarios.map(x=>({
  ...x,relativeToReferencePct:priceOk?
   Math.round(10000*(x.modelBarValuePerShare/price-1))/100:null
 }));
 result.verdict='Forschungs-Sensitivität: Modellbarwerte hängen vollständig von '+
  'ungeprüften Cashflow-Wachstums- und Renditeannahmen ab. '+
  '2026er Finanzierung und Übernahmen können den FY2025-Ausgangspunkt entwerten.';
 return result;
}
function unityPilotScenarioSensitivityPanel(s,options={}){
 const x=unityPilotScenarioSensitivity(s,options);
 if(!x)return '';
 const fmt=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
 let h='<details class="unity-secondary-check"><summary>UNITY 0.17 · Drei Cashflow-Szenarien (Forschung)</summary>';
 if(x.status!=='sensitivity-only'){
  return h+'<p class="tiny muted">Keine Szenariorechnung: '+esc(x.missing.join(' · '))+
   '. Kein fairer Wert und kein Kaufkurs.</p></details>';
 }
 h+='<p class="tiny muted"><b>Rechenbeispiel, keine Unternehmensbewertung:</b> FY2025 '+
   'OCF minus Capex je ausstehender FY2025-Aktie: '+esc(fmt(x.cashFlowPerShare))+
   ' '+esc(x.reportCurrency)+'. Die Szenarien nehmen für fünf Jahre '+
   'ausdrücklich <b>hypothetische</b> jährliche Cashflow-Veränderungen und Eigenkapitalkosten an. '+
   'Keine davon ist ein Unternehmensausblick oder unabhängig bestätigter Kapitalmarktzins.</p>';
 for(const c of x.scenarios){
  h+='<div class="home-data-row"><span>'+esc(c.label)+'<small>'+
    esc(c.growthPct)+' % Wachstum · '+esc(c.discountPct)+
    ' % Abzinsung · '+esc(c.terminalGrowthPct)+' % Endwachstum</small></span><b>'+
    esc(fmt(c.modelBarValuePerShare))+' '+esc(x.reportCurrency)+
    '</b></div>';
 }
 h+='<p class="tiny muted">Angezeigte Beträge sind <b>mathematische Modellbarwerte</b> der jeweiligen Annahmen, '+
   'keine fairen Unternehmenswerte, Kursziele oder Einstiegszonen. '+
   (x.referencePrice!==null?
   'Vergleichsschlusskurs '+esc(x.referenceDate)+': '+esc(fmt(x.referencePrice))+' '+
   esc(x.reportCurrency)+'. ':'Kein frischer, vergleichbarer Börsenkurs vorhanden. ')+
   'SEC-Quartalsbilanz 30.09.2026: Finanzschulden '+esc(fmt(x.quarterRisk.grossDebt))+
   ' Mio. USD; liquide Mittel '+esc(fmt(x.quarterRisk.cashAndEquivalents))+
   ' Mio. USD. Der Q3-Stand ist unauditiert und wird nicht in den FY2025-Cashflow hineingerechnet.</p>'+
   '<p class="tiny muted"><b>Nicht abgedeckt:</b> Veränderungen durch Übernahmen, künftige Refinanzierung, '+
   'Aktienverwässerung, Normalisierung des 2026er Cashflows und vollständige Kapitalkostenprüfung. '+
   'UNITY-Freigabe bleibt gesperrt.</p></details>';
 return h;
}

function unityScenarioValuationPanel(s){
 const g=unityGuidanceEvidence(s),m=unityScenarioValuation(s);
 let h='<h4>Zukunftserwartungen und Szenariobewertung · UNITY</h4>';
 h+=unityPilotValuationAuditPanel(s,{guidance:g,model:m});
 h+=unityPilotScenarioSensitivityPanel(s);
 h+=unityPilotTrailingCashFlowPanel(s);
 h+=unityPilotNormalizationReviewPanel(s);
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
