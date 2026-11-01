'use strict';
/* Official-report metadata and strictly checked financial facts for the
 * four-company European pilot. This module never grants trade permission. */
let unityFundPilot=null,unityFundPilotError='',unityFundPilotLoading=false;
const unityFundPilotUrl='./data/fundamentals.json';
const unityFundPilotNames={revenue:'Umsatz',netIncome:'Jahresüberschuss',assets:'Bilanzsumme',equity:'Eigenkapital',operatingCashFlow:'Operativer Cashflow'};
async function unityLoadFundPilot(){
 if(unityFundPilotLoading)return;
 unityFundPilotLoading=true;
 try{
  const response=await fetch(unityFundPilotUrl+'?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(data.schemaVersion!==1||!data.items||typeof data.items!=='object')throw Error('Unbekanntes Berichtsformat');
  unityFundPilot=data;unityFundPilotError='';
 }catch(e){unityFundPilotError=String(e.message||e)}
 finally{unityFundPilotLoading=false;if(typeof render==='function'&&typeof db!=='undefined'&&db)render()}
}
function unityFundPilotItem(s){
 const entry=unityFundPilot?.items?.[s?.isin];
 return entry?.isin===s?.isin?entry:null;
}
function unityFundPilotPanel(s){
 const item=unityFundPilotItem(s);
 if(!item&&!['CH0012221716','FR0000121972','DE000ENER6Y0','DE0006231004'].includes(s?.isin))return '';
 let h='<section class="home-security-data unity-fund-pilot"><h3>Unternehmenszahlen · geprüfte Berichtsquellen</h3>';
 if(!item){
  h+='<p class="tiny muted">Der automatische Abruf der Unternehmensberichte ist '+(unityFundPilotLoading?'noch nicht abgeschlossen.':unityFundPilotError?'nicht erreichbar ('+esc(unityFundPilotError)+').':'noch nicht verfügbar.')+'</p>';
 }else{
  const status={
   'no-esef-route':'Für dieses Unternehmen ist keine geeignete ESEF-Abfrage hinterlegt.',
   'no-filing-found':'Im öffentlichen ESEF-Archiv wurde kein passender Bericht gefunden.',
   'filing-found':'Ein Bericht wurde gefunden; Zahlen konnten noch nicht geprüft werden.',
   'filing-no-validated-metrics':'Ein Bericht wurde gefunden, aber keine Kennzahlen erfüllen die strengen Prüfregeln.',
   'metrics-partial':'Einzelne Berichtskennzahlen konnten eindeutig zugeordnet werden.',
   'source-unavailable':'Die Quelle war beim letzten automatischen Abruf nicht erreichbar.',
   'stale-previous':'Die Quelle ist derzeit nicht erreichbar. Der zuletzt gespeicherte Bericht kann veraltet sein.'
  };
  h+='<p><b>Datenstatus:</b> '+esc(status[item.status]||'Datenlage noch offen')+'</p>';
  if(item.latestFiling){
   const report=item.latestFiling;
   h+='<p class="tiny muted">Geschäftsjahresende: '+esc(report.periodEnd||'unbekannt')+
     (report.published?' · Veröffentlichung: '+esc(String(report.published).slice(0,10)):'')+'</p>';
   if(report.reportUrl)h+='<p><a href="'+esc(report.reportUrl)+'" target="_blank" rel="noopener noreferrer">Originalbericht im XBRL-Archiv ansehen</a></p>';
  }
  for(const [key,label] of Object.entries(unityFundPilotNames)){
   const fact=item.metrics?.[key];
   let value='Nicht zuverlässig verfügbar',help='Keine geprüfte Angabe';
   if(fact&&Number.isFinite(Number(fact.value))&&fact.currency===item.reportCurrency&&fact.periodEnd===item.latestFiling?.periodEnd){
     value=new Intl.NumberFormat('de-DE',{style:'currency',currency:fact.currency,maximumFractionDigits:0}).format(Number(fact.value));
     help='Geschäftsjahr '+fact.periodEnd+' · '+fact.concept;
   }
   h+='<div class="home-data-row"><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(help)+'</small></div>';
  }
  h+='<p class="tiny muted">Letzte Quellenprüfung: '+esc(item.checkedAt||'unbekannt')+' · '+esc(item.source||'ESEF')+'</p>';
  if(item.investorRelations&&/^https:\/\//.test(item.investorRelations))
   h+='<p><a href="'+esc(item.investorRelations)+'" target="_blank" rel="noopener noreferrer">Offizielle Investor-Relations-Seite öffnen</a></p>';
  if(item.note)h+='<p class="tiny muted">'+esc(item.note)+'</p>';
 }
 h+='<p class="tiny muted">Dies sind historische Geschäftsberichtsdaten, keine aktuellen Quartalsprognosen. Fehlende Zahlen werden nicht geschätzt. Es entsteht daraus keine Kauf- oder Verkaufsfreigabe.</p></section>';
 return h;
}
unityLoadFundPilot();
