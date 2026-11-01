'use strict';
/* Home-first selected watchlist. Source: delayed market.json daily closes.
   This is not a live broker account, nor a real-time trading signal. */
let unityHomeRange='1D',unityHomeSelected='',unityHomeTradeMode='',unityHomeDrag=null,unityHomeSort='manual';
const unityHomeStocks=()=>stocks().filter(s=>!s.watchHidden).sort((a,b)=>{
  const aa=Number.isFinite(Number(a.watchOrder))&&a.watchOrder!==undefined?Number(a.watchOrder):Infinity;
  const bb=Number.isFinite(Number(b.watchOrder))&&b.watchOrder!==undefined?Number(b.watchOrder):Infinity;
  return aa-bb||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||a.name.localeCompare(b.name);
});
async function unityHomeReorder(sourceId,targetId){
  const ordered=unityHomeStocks(),from=ordered.findIndex(s=>s.id===sourceId),to=ordered.findIndex(s=>s.id===targetId);
  if(from<0||to<0||from===to)return false;
  const moved=ordered.splice(from,1)[0];ordered.splice(to,0,moved);
  // Atomic update: either all new positions are persisted or none are.
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('instruments','readwrite'),store=tx.objectStore('instruments');
    ordered.forEach((s,i)=>store.put({...s,watchOrder:i}));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  await audit('WATCHLIST_REORDER',sourceId,'Neue Position: '+(to+1));
  await refresh();return true;
}
async function unityHomeShift(sid,delta){
  const ordered=unityHomeStocks(),i=ordered.findIndex(s=>s.id===sid);
  if(i<0||i+delta<0||i+delta>=ordered.length)return false;
  return unityHomeReorder(sid,ordered[i+delta].id);
}
const unityHomePeriods=[['1D','Aktuell'],['1W','Woche'],['1M','Monat'],['3M','3 Monate'],['1Y','Jahr'],['3Y','3J'],['6Y','6J']];
function unityHomeQuote(s){
  const x=(typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin)),m=x?unityMetrics(x):null;
  const quality=x?unityDataQuality(x,s.isin):null;
  return {x,m,quality,valid:!!m&&!m.stale&&!!quality?.canCompare};
}
function unityHomeMovement(x,range){
  const a=unityChartData(x,range);
  return a.length>=2?(Number(a.at(-1).close)/Number(a[0].close)-1)*100:NaN;
}
function unityHomeDecision(s){
  const {x,m,quality,valid}=unityHomeQuote(s);
  if(!x||!m)return {action:'Nicht bewertbar',buy:'Nicht entscheidbar',sell:'Nicht entscheidbar',reason:'Für diese Aktie fehlen ausreichend belastbare Kursdaten.',technical:'Keine Daten',confidence:'Keine ausreichende Datenbasis'};
  if(!valid)return {action:'Daten prüfen',buy:'Nicht freigegeben',sell:'Nicht entscheidbar',reason:'Der Kursstand ist nicht aktuell genug oder die Datenprüfung ist fehlgeschlagen.',technical:m.trend,confidence:'Datenqualität unzureich'};
  const a=unityCalc(s),gaps=a.veto||[];
  const positive=m.trend==='Aufwärtstrend';
  const negative=m.trend==='Abwärtstrend';
  const risk=m.rsi>=70?'Der RSI ist hoch; Rückschlagrisiko beachten.':m.rsi<35?'Der RSI ist niedrig; eine Bodenbildung ist nicht bestätigt.':'';
  const reason=(positive?'Der langfristige Kurstrend ist positiv. ':negative?'Der langfristige Kurstrend ist negativ. ':'Der langfristige Trend ist uneinheitlich. ')+risk+
    (gaps.length?' Für eine belastbare Kauf- oder Verkaufsentscheidung fehlen geprüfte Bewertung, Unternehmensdaten oder Ereignistermine.':'');
  return {action:positive?'Technisch positiv':negative?'Technisch schwach':'Technisch uneinheitlich',
    buy:'Noch nicht freigegeben',sell:'Individuell prüfen',reason,technical:m.trend,
    confidence:'Technischer Befund · keine vollständige UNITY-Freigabe',index:m.technicalIndex,
    gaps:gaps.slice(0,5),rsi:m.rsi};
}
/* Decision colours are NOT price colours. Only a fully verified UNITY verdict may
   turn a row green/red; delayed EOD technical trends never authorize a trade. */
