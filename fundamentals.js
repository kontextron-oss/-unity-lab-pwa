'use strict';
/* Official-report metadata and strictly checked financial facts for the
 * four-company European pilot. This module never grants trade permission. */
let unityFundPilot=null,unitySecFundamentals=null,unityFundPilotError='',unityFundPilotLoading=false;
const unityFundPilotUrl='./data/fundamentals.json',unitySecFundamentalsUrl='./data/sec-fundamentals.json';
const unityFundPilotNames={revenue:'Umsatz',netIncome:'Jahresüberschuss',assets:'Bilanzsumme',equity:'Eigenkapital',operatingCashFlow:'Operativer Cashflow'};
async function unityLoadFundPilot(){
 if(unityFundPilotLoading)return;
 unityFundPilotLoading=true;
 try{
  const load=async url=>{const response=await fetch(url+'?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(data.schemaVersion!==1||!data.items||typeof data.items!=='object')throw Error('Unbekanntes Berichtsformat');return data};
  const [europe,sec]=await Promise.allSettled([load(unityFundPilotUrl),load(unitySecFundamentalsUrl)]);
  unityFundPilot=europe.status==='fulfilled'?europe.value:null;
  unitySecFundamentals=sec.status==='fulfilled'?sec.value:null;
  unityFundPilotError=[europe,sec].filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason)).join(' · ');
 }catch(e){unityFundPilotError=String(e.message||e)}
 finally{unityFundPilotLoading=false;if(typeof render==='function'&&typeof db!=='undefined'&&db)render()}
}
function unityFundPilotItem(s){
 const european=unityFundPilot?.items?.[s?.isin];
 if(european&&european.isin===s?.isin)return european;
 const symbol=String(s?.providerSymbol||s?.ticker||'').toUpperCase();
 const sec=unitySecFundamentals?.items?.[symbol];
 if(sec&&String(sec.ticker||'').toUpperCase()===symbol)return sec;
 return null;
}
// Source-bound annual-report multiples. These are descriptive valuation
// ratios, not a fair-value model or a buy signal.
function unityFundValuation(s, referencePrice){
 const item=unityFundPilotItem(s),period=String(item?.latestFiling?.periodEnd||'');
 const age=Date.parse(period+'T12:00:00Z');
 const fresh=Number.isFinite(age)&&age<=Date.now()&&Date.now()-age<=550*86400000;
 const metric=key=>Number(item?.metrics?.[key]?.value);
 const samePeriod=key=>item?.metrics?.[key]?.periodEnd===period;
 const price=Number(referencePrice),eps=metric('epsDiluted'),shares=metric('sharesDiluted'),equity=metric('equity');
 const fcf=Number(item?.derived?.freeCashFlow?.value);
 const fcfValid=item?.derived?.freeCashFlow?.kind==='derived'&&item?.derived?.freeCashFlow?.periodEnd===period;
 const priceOk=Number.isFinite(price)&&price>0&&fresh;
 const epsOk=priceOk&&samePeriod('epsDiluted')&&Number.isFinite(eps)&&eps>0;
 const sharesOk=priceOk&&samePeriod('sharesDiluted')&&Number.isFinite(shares)&&shares>0;
 const equityOk=sharesOk&&samePeriod('equity')&&Number.isFinite(equity)&&equity>0;
 const fcfOk=sharesOk&&fcfValid&&Number.isFinite(fcf)&&fcf>0;
 const missing=[];
 if(!fresh)missing.push('aktueller geprüfter Jahresbericht');
 if(!priceOk)missing.push('plausibler Referenzkurs');
 if(!epsOk)missing.push('verwässerter Gewinn je Aktie');
 if(!sharesOk)missing.push('verwässerte Aktienzahl');
 if(!fcfOk)missing.push('Cashflow und Investitionsausgaben');
 return {item,period,price,pe:epsOk?price/eps:NaN,pb:equityOk?price/(equity/shares):NaN,
  fcfYield:fcfOk?fcf/(shares*price)*100:NaN,available:[epsOk,equityOk,fcfOk].filter(Boolean).length,
  missing};
}
// A decision source must belong to this issuer's IR domain, or to an explicitly
// whitelisted issuer disclosure host in its own record. No cross-company reuse.
function unityFundEvidenceSourceAllowed(item,url){
 try{
  const source=new URL(String(url||'')),ir=new URL(String(item?.investorRelations||''));
  if(source.protocol!=='https:')return false;
  const extra=Array.isArray(item?.decisionEvidence?.sourceHosts)?item.decisionEvidence.sourceHosts:[];
  const allowed=new Set([ir.hostname,...extra].map(x=>String(x||'').toLowerCase()));
  return allowed.has(source.hostname.toLowerCase());
 }catch(_){return false}
}
function unityFundPilotPanel(s){
 const item=unityFundPilotItem(s);
 if(!item)return '';
 let h='<section class="home-security-data unity-fund-pilot"><h3>Unternehmenszahlen · geprüfte Berichtsquellen</h3>';
 if(!item){
  h+='<p class="tiny muted">Der automatische Abruf der Unternehmensberichte ist '+(unityFundPilotLoading?'noch nicht abgeschlossen.':unityFundPilotError?'nicht erreichbar ('+esc(unityFundPilotError)+').':'noch nicht verfügbar.')+'</p>';
 }else{
  const status={
   'no-esef-route':'Für dieses Unternehmen ist keine geeignete ESEF-Abfrage hinterlegt.',
   'issuer-release-only':'Offizielle Unternehmensmeldung verfügbar; vollständige ESEF-Konzernzahlen fehlen.',
   'no-filing-found':'Im öffentlichen ESEF-Archiv wurde kein passender Bericht gefunden.',
   'filing-found':'Ein Bericht wurde gefunden; Zahlen konnten noch nicht geprüft werden.',
   'filing-no-validated-metrics':'Ein Bericht wurde gefunden, aber keine Kennzahlen erfüllen die strengen Prüfregeln.',
   'metrics-partial':'Einzelne Berichtskennzahlen konnten eindeutig zugeordnet werden.',
   'metrics-complete':'Fünf zentrale Jahreskennzahlen wurden direkt aus einer geprüften Berichtsquelle zugeordnet.',
   'source-unavailable':'Die Quelle war beim letzten automatischen Abruf nicht erreichbar.',
   'stale-previous':'Die Quelle ist derzeit nicht erreichbar. Der zuletzt gespeicherte Bericht kann veraltet sein.'
  };
  h+='<p><b>Datenstatus:</b> '+esc(status[item.status]||'Datenlage noch offen')+'</p>';
  if(item.latestFiling){
   const report=item.latestFiling;
   h+='<p class="tiny muted">Geschäftsjahresende: '+esc(report.periodEnd||'unbekannt')+
     (report.published?' · Veröffentlichung: '+esc(String(report.published).slice(0,10)):'')+'</p>';
   if(report.reportUrl)h+='<p><a href="'+esc(report.reportUrl)+'" target="_blank" rel="noopener noreferrer">Originalbericht / SEC-Datensatz ansehen</a></p>';
  }
  const official=item.officialHighlights;
  if(official&&['issuer-press-release','issuer-primary-disclosure'].includes(official.sourceType)){
    h+='<h4>Offizielle Unternehmensmeldung · Geschäftsjahr '+esc(official.fiscalYear)+'</h4>';
    if(official.stale)h+='<p class="tiny muted">Achtung: Die letzte automatische Quellenprüfung ist fehlgeschlagen. Dies ist ein älterer geprüfter Datenstand.</p>';
    const officialFacts=Object.values(official.facts||{});
    for(const fact of officialFacts){
      if(fact.kind!=='issuer-release'||fact.currency!==official.currency||fact.periodEnd!==official.fiscalYear||
         !Number.isFinite(Number(fact.value))||Number(fact.value)<=0)continue;
      h+='<div class="home-data-row"><span>'+esc(fact.label)+'</span><b>'+
        new Intl.NumberFormat('de-DE',{style:'currency',currency:fact.currency,maximumFractionDigits:0}).format(Number(fact.value))+
        '</b><small>Unternehmensmeldung '+esc(official.fiscalYear)+' · '+esc(fact.currency)+'</small></div>';
    }
    if(official.sourceUrl&&/^https:\/\//.test(official.sourceUrl))
      h+='<p><a href="'+esc(official.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Originalmeldung des Unternehmens lesen</a></p>';
    h+='<p class="tiny muted">Kennzahlen aus Unternehmensmeldungen sind nicht zwingend direkt mit geprüften Konzernabschlüssen vergleichbar. Insbesondere bereinigter Free Cashflow, operativer Cashflow und Free Cashflow vor Steuern sind unterschiedliche Größen.</p>';
  }
  if(item.latestFiling)for(const [key,label] of Object.entries(unityFundPilotNames)){
   const fact=item.metrics?.[key];
   let value='Nicht zuverlässig verfügbar',help='Keine geprüfte Angabe';
   if(fact&&Number.isFinite(Number(fact.value))&&fact.currency===item.reportCurrency&&fact.periodEnd===item.latestFiling?.periodEnd){
     value=new Intl.NumberFormat('de-DE',{style:'currency',currency:fact.currency,maximumFractionDigits:0}).format(Number(fact.value));
     help='Geschäftsjahr '+fact.periodEnd+' · '+fact.concept;
   }
   h+='<div class="home-data-row"><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(help)+'</small></div>';
  }
  const growth=item.derived?.revenueGrowth?.value,earnings=item.derived?.netIncomeGrowth?.value;
  if(Number.isFinite(growth)&&Number.isFinite(earnings)&&item.derived?.revenueGrowth?.periodEnd===item.latestFiling?.periodEnd){
    const revenueText=growth>0?'Umsatz gestiegen':growth<0?'Umsatz gesunken':'Umsatz unverändert';
    const earningsText=earnings>0?'Jahresüberschuss gestiegen':earnings<0?'Jahresüberschuss gesunken':'Jahresüberschuss unverändert';
    h+='<p class="unity-fund-brief"><b>Automatischer Berichtsvergleich:</b> '+revenueText+', '+earningsText+
      '. Gründe, Sondereffekte und Prognosen sind damit noch nicht geprüft. Keine Kaufentscheidung.</p>';
  }
  const ratios=[['revenueGrowth','Umsatzwachstum gegenüber Vorjahr'],['netIncomeGrowth','Gewinnveränderung gegenüber Vorjahr'],
    ['netMargin','Nettomarge'],['equityRatio','Eigenkapitalquote'],['operatingCashFlowMargin','Operative Cashflow-Marge']];
  if(item.latestFiling)for(const [key,label] of ratios){
    const r=item.derived?.[key];
    const valid=r&&r.unit==='percent'&&Number.isFinite(Number(r.value))&&r.periodEnd===item.latestFiling?.periodEnd&&
      (!r.priorPeriodEnd||r.priorPeriodEnd===item.priorFiling?.periodEnd);
    h+='<div class="home-data-row"><span>'+esc(label)+'</span><b>'+
      (valid?new Intl.NumberFormat('de-DE',{minimumFractionDigits:1,maximumFractionDigits:2,signDisplay:key.endsWith('Growth')?'exceptZero':'auto'}).format(Number(r.value))+' %':'Nicht berechenbar')+
      '</b><small>'+(valid?'Aus geprüften Berichtskennzahlen berechnet':'Keine ausreichend vergleichbaren Geschäftsjahre')+'</small></div>';
  }
  const quote=typeof unityMarketForStock==='function'?unityMarketForStock(s):null;
  const valuation=unityFundValuation(s,quote?.price);
  h+='<h4>Bewertungskennzahlen · Abschluss + Referenzkurs</h4>';
  if(valuation.available){
   const rows=[['Kurs-Gewinn-Verhältnis (KGV)',valuation.pe],['Kurs-Buchwert-Verhältnis (KBV)',valuation.pb],['Free-Cashflow-Rendite',valuation.fcfYield]];
   for(const [label,value] of rows)if(Number.isFinite(value)){
     const suffix=label.includes('Rendite')?' %':'';
     h+='<div class="home-data-row"><span>'+esc(label)+'</span><b>'+esc(unityNumber?unityNumber(value,2):Number(value).toFixed(2))+suffix+'</b><small>Jahresabschluss '+esc(valuation.period)+' + verfügbarer Referenzkurs</small></div>';
   }
   h+='<p class="tiny muted">Multiplikatoren beschreiben die aktuelle Kombination aus Abschluss und Kurs. Sie bestimmen keinen inneren Wert und sind keine Kaufempfehlung.</p>';
  }else h+='<p class="tiny muted">Bewertung noch offen: '+esc(valuation.missing.join(', '))+'. Fehlende Werte werden nicht geschätzt.</p>';
  h+='<p class="tiny muted">Letzte Quellenprüfung: '+esc(item.checkedAt||'unbekannt')+' · '+esc(item.source||'ESEF')+'</p>';
  const decisionEvidence=item.decisionEvidence;
  if(decisionEvidence){
    const evidenceRows=[
      ['Fundamentaldaten',decisionEvidence.fundamentals?.verified,decisionEvidence.fundamentals?.label,decisionEvidence.fundamentals?.periodEnd,decisionEvidence.fundamentals?.sourceUrl],
      ['Nächster Ergebnisbericht',decisionEvidence.earnings?.confirmed,decisionEvidence.earnings?.label,decisionEvidence.earnings?.date,decisionEvidence.earnings?.sourceUrl],
      ['Guidance',decisionEvidence.guidance?.verified,decisionEvidence.guidance?.label,decisionEvidence.guidance?.asOf,decisionEvidence.guidance?.sourceUrl]
    ];
    h+='<h4>Datierte Entscheidungsbelege</h4><div class="unity-issuer-events">';
    for(const [label,ok,detail,date,url] of evidenceRows){
      const safeUrl=unityFundEvidenceSourceAllowed(item,url)?url:'';
      h+='<div class="unity-issuer-event"><span><strong>'+esc(label)+'</strong><small>'+
        esc(ok?'✓ belegt':'○ offen')+(date?' · '+esc(date):'')+(detail?' · '+esc(detail):'')+
        '</small></span>'+(safeUrl?'<a href="'+esc(safeUrl)+'" target="_blank" rel="noopener noreferrer">Original öffnen</a>':'')+'</div>';
    }
    h+='</div><p class="tiny muted">Der bestätigte Ergebnisbericht ist ein Ereignisrisiko, keine positive Kursprognose. Guidance ist eine Unternehmensprognose und keine unabhängige Bestätigung.</p>';
  }
  if(item.investorRelations&&/^https:\/\//.test(item.investorRelations))
   h+='<p><a href="'+esc(item.investorRelations)+'" target="_blank" rel="noopener noreferrer">Offizielle Investor-Relations-Seite öffnen</a></p>';
  if(item.note)h+='<p class="tiny muted">'+esc(item.note)+'</p>';
 }
 h+='<p class="tiny muted">Dies sind historische Berichts- und Meldungsdaten, keine aktuellen Quartalsprognosen. Fehlende Zahlen werden nicht geschätzt. Es entsteht daraus keine Kauf- oder Verkaufsfreigabe.</p></section>';
 return h;
}
unityLoadFundPilot();
