'use strict';
/* Market context from the dated, local EOD snapshot. It never substitutes issuer evidence. */
function unityBenchmarkItem(){
  const x=unityMarket?.items?.['@SPY5.DE'];
  if(!x||!Array.isArray(x.points)||x.points.length<200||!(Number(x.price)>0))return null;
  return x;
}
function unityAlignedCloses(a,b){
  const bm=new Map((b?.points||[]).map(p=>[String(p.date),Number(p.close)]));
  return (a?.points||[]).map(p=>({date:String(p.date),stock:Number(p.close),benchmark:bm.get(String(p.date))}))
    .filter(p=>p.stock>0&&p.benchmark>0);
}
function unityWindowReturn(points,key,sessions){
  if(!Array.isArray(points)||points.length<=sessions)return NaN;
  const last=Number(points.at(-1)?.[key]),start=Number(points.at(-1-sessions)?.[key]);
  return last>0&&start>0?(last/start-1)*100:NaN;
}
function unityAnnualizedVolatility(points,sessions=20){
  if(!Array.isArray(points)||points.length<=sessions)return NaN;
  const sample=points.slice(-sessions-1).map(p=>Number(p.stock));
  const returns=[];
  for(let i=1;i<sample.length;i++)if(sample[i-1]>0&&sample[i]>0)returns.push(Math.log(sample[i]/sample[i-1]));
  if(returns.length<sessions)return NaN;
  const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
  const variance=returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1);
  return Math.sqrt(variance)*Math.sqrt(252)*100;
}
function unityMarketRegime(benchmark){
  const close=(benchmark?.points||[]).map(p=>Number(p.close)).filter(n=>n>0);
  if(close.length<200)return {kind:'open',title:'Marktregime offen',detail:'Für den Marktvergleich fehlen mindestens 200 gemeinsame Handelstage.'};
  const last=close.at(-1),sma50=close.slice(-50).reduce((a,b)=>a+b,0)/50,sma200=close.slice(-200).reduce((a,b)=>a+b,0)/200;
  const r21=last/close.at(-22)-1;
  if(last<sma200&&r21<=-.05)return {kind:'stress',title:'Marktstress – neue technische Einstiege zurückstellen',detail:'Der Vergleichsmarkt liegt unter seinem SMA200 und verlor in 21 Sitzungen mindestens 5 %. Das ist ein Vorsichtsfilter, kein Verkaufsauftrag.',last,sma50,sma200,r21:r21*100};
  if(last>=sma200&&sma50>=sma200)return {kind:'constructive',title:'Marktumfeld technisch konstruktiv',detail:'Der Vergleichsmarkt liegt über SMA50 und SMA200. Einzelwerte müssen dennoch separat geprüft werden.',last,sma50,sma200,r21:r21*100};
  return {kind:'fragile',title:'Marktumfeld fragil',detail:'Der Vergleichsmarkt zeigt keine bestätigte Aufwärtsstruktur. Technische Signale einzelner Werte vorsichtiger einordnen.',last,sma50,sma200,r21:r21*100};
}
function unityMarketContext(stock){
  if(typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(stock))return {available:false,reason:'Für Kryptowerte gilt ein eigener 24/7-Marktvergleich.'};
  const item=typeof unityMarketForStock==='function'?unityMarketForStock(stock):(typeof unityMarketItem==='function'?unityMarketItem(stock?.isin):null);
  const benchmark=unityBenchmarkItem();
  if(!item||!benchmark)return {available:false,reason:'Kursreihe oder Marktvergleich sind nicht vollständig verfügbar.'};
  const aligned=unityAlignedCloses(item,benchmark);
  if(aligned.length<201)return {available:false,reason:'Für relative Stärke fehlen 200 gemeinsame Handelstage.'};
  const stock63=unityWindowReturn(aligned,'stock',63),benchmark63=unityWindowReturn(aligned,'benchmark',63);
  const stock21=unityWindowReturn(aligned,'stock',21),benchmark21=unityWindowReturn(aligned,'benchmark',21);
  return {available:true,benchmark,regime:unityMarketRegime(benchmark),relative63:Number.isFinite(stock63)&&Number.isFinite(benchmark63)?stock63-benchmark63:NaN,relative21:Number.isFinite(stock21)&&Number.isFinite(benchmark21)?stock21-benchmark21:NaN,volatility20:unityAnnualizedVolatility(aligned,20),sessions:aligned.length};
}
function unityMarketContextPanel(stock){
  if(typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(stock))return '';
  const c=unityMarketContext(stock);
  let h='<section class="panel unity-market-context"><h3>Marktvergleich & Risikorahmen</h3>';
  if(!c.available)return h+'<p class="tiny muted">'+esc(c.reason)+' Keine Annahme wird daraus abgeleitet.</p></section>';
  const f=v=>Number.isFinite(v)?(v>0?'+':'')+number(v,1)+' %':'–';
  h+='<p class="tiny muted">Vergleich mit '+esc(c.benchmark.name||'SPDR S&P 500 UCITS ETF')+' aus derselben datierten Tageskursdatei. Relative Stärke ist ein Priorisierungsmerkmal, keine Qualitäts- oder Kaufbewertung.</p>'+
    '<div class="home-decision-grid"><div><small>Relative Stärke · 63 Sitzungen</small><b>'+f(c.relative63)+'</b><small>Aktie minus Markt</small></div><div><small>Relative Stärke · 21 Sitzungen</small><b>'+f(c.relative21)+'</b><small>Kurzfristige Entwicklung</small></div><div><small>20-Tage-Volatilität · annualisiert</small><b>'+f(c.volatility20)+'</b><small>Historische Schwankung, kein Stop</small></div><div><small>Marktregime</small><b>'+esc(c.regime.title)+'</b><small>'+esc(c.regime.detail)+'</small></div></div>'+
    '<p class="tiny muted">Gemeinsame Handelstage: '+c.sessions+' · Benchmark-Stichtag '+esc(c.benchmark.date||'–')+' · Quelle: '+esc(c.benchmark.source||'datierter EOD-Snapshot')+'.</p>';
  return h+'</section>';
}