function unityHomeSignal(s){
  const {x,m,valid,quality}=unityHomeQuote(s);
  if(!x||!m)return {kind:'warning',label:'Daten fehlen',icon:'!',detail:'Keine belastbare Kursreihe vorhanden.',rank:3};
  if(!valid)return {kind:'warning',label:'Daten prüfen',icon:'!',detail:quality?.detail||'Kursdaten nicht aktuell oder unplausibel.',rank:3};
  const a=unityCalc(s),veto=a.veto||[];
  if(veto.length)return {kind:'warning',label:'Analyse offen',icon:'!',detail:'Technik: '+m.trend+'. '+veto.length+' Prüfbedingungen für eine Handelsentscheidung noch offen.',rank:3};
  // Future fully sourced evaluation can explicitly emit these actions after all vetoes clear.
  const action=String(a.action||'').trim();
  if(action==='Kaufen – freigegeben')return {kind:'buy',label:'Kaufen prüfen',icon:'+',detail:'Alle verbindlichen UNITY-Datenprüfungen bestanden.',rank:0};
  if(action==='Verkaufen – freigegeben')return {kind:'sell',label:'Verkauf prüfen',icon:'−',detail:'Verkaufssignal nach vollständiger UNITY-Prüfung.',rank:1};
  if(action==='Halten – freigegeben')return {kind:'hold',label:'Halten',icon:'=',detail:'Bestand nach vollständiger UNITY-Prüfung halten.',rank:2};
  return {kind:'wait',label:'Abwarten',icon:'·',detail:'Keine bestätigte Kauf- oder Verkaufsfreigabe.',rank:4};
}
function unityHomeDisplayedStocks(){
  const list=unityHomeStocks();
  if(unityHomeSort==='priority')list.sort((a,b)=>unityHomeSignal(a).rank-unityHomeSignal(b).rank);
  return list;
}

