'use strict';
/* UNITY PRIVATE WORKER FOUNDATION – platform-independent SANDBOX logic.
 * It never reads the iPhone IndexedDB, brokers, personal watchlists or pCloud.
 * Public Actions may run only synthetic demonstrations.
 * All decisions and simulated trades are labelled DEMO; do NOT confuse with
 * the user's existing local Testdepot or a live market execution. */
const crypto=require('node:crypto');
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
  new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const cents=x=>Math.round(Number(x)*100);
const sum=a=>a.reduce((n,x)=>n+x,0);
const average=a=>sum(a)/a.length;
function rsi(points){
  if(points.length<15)return NaN;
  let up=0,down=0;
  for(let i=points.length-14;i<points.length;i++){
    const delta=points[i].close-points[i-1].close;
    if(delta>0)up+=delta;else down-=delta;
  }
  return down===0?(up?100:50):100-100/(1+up/down);
}
function verifyQuote(s,feed,fx,asOf){
  if(!s||s.assetClass!=='equity'||!s.isin||!s.exchange||!s.currency)
    return {ok:false,reason:'Aktien-Testinstrument nicht eindeutig'};
  if(feed?.schemaVersion!==1||!Number.isFinite(Date.parse(feed.generatedAt||''))||
     !feed.items||typeof feed.items!=='object')
    return {ok:false,reason:'Fehlende Kursquelle/Zeitstempel'};
  const age=asOf-Date.parse(feed.generatedAt);
  if(age< -3600000||age>72*3600000)return {ok:false,reason:'Kurs-Snapshot veraltet'};
  const item=feed.items[s.isin.toUpperCase()];
  if(!item||item.isin!==s.isin.toUpperCase()||item.currency!==s.currency||
     item.exchange!==s.exchange||!validDate(item.date)||!(Number(item.price)>0))
    return {ok:false,reason:'ISIN/Börse/Währung/Kurs nicht zuordenbar'};
  if(asOf-Date.parse(item.date+'T00:00:00Z')>6*86400000||
     asOf-Date.parse(item.date+'T00:00:00Z')< -2*86400000)
    return {ok:false,reason:'Kursdatum ungültig'};
  const raw=item.points;
  if(!Array.isArray(raw)||raw.length<201)return {ok:false,reason:'200-Tage-Historie fehlt'};
  const points=raw.slice(-252).map(p=>({date:p.date,close:Number(p.close)}));
  if(points.some((p,i)=>!validDate(p.date)||!(p.close>0)||(i>0&&p.date<=points[i-1].date))||
     points.at(-1).date!==item.date||
     Math.abs(points.at(-1).close-item.price)>Math.max(.0001,item.price*.000001))
    return {ok:false,reason:'Historie/letzter Schlusskurs widersprüchlich'};
  let rate=1;
  if(s.currency!=='EUR'){
    rate=Number(fx?.rates?.[s.currency]);
    if(fx?.schemaVersion!==1||!(rate>0)||!validDate(fx.referenceDate)||
      asOf-Date.parse(fx.referenceDate+'T00:00:00Z')>6*86400000)
      return {ok:false,reason:'EUR-Umrechnung unvollständig'};
  }
  const closes=points.map(x=>x.close),ma50=average(closes.slice(-50)),
    ma200=average(closes.slice(-200));
  return {ok:true,price:item.price,quoteDate:item.date,ma50,ma200,rsi:rsi(points),
    currency:s.currency,rate,exchange:s.exchange,isin:s.isin,
    source:String(item.source||'Unabhängige Prüfung offen'),
    feedGeneratedAt:feed.generatedAt};
}
function eligible(q){
  return q.ok&&q.price>=q.ma50*.98&&q.price<=q.ma50*1.02&&
    q.price>=q.ma200&&q.ma50>=q.ma200&&q.rsi>=40&&q.rsi<=68;
}
function fillId(order){
  return 'unity-worker-demo-'+crypto.createHash('sha256').update(
    [order.id,order.activatedAt,order.triggerQuoteDate].join('|')).digest('hex').slice(0,24);
}
function modelFill(q,side,amountEur,quantity,policy){
  const spread=Number(policy?.spreadBps),slippage=Number(policy?.slippageBps),fee=Number(policy?.feeEur);
  if(!(spread>=0&&spread<=200&&slippage>=0&&slippage<=200&&fee>=0&&fee<=100))
    return null;
  const price=q.price*(1+(side==='BUY'?1:-1)*(spread/2+slippage)/10000);
  const qty=side==='BUY'?(amountEur-fee)/(price*q.rate):quantity;
  const total=side==='BUY'?qty*price*q.rate+fee:qty*price*q.rate-fee;
  if(!(price>0&&qty>0&&total>0))return null;
  return {price,qty,totalEur:Math.round(total*100)/100,fee,spread,slippage,
    referenceClose:q.price,quoteDate:q.quoteDate,source:q.source};
}
function sampleState(){
  return {schema:1,mode:'synthetic-demo',enabled:false,budgetEur:500,openingCashEur:1000,
    policy:{spreadBps:10,slippageBps:15,feeEur:1},
    instruments:[],orders:[],trades:[],events:[],
    run:{lastAttempt:'',lastSuccess:'',status:'not-enabled',failures:0}};
}
function validate(state){
  if(state?.schema!==1||state?.mode!=='synthetic-demo'||!Array.isArray(state.orders)||
     !Array.isArray(state.instruments)||!Array.isArray(state.trades)||
     !(state.budgetEur>=0)||!(state.openingCashEur>=0)||
     state.orders.length>300||state.trades.length>50000)
    throw Error('Unzulässiger privater Demonstrationsstand; Ausführung verweigert');
}
function tick(source,feed,fx,asOf=Date.now()){
  validate(source);
  const state=JSON.parse(JSON.stringify(source)),now=new Date(asOf).toISOString(),
    events=[],notice=(kind,detail,quoteDate='')=>{const e={kind,detail,quoteDate,at:now};
      events.push(e);state.events.push(e)};
  state.run.lastAttempt=now;
  if(!state.enabled){state.run.status='paused';return {state,events}};
  let seen=false;
  for(const o of state.orders){
    if(!o.active||o.state==='filled'||o.state==='cancelled')continue;
    const s=state.instruments.find(x=>x.id===o.instrumentId);
    if(!s||s.assetClass!=='equity'||o.sandboxApproved!==true||o.mode!=='technical-demo'||
       !['BUY','SELL'].includes(o.side)){
      notice('blocked','Kein freigegebener Demo-Aktienauftrag');continue;
    }
    const q=verifyQuote(s,feed,fx,asOf);
    if(!q.ok){notice('data-block',q.reason);continue}
    seen=true;
    const earnings=Date.parse(o.nextEarnings||'');
    if(Number.isFinite(earnings)&&earnings>=asOf-86400000&&earnings<asOf+7*86400000){
      notice('event-block','Bestätigtes Ergebnisereignis nahe',q.quoteDate);continue;
    }
    if(!o.triggerQuoteDate){
      if(q.quoteDate<=String(o.activatedAt||'').slice(0,10))continue;
      const signal=o.side==='BUY'?eligible(q):
        q.price<=Math.max(q.ma200*.99,q.ma50*.96);
      if(!signal)continue;
      o.triggerQuoteDate=q.quoteDate;o.triggerLimit=o.side==='BUY'?q.ma50*1.02:null;
      o.state='triggered';notice('trigger',o.side+'-Signal erfasst',q.quoteDate);continue;
    }
    if(q.quoteDate<=o.triggerQuoteDate)continue;
    const id=fillId(o);
    if(state.trades.some(t=>t.id===id)){o.active=false;o.state='filled';continue}
    const held=sum(state.trades.filter(t=>t.instrumentId===s.id).map(t=>t.side==='BUY'?t.quantity:-t.quantity));
    if(o.side==='SELL'&&!(held>0)){notice('blocked','Keine Testposition für Verkauf',q.quoteDate);continue}
    const fill=modelFill(q,o.side,Number(o.amountEur),held,state.policy);
    if(!fill){notice('blocked','Fester Betrag/Modellkosten ungültig',q.quoteDate);continue}
    if(o.side==='BUY'){
      if(fill.price>o.triggerLimit){
        delete o.triggerQuoteDate;delete o.triggerLimit;o.state='waiting';
        notice('limit-block','Preis höher als bei Auslösung zulässig',q.quoteDate);continue;
      }
      const buys=sum(state.trades.filter(t=>t.side==='BUY').map(t=>t.totalEur));
      const sells=sum(state.trades.filter(t=>t.side==='SELL').map(t=>t.totalEur));
      if(cents(buys+fill.totalEur)>cents(state.budgetEur)||
         cents(buys-sells+fill.totalEur)>cents(state.openingCashEur)){
        notice('budget-block','Budget/Kapital reichen nicht',q.quoteDate);continue;
      }
    }
    state.trades.push({id,orderId:o.id,instrumentId:s.id,side:o.side,
      quantity:fill.qty,modelPrice:fill.price,referenceClose:fill.referenceClose,
      quoteDate:q.quoteDate,fx:q.rate,feeEur:fill.fee,totalEur:fill.totalEur,
      executedAt:now,source:fill.source,tag:'SYNTHETIC TEST ONLY'});
    o.state='filled';o.active=false;o.filledAt=now;notice('filled',o.side+' – Modellbuchung',q.quoteDate);
  }
  state.events=state.events.slice(-120);
  state.run.status=seen?'ok':'data-blocked';
  if(seen)state.run.lastSuccess=now;else state.run.failures=Number(state.run.failures||0)+1;
  return {state,events};
}
module.exports={verifyQuote,eligible,fillId,modelFill,sampleState,validate,tick};
