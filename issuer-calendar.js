'use strict';
/* Official issuer IR calendar monitor. A missing date remains missing. */
let unityIssuerCalendar=null,unityIssuerCalendarError='',unityIssuerCalendarLoading=false;
function unityIssuerCalendarKey(stock){
 const values=[stock?.providerSymbol,stock?.ticker,stock?.isin].filter(Boolean).map(v=>String(v).toUpperCase());
 for(const value of values){const key=value.split('.')[0];if(unityIssuerCalendar?.items?.[key])return key}
 return '';
}
function unityIssuerCalendarItem(stock){
 const key=unityIssuerCalendarKey(stock);return key?unityIssuerCalendar.items[key]:null;
}
function unityIssuerCalendarFresh(){
 const stamp=Date.parse(unityIssuerCalendar?.generatedAt||'');
 return Number.isFinite(stamp)&&Date.now()-stamp<48*86400000&&stamp<=Date.now()+3600000;
}
function unityIssuerEvidenceMatrix(stock){
 const calendar=unityIssuerCalendarItem(stock),calendarFresh=unityIssuerCalendarFresh();
 const item=typeof unityFundPilotItem==='function'?unityFundPilotItem(stock):null;
 const end=String(item?.latestFiling?.periodEnd||''),age=Date.parse(end+'T12:00:00Z');
 const reportFresh=Number.isFinite(age)&&age<=Date.now()&&Date.now()-age<=550*86400000;
 const required=['revenue','netIncome','assets','equity','operatingCashFlow'];
 const fundamentals=!!item&&reportFresh&&required.every(key=>Number.isFinite(Number(item.metrics?.[key]?.value)));
 const earnings=!!calendar&&calendarFresh&&calendar.status==='confirmed-future-earnings'&&/^\d{4}-\d{2}-\d{2}$/.test(String(calendar.nextEarnings||''));
 return [
  {key:'fundamentals',title:'Fundamentaldaten',verified:fundamentals,
   detail:fundamentals?'Vollständiger geprüfter Jahresbericht '+end:'Vollständiger, frischer Jahresbericht fehlt',
   date:fundamentals?end:'',sourceUrl:item?.latestFiling?.reportUrl||calendar?.annualReportUrl||''},
  {key:'earnings',title:'Nächster Ergebnisbericht',verified:earnings,
   detail:earnings?'Offiziell bestätigt':'Kein eindeutig zukünftiger Termin belegt',
   date:earnings?calendar.nextEarnings:'',sourceUrl:calendar?.sourceUrl||''},
  {key:'guidance',title:'Guidance',verified:false,
   detail:'Keine einzeln zugeordnete, aktuelle Primärquelle geprüft',date:'',sourceUrl:''},
  {key:'thesis',title:'These & Widerlegung',verified:false,
   detail:'Keine belegte These mit überprüfbarer Widerlegungsbedingung hinterlegt',date:'',sourceUrl:''},
  {key:'risk',title:'Unternehmensrisiken',verified:false,
   detail:'Keine einzeln geprüften Risikofaktoren als Entscheidungsbeleg hinterlegt',date:'',sourceUrl:''}
 ];
}
function unityIssuerEvidencePanel(stock){
 const rows=unityIssuerEvidenceMatrix(stock);
 let h='<section class="panel unity-issuer-calendar"><h3>Entscheidungsbelege · Unternehmen</h3><p class="tiny muted">Jeder Bereich braucht Quelle, Stichtag und eindeutige Zuordnung. Eine Meldungsüberschrift oder ein Kalendertermin ersetzt keine Guidance-, Risiko- oder Thesenprüfung.</p><div class="unity-issuer-events">';
 for(const row of rows){
  const link=/^https:\/\//.test(String(row.sourceUrl||''))?'<a href="'+esc(row.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Original öffnen</a>':'';
  h+='<div class="unity-issuer-event"><span><strong>'+esc(row.title)+'</strong><small>'+esc(row.verified?'✓ belegt':'○ offen')+(row.date?' · '+esc(row.date):'')+' · '+esc(row.detail)+'</small></span>'+link+'</div>';
 }
 return h+'</div><p class="tiny muted">Offene Belege verhindern eine vollständige Investmentwertung. Sie werden nicht durch technische Signale, Kursbewegungen oder einen Score ersetzt.</p></section>';
}
function unityIssuerDecisionEvidence(stock){
 const item=unityIssuerCalendarItem(stock),fresh=unityIssuerCalendarFresh(),rows=unityIssuerEvidenceMatrix(stock);
 const byKey=key=>rows.find(row=>row.key===key)||{};
 const earnings=byKey('earnings');
 return {earnings:{confirmed:earnings.verified===true,date:earnings.verified?earnings.date:'',sourceUrl:earnings.sourceUrl||''},
   guidance:{verified:false,label:byKey('guidance').detail||'',sourceUrl:''},
   fundamentals:{verified:byKey('fundamentals').verified===true,periodEnd:byKey('fundamentals').date||''},
   positionRisk:null};
}
function unityIssuerCalendarPanel(stock){
 const item=unityIssuerCalendarItem(stock);
 let h='<section class="panel unity-issuer-calendar"><h3>Earnings & Guidance · offizielle IR-Quelle</h3>';
 if(!item)return h+'<p class="tiny muted">'+(unityIssuerCalendarLoading?'IR-Kalender werden geprüft.':unityIssuerCalendarError?'IR-Kalenderquelle derzeit nicht erreichbar.':'Für diesen Titel ist noch keine offizielle IR-Kalenderquelle hinterlegt.')+'</p></section>';
 const fresh=unityIssuerCalendarFresh();
 const confirmed=fresh&&item.status==='confirmed-future-earnings'&&item.nextEarnings;
 h+='<p><b>'+ (confirmed?'Nächster Ergebnis-Termin bestätigt':'Nächster Ergebnis-Termin nicht bestätigt')+'</b></p>'+
   '<p>'+ (confirmed?'Offizielle Ankündigung für '+esc(item.nextEarnings)+'.':'Die offizielle IR-Seite nennt derzeit keinen eindeutig zukünftigen Ergebnis-Termin. Es wird kein Datum geschätzt.')+'</p>'+
   '<p class="tiny muted">Guidance: noch nicht einzeln aus einer zugeordneten Unternehmensveröffentlichung geprüft · Quellenstand: '+esc(String(item.checkedAt||'').slice(0,10)||'offen')+'.</p>';
 if(/^https:\/\//.test(String(item.sourceUrl||'')))h+='<p><a href="'+esc(item.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Offizielle IR-Kalenderseite öffnen</a></p>';
 if(/^https:\/\//.test(String(item.annualReportUrl||'')))h+='<p class="tiny muted">Jahresabschluss-Quelle registriert · <a href="'+esc(item.annualReportUrl)+'" target="_blank" rel="noopener noreferrer">offiziellen Jahresbericht öffnen</a>. Die Kennzahlen werden erst nach eindeutiger Extraktion als belegt gewertet.</p>';
 return h+'</section>';
}
async function unityLoadIssuerCalendar(){
 if(unityIssuerCalendarLoading||unityIssuerCalendar)return;
 unityIssuerCalendarLoading=true;
 try{const res=await fetch('./data/issuer-calendar.json',{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);unityIssuerCalendar=await res.json();}
 catch(err){unityIssuerCalendarError=String(err?.message||'Load failed');}
 finally{unityIssuerCalendarLoading=false;if(typeof render==='function')render();}
}
unityLoadIssuerCalendar();