function unityHome(){
  const selected=unityHomeDisplayedStocks(),pos=typeof depotPositions==='function'?depotPositions():[];
  const allValid=pos.length>0&&pos.every(p=>Number.isFinite(p.value));
  const value=allValid?pos.reduce((n,p)=>n+p.value,0):NaN;
  const nUp=selected.filter(s=>unityHomeQuote(s).valid&&unityHomeQuote(s).m.trend==='Aufwärtstrend').length;
  const nDown=selected.filter(s=>unityHomeQuote(s).valid&&unityHomeQuote(s).m.trend==='Abwärtstrend').length;
  let h='<section class="home-hero" id="unity-home"><div class="home-hero-title"><span class="home-hero-mark" aria-hidden="true">↗</span><div><h2>Mein Depot</h2><small>UNITY Lab · persönliche Aktienübersicht</small></div><button type="button" class="home-hero-menu" data-home-add title="Aktien auswählen">＋</button></div>'+
    '<div class="home-periods" aria-label="Kurszeitraum">'+unityHomePeriods.map(([r,label])=>'<button type="button" data-home-range="'+r+'" class="'+(r===unityHomeRange?'active':'')+'">'+label+'</button>').join('')+'</div>';
  if(pos.length&&allValid)h+='<div class="home-big-number">'+euro(value)+'</div><p class="home-value-label">Simulierter Positionswert · verzögerte Schlusskurse</p>';
  else if(pos.length)h+='<div class="home-big-number">–</div><p class="home-value-label">Simulationsdepot: '+pos.length+' Positionen · Bewertung unvollständig</p>';
  else h+='<div class="home-big-number home-count">'+selected.length+'</div><p class="home-value-label">Ausgewählte Aktien · noch keine simulierten Depotpositionen</p>';
  const pilotCount=selected.filter(s=>typeof unityDisplayQuote==='function'&&unityDisplayQuote(s)?.precision==='15m-bar').length;
  h+='<div class="home-hero-summary"><span>↗ '+nUp+' Aufwärtstrend</span><span>↘ '+nDown+' Abwärtstrend</span><span>'+selected.length+' beobachtet</span></div>'+
    '<p class="home-feed-note">'+(pilotCount?'Pilot: '+pilotCount+' zeitgestempelte 15-Minuten-Kursbalken · ':'')+'Automatische Tageskurse · <b>keine garantierten Echtzeitkurse</b> · Datenabruf '+esc(unityMarket?.generatedAt?.slice(0,16).replace('T',' ')||'noch nicht geladen')+'</p></section>';
  const signals=selected.map(unityHomeSignal),buys=signals.filter(v=>v.kind==='buy').length,sells=signals.filter(v=>v.kind==='sell').length,open=signals.filter(v=>v.kind==='warning').length;
  h+='<section class="home-list"><div class="home-list-head"><h2>Meine ausgewählten Aktien</h2><button type="button" class="secondary" data-home-add>＋ Aktie hinzufügen</button></div>'+
    '<div class="home-signal-summary" aria-label="UNITY Entscheidungslage"><span class="home-signal-count buy">● '+buys+' Kaufsignale</span><span class="home-signal-count sell">● '+sells+' Verkaufssignale</span><span class="home-signal-count warning">● '+open+' Datenprüfungen</span></div>'+
    '<div class="home-sort-controls"><span>Reihenfolge:</span><button type="button" data-home-sort="manual" class="'+(unityHomeSort==='manual'?'active':'')+'">Meine Reihenfolge</button><button type="button" data-home-sort="priority" class="'+(unityHomeSort==='priority'?'active':'')+'">Handlungsbedarf</button></div>'+
    '<p class="home-sort-hint">☰ Aktie ziehen oder mit ↑ ↓ nach oben/unten verschieben. Reihenfolge bleibt gespeichert. Orange bedeutet: noch keine belastbare Kauf-/Verkaufsentscheidung. Bei Pilotkursen: „Aktuell“ = Veränderung zum letzten Schlusskurs.</p>';
  if(!selected.length)h+='<div class="home-empty"><p>Du hast noch keine Aktien ausgewählt. Wähle deine Werte aus dem vorhandenen UNITY-Katalog. Die App zeigt sie danach automatisch beim Öffnen an.</p><button type="button" class="primary" data-home-add>Aktien auswählen</button></div>';
  for(const [i,s] of selected.entries()){
    const {x,m,valid}=unityHomeQuote(s);
    const dq=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null;
    const pilot=dq?.precision==='15m-bar'&&x&&valid;
    const series=pilot&&unityHomeRange!=='1D'?unityChartData(x,unityHomeRange):[];
    const base=pilot?(unityHomeRange==='1D'?Number(x.price):Number(series[0]?.close)):NaN;
    const change=pilot&&base>0?(Number(dq.price)/base-1)*100:valid?unityHomeMovement(x,unityHomeRange):NaN;
    const rising=Number.isFinite(change)&&change>0,falling=Number.isFinite(change)&&change<0;
    const cls=rising?'home-up':falling?'home-down':'home-flat';
    const p=depotPosition(s),signal=unityHomeSignal(s);
    h+='<div class="home-stock-item" data-home-row="'+esc(s.id)+'"><div class="home-reorder-tools"><button type="button" class="home-drag-handle" data-home-drag="'+esc(s.id)+'" title="Aktie ziehen" aria-label="'+esc(s.name)+' durch Ziehen verschieben">☰</button><button type="button" class="home-shift-btn" data-home-shift="'+esc(s.id)+'" data-direction="-1" '+(i===0?'disabled':'')+' aria-label="'+esc(s.name)+' nach oben verschieben">↑</button><button type="button" class="home-shift-btn" data-home-shift="'+esc(s.id)+'" data-direction="1" '+(i===selected.length-1?'disabled':'')+' aria-label="'+esc(s.name)+' nach unten verschieben">↓</button></div><button type="button" class="home-stock-row" data-home-open="'+esc(s.id)+'"><span class="home-trend-icon '+cls+'" aria-hidden="true">'+(rising?'↗':falling?'↘':'–')+'</span>'+
      '<span class="home-stock-main"><strong>'+esc(s.name)+'</strong><span class="home-signal home-signal-'+signal.kind+'"><span aria-hidden="true">'+signal.icon+'</span> '+esc(signal.label)+'</span><small>'+esc(s.ticker)+' · '+esc(s.exchange)+' · '+esc(valid?m.trend:'Daten nicht ausreichend')+'</small>'+(p.qty>0?'<small class="home-position-label">'+number(p.qty,4)+' Stück im Testdepot'+(Number.isFinite(p.pnl)?' · '+(p.pnl>=0?'+':'')+depotMoney(p.pnl):'')+'</small>':'')+'</span>'+
      '<span class="home-stock-right"><strong class="'+cls+'">'+(valid?unityPct(change):'–')+'</strong><small>'+(dq?number(Number(dq.price),2)+' '+esc(s.currency):'Kurs fehlt')+'</small><small>'+(dq?.precision==='15m-bar'?'15m-Pilot · '+esc(new Date(dq.quotedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})):dq?esc(dq.date)+' · Schluss':'Kein Datenstand')+'</small></span><span class="home-chevron">›</span></button></div>';
  }
  h+='</section>';
  if(unityHomeSelected)h+=unityHomeDetail(unityHomeSelected);
  h+='<section class="home-bottom-actions"><button type="button" class="secondary" data-home-reload '+(unityMarketLoading?'disabled':'')+'>'+(unityMarketLoading?'Kursdaten werden geladen …':'Kursdaten erneut prüfen')+'</button><button type="button" class="secondary" data-home-all>Alle UNITY-Kandidaten vergleichen</button><button type="button" class="secondary" data-home-trades>Käufe / Verkäufe</button></section>';
  h+='<p class="home-disclaimer">Die Pfeile und Prozentwerte zeigen die Kursänderung im gewählten Zeitraum, nicht den persönlichen Depotgewinn. Die Trendbewertung nutzt gleitende Durchschnitte. Die App gibt ohne geprüfte Fundamentaldaten, Earnings und aktuelle Handelskurse keine Kauf- oder Verkaufsfreigabe.</p>';
  return h;
}
function unityHomeDetail(sid){
  const s=stocks().find(x=>x.id===sid);
  if(!s)return '';
  const {x,m,valid}=unityHomeQuote(s),d=unityHomeDecision(s),signal=unityHomeSignal(s);
  let h='<section class="home-detail" id="home-stock-detail"><div class="home-detail-title"><div><small>Aktienansicht</small><h2>'+esc(s.name)+'</h2><p>'+esc(s.ticker)+' · '+esc(s.exchange)+' · '+esc(s.currency)+'</p></div><button type="button" class="secondary" data-home-close>Schließen</button></div>';
  const dq=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null;
  if(x)h+=unityChartPanel(x);
  else h+='<p class="home-missing">'+(s.providerSymbol?(typeof unityDynamicErrors!=='undefined'&&unityDynamicErrors.get(s.providerSymbol.toUpperCase())?'Kursquelle derzeit nicht erreichbar: '+esc(unityDynamicErrors.get(s.providerSymbol.toUpperCase())):'Internationale Kursreihe wird geladen, sofern die externe Quelle erreichbar ist.'):'Kein überprüfbarer Tageskursverlauf vorhanden. Es wird keine Kurve erfunden.')+'</p>';
  if(dq)h+='<p class="home-price-time">'+esc(dq.label)+': <b>'+number(dq.price,2)+' '+esc(s.currency)+'</b> · '+(dq.quotedAt?esc(new Date(dq.quotedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}))+' MEZ/MESZ':esc(dq.date))+' · '+esc(dq.exchange)+'</p>';
  if(s.providerSymbol)h+='<p class="tiny muted">Weltweiter Kursabruf: inoffizielle Yahoo-Daten über cors.dev, nicht börslich geprüft. Keine Handelsfreigabe; Suchanfrage und Symbol werden an externe Dienste übertragen.</p>';
  if(s.note)h+='<p><b>Unternehmensbereich:</b> '+esc(s.note)+'</p>';
  h+=unityHomeSecurityDetails(s,x);
  if(typeof unityFundPilotPanel==='function')h+=unityFundPilotPanel(s);
  h+=unityHomeTradeActions(s);
  h+='<div class="home-decision home-decision-'+signal.kind+'"><div class="home-decision-head"><span>UNITY-Entscheidung: <b class="home-signal home-signal-'+signal.kind+'">'+signal.icon+' '+esc(signal.label)+'</b></span><strong>'+esc(d.action)+'</strong></div><p class="home-signal-reason">'+esc(signal.detail)+'</p>'+
    '<div class="home-decision-grid"><div><small>Kauf</small><b>'+esc(d.buy)+'</b></div><div><small>Verkauf</small><b>'+esc(d.sell)+'</b></div><div><small>Technischer Trend</small><b>'+esc(d.technical)+'</b></div><div><small>Technikindex</small><b>'+(valid&&Number.isFinite(d.index)?d.index+'/100':'–')+'</b></div></div>'+
    '<p><b>Begründung:</b> '+esc(d.reason)+'</p><p class="tiny muted">'+esc(d.confidence)+'</p></div>'+
    '<button type="button" class="home-analyze-btn" data-home-analyze="'+esc(s.id)+'">Vollständige UNITY-Analyse & Datenlage ansehen <span aria-hidden="true">›</span></button>'+
    (typeof unityNewsPanel==='function'?unityNewsPanel(s):'')+
    '<p><a href="https://news.google.com/search?q='+encodeURIComponent(s.name+' Aktie')+'&amp;hl=de&amp;gl=DE&amp;ceid=DE%3Ade" target="_blank" rel="noopener noreferrer">Aktuelle Meldungen zu '+esc(s.name)+' extern ansehen</a></p>'+
    '<p class="tiny muted">Externe Nachrichten sind noch nicht automatisch auf Relevanz und Auswirkungen auf die UNITY-Entscheidung geprüft.</p>'+
    '<p class="tiny muted">Die Analyse berechnet vorhandene Kennzahlen automatisch. Fehlende Bilanz-, Bewertungs- und Ereignisdaten werden als offene Prüfpunkte angezeigt, nicht geschätzt.</p></section>';
  return h;
}


