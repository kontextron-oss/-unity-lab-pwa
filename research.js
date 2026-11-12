'use strict';
/* UNITY official issuer monitor (public SEC/XBRL filing metadata only).
   No article text, paid feeds, automated recommendations or client API keys. */
let unityResearch=null,unityResearchError='',unityResearchLoading=false;
const unityResearchUrl='./data/research.json';
function unityResearchDate(value){
  const s=String(value||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(s.slice(0,10))?s.slice(0,10):'';
}
function unityResearchIsFresh(doc){
  const time=Date.parse(doc?.generatedAt||'');
  return Number.isFinite(time)&&time<=Date.now()+3600000&&Date.now()-time<8*86400000;
}
function unityResearchSourceLink(url){
  const s=String(url||'');
  return /^https:\/\/(?:www\.sec\.gov|data\.sec\.gov|filings\.xbrl\.org|global\.abb|www\.infineon\.com|www\.siemens-energy\.com|www\.se\.com|view\.news\.eu\.nasdaq\.com)(?:\/|$)/i.test(s)?s:'';
}
function unityResearchItem(stock){
  if(!stock||!unityResearch?.items)return null;
  // ISIN is primary; an unverified bare ticker must not inherit another company's CIK.
  const key=stock.isin||String(stock.providerSymbol||stock.ticker||'').toUpperCase();
  const item=unityResearch.items[key];
  if(!item)return null;
  if(item.isin&&stock.isin&&item.isin!==stock.isin)return null;
  if(item.ticker){
    const ticker=String(stock.providerSymbol||stock.ticker||'').toUpperCase();
    if(ticker!==String(item.ticker).toUpperCase())return null;
  }
  return item;
}
function unityResearchRecent(stock){
  const item=unityResearchItem(stock);
  if(!unityResearchIsFresh(unityResearch)||!item||['source-unavailable','stale-previous'].includes(item.status))return null;
  const ev=(item.events||[]).find(e=>{
    const d=Date.parse(unityResearchDate(e.filedAt));
    return d<=Date.now()+86400000&&Date.now()-d<=8*86400000&&!!unityResearchSourceLink(e.url);
  });
  return ev||null;
}
function unityResearchEventLabel(event){
  const kind=String(event?.eventClass||'filing');
  const allowed={leadership:'Führungswechsel / Management',cybersecurity:'Cybersecurity-Ereignis',
    accounting:'Rechnungslegung überprüfen',impairment:'Wertminderung / Abschreibung',
    contract:'Wesentlicher Vertragsverlust',financing:'Fälligkeit / Finanzierung prüfen'};
  return allowed[kind]||String(event?.label||'Amtliche Pflichtmeldung');
}
function unityResearchBadge(stock){
  const e=unityResearchRecent(stock);
  return e?'<span class="unity-issuer-event-flag" title="Amtliche, entscheidungsrelevante Meldung: Original prüfen; kein automatisches Kauf- oder Verkaufssignal">◆ '+esc(unityResearchEventLabel(e))+' · Prüfung nötig</span>':'';
}
function unityResearchPanel(stock){
  const item=unityResearchItem(stock);
  // Always state when a symbol is not yet covered; silence would imply completeness.
  let html='<section class="panel unity-issuer-panel"><h3>Automatischer Quellenmonitor · Unternehmensberichte</h3>';
  if(!item){
    html+='<p class="tiny muted">'+(unityResearchLoading?'Öffentliche Quellen werden geladen.':
      unityResearchError?'Quellenmonitor derzeit nicht erreichbar. Es erfolgt keine neue Unternehmensbewertung.':
      'Für diese Aktie sind noch keine bestätigten amtlichen Berichte angebunden.')+'</p>';
    return html+'</section>';
  }
  const fresh=unityResearchIsFresh(unityResearch),bad=!fresh||item.status==='stale-previous'||item.status==='source-unavailable';
  const state=bad?'Quelle veraltet / nicht erreichbar':item.status==='metrics-partial'?'Amtliche Zahlen teilweise verfügbar':
    item.status==='filings-only'?'Amtliche Veröffentlichungen verfügbar':
    item.status==='european-pilot'?'Europäische Unternehmensberichte separat verfügbar':'Daten prüfen';
  html+='<p><b>Quellenstand:</b> '+esc(state)+'</p>'+
    '<p class="tiny muted">Letzte Monitoraktualisierung: '+esc(unityResearchDate(unityResearch.generatedAt)||'offen')+
    ' · Unternehmensquelle: '+esc(item.source||'unbekannt')+'.</p>';
  if(bad)html+='<p class="tiny muted"><b>Keine aktuelle Schlussfolgerung:</b> Dieser Datenstand ist unvollständig oder veraltet.</p>';
  const keys=[['revenue','Umsatz'],['netIncome','Jahresüberschuss'],['operatingCashFlow','Operativer Cashflow'],
    ['equity','Eigenkapital'],['assets','Bilanzsumme'],['liabilities','Verbindlichkeiten']];
  const metrics=item.metrics||{};
  const available=keys.filter(([k])=>metrics[k]&&Number.isFinite(Number(metrics[k].value))&&metrics[k].unit==='USD');
  if(available.length){
    html+='<div class="unity-issuer-metrics">';
    for(const [k,label] of available){
      const m=metrics[k],value=Number(m.value);
      const compact=(value/1000000000).toLocaleString('de-DE',{maximumFractionDigits:2});
      html+='<div class="unity-issuer-metric"><small>'+label+'</small><b>'+esc(compact)+' Mrd. USD</b>'+
        '<small>'+esc(m.period==='Q'?'Quartal':m.period==='FY'?'Geschäftsjahr':'Bilanzstichtag')+' · '+esc(m.end)+
        ' · gemeldet '+esc(m.filed)+'</small></div>';
    }
    html+='</div>';
  }else if(item.status==='european-pilot'){
    html+='<p class="tiny muted">Europäische Konzernkennzahlen stehen im separaten geprüften XBRL-/Emittentenbereich. Keine Doppelzählung.</p>';
  }else html+='<p class="tiny muted">Keine eindeutig zugeordneten neuen Finanzkennzahlen. Fehlende Angaben werden nicht geschätzt.</p>';
  const events=(item.events||[]).filter(e=>unityResearchSourceLink(e.url)&&unityResearchDate(e.filedAt)).slice(0,6);
  if(events.length){
    html+='<h4>Amtliche Veröffentlichungen</h4><div class="unity-issuer-events">';
    for(const ev of events){
      const eventLabel=unityResearchEventLabel(ev);
      const review=ev.decisionImpact==='review'?' · Prüfung erforderlich':'';
      html+='<div class="unity-issuer-event"><span><strong>'+esc(eventLabel)+'</strong>'+
        '<small>'+esc(ev.filedAt)+' · '+esc(ev.source||'')+' · '+esc(ev.form||'')+esc(review)+'</small></span>'+
        '<a href="'+esc(unityResearchSourceLink(ev.url))+'" target="_blank" rel="noopener noreferrer">Original öffnen</a></div>';
    }
    html+='</div>';
  }else html+='<p class="tiny muted">Keine passende neue Pflichtveröffentlichung in dieser Quelle.</p>';
  html+='<p class="tiny muted">Wichtig: Führungswechsel, Governance-, Cyber-, Rechnungslegungs-, Finanzierungs- oder Vertragsmeldungen markieren eine verpflichtende Neubewertung. Sie sagen allein weder etwas Positives noch Negatives über die Aktie aus und ergeben keine Handelsfreigabe; eine automatische Handelsfreigabe ist ausgeschlossen.</p>';
  return html+'</section>';
}
async function unityLoadResearch(){
  if(unityResearchLoading)return;
  unityResearchLoading=true;
  try{
    const r=await fetch(unityResearchUrl+'?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw Error('HTTP '+r.status);
    const data=await r.json();
    if(data.schemaVersion!==1||!data.items||typeof data.items!=='object'||
      !Array.isArray(Object.keys(data.items)))throw Error('Falsches Quellenformat');
    unityResearch=data;unityResearchError='';
  }catch(e){unityResearchError=String(e.message||e)}
  finally{unityResearchLoading=false;if(typeof render==='function'&&typeof db!=='undefined'&&db)render()}
}
unityLoadResearch();
