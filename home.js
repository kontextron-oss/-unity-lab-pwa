'use strict';
/* Home-first selected watchlist. Source: delayed market.json daily closes.
   This is not a live broker account, nor a real-time trading signal. */
let unityHomeRange='1D',unityHomeSelected='',unityHomeTradeMode='',unityHomeDrag=null;
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
  const x=unityMarketItem(s.isin),m=x?unityMetrics(x):null;
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
function unityHome(){
  const selected=unityHomeStocks(),pos=typeof depotPositions==='function'?depotPositions():[];
  const allValid=pos.length>0&&pos.every(p=>Number.isFinite(p.value));
  const value=allValid?pos.reduce((n,p)=>n+p.value,0):NaN;
  const nUp=selected.filter(s=>unityHomeQuote(s).valid&&unityHomeQuote(s).m.trend==='Aufwärtstrend').length;
  const nDown=selected.filter(s=>unityHomeQuote(s).valid&&unityHomeQuote(s).m.trend==='Abwärtstrend').length;
  let h='<section class="home-hero" id="unity-home"><div class="home-hero-title"><span class="home-hero-mark" aria-hidden="true">↗</span><div><h2>Mein Depot</h2><small>UNITY Lab · persönliche Aktienübersicht</small></div><button type="button" class="home-hero-menu" data-home-add title="Aktien auswählen">＋</button></div>'+
    '<div class="home-periods" aria-label="Kurszeitraum">'+unityHomePeriods.map(([r,label])=>'<button type="button" data-home-range="'+r+'" class="'+(r===unityHomeRange?'active':'')+'">'+label+'</button>').join('')+'</div>';
  if(pos.length&&allValid)h+='<div class="home-big-number">'+euro(value)+'</div><p class="home-value-label">Simulierter Positionswert · verzögerte Schlusskurse</p>';
  else if(pos.length)h+='<div class="home-big-number">–</div><p class="home-value-label">Simulationsdepot: '+pos.length+' Positionen · Bewertung unvollständig</p>';
  else h+='<div class="home-big-number home-count">'+selected.length+'</div><p class="home-value-label">Ausgewählte Aktien · noch keine simulierten Depotpositionen</p>';
  h+='<div class="home-hero-summary"><span>↗ '+nUp+' Aufwärtstrend</span><span>↘ '+nDown+' Abwärtstrend</span><span>'+selected.length+' beobachtet</span></div>'+
    '<p class="home-feed-note">Automatisch geladene Börsenschlusskurse · <b>nicht in Echtzeit</b> · Stand '+esc(unityMarket?.generatedAt?.slice(0,16).replace('T',' ')||'noch nicht geladen')+'</p></section>';
  h+='<section class="home-list"><div class="home-list-head"><h2>Meine ausgewählten Aktien</h2><button type="button" class="secondary" data-home-add>＋ Aktie hinzufügen</button></div><p class="home-sort-hint">☰ Gedrückt halten und nach oben oder unten ziehen, um die Reihenfolge zu ändern.</p>';
  if(!selected.length)h+='<div class="home-empty"><p>Du hast noch keine Aktien ausgewählt. Wähle deine Werte aus dem vorhandenen UNITY-Katalog. Die App zeigt sie danach automatisch beim Öffnen an.</p><button type="button" class="primary" data-home-add>Aktien auswählen</button></div>';
  for(const [i,s] of selected.entries()){
    const {x,m,valid}=unityHomeQuote(s);
    const change=valid?unityHomeMovement(x,unityHomeRange):NaN;
    const rising=Number.isFinite(change)&&change>0,falling=Number.isFinite(change)&&change<0;
    const cls=rising?'home-up':falling?'home-down':'home-flat';
    h+='<div class="home-stock-item" data-home-row="'+esc(s.id)+'"><button type="button" class="home-drag-handle" data-home-drag="'+esc(s.id)+'" title="Gedrückt halten und Aktie verschieben" aria-label="'+esc(s.name)+' verschieben">☰</button><button type="button" class="home-stock-row" data-home-open="'+esc(s.id)+'"><span class="home-trend-icon '+cls+'" aria-hidden="true">'+(rising?'↗':falling?'↘':'–')+'</span>'+
      '<span class="home-stock-main"><strong>'+esc(s.name)+'</strong><small>'+esc(s.ticker)+' · '+esc(s.exchange)+' · '+esc(valid?m.trend:'Daten nicht ausreichend')+'</small></span>'+
      '<span class="home-stock-right"><strong class="'+cls+'">'+(valid?unityPct(change):'–')+'</strong><small>'+(x?number(Number(x.price),2)+' '+esc(s.currency):'Kurs fehlt')+'</small><small>'+(x?esc(x.date):'Kein Datenstand')+'</small></span><span class="home-chevron">›</span></button></div>';
  }
  h+='</section>';
  if(unityHomeSelected)h+=unityHomeDetail(unityHomeSelected);
  h+='<section class="home-bottom-actions"><button type="button" class="secondary" data-home-reload '+(unityMarketLoading?'disabled':'')+'>'+(unityMarketLoading?'Kursdaten werden geladen …':'Kursdaten erneut prüfen')+'</button><button type="button" class="secondary" data-home-all>Alle UNITY-Kandidaten vergleichen</button><button type="button" class="secondary" data-home-trades>Käufe / Verkäufe</button></section>';
  h+='<p class="home-disclaimer">Die Pfeile und Prozentwerte zeigen die Kursänderung im gewählten Zeitraum, nicht den persönlichen Depotgewinn. Die Trendbewertung nutzt gleitende Durchschnitte. Die App gibt ohne geprüfte Fundamentaldaten, Earnings und aktuelle Handelskurse keine Kauf- oder Verkaufsfreigabe.</p>';
  return h;
}
function unityHomeDetail(sid){
  const s=unityHomeStocks().find(x=>x.id===sid);
  if(!s)return '';
  const {x,m,valid}=unityHomeQuote(s),d=unityHomeDecision(s);
  let h='<section class="home-detail" id="home-stock-detail"><div class="home-detail-title"><div><small>Aktienansicht</small><h2>'+esc(s.name)+'</h2><p>'+esc(s.ticker)+' · '+esc(s.exchange)+' · '+esc(s.currency)+'</p></div><button type="button" class="secondary" data-home-close>Schließen</button></div>';
  if(x){
    h+=unityChartPanel(x);
    h+='<p class="home-price-time">Letzter verfügbarer Schlusskurs: <b>'+number(x.price,2)+' '+esc(s.currency)+'</b> · '+esc(x.date)+' · '+esc(x.exchange||s.exchange)+'</p>';
  }else h+='<p class="home-missing">Kein überprüfbarer Kursverlauf vorhanden. Es wird keine Kurve erfunden.</p>';
  h+=unityHomeSecurityDetails(s,x);
  h+=unityHomeTradeActions(s);
  h+='<div class="home-decision"><div class="home-decision-head"><span>Automatischer UNITY-Kurzbefund</span><strong>'+esc(d.action)+'</strong></div>'+
    '<div class="home-decision-grid"><div><small>Kauf</small><b>'+esc(d.buy)+'</b></div><div><small>Verkauf</small><b>'+esc(d.sell)+'</b></div><div><small>Technischer Trend</small><b>'+esc(d.technical)+'</b></div><div><small>Technikindex</small><b>'+(valid&&Number.isFinite(d.index)?d.index+'/100':'–')+'</b></div></div>'+
    '<p><b>Begründung:</b> '+esc(d.reason)+'</p><p class="tiny muted">'+esc(d.confidence)+'</p></div>'+
    '<button type="button" class="home-analyze-btn" data-home-analyze="'+esc(s.id)+'">Vollständige UNITY-Analyse & Datenlage ansehen <span aria-hidden="true">›</span></button>'+
    '<p class="tiny muted">Die Analyse berechnet vorhandene Kennzahlen automatisch. Fehlende Bilanz-, Bewertungs- und Ereignisdaten werden als offene Prüfpunkte angezeigt, nicht geschätzt.</p></section>';
  return h;
}