function unityHomeSecurityDetails(s,x){
  const p=depotPosition(s),dq=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):null,rows=[
    ['Kursdaten',dq?number(Number(dq.price),2)+' '+s.currency:'Nicht verfügbar',dq?.precision==='15m-bar'?'Inoffizieller 15-Minuten-Kursbalken, kein Echtzeitversprechen':'Letzter verfügbarer Börsenschlusskurs'],
    ['Kursdatum',dq?.quotedAt?new Date(dq.quotedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):dq?.date||'–','Beobachtungszeitpunkt, nicht Downloadzeitpunkt'],
    ['Börsenplatz',dq?.exchange||s.exchange,'Referenzmarkt'],
    ['ISIN',s.isin||'–','Wertpapierkennung'],
    ['Bestand',number(p.qty,4)+' Stück','Nur simulierte Transaktionen'],
    ['Einstand',p.qty>0?depotMoney(p.cost):'–','Simulierter Kaufwert offener Positionen'],
    ['Offener Erfolg',Number.isFinite(p.pnl)?depotMoney(p.pnl):'–','Marktwert abzüglich Einstand, sofern Kurs und EUR-FX verfügbar']
  ];
  let h='<section class="home-security-data"><h3>Wertpapierdetails & Testdepot</h3>';
  for(const [key,value,help] of rows)h+='<div class="home-data-line"><div><b>'+esc(value)+'</b><small>'+esc(help)+'</small></div><span>'+esc(key)+'</span></div>';
  h+='<p class="tiny muted">BID/ASK werden ohne verifizierte Geld-/Briefkurse bewusst nicht angezeigt.</p></section>';
  if(p.buys||p.sells)h+='<section class="home-trade-history"><h3>Simulierte Käufe und Verkäufe</h3>'+depotTradeHistory(s.id)+'</section>';
  return h;
}
function unityHomeTradeActions(s){
  const p=depotPosition(s),market=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):(typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin)),mode=unityHomeTradeMode;
  let h='<div class="home-trade-actions"><button type="button" class="home-buy-button" data-home-trade="BUY">＋ Kaufen · Simulation</button>'+
    '<button type="button" class="home-sell-button" data-home-trade="SELL" '+(p.qty>0?'':'disabled')+'>− Verkaufen · Simulation</button></div>';
  if(!p.qty)h+='<p class="tiny muted">Für einen Testverkauf zunächst eine simulierte Position kaufen.</p>';
  if(mode!=='BUY'&&mode!=='SELL')return h;
  const sell=mode==='SELL',fx=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
  const eod=(typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin)),verified=eod&&unityDataQuality(eod,s.isin)?.canCompare;
  const available=verified&&market&&Number(market.price)>0&&fx&&fx.rate>0;
  h+='<form class="home-trade-form" id="home-trade-form"><h3>'+(sell?'Testverkauf':'Testkauf')+' · '+esc(s.name)+'</h3>'+
    '<p class="tiny muted">Nur Simulation, kein echter Börsenauftrag. Kurs und EUR-Umrechnung werden automatisch übernommen. Der Börsenkurs ist ein unverbindlicher Referenzwert, kein ausführbarer Kauf-/Verkaufspreis.</p>'+
    '<input type="hidden" name="instrumentId" value="'+esc(s.id)+'"><input type="hidden" name="type" value="'+mode+'">'+
    '<label>Stückzahl<input type="number" name="quantity" step="any" min="0.000001" '+(sell?'max="'+String(Number(p.qty.toFixed(6)))+'"':'')+' required placeholder="'+(sell?'Maximal '+number(p.qty,4):'z. B. 5')+'"></label>'+
    '<label>Gebühr in EUR<input type="number" name="fee" step="0.01" min="0" value="1.00" required><small>Standard: 1,00 € je Simulation. Passe den Betrag an deinen Broker an.</small></label>'+
    '<div class="home-trade-auto full"><b>Aktienkurs:</b> '+(market?number(market.price,2)+' '+esc(s.currency):'Kein verifizierbarer Referenzkurs')+
    '<small>'+(market?esc(market.precision==='15m-bar'?'15-Minuten-Kursbalken · '+new Date(market.quotedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):'Börsenschlusskurs · '+market.date):'Kursdaten fehlen')+'</small></div>'+
    '<div class="home-trade-auto full"><b>Automatische EUR-Umrechnung:</b> '+(fx?number(fx.rate,6)+' € je '+esc(s.currency):'Noch kein gültiger Wechselkurs verfügbar')+
    '<small>'+(fx?esc(fx.source)+' · '+esc(fx.date):'Für diese Währung muss zunächst eine aktuelle EZB-Referenz verfügbar sein.')+'</small></div>'+
    '<div class="home-trade-total full" id="home-trade-estimate" aria-live="polite">Voraussichtlicher Testbetrag: –</div>'+
    '<label class="full">Notiz (optional)<textarea name="note" maxlength="1000" placeholder="Eigene Beobachtung"></textarea></label>'+
    '<div class="full home-trade-confirm"><button class="primary" type="submit" '+(available?'':'disabled')+'>'+(sell?'Testverkauf speichern':'Testkauf speichern')+'</button><button type="button" class="secondary" data-home-trade-cancel>Abbrechen</button></div></form>';
  return h;
}
function unityHomeUpdateTradeEstimate(form){
  const el=form.querySelector('#home-trade-estimate'),s=stocks().find(x=>x.id===form.elements.instrumentId?.value);
  if(!el||!s)return;
  const market=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):(typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin));
  const fx=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
  const n=Number(form.elements.quantity?.value),fee=Number(form.elements.fee?.value)||0,amount=n*Number(market?.price)*Number(fx?.rate);
  if(!(fee>=0&&Number.isFinite(fee)))return el.textContent='Gebühr prüfen';
  const net=amount+(form.elements.type?.value==='SELL'?-fee:fee);
  el.textContent=n>0&&market&&fx?'Voraussichtlicher '+(form.elements.type?.value==='SELL'?'Nettoerlös':'Gesamtaufwand')+': '+euro(net)+' · Gebühr '+euro(fee)+' · Spread nicht enthalten':'Voraussichtlicher Testbetrag: –';
}

