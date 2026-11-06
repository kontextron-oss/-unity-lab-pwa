'use strict';
/* UNITY 0.16.1 – prospective observation radar.
 * Registered official management forecasts precede measured outcomes.
 * No guessed earnings calendar, no stock-price prediction, no order approval.
 * Public reference-only dataset; the user's personal financial data stay local. */
let unityForesightData=null,unityForesightError='',unityForesightLoading=false;
let unityForesightOutcomes=null,unityForesightAuditError='';
const UNITY_FORESIGHT_METRICS={
 revenue:{label:'Konzernumsatz',unit:'USD',concept:'RevenueFromContractWithCustomerExcludingAssessedTax'},
 epsDiluted:{label:'Verwässerter GAAP-Gewinn je Aktie',unit:'USD/shares',concept:'EarningsPerShareDiluted'}
};
function unityForesightDay(v){
 const s=String(v||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+'T12:00:00Z')))return '';
 return s;
}
function unityForesightValidDateAfter(a,b){return !!unityForesightDay(a)&&!!unityForesightDay(b)&&a>b}
function unityForesightFinite(v){return typeof v==='number'&&Number.isFinite(v)}
function unityForesightPercent(a,b){
 return unityForesightFinite(a)&&unityForesightFinite(b)&&b>0?
   Math.round(10000*(a/b-1))/100:null;
}
function unityForesightSourceUrl(s){
 try{const u=new URL(String(s||''));return u.protocol==='https:'&&
   ['www.eaton.com','investors.vertiv.com'].includes(u.hostname)?u.href:''}
 catch(_){return ''}
}
function unityForesightValidatedCheckpoint(c){
 const metric=UNITY_FORESIGHT_METRICS[c?.metric];
 if(!c||!metric||!c.isin||typeof c.id!=='string'||c.id.length>128||
   c.unit!==metric.unit||c.basis!=='US-GAAP'||c.sourceType!=='official-issuer-2026-management-guidance'||
   c.fiscalYear!==2026||c.periodEnd!=='2026-12-31'||
   !unityForesightValidDateAfter(c.recordedAt,c.sourcePublishedAt)||
   !unityForesightValidDateAfter(c.periodEnd,c.recordedAt)||!unityForesightSourceUrl(c.sourceUrl))return false;
 const f=c.forecast;
 if(f?.kind==='range')return unityForesightFinite(f.low)&&unityForesightFinite(f.high)&&f.low>0&&f.high>=f.low;
 if(f?.kind==='point')return unityForesightFinite(f.value)&&f.value>0;
 return false;
}
async function unityForesightLoad(){
 if(unityForesightLoading||unityForesightData)return;
 unityForesightLoading=true;
 try{
  // Cacheable URL allows offline-first service worker to serve this public record.
  const r=await fetch('./data/foresight-checkpoints.json',{cache:'default',credentials:'omit'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const o=await r.json();
  if(o?.schemaVersion!==1||!Array.isArray(o.checkpoints)||
     o.checkpoints.some(x=>!unityForesightValidatedCheckpoint(x))||
     new Set(o.checkpoints.map(x=>x.id)).size!==o.checkpoints.length)
    throw Error('Vorausschau-Protokoll: ungültige oder widersprüchliche Quelldaten');
  unityForesightData=o;
  unityForesightError='';
  try{
   // Network-first for automated new SEC results; separate immutable
   // cache key remains available offline on iPhone through the service worker.
   let res;
   try{
    res=await fetch('./data/foresight-outcomes.json?t='+Date.now(),
      {cache:'no-store',credentials:'omit'});
    if(!res.ok)throw Error('HTTP '+res.status);
   }catch(_){
    res=await fetch('./data/foresight-outcomes.json',{cache:'default',credentials:'omit'});
    if(!res.ok)throw Error('Offline-Audit nicht verfügbar');
   }
   const audit=await res.json();
   if(audit?.schemaVersion!==1||!audit.entries||
      typeof audit.entries!=='object'||Array.isArray(audit.entries))
     throw Error('Ungültiges SEC-Prüfprotokoll');
   unityForesightOutcomes=audit;
   unityForesightAuditError='';
  }catch(e){
   unityForesightAuditError=String(e?.message||e);
   unityForesightOutcomes=null;
  }
 }catch(e){unityForesightError=String(e?.message||e)}
 finally{
  unityForesightLoading=false;
  if(typeof render==='function'&&typeof db!=='undefined'&&db)render();
 }
}
function unityForesightReport(stock,report){
 const raw=report===undefined?
   (typeof unityFundPilotItem==='function'?unityFundPilotItem(stock):null):report;
 if(!raw||raw.isin!==stock?.isin||raw.status!=='metrics-complete'||
   raw.reportCurrency!=='USD'||!/^https:\/\/data\.sec\.gov\/api\/xbrl\/companyfacts\/CIK\d{10}\.json$/.test(
    String(raw.latestFiling?.reportUrl||'')))return null;
 return raw;
}
function unityForesightFiledMetric(report,metric,period){
 const schema=UNITY_FORESIGHT_METRICS[metric],f=report?.metrics?.[metric];
 if(!schema||report.latestFiling?.periodEnd!==period||!f||
   f.periodEnd!==period||f.unit!==schema.unit||f.currency!=='USD'||
   f.sourceUrl!==report.latestFiling.reportUrl||
   f.concept!=='us-gaap:'+schema.concept||!unityForesightFinite(f.value)||f.value<=0)
   return null;
 return {value:f.value,unit:f.unit,filedAt:unityForesightDay(f.filed),sourceUrl:f.sourceUrl};
}
function unityForesightCompare(stock,checkpoint,report){
 if(!unityForesightValidatedCheckpoint(checkpoint)||stock?.isin!==checkpoint.isin)
  return {status:'invalid',value:null,sourceUrl:null,errorPercent:null};
 const resolved=unityForesightReport(stock,report);
 const actual=resolved&&unityForesightFiledMetric(resolved,checkpoint.metric,checkpoint.periodEnd);
 if(!actual||!actual.filedAt||!unityForesightValidDateAfter(actual.filedAt,checkpoint.recordedAt)||
    actual.filedAt<checkpoint.periodEnd)
  return {status:'awaiting-audited-FY2026',value:null,sourceUrl:null,errorPercent:null};
 const f=checkpoint.forecast,base=f.kind==='range'?(f.low+f.high)/2:f.value;
 const error=unityForesightPercent(actual.value,base);
 return {status:f.kind==='point'?'point-deviation':
    actual.value<f.low?'below-guidance':actual.value>f.high?'above-guidance':'within-guidance',
   value:actual.value,sourceUrl:actual.sourceUrl,filedAt:actual.filedAt,
   errorPercent:error,rangeKind:f.kind,recordedAt:checkpoint.recordedAt};
}
function unityForesight2025Baseline(report,metric){
 if(!report)return null;
 if(report.latestFiling?.periodEnd==='2025-12-31')
  return unityForesightFiledMetric(report,metric,'2025-12-31');
 // Keep the old FY2025 base after FY2026 becomes the latest audited filing.
 // Do not accidentally compare FY2026 guidance against FY2026 actual.
 if(report.priorFiling?.periodEnd!=='2025-12-31')return null;
 const prior={...report,
  latestFiling:{...report.latestFiling,periodEnd:'2025-12-31'},
  metrics:report.priorMetrics||{}};
 return unityForesightFiledMetric(prior,metric,'2025-12-31');
}
function unityForesightAuditedResult(checkpoint,doc=unityForesightOutcomes){
 const entry=doc?.entries?.[checkpoint?.id];
 if(!entry||entry.id!==checkpoint.id||entry.isin!==checkpoint.isin||
   entry.metric!==checkpoint.metric||entry.periodEnd!==checkpoint.periodEnd||
   entry.recordedAt!==checkpoint.recordedAt||
   entry.guidanceSourceUrl!==checkpoint.sourceUrl||
   JSON.stringify(entry.forecast)!==JSON.stringify(checkpoint.forecast)||
   !['verified','verified-previous-source-unavailable','revision-review'].includes(entry.status))
  return null;
 const verified=entry.verified;
 if(!verified||verified.unit!==checkpoint.unit||
   verified.periodEnd!==checkpoint.periodEnd||
   verified.concept!=='us-gaap:'+UNITY_FORESIGHT_METRICS[checkpoint.metric].concept||
   !/^https:\/\/data\.sec\.gov\/api\/xbrl\/companyfacts\/CIK\d{10}\.json$/.test(String(verified.sourceUrl||''))||
   !unityForesightFinite(verified.value)||verified.value<=0||
   !unityForesightValidDateAfter(verified.filedAt,checkpoint.recordedAt)||
   verified.filedAt<checkpoint.periodEnd)return null;
 return {status:verified.category,value:verified.value,
   sourceUrl:verified.sourceUrl,filedAt:verified.filedAt,
   errorPercent:verified.errorPercent,rangeKind:checkpoint.forecast.kind,
   recordedAt:checkpoint.recordedAt,
   auditStatus:entry.status,observedCandidate:entry.observedCandidate};
}
function unityForesightPriority(snapshot){
 const reviews=snapshot.checkpoints.filter(c=>c.measurement?.auditStatus==='revision-review');
 if(reviews.length)return {rank:0,key:'review',label:'Abweichung prüfen',
   reason:'Eine spätere SEC-Korrektur widerspricht einem bereits festgehaltenen Istwert. Keine automatische Ersetzung.',
   trigger:'Jahreswert und SEC-Änderungsmitteilung abgleichen',sourceUrl:reviews[0].measurement.sourceUrl};
 if(snapshot.calendar?.confirmed&&snapshot.calendar.daysUntil<=14)
  return {rank:1,key:'earnings',label:'Ereignis bevorstehend',
   reason:'Offiziell bestätigter Ergebnisbericht in '+snapshot.calendar.daysUntil+' Tagen.',
   trigger:'Am '+snapshot.calendar.date+' neue Guidance und Ergebnisrisiko prüfen',
   sourceUrl:snapshot.calendar.sourceUrl};
 if(snapshot.checkpoints.some(c=>c.measurement?.auditStatus==='verified'))
  return {rank:2,key:'audit',label:'Ergebnisabgleich verfügbar',
   reason:'Ein vorab protokolliertes Prognoseziel ist anhand neuer Konzernzahlen überprüft.',
   trigger:'Prognoseabweichungen und Quellen prüfen',
   sourceUrl:snapshot.checkpoints.find(c=>c.measurement?.auditStatus==='verified')?.measurement?.sourceUrl};
 if(snapshot.expectations.impliedFiveYearFcfGrowthAt10Pct!==null&&
    snapshot.expectations.impliedFiveYearFcfGrowthAt10Pct>=25)
  return {rank:3,key:'expectations',label:'Markterwartung prüfen',
   reason:'Der aktuelle Kurs unterstellt in einem offengelegten Modell mindestens 25 % jährlichen FCF-Zuwachs.',
   trigger:'Auftragsentwicklung, Guidance und Bewertung erneut abgleichen',
   sourceUrl:snapshot.guidanceSource};
 if(snapshot.checkpoints.length)
  return {rank:4,key:'monitor',label:'Prognose im Blick',
   reason:'Quellengebundene Unternehmensprognose wurde vor dem Jahresergebnis festgehalten.',
   trigger:snapshot.nextCheck,sourceUrl:snapshot.guidanceSource};
 return {rank:5,key:'sources',label:'Quellen fehlen',
   reason:'Keine vergleichbare quantitative Unternehmensprognose protokolliert.',
   trigger:'Nächste offizielle Guidance oder bestätigten Earnings-Termin prüfen',
   sourceUrl:snapshot.guidanceSource};
}
function unityForesightCalendar(stock){
 const item=typeof unityIssuerCalendarItem==='function'?unityIssuerCalendarItem(stock):null;
 const fresh=typeof unityIssuerCalendarFresh==='function'&&unityIssuerCalendarFresh();
 const due=unityForesightDay(item?.nextEarnings);
 const days=due?Math.ceil((Date.parse(due+'T12:00:00Z')-Date.now())/86400000):null;
 if(fresh&&item?.status==='confirmed-future-earnings'&&days!==null&&days>=0&&days<=365&&
    /^https:\/\//.test(item.sourceUrl||''))
  return {confirmed:true,date:due,daysUntil:days,sourceUrl:item.sourceUrl};
 return {confirmed:false,date:null,daysUntil:null,sourceUrl:null};
}
function unityForesightSnapshot(stock,options={}){
 const report=unityForesightReport(stock,options.report);
 const guidance=options.guidance===undefined?
   (typeof unityGuidanceEvidence==='function'?unityGuidanceEvidence(stock):null):options.guidance;
 const validGuidance=guidance&&typeof unityGuidanceEvidence==='function'?
   unityGuidanceEvidence(stock,{[stock?.isin]:guidance}):null;
 const checkpoints=(options.checkpoints===undefined?unityForesightData?.checkpoints:options.checkpoints)||[];
 const related=checkpoints.filter(c=>c.isin===stock?.isin&&unityForesightValidatedCheckpoint(c));
 const calendar=options.calendar===undefined?unityForesightCalendar(stock):options.calendar;
 const reverse=options.reverse===undefined?
   (typeof unityReverseValuation==='function'?unityReverseValuation(stock):null):options.reverse;
 // 2025 is a historical baseline even after a genuine FY2026 filing arrives.
 const evaluations=related.map(c=>{
  const current=unityForesight2025Baseline(report,c.metric);
  const archived=unityForesightAuditedResult(c);
  const forecast=c.forecast;
  return {id:c.id,metric:c.metric,periodEnd:c.periodEnd,recordedAt:c.recordedAt,
   sourcePublishedAt:c.sourcePublishedAt,sourceUrl:c.sourceUrl,unit:c.unit,forecast,
   FY2025:current?.value??null,expectedYoYPct:current&&forecast.kind==='range'?
    {low:unityForesightPercent(forecast.low,current.value),
     high:unityForesightPercent(forecast.high,current.value)}:
    current?{point:unityForesightPercent(forecast.value,current.value)}:null,
   measurement:archived||unityForesightCompare(stock,c,report)};
 });
 // Unconfirmed calendar dates are NOT guessed from previous cycles.
 const sensitivity=reverse?.status==='diagnostic'&&Array.isArray(reverse.impliedAnnualFcfGrowth)?
   reverse.impliedAnnualFcfGrowth.find(x=>x.id==='r10'):null;
 const impliedGrowth=unityForesightFinite(sensitivity?.impliedGrowthPct)?
   sensitivity.impliedGrowthPct:null;
 const expectations=impliedGrowth===null?'unavailable':
   impliedGrowth>=25?'demanding-under-assumption':'sensitivity-available';
 const evidenceComplete=!!validGuidance&&evaluations.length>0;
 return {schemaVersion:1,kind:'unity-forward-expectation-audit',
  isin:String(stock?.isin||''),ticker:String(stock?.ticker||''),name:String(stock?.name||''),
  status:evidenceComplete?'documented-forward-guidance':validGuidance?'qualitative-or-unregistered-guidance':'insufficient-data',
  guidanceSource:validGuidance?.sourceUrl||null,calendar,
  expectations:{status:expectations,impliedFiveYearFcfGrowthAt10Pct:impliedGrowth,
   note:'Sensitivität mit 10 % Eigenkapitalkosten, 2 % Endwertwachstum, FY2025-FCF-Runrate; keine Unternehmensprognose'},
  checkpoints:evaluations,tradeApproved:false,entryZone:null,
  nextCheck:calendar?.confirmed?'Offizieller Ergebnisbericht '+calendar.date:
    related.length?'FY2026-Konzernabschluss und neue offizielle Guidance prüfen':
    'Nächste belegte Guidance und offiziellen Ergebnistermin prüfen',
  confidence:'Quellenabdeckung, keine Erfolgswahrscheinlichkeit',
  auditCheckedAt:unityForesightOutcomes?.generatedAt||null};
}
function unityForesightMaster(list,options={}){
 const all=(Array.isArray(list)?list:typeof stocks==='function'?stocks():[])
   .filter(s=>!(typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(s)));
 const snapshots=all.map(s=>unityForesightSnapshot(s,options.forStock?.(s)||{}));
 const detailed=snapshots.filter(x=>x.status!=='insufficient-data');
 return {schemaVersion:1,total:snapshots.length,withGuidance:detailed.length,
  withPreRegisteredCheckpoints:snapshots.filter(x=>x.checkpoints.length>0).length,
  trackedTargets:snapshots.reduce((a,x)=>a+x.checkpoints.length,0),
  snapshots,tradeApproved:false};
}
function unityForesightFormat(value,unit){
 if(!unityForesightFinite(value))return 'nicht verfügbar';
 const scaled=unit==='USD'&&Math.abs(value)>=1e9?value/1e9:value;
 const suffix=unit==='USD'&&Math.abs(value)>=1e9?' Mrd. USD':
   unit==='USD/shares'?' USD/Aktie':' '+unit;
 return new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(scaled)+suffix;
}
function unityForesightHtmlCheckpoint(c){
 const metric=UNITY_FORESIGHT_METRICS[c.metric],f=c.forecast;
 const band=f.kind==='range'?unityForesightFormat(f.low,c.unit)+' – '+unityForesightFormat(f.high,c.unit):
   unityForesightFormat(f.value,c.unit)+' (Mittelpunkt)';
 const delta=c.expectedYoYPct;
 const growth=delta?.point!==undefined?' · gegenüber 2025 rechnerisch '+delta.point+' %':
   delta?.low!==undefined?' · gegenüber 2025 rechnerisch '+delta.low+' bis '+delta.high+' %':'';
 const result=c.measurement,measured=result?.value!==null&&result?.value!==undefined;
 const revisionWarning=result?.auditStatus==='revision-review'?
   ' · SEC-Nachmeldung weicht vom gespeicherten Istwert ab – Quellenprüfung erforderlich':'';
 const published=measured?
   ' · Tatsächlich: '+unityForesightFormat(result.value,c.unit)+
   ' · '+(result.status==='within-guidance'?'innerhalb der Prognosespanne':
         result.status==='above-guidance'?'oberhalb der Prognosespanne':
         result.status==='below-guidance'?'unterhalb der Prognosespanne':
         'Abweichung vom prognostizierten Mittelpunkt')+
   ' ('+result.errorPercent+' % gegenüber Referenz)'+revisionWarning:
   ' · Ergebnis aus dem geprüften FY2026-Konzernabschluss noch offen';
 return '<div class="unity-issuer-event"><span><strong>'+esc(metric.label+' FY2026 · '+band)+'</strong>'+
   '<small>Prognose am '+esc(c.recordedAt)+' unveränderlich protokolliert'+esc(growth+published)+'</small></span>'+
   (c.sourceUrl?'<a href="'+esc(c.sourceUrl)+'" rel="noopener noreferrer" target="_blank">Quelle</a>':'')+'</div>';
}
function unityForesightPanel(stock){
 if(typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(stock))return '';
 const s=unityForesightSnapshot(stock);
 let h='<section class="panel unity-foresight"><h3>Vorausschau · überprüfbare Erwartungen</h3>'+
   '<p class="tiny muted">Unternehmensprognose → überprüfbare Kennzahl → späterer Vergleich mit tatsächlich gemeldeten Daten. Kein Kursversprechen.</p>';
 if(s.checkpoints.length){
  h+='<div class="unity-issuer-events">'+s.checkpoints.map(unityForesightHtmlCheckpoint).join('')+'</div>';
 }else h+='<p class="tiny muted">'+(unityForesightLoading?'Prognoseprotokoll wird geladen.':
   unityForesightError?'Öffentliches Prognoseprotokoll nicht erreichbar: '+esc(unityForesightError):
   s.guidanceSource?'Offizielle Unternehmensprognose vorhanden; noch keine vergleichbare quantitative Messgröße protokolliert.':
   'Keine aktuelle, überprüfbare Unternehmensprognose dieser Aktie verfügbar.')+'</p>';
 if(s.calendar?.confirmed)h+='<p class="tiny muted"><b>Nächster offizieller Bericht:</b> '+esc(s.calendar.date)+
   ' · noch '+s.calendar.daysUntil+' Tage.</p>';
 else h+='<p class="tiny muted">Nächster Earnings-Termin: noch nicht eindeutig bestätigt – kein Datum geschätzt.</p>';
 if(s.expectations.impliedFiveYearFcfGrowthAt10Pct!==null)
  h+='<p class="tiny muted"><b>Im Kurs enthaltene FCF-Wachstumserwartung:</b> '+
   s.expectations.impliedFiveYearFcfGrowthAt10Pct+' % p. a. unter einer 10-%-Diskontannahme. '+
   (s.expectations.status==='demanding-under-assumption'?'Anspruchsvoll unter dieser Modellannahme. ':'')+
   'Dies ist keine eigene Unternehmenswachstumsprognose.</p>';
 const priority=unityForesightPriority(s);
 h+='<p class="tiny muted"><b>Prüfpriorität · '+esc(priority.label)+':</b> '+
   esc(priority.reason)+' <b>Nächster Schritt:</b> '+esc(priority.trigger)+'.</p>';
 if(s.auditCheckedAt)h+='<p class="tiny muted">Automatischer Jahresergebnis-Abgleich: '+
   esc(s.auditCheckedAt.slice(0,10))+' · '+esc(unityForesightOutcomes?.source||'SEC')+'</p>';
 else h+='<p class="tiny muted">Automatischer Jahresergebnis-Abgleich noch nicht initialisiert'+
   (unityForesightAuditError?' · Quelle derzeit nicht geladen':'')+'.</p>';
 h+='<p class="tiny muted">Ein Unternehmenssignal allein setzt keine UNITY-Kaufregel außer Kraft.</p></section>';
 return h;
}
function unityForesightOverview(list){
 const r=unityForesightMaster(list);
 const entries=r.snapshots.filter(s=>s.status!=='insufficient-data').sort((a,b)=>{
  const pa=unityForesightPriority(a),pb=unityForesightPriority(b);
  return pa.rank-pb.rank||b.checkpoints.length-a.checkpoints.length||a.name.localeCompare(b.name);
 });
 let h='<section class="panel unity-foresight"><h2>Vorausschau-Radar · Erwartungen vor den Ergebnissen</h2>'+
  '<p class="tiny muted">Unternehmen und Frühindikatoren werden anhand festgehaltener Primärquellen beobachtet. '+'Zahlen ohne vergleichbares späteres Ergebnis bleiben ausdrücklich offen; es gibt keine erfundene Trefferquote.</p>'+
  '<p><b>'+r.withGuidance+' von '+r.total+' Aktien</b> mit aktuell nutzbarer Unternehmensprognose · '+
  r.trackedTargets+' eingefrorene, später überprüfbare FY2026-Prognosewerte.</p>';
 if(!entries.length){
  h+='<p class="tiny muted">'+(unityForesightLoading?'Frühindikatoren laden …':'Keine ausreichend aktuellen Prognosen vorhanden.')+'</p>';
 }else{
  h+='<div class="unity-issuer-events">';
  for(const item of entries.slice(0,6)){
   const priority=unityForesightPriority(item);
   h+='<div class="unity-issuer-event"><span><strong>'+esc(item.name)+' · '+esc(priority.label)+'</strong>'+
    '<small>'+esc(priority.reason)+' · '+esc(priority.trigger)+
    ' · '+item.checkpoints.length+' protokollierte Prognosewerte</small></span></div>';
  }
  h+='</div>';
 }
 h+='<details class="unity-secondary-check"><summary>Gesamte Aktienliste · '+r.total+
  ' Titel berücksichtigt</summary><p class="tiny muted">Fehlende Guidance bedeutet Datenmangel, keine negative Bewertung.</p>';
 for(const item of r.snapshots)
  h+='<div class="home-data-row"><span>'+esc(item.name||item.ticker)+'</span><b>'+
    (item.checkpoints.length?item.checkpoints.length+' dokumentierte Ziele':
     item.guidanceSource?'Nur qualitative/ungeprüft vergleichbare Prognose':'Daten offen')+
    '</b></div>';
 h+='</details></section>';
 return h;
}
if(typeof fetch==='function')unityForesightLoad();