function unityHomeSecurityDetails(s,x){
  const p=depotPosition(s),rows=[
    ['Kursdaten',x?number(Number(x.price),2)+' '+s.currency:'Nicht verfügbar','Letzter verfügbarer Börsenschlusskurs'],
    ['Kursdatum',x?.date||'–','Zeitpunkt des Kursstands, keine Echtzeit'],
    ['Börsenplatz',x?.exchange||s.exchange,'Referenzmarkt'],
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
  const p=depotPosition(s),market=unityMarketItem(s.isin),mode=unityHomeTradeMode;
  let h='<div class="home-trade-actions"><button type="button" class="home-buy-button" data-home-trade="BUY">＋ Kaufen · Simulation</button>'+
    '<button type="button" class="home-sell-button" data-home-trade="SELL" '+(p.qty>0?'':'disabled')+'>− Verkaufen · Simulation</button></div>';
  if(!p.qty)h+='<p class="tiny muted">Für einen Testverkauf zunächst eine simulierte Position kaufen.</p>';
  if(mode!=='BUY'&&mode!=='SELL')return h;
  const sell=mode==='SELL',eur=s.currency==='EUR',fx=eur?'1':'',price=market&&Number(market.price)>0?Number(market.price).toFixed(2):'';
  h+='<form class="home-trade-form" id="home-trade-form"><h3>'+(sell?'Testverkauf':'Testkauf')+' · '+esc(s.name)+'</h3>'+
    '<p class="tiny muted">Nur eine Simulation. Es wird keine Order an eine Bank oder Börse gesendet. Der Kurs ist ein Vorschlag auf Basis des letzten verfügbaren Schlusskurses, kein ausführbarer Echtzeitkurs.</p>'+
    '<input type="hidden" name="instrumentId" value="'+esc(s.id)+'"><input type="hidden" name="type" value="'+mode+'">'+
    '<label>Stückzahl<input type="number" name="quantity" step="any" min="0.000001" '+(sell?'max="'+number(p.qty,6)+'"':'')+' required placeholder="'+(sell?'Maximal '+number(p.qty,4):'z. B. 5')+'"></label>'+
    '<label>Simulierter Kurs ('+esc(s.currency)+')<input type="number" name="price" step="any" min="0.000001" value="'+esc(price)+'" required></label>'+
    '<label>EUR je 1 '+esc(s.currency)+'<input type="number" name="fx" step="any" min="0.000001" value="'+fx+'" '+(eur?'readonly':'required')+' placeholder="'+(eur?'1':'Aktuellen Wechselkurs eintragen')+'"></label>'+
    '<label>Zeitpunkt<input type="datetime-local" name="executedAt" value="'+localNow()+'" required></label>'+
    '<label class="full">Notiz zur Entscheidung<textarea name="note" maxlength="1000" placeholder="Warum kaufst oder verkaufst du testweise?"></textarea></label>'+
    '<div class="full home-trade-confirm"><button class="primary" type="submit">'+(sell?'Testverkauf speichern':'Testkauf speichern')+'</button><button type="button" class="secondary" data-home-trade-cancel>Abbrechen</button></div></form>';
  return h;
}
async function unityHomeSaveTrade(data){
  const s=stocks().find(x=>x.id===data.instrumentId);if(!s)throw Error('Aktie nicht gefunden.');
  const type=data.type;if(type!=='BUY'&&type!=='SELL')throw Error('Ungültige Buchungsart.');
  const quantity=Number(data.quantity),price=Number(data.price),fx=Number(data.fx),at=new Date(data.executedAt);
  if(!(quantity>0&&price>0&&fx>0))throw Error('Stückzahl, Kurs und EUR-Wechselkurs müssen positiv sein.');
  if(!Number.isFinite(at.getTime())||at.getTime()>Date.now()+60000)throw Error('Ungültiger oder zukünftiger Ausführungszeitpunkt.');
  if(s.currency==='EUR'&&fx!==1)throw Error('Für EUR muss der Wechselkurs 1 sein.');
  if(type==='SELL'){
    const available=depotLedger(s.id,at.toISOString().slice(0,10)).qty;
    if(quantity>available+1e-8)throw Error('Nicht genügend simulierte Aktien am gewählten Datum. Verfügbar: '+number(available,4));
  }
  const t={id:id(),instrumentId:s.id,type,quantity,price,fx,amount:quantity*price,
    decidedAt:at.toISOString(),executedAt:at.toISOString(),note:String(data.note||'').trim(),
    source:'UNITY Lab · Testhandel',createdAt:new Date().toISOString()};
  if(!confirm((type==='BUY'?'Testkauf':'Testverkauf')+' von '+number(quantity,4)+' Stück '+s.name+' zu '+number(price,2)+' '+s.currency+' speichern? Dies ist KEIN echter Börsenauftrag.'))return false;
  await put('transactions',t);await audit(type==='BUY'?'BUY_ADD':'SELL_ADD',t.id,'Simuliert · '+s.ticker);
  await refresh();return true;
}

function unityHomeManagePanel(){
  let h='<section class="panel" id="home-manage"><h2>Meine Aktienauswahl verwalten</h2><p class="muted">Bestimme, welche Aktien auf der Startseite erscheinen. Ausblenden entfernt keine Buchungen, Kursdaten oder Analysen.</p>';
  if(!stocks().length)h+='<p>Noch keine Aktien gespeichert. Wähle unten eine Aktie aus dem Katalog.</p>';
  for(const s of stocks())h+='<div class="home-manage-row"><div><strong>'+esc(s.name)+'</strong><small>'+esc(s.ticker)+' · '+esc(s.isin||s.exchange)+'</small></div><button type="button" class="'+(s.watchHidden?'secondary':'primary')+'" data-home-toggle="'+esc(s.id)+'">'+(s.watchHidden?'Auf Startseite zeigen':'Ausblenden')+'</button></div>';
  return h+'</section>';
}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.homeToggle){const stock=stocks().find(s=>s.id===b.dataset.homeToggle);if(stock){put('instruments',{...stock,watchHidden:!stock.watchHidden}).then(()=>audit('WATCHLIST_TOGGLE',stock.id,!stock.watchHidden?'hidden':'shown')).then(refresh).catch(err=>alert(err.message||String(err)))}return}
  if(b.dataset.homeShift){unityHomeShift(b.dataset.homeShift,Number(b.dataset.direction)).catch(err=>alert(err.message||String(err)));return}
  if(b.dataset.homeTrade){unityHomeTradeMode=b.dataset.homeTrade;render();document.getElementById('home-trade-form')?.scrollIntoView({block:'nearest'});return}
  if(b.hasAttribute('data-home-trade-cancel')){unityHomeTradeMode='';render();return}
  if(b.dataset.homeRange){unityHomeRange=b.dataset.homeRange;render();return}
  if(b.dataset.homeOpen){unityHomeSelected=b.dataset.homeOpen;unityHomeTradeMode='';render();document.getElementById('home-stock-detail')?.scrollIntoView({behavior:'smooth',block:'start'});return}
  if(b.hasAttribute('data-home-close')){unityHomeSelected='';unityHomeTradeMode='';render();return}
  if(b.dataset.homeAnalyze){selectedUnityStock=b.dataset.homeAnalyze;activeTab='analysis';render();document.getElementById('app')?.scrollIntoView({block:'start'});return}
  if(b.hasAttribute('data-home-add')){activeTab='stocks';render();document.getElementById('catalog-search')?.scrollIntoView({block:'start'});document.getElementById('catalog-search')?.focus();return}
  if(b.hasAttribute('data-home-all')){unityScope='all';activeTab='stocks';render();return}
  if(b.hasAttribute('data-home-trades')){activeTab='trades';render();return}
  if(b.hasAttribute('data-home-reload')){unityLoadMarket();return}
});
// Recheck the published EOD snapshot when the user returns to the app.
// A refreshed snapshot is not a live quote stream.
let unityHomeLastCheck=Date.now();
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&Date.now()-unityHomeLastCheck>15*60000){
    unityHomeLastCheck=Date.now();unityLoadMarket();
  }
});

/* Touch + mouse reorder: move only from the explicit grip so tapping a row still opens details. */
document.addEventListener('pointerdown',e=>{
  const grip=e.target.closest('[data-home-drag]');if(!grip||e.button!==0)return;
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
  if(drag.moved&&drag.target!==drag.id)unityHomeReorder(drag.id,drag.target).catch(err=>alert(err.message||String(err)));
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