async function unityHomeSaveTrade(data){
  const s=stocks().find(x=>x.id===data.instrumentId);if(!s)throw Error('Aktie nicht gefunden.');
  const type=data.type;if(type!=='BUY'&&type!=='SELL')throw Error('Ungültige Buchungsart.');
  const quantity=Number(data.quantity),fee=Number(data.fee??1),at=new Date();
  const market=typeof unityDisplayQuote==='function'?unityDisplayQuote(s):(typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin));
  const rate=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
  if(!(quantity>0&&Number.isFinite(quantity)))throw Error('Bitte eine gültige Stückzahl eingeben.');
  if(!(fee>=0&&Number.isFinite(fee)&&fee<=100000))throw Error('Bitte eine gültige Gebühr in EUR eingeben.');
  const daily=(typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin));
  if(!daily||!unityDataQuality(daily,s.isin)?.canCompare||!market||!(Number(market.price)>0))throw Error('Kein ausreichend aktueller und geprüfter Referenzkurs verfügbar. Testhandel nicht möglich.');
  if(!rate||!(rate.rate>0))throw Error('Automatischer EUR-Wechselkurs fehlt oder ist veraltet. Testhandel nicht möglich.');
  const price=Number(market.price),fx=rate.rate;
  if(type==='SELL'){
    const available=depotLedger(s.id,at.toISOString().slice(0,10)).qty;
    if(quantity>available+1e-8)throw Error('Nicht genügend simulierte Aktien am gewählten Datum. Verfügbar: '+number(available,4));
  }
  const decision=unityHomeDecision(s),quote=market;
  const t={id:id(),instrumentId:s.id,type,quantity,price,fx,amount:quantity*price,fee,
    decidedAt:at.toISOString(),executedAt:at.toISOString(),note:String(data.note||'').trim(),
    fxSource:rate.source,fxReferenceDate:rate.date,priceSource:market.source||null,
    decisionSnapshot:{action:decision.action,buy:decision.buy,sell:decision.sell,
      technicalIndex:Number.isFinite(decision.index)?decision.index:null,
      quoteDate:quote?.date||null,quoteObservedAt:quote?.quotedAt||null,quotePrecision:quote?.precision||'day',quotePrice:quote&&Number.isFinite(Number(quote.price))?Number(quote.price):null,
      reason:decision.reason,source:'UNITY EOD-Analyse · keine Handelsfreigabe'},
    source:'UNITY Lab · Testhandel',createdAt:new Date().toISOString()};
  // Check the entire simulated timeline; a backdated sale may invalidate a later sale.
  let running=0;
  for(const item of [...depotActiveTrades(s.id),t].sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.createdAt.localeCompare(b.createdAt))){
    running+=item.type==='BUY'?Number(item.quantity):-Number(item.quantity);
    if(running < -1e-8)throw Error('Der Testhandel würde zu einem negativen Bestand in der Buchungshistorie führen.');
  }
  if(!confirm((type==='BUY'?'Testkauf':'Testverkauf')+' von '+number(quantity,4)+' Stück '+s.name+' zu '+number(price,2)+' '+s.currency+' (ca. '+euro(quantity*price*fx)+') speichern? EZB-Referenzkurs '+rate.date+'. Dies ist KEIN echter Börsenauftrag.'))return false;
  await put('transactions',t);await audit(type==='BUY'?'BUY_ADD':'SELL_ADD',t.id,'Simuliert · '+s.ticker);
  await refresh();return true;
}

