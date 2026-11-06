'use strict';
/*
 * UNITY 0.15.3.2 – Read-only exchange envelope, browser + Node.
 * Explicitly NOT an executable order or pCloud synchronization protocol.
 * Crypto verification via provided SHA-256 function (WebCrypto / Node).
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.UNITY_EXCHANGE_PROTOCOL=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const FORMAT='unity-exchange-readonly',SCHEMA=1;
  const RFC_DATE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
  const HEX=/^[a-f0-9]{64}$/;
  const MAX_ITEMS=5000,MAX_BYTES=5*1024*1024;
  function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype}
  function canonical(x){
    if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
    if(plain(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
    if(x===null||typeof x==='string'||typeof x==='boolean'||typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
    throw Error('Unzulässige Datentypen im UNITY-Austausch');
  }
  const textBytes=s=>typeof TextEncoder!=='undefined'?new TextEncoder().encode(s).length:
    typeof Buffer!=='undefined'?Buffer.byteLength(s,'utf8'):s.length;
  function assert(cond,message){if(!cond)throw Error('UNITY Austausch: '+message)}
  function idOk(x){return typeof x==='string'&&x.length>0&&x.length<=180&&!/[\u0000-\u001f]/.test(x)}
  function money(x){return typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e9&&
    Math.abs(Math.round(x*100)-x*100)<1e-5}
  function validatePayload(p){
    assert(plain(p)&&Object.keys(p).sort().join(',')==='budget,instruments,orders,trades',
      'Austauschfelder unbekannt oder unvollständig');
    assert(plain(p.budget)&&Object.keys(p.budget).sort().join(',')==='limitEur,spentEur',
      'Budgetformat ungültig');
    assert((p.budget.limitEur===null||money(p.budget.limitEur))&&money(p.budget.spentEur),
      'Budget in EUR unzulässig');
    for(const k of ['instruments','orders','trades'])assert(Array.isArray(p[k])&&p[k].length<=MAX_ITEMS,
      'Zu viele Datensätze in '+k);
    const seen=new Set(),instIds=new Set();
    for(const s of p.instruments){
      assert(plain(s)&&Object.keys(s).sort().join(',')==='assetClass,currency,exchange,id,isin,name,ticker',
        'Instrumentenfelder unerwartet');
      assert(idOk(s.id)&&s.assetClass==='equity'&&typeof s.name==='string'&&s.name.length<=250&&
        typeof s.isin==='string'&&s.isin.length<=32&&
        typeof s.ticker==='string'&&s.ticker.length<=40&&
        typeof s.exchange==='string'&&s.exchange.length<=100&&
        typeof s.currency==='string'&&/^[A-Z]{3}$/.test(s.currency),'Instrument ungültig');
      assert(!instIds.has(s.id),'Doppelte Instrumenten-ID');
      instIds.add(s.id);
    }
    for(const o of p.orders){
      assert(plain(o)&&Object.keys(o).sort().join(',')==='active,amountEur,createdAt,id,instrumentId,mode,side,triggerDate',
        'Auftragsfelder unbekannt');
      assert(idOk(o.id)&&instIds.has(o.instrumentId)&&
        ['BUY','SELL'].includes(o.side)&&['technical','strict'].includes(o.mode)&&
        o.active===true&&o.createdAt&&RFC_DATE.test(o.createdAt)&&
        (o.side==='SELL'&&o.amountEur===null||o.side==='BUY'&&money(o.amountEur)&&o.amountEur>=1)&&
        (o.triggerDate===null||typeof o.triggerDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(o.triggerDate)),
        'Auftrag ungültig');
      assert(!seen.has('order:'+o.id),'Doppelte Auftrags-ID');
      seen.add('order:'+o.id);
    }
    for(const t of p.trades){
      assert(plain(t)&&Object.keys(t).sort().join(',')==='executedAt,fee,fx,id,instrumentId,price,quantity,side,source',
        'Buchungsfelder unbekannt');
      assert(idOk(t.id)&&instIds.has(t.instrumentId)&&['BUY','SELL'].includes(t.side),
        'Buchung ungültig');
      assert((t.source==='UNITY Lab · Auto-Testkauf'&&t.side==='BUY'||
        t.source==='UNITY Lab · Auto-Testverkauf'&&t.side==='SELL')&&
        RFC_DATE.test(t.executedAt)&&t.quantity>0&&Number.isFinite(t.quantity)&&
        t.price>0&&Number.isFinite(t.price)&&t.fx>0&&Number.isFinite(t.fx)&&money(t.fee),
        'Buchungsinhalt ungültig');
      assert(!seen.has('trade:'+t.id),'Doppelte Buchungs-ID');
      seen.add('trade:'+t.id);
    }
    return p;
  }
  function contentForHash(packet){
    const copy={...packet};delete copy.sha256;return canonical(copy);
  }
  async function seal(packet,sha256){
    assert(typeof sha256==='function','SHA-256 Funktion fehlt');
    assert(plain(packet)&&packet.format===FORMAT&&packet.schema===SCHEMA,
      'Unbekanntes Format');
    assert(packet.executionPermission===false&&packet.authority==='local-iphone'&&packet.purpose==='review-only',
      'Keine Ausführungsfreigabe erlaubt');
    assert(idOk(packet.originId)&&Number.isSafeInteger(packet.revision)&&packet.revision>=1&&
      RFC_DATE.test(packet.exportedAt),'Identität/Version unzulässig');
    validatePayload(packet.payload);
    const bytes=contentForHash(packet);
    assert(textBytes(bytes)<=MAX_BYTES,'Austauschdatei zu groß');
    const digest=await sha256(bytes);
    assert(HEX.test(digest),'SHA-256 Ergebnis ungültig');
    return {...packet,sha256:digest};
  }
  async function verify(packet,sha256){
    assert(plain(packet)&&Object.keys(packet).sort().join(',')===
      'authority,executionPermission,exportedAt,format,originId,payload,purpose,revision,schema,sha256',
      'Unerwartete Paketfelder');
    assert(HEX.test(packet.sha256),'Prüfsumme fehlt');
    const expected=await seal((({sha256:unused,...rest})=>rest)(packet),sha256);
    assert(expected.sha256===packet.sha256,'Prüfsumme stimmt nicht; Import verweigert');
    return {valid:true,originId:packet.originId,revision:packet.revision,
      exportedAt:packet.exportedAt,orders:packet.payload.orders.length,
      instruments:packet.payload.instruments.length,trades:packet.payload.trades.length,
      spend:packet.payload.budget.spentEur,limit:packet.payload.budget.limitEur,
      executionPermission:false,sha256:packet.sha256};
  }
  function compare(local,remote){
    validatePayload(local);validatePayload(remote);
    const changes=[];
    for(const kind of ['instruments','orders','trades']){
      const a=new Map(local[kind].map(v=>[v.id,canonical(v)]));
      const b=new Map(remote[kind].map(v=>[v.id,canonical(v)]));
      let onlyLocal=0,onlyRemote=0,conflicts=0,same=0;
      for(const [id,val] of a){
        if(!b.has(id))onlyLocal++;
        else if(val===b.get(id))same++;else conflicts++;
      }
      for(const id of b.keys())if(!a.has(id))onlyRemote++;
      changes.push({kind,onlyLocal,onlyRemote,conflicts,same});
    }
    return changes;
  }
  return {FORMAT,SCHEMA,MAX_BYTES,canonical,validatePayload,seal,verify,compare};
});
