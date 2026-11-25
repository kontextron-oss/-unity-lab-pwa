'use strict';
/* Four European stocks: experimental 15-minute Yahoo chart bars.
   Bars are not licensed live quotes. Timestamp is exchange observation, not
   download time. Strictly separate from daily history and UNITY approval. */
let unityIntraday=null,unityIntradayError='',unityIntradayLoading=false;
const unityIntradayPilotIsins=new Set(['CH0012221716','FR0000121972','DE000ENER6Y0','DE0006231004']);
function unityIntradayItem(isin){
  if(!unityIntradayPilotIsins.has(isin)||!unityIntraday||unityIntraday.errors?.[isin])return null;
  const item=unityIntraday.items?.[isin],expected=CATALOG.find(s=>s.isin===isin);
  if(!item||item.isin!==isin||!expected||item.currency!==expected.currency||
     !(Number(item.price)>0)||item.quotePrecision!=='15m-bar'||
     !Number.isFinite(Date.parse(item.quotedAt)))return null;
  const observed=Date.parse(item.quotedAt),age=(Date.now()-observed)/60000;
  if(age < -2||age>90)return null;
  // After the relevant exchange has closed, use the dated daily close rather
  // than showing a stale intraday bar as a continuing market observation.
  const now=new Date(),day=now.getUTCDay(),hour=now.getUTCHours()+now.getUTCMinutes()/60;
  const swiss=String(item.exchange||'').toLowerCase().includes('swiss');
  const open=day>=1&&day<=5&&hour>=8&&(swiss?hour<16.6:hour<17.6);
  if(!open)return null;
  return item;
}
function unityDisplayQuote(s){
  const fullDaily=typeof unityMarketForStock==='function'?unityMarketForStock(s):unityMarketItem(s.isin),daily=fullDaily||(typeof unityReferenceQuoteItem==='function'?unityReferenceQuoteItem(s):null),pilot=unityIntradayItem(s.isin);
  // A newer 15-minute observation on the SAME trading day must not be
  // suppressed by an earlier dated daily-chart snapshot.
  const lastDailyFetch=Date.parse(daily?.lastSuccessfulFetchAt||(typeof unityMarket!=='undefined'?unityMarket?.generatedAt:'')||'');
  const pilotNewer=pilot&&(!daily||pilot.quotedAt.slice(0,10)>daily.date||
    pilot.quotedAt.slice(0,10)===daily.date&&
    Number.isFinite(lastDailyFetch)&&Date.parse(pilot.quotedAt)>lastDailyFetch);
  if(pilotNewer){
    return {price:pilot.price,currency:pilot.currency,exchange:pilot.exchange||s.exchange,
      date:pilot.quotedAt.slice(0,10),quotedAt:pilot.quotedAt,precision:'15m-bar',
      source:pilot.source,ageMinutes:Math.max(0,Math.floor((Date.now()-Date.parse(pilot.quotedAt))/60000)),
      label:'Pilot: 15-Minuten-Kursbalken (inoffiziell; keine garantierte Verzögerung)'};
  }
  if(daily)return {price:daily.price,currency:daily.currency,exchange:daily.exchange||s.exchange,
    date:daily.date,quotedAt:null,precision:'day',source:daily.source,
    label:fullDaily?'Letzter Börsenschlusskurs (inoffiziell)':'Letzter Schlusskurs (kurze Historie, technische Analyse offen)'};
  return null;
}
async function unityLoadIntraday(){
  if(unityIntradayLoading)return;
  unityIntradayLoading=true;
  try{
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
    let response;
    try{response=await fetch('./data/intraday.json?t='+Date.now(),{cache:'no-store',signal:c.signal,credentials:'omit'})}
    finally{clearTimeout(timer)}
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(data.schemaVersion!==1||!data.items||!Number.isFinite(Date.parse(data.generatedAt)))throw Error('Pilotformat ungültig');
    unityIntraday=data;unityIntradayError='';
    if(typeof unityAutoAnalysisSchedule==='function')unityAutoAnalysisSchedule('intraday');
  }catch(e){unityIntradayError=e.message||String(e);unityIntraday=null}
  finally{unityIntradayLoading=false;if(typeof render==='function')render()}
}
unityLoadIntraday();
