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
function unityIssuerDecisionEvidence(stock){
 const item=unityIssuerCalendarItem(stock),fresh=unityIssuerCalendarFresh();
 const earnings=!!item&&fresh&&item.status==='confirmed-future-earnings'&&/^\d{4}-\d{2}-\d{2}$/.test(String(item.nextEarnings||''));
 return {earnings:{confirmed:earnings,date:earnings?item.nextEarnings:'',sourceUrl:item?.sourceUrl||''},
   guidance:{verified:false,sourceUrl:item?.sourceUrl||''},
   fundamentals:{verified:false},positionRisk:null};
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
