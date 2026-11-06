'use strict';
/* UNITY 0.15.3.8: uniform audited core metrics, prior-year comparison and FX.
   READ ONLY. This module NEVER approves trades, predicts a fair value, or
   treats an exchange rate as a tradable quote. */
const UNITY_FINANCIAL_CORE=['revenue','netIncome','assets','equity','operatingCashFlow'];
const UNITY_FINANCIAL_RATIO_NAMES={
 netMargin:'Nettomarge',equityRatio:'Eigenkapitalquote',
 operatingCashFlowMargin:'Operative Cashflow-Marge',
 cashConversion:'Operativer Cashflow / Jahresüberschuss',
 revenueGrowth:'Umsatzveränderung gegenüber Vorjahr',
 netIncomeGrowth:'Ergebnisveränderung gegenüber Vorjahr'
};
function unityFinancialNumber(value){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);return Number.isFinite(n)?n:null;
}
function unityFinancialPeriodDays(period,previous){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(period||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(previous||'')))return NaN;
 return (Date.parse(period+'T12:00:00Z')-Date.parse(previous+'T12:00:00Z'))/86400000;
}
function unityFinancialSourceKind(report){
 const url=String(report?.latestFiling?.reportUrl||'');
 const status=report?.status;
 if(status==='issuer-pdf-metrics-complete'&&report?.annualReport?.coreMetricsValidated===true&&
   report.annualReport.stale!==true&&report?.latestFiling?.sourceType==='issuer-audited-annual-report'&&
   report.latestFiling.periodEnd===report.annualReport.periodEnd&&
   report.annualReport.sourceUrl===url&&/^https:\/\//.test(url))return 'issuer-pdf';
 if(status==='metrics-complete'&&/^https:\/\/filings\.xbrl\.org\//.test(url))return 'esef';
 if(status==='metrics-complete'&&/^https:\/\/data\.sec\.gov\//.test(url))return 'sec';
 return 'unverified';
}
function unityFinancialFact(report,key,prior=false){
 const period=prior?report?.priorFiling?.periodEnd:report?.latestFiling?.periodEnd;
 const fact=(prior?report?.priorMetrics:report?.metrics)?.[key];
 const currency=String(report?.reportCurrency||'').toUpperCase();
 const value=unityFinancialNumber(fact?.value);
 if(!period||!fact||fact.periodEnd!==period||fact.currency!==currency||!currency||value===null)return null;
 const kind=unityFinancialSourceKind(report);
 const issuerSource=String(fact.sourceUrl||'');
 const reportSource=String(report?.latestFiling?.reportUrl||'');
 const sameHost=host=>{
   try{return new URL(issuerSource).hostname===host&&new URL(reportSource).hostname===host}
   catch(_){return false}
 };
 if(kind==='issuer-pdf'&&
   (issuerSource!==reportSource||fact.sourceType!=='issuer-audited-annual-report'))return null;
 if(kind==='sec'&&
   (issuerSource!==reportSource||!String(fact.concept||'').startsWith('us-gaap:')))return null;
 if(kind==='esef'&&!sameHost('filings.xbrl.org'))return null;
 return value;
}
function unityFinancialRatio(n,d){
 return n!==null&&d!==null&&d>0?Math.round(10000*n/d)/100:null;
}
function unityFinancialRate(from,to,rateLookup){
 if(!from||!to)return null;
 if(from===to)return {value:1,date:'',source:'Gleiche Währung'};
 if(typeof rateLookup!=='function')return null;
 const a=rateLookup(from),b=rateLookup(to);
 if(!a||!b)return null;
 const av=unityFinancialNumber(a.rate),bv=unityFinancialNumber(b.rate);
 if(av===null||bv===null||av<=0||bv<=0)return null;
 const dateA=from==='EUR'?'':String(a.date||''),dateB=to==='EUR'?'':String(b.date||'');
 // Cross-FX must never combine different official ECB reference days.
 if(dateA&&dateB&&dateA!==dateB)return null;
 const stamp=dateA||dateB;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(stamp))return null;
 const age=(Date.now()-Date.parse(stamp+'T12:00:00Z'))/86400000;
 if(age < -1||age > 5.5)return null;
 return {value:av/bv,date:stamp,source:'EZB-Referenzkurs; indikativ, nicht handelbar'};
}
function unityFinancialStockSnapshot(s,options={}){
 const report=options.report===undefined?
   (typeof unityFundPilotItem==='function'?unityFundPilotItem(s):null):options.report;
 const quote=options.quote===undefined?
   (typeof unityHomeQuote==='function'?unityHomeQuote(s):null):options.quote;
 const fxLookup=options.fxLookup===undefined?
   (typeof unityEuroRate==='function'?unityEuroRate:null):options.fxLookup;
 const issuer={id:String(s?.id||''),isin:String(s?.isin||''),ticker:String(s?.ticker||''),
   name:String(s?.name||''),exchange:String(s?.exchange||''),currency:String(s?.currency||'').toUpperCase()};
 const kind=unityFinancialSourceKind(report);
 const period=String(report?.latestFiling?.periodEnd||'');
 const priorPeriod=String(report?.priorFiling?.periodEnd||'');
 const currency=String(report?.reportCurrency||'').toUpperCase();
 const fields={};
 for(const key of UNITY_FINANCIAL_CORE)fields[key]=kind==='unverified'?null:unityFinancialFact(report,key);
 const coreComplete=kind!=='unverified'&&UNITY_FINANCIAL_CORE.every(k=>fields[k]!==null)&&
   fields.revenue>0&&fields.assets>0&&fields.equity>0&&fields.equity<=fields.assets;
 const value=(key,prior=false)=>kind==='unverified'?null:unityFinancialFact(report,key,prior);
 const metrics={
  netMargin:unityFinancialRatio(fields.netIncome,fields.revenue),
  equityRatio:unityFinancialRatio(fields.equity,fields.assets),
  operatingCashFlowMargin:unityFinancialRatio(fields.operatingCashFlow,fields.revenue),
  cashConversion:fields.netIncome!==null&&fields.netIncome>0&&fields.operatingCashFlow!==null?
    Math.round(10000*fields.operatingCashFlow/fields.netIncome)/100:null,
  revenueGrowth:null,netIncomeGrowth:null
 };
 const comparable=coreComplete&&unityFinancialPeriodDays(period,priorPeriod)>=330&&
   unityFinancialPeriodDays(period,priorPeriod)<=400;
 if(comparable)for(const [name,metric] of [['revenueGrowth','revenue'],['netIncomeGrowth','netIncome']]){
   const current=value(metric),previous=value(metric,true);
   if(current!==null&&previous!==null&&previous>0)
     metrics[name]=Math.round(10000*(current/previous-1))/100;
 }
 const q=quote?.x||null;
 const quality=quote?.quality;
 const quoteValid=!!q&&quote?.valid===true&&quality?.canCompare===true&&
   String(q.currency||'').toUpperCase()===issuer.currency&&
   String(q.exchange||'').trim()!==''&&unityFinancialNumber(q.price)>0;
 const exchange=quoteValid?unityFinancialRate(issuer.currency,currency,fxLookup):null;
 const converted=quoteValid&&exchange?Number(q.price)*exchange.value:null;
 const eps=value('epsDiluted');
 const epsOk=eps!==null&&eps>0&&
   String(report?.metrics?.epsDiluted?.unit||'').endsWith('/shares')&&
   String(report?.metrics?.epsDiluted?.currency||'').toUpperCase()===currency;
 const pe=converted!==null&&epsOk?Math.round(100*converted/eps)/100:null;
 // Strict point-in-time shares outstanding are required for book valuation.
 // Weighted-average diluted shares would give a misleading price/book ratio.
 const shares=value('sharesOutstanding');
 const sharesOk=shares!==null&&shares>0&&report?.metrics?.sharesOutstanding?.unit==='shares';
 const pb=converted!==null&&sharesOk&&fields.equity!==null&&fields.equity>0?
   Math.round(100*converted/(fields.equity/shares))/100:null;
 const capex=value('capitalExpenditure');
 const fcf=coreComplete&&capex!==null&&capex>=0?fields.operatingCashFlow-capex:null;
 const fcfYield=converted!==null&&sharesOk&&fcf!==null?
   Math.round(10000*fcf/(converted*shares))/100:null;
 const missing=[];
 if(!coreComplete)missing.push('Fünf geprüfte Konzernkennzahlen');
 if(coreComplete&&!comparable)missing.push('Vergleichbare Vorjahreszahlen (2024/2025)');
 if(!quoteValid)missing.push('Gültiger Börsenkurs mit geprüfter Referenz');
 else if(!exchange)missing.push('Aktueller, datumsgleicher EUR-Wechselkurs für Kurs/Bericht');
 if(!epsOk)missing.push('Verwässerter Gewinn je Aktie aus Konzernbericht');
 if(!sharesOk)missing.push('Stichtagsbezogene ausstehende Aktienzahl');
 if(fcf===null)missing.push('Investitionsausgaben für Free Cashflow');
 return {schemaVersion:1,kind:'unity-company-fundamentals',
   instrument:issuer,sourceKind:kind,sourceUrl:String(report?.latestFiling?.reportUrl||''),
   period,priorPeriod,reportCurrency:currency,coreComplete,
   core:fields,priorComparable:comparable&&metrics.revenueGrowth!==null,
   ratios:metrics,quoteCurrency:issuer.currency,
   priceRef:quoteValid?{price:Number(q.price),date:String(q.date||''),exchange:String(q.exchange)}:null,
   quoteInReportCurrency:converted,fx:exchange,
   valuation:{pe,pb,freeCashFlow:fcf,freeCashFlowYield:fcfYield},
   missing,tradeApproved:false};
}
function unityFinancialMasterDataset(list){
 const selected=Array.isArray(list)?list:typeof stocks==='function'?stocks():[];
 const equities=selected.filter(s=>!(typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(s)));
 const records=equities.map(s=>unityFinancialStockSnapshot(s));
 return {schemaVersion:1,kind:'unity-company-master-financials',
   total:records.length,
   counts:{coreComplete:records.filter(r=>r.coreComplete).length,
     priorComparable:records.filter(r=>r.priorComparable).length,
     currencyConvertible:records.filter(r=>r.quoteInReportCurrency!==null).length},
   records};
}
function unityFinancialSnapshotPanel(s){
 const m=unityFinancialStockSnapshot(s);
 const labels={netMargin:'Nettomarge',equityRatio:'Eigenkapitalquote',
   operatingCashFlowMargin:'Operative Cashflow-Marge',cashConversion:'Cashflow / Gewinn',
   revenueGrowth:'Umsatz gegenüber Vorjahr',netIncomeGrowth:'Gewinn gegenüber Vorjahr'};
 let h='<h4>Einheitliche Finanzkennzahlen · UNITY</h4>';
 if(!m.coreComplete)return h+'<p class="tiny muted">Noch keine fünf geprüften Konzernwerte verfügbar. Keine Ableitung aus Pressemitteilungen.</p>';
 for(const [key,label] of Object.entries(labels)){
  const n=m.ratios[key];
  h+='<div class="home-data-row"><span>'+esc(label)+'</span><b>'+
    (n===null?'Nicht belastbar verfügbar':
     new Intl.NumberFormat('de-DE',{maximumFractionDigits:2,minimumFractionDigits:1}).format(n)+' %')+
    '</b><small>'+(key.endsWith('Growth')?'Nur bei belegtem vergleichbarem Vorjahr':'Aus denselben geprüften Konzernzahlen')+'</small></div>';
 }
 h+='<h4>Währung, Kurs und Bewertung</h4>';
 if(m.priceRef&&m.fx){
  h+='<p class="tiny muted">Referenzkurs '+esc(m.priceRef.date)+' · '+
    esc(m.priceRef.exchange)+' · '+esc(m.priceRef.price)+' '+esc(m.quoteCurrency)+
    ' ≈ '+esc(new Intl.NumberFormat('de-DE',{maximumFractionDigits:3}).format(m.quoteInReportCurrency))+
    ' '+esc(m.reportCurrency)+
    (m.fx.date?' · EZB '+esc(m.fx.date):'')+
    '. Indikativer Vergleich, kein ausführbarer Wechselkurs.</p>';
 }else{
  h+='<p class="tiny muted">Bewertungskurs in Berichtswährung nicht zuverlässig verfügbar. Kurs/FX muss geprüft werden.</p>';
 }
 for(const [label,value,suffix] of [
   ['KGV aus geprüfter EPS',m.valuation.pe,''],
   ['KBV mit stichtagsbezogener Aktienzahl',m.valuation.pb,''],
   ['Free-Cashflow-Rendite',m.valuation.freeCashFlowYield,' %']]){
   h+='<div class="home-data-row"><span>'+esc(label)+'</span><b>'+
      (value===null?'Nicht berechenbar':new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(value)+suffix)+
      '</b></div>';
 }
 h+='<p class="tiny muted">Fehlende Nachweise: '+esc(m.missing.join(' · ')||'Keine in diesem Kennzahlensatz')+
   '. Fairer Unternehmenswert, Sicherheitsmarge und Kaufzone sind hier nicht geschätzt; keine Handelsfreigabe.</p>';
 return h;
}