function unityHomeManagePanel(){
  let h='<section class="panel" id="home-manage"><h2>Meine Aktienauswahl verwalten</h2><p class="muted">Bestimme, welche Aktien auf der Startseite erscheinen. Ausblenden entfernt keine Buchungen, Kursdaten oder Analysen.</p>';
  if(!stocks().length)h+='<p>Noch keine Aktien gespeichert. Wähle unten eine Aktie aus dem Katalog.</p>';
  const visible=unityHomeStocks(),all=[...visible,...stocks().filter(s=>s.watchHidden)];
  for(const s of all){const index=visible.findIndex(x=>x.id===s.id);
    h+='<div class="home-manage-row"><div><strong>'+esc(s.name)+'</strong><small>'+esc(s.ticker)+' · '+esc(s.isin||s.exchange)+'</small></div><div class="home-manage-controls">'+
    (index>=0?'<button type="button" class="secondary" data-home-shift="'+esc(s.id)+'" data-direction="-1" '+(index===0?'disabled':'')+' aria-label="'+esc(s.name)+' nach oben">↑</button><button type="button" class="secondary" data-home-shift="'+esc(s.id)+'" data-direction="1" '+(index===visible.length-1?'disabled':'')+' aria-label="'+esc(s.name)+' nach unten">↓</button>':'')+
    '<button type="button" class="'+(s.watchHidden?'secondary':'primary')+'" data-home-toggle="'+esc(s.id)+'">'+(s.watchHidden?'Anzeigen':'Ausblenden')+'</button></div></div>';
  }
  return h+'</section>';
}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.homeToggle){const stock=stocks().find(s=>s.id===b.dataset.homeToggle);if(stock){put('instruments',{...stock,watchHidden:!stock.watchHidden}).then(()=>audit('WATCHLIST_TOGGLE',stock.id,!stock.watchHidden?'hidden':'shown')).then(refresh).catch(err=>alert(err.message||String(err)))}return}
  if(b.dataset.homeShift){unityHomeSort='manual';unityHomeShift(b.dataset.homeShift,Number(b.dataset.direction)).catch(err=>alert(err.message||String(err)));return}
  if(b.dataset.homeTrade){unityHomeTradeMode=b.dataset.homeTrade;render();document.getElementById('home-trade-form')?.scrollIntoView({block:'nearest'});return}
  if(b.hasAttribute('data-home-trade-cancel')){unityHomeTradeMode='';render();return}
  if(b.dataset.homeSort){unityHomeSort=b.dataset.homeSort==='priority'?'priority':'manual';render();return}
  if(b.dataset.homeRange){unityHomeRange=b.dataset.homeRange;render();return}
  if(b.dataset.analyze){unityHomeSelected=b.dataset.analyze;unityHomeTradeMode='';activeTab='overview';render();document.getElementById('home-stock-detail')?.scrollIntoView({behavior:'smooth',block:'start'});const stock=stocks().find(x=>x.id===unityHomeSelected);if(stock&&typeof unityLoadDynamicStock==='function')unityLoadDynamicStock(stock);if(stock&&typeof unityLoadNews==='function')unityLoadNews(stock);return}
  if(b.dataset.homeOpen){unityHomeSelected=b.dataset.homeOpen;unityHomeTradeMode='';render();document.getElementById('home-stock-detail')?.scrollIntoView({behavior:'smooth',block:'start'});const stock=stocks().find(x=>x.id===unityHomeSelected);if(stock&&typeof unityLoadDynamicStock==='function')unityLoadDynamicStock(stock);if(stock&&typeof unityLoadNews==='function')unityLoadNews(stock);return}
  if(b.hasAttribute('data-home-close')){unityHomeSelected='';unityHomeTradeMode='';render();return}
  if(b.dataset.homeAnalyze){selectedUnityStock=b.dataset.homeAnalyze;activeTab='analysis';render();document.getElementById('app')?.scrollIntoView({block:'start'});return}
  if(b.hasAttribute('data-home-add')){activeTab='stocks';render();document.getElementById('online-search')?.scrollIntoView({block:'start'});document.getElementById('online-search')?.focus();return}
  if(b.hasAttribute('data-home-all')){unityScope='all';activeTab='stocks';render();return}
  if(b.hasAttribute('data-home-trades')){activeTab='trades';render();return}
  if(b.hasAttribute('data-home-reload')){unityLoadMarket();if(typeof unityLoadIntraday==='function')unityLoadIntraday();if(typeof unityLoadFx==='function')unityLoadFx();return}
});
// Recheck the published EOD snapshot when the user returns to the app.
// A refreshed snapshot is not a live quote stream.
let unityHomeLastCheck=Date.now();
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&Date.now()-unityHomeLastCheck>15*60000){
    unityHomeLastCheck=Date.now();unityLoadMarket();if(typeof unityLoadIntraday==='function')unityLoadIntraday();if(typeof unityLoadFx==='function')unityLoadFx();
  }
});

/* Touch + mouse reorder: move only from the explicit grip so tapping a row still opens details. */
document.addEventListener('pointerdown',e=>{
  const grip=e.target.closest('[data-home-drag]');if(!grip||e.button!==0||unityHomeSort!=='manual')return;
  const row=grip.closest('[data-home-row]');if(!row)return;
  unityHomeDrag={id:grip.dataset.homeDrag,target:grip.dataset.homeDrag,startY:e.clientY,moved:false,handle:grip};
  grip.setPointerCapture?.(e.pointerId);
  row.classList.add('home-dragging');
});
document.addEventListener('pointermove',e=>{
  if(!unityHomeDrag)return;
  const drag=unityHomeDrag;
  if(Math.abs(e.clientY-drag.startY)>8)drag.moved=true;
  const under=document.elementFromPoint?.(e.clientX,e.clientY)?.closest?.('[data-home-row]');
  if(under&&under.dataset.homeRow!==drag.id){
    drag.target=under.dataset.homeRow;
    document.querySelectorAll('[data-home-row]').forEach(el=>el.classList.toggle('home-drop-target',el===under));
  }
});
document.addEventListener('pointerup',e=>{
  if(!unityHomeDrag)return;
  const drag=unityHomeDrag;unityHomeDrag=null;
  document.querySelectorAll('[data-home-row]').forEach(el=>el.classList.remove('home-dragging','home-drop-target'));
  if(drag.moved&&drag.target!==drag.id){unityHomeSort='manual';unityHomeReorder(drag.id,drag.target).catch(err=>alert(err.message||String(err)))}
});
document.addEventListener('pointercancel',()=>{
  unityHomeDrag=null;document.querySelectorAll('[data-home-row]').forEach(el=>el.classList.remove('home-dragging','home-drop-target'));
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='home-trade-form')return;
  e.preventDefault();
  try{
    const saved=await unityHomeSaveTrade(Object.fromEntries(new FormData(e.target)));
    if(saved){unityHomeTradeMode='';render();document.getElementById('home-stock-detail')?.scrollIntoView({block:'start'})}
  }catch(err){alert(err.message||String(err))}
});

document.addEventListener('input',e=>{if(e.target.closest?.('#home-trade-form')&&['quantity','fee'].includes(e.target.name))unityHomeUpdateTradeEstimate(e.target.form)});
