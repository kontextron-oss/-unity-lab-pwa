'use strict';
/* UNITY 0.15.1 – unified, reproducible paper-decision engine.
 * This module is deliberately read-only during evaluation.
 * No quote is a live executable market order; no broker approval exists. */
const UNITY_DECISION_ENGINE_VERSION='UNITY Decision Engine 0.15.1';
const UNITY_DECISION_ACTIONS={BUY:'Kaufen',SELL:'Verkaufen',HOLD:'Halten / Abwarten',BLOCKED:'Blockiert'};
const unityDecisionSafeNum=v=>v===null||v===undefined||v===''?NaN:Number(v);
const unityDecisionCleanList=a=>[...new Set((Array.isArray(a)?a:[]).map(x=>String(x||'').trim()).filter(Boolean))];
function unityDecisionResolve(input){
  const m=input?.mode==='technical'?'technical':'strict',position=Math.max(0,unityDecisionSafeNum(input?.positionQty)||0);
  const price=unityDecisionSafeNum(input?.priceRef?.price),ref=input?.priceRef||null;
  const priceOk=!!input?.quoteValid&&!!ref&&Number.isFinite(price)&&price>0&&
    !!String(ref.date||'')&&!!String(ref.exchange||'')&&!!String(ref.currency||'');
  const missing=unityDecisionCleanList(input?.missing);
  const hard=unityDecisionCleanList(input?.hardVeto);
  const deep=input?.deep||null,signal=input?.technicalSignal||{kind:'data'};
  const base={version:UNITY_DECISION_ENGINE_VERSION,mode:m,action:'BLOCKED',label:UNITY_DECISION_ACTIONS.BLOCKED,
    dataStatus:input?.dataStatus||'missing',scoreBand:'–',
    confidence:'Datenlage eingeschränkt',veto:[],signalAt:String(input?.signalAt||ref?.date||''),
    priceRef:priceOk?{price,currency:String(ref.currency),exchange:String(ref.exchange),
      date:String(ref.date),source:String(ref.source||'Tageskursreferenz')} : null,
    trigger:'',invalidation:'Bei neuer, verifizierter Datenlage erneut prüfen',
    capitalPct:Number.isFinite(unityDecisionSafeNum(input?.capitalEur))&&unityDecisionSafeNum(input.capitalEur)>0?
      null:[2,5,10,15,20,25,50].includes(Number(input?.capitalPct))?Number(input.capitalPct):2,
    capitalEur:Number.isFinite(unityDecisionSafeNum(input?.capitalEur))&&unityDecisionSafeNum(input.capitalEur)>0?
      Number(input.capitalEur):null,
    why:[],reasonCode:'missing-data',sourceRefs:Array.isArray(input?.sourceRefs)?input.sourceRefs.map(e=>({
      key:String(e.key||''),status:String(e.status||''),stamp:String(e.stamp||''),source:String(e.source||'')})):[],
    positionQty:position,investmentReady:!!deep?.investmentReady,
    technicalEligible:false,realOrderApproved:false,testActionEligible:false};
  const score=unityDecisionSafeNum(deep?.investmentScore);
  if(Number.isFinite(score)&&score>=0&&score<=100){
    const low=Math.min(90,Math.floor(score/10)*10);
    base.scoreBand=low+'–'+(low===90?'100':low+9)+' / 100';
  }
  const confidence=String(deep?.confidence||'');
  if(priceOk&&m==='strict'&&missing.length===0&&confidence)base.confidence=confidence;
  else if(priceOk&&m==='technical')base.confidence='Nur technisches Signal – keine Anlagefreigabe';
  const decide=(action,reason,why,trigger='',invalid='Bei verändertem Befund erneut prüfen')=>({
    ...base,action,label:UNITY_DECISION_ACTIONS[action],reasonCode:reason,
    why:unityDecisionCleanList(why),trigger,invalidation:invalid,
    veto:hard,technicalEligible:m==='technical'&&action==='BUY',
    testActionEligible:(action==='SELL'&&priceOk)||(action==='BUY'&&priceOk&&hard.length===0)
  });
  // Highest gate: no executable reference or wrong/stale currency/market identity.
  if(!priceOk)return decide('BLOCKED','missing-data',
    ['Keine gültige aktuelle Kursbasis mit Börsenplatz, Währung und geprüftem Zeitstand',...missing],
    '', 'Erst nach Kurs-/Währungsprüfung neu entscheiden');
  // A held position needs separate exit logic. A bad NEW entry does not
  // silently become an instruction to sell the existing holding.
  if(position>0&&input?.verifiedFundamentalExit===true)
    return decide('SELL','verified-exit',
      ['Quellengebundene fundamentale Verschlechterung des bestehenden Bestands',String(input?.exitReason||'Risiko- oder Thesenbruch bestätigt')],
      'Belegtes Bestandsrisiko', 'Ausstiegssignal wird mit aktualisierten Unternehmensquellen überprüft');
  if(position>0&&m==='technical'&&input?.technicalExit===true)
    return decide('SELL','technical-exit',
      ['Technische Schutzschwelle mit gültigem Tageskurs unterschritten'],
      'Schlusskurs unter '+String(input?.exitLimit||'')+' '+String(ref.currency||''),
      'Schutzschwelle muss aus aktuellen 200-Tage-Daten stammen');
  // Do not add a new position immediately before a binary issuer event.
  if(input?.nearEarnings===true){
    const event='Bestätigte Ergebnisveröffentlichung innerhalb der nächsten sieben Tage';
    return {...decide('BLOCKED','event-veto',[event], '', 'Earnings abwarten und Daten erneut prüfen'),veto:unityDecisionCleanList([...hard,event])};
  }
  if(hard.length)return decide('BLOCKED','risk-veto',hard,
    '', 'Nur eine belegte Änderung der Risikofaktoren hebt das Veto auf');
  if(m==='technical'){
    if(input?.technicalReady!==true)return decide('BLOCKED','missing-data',
      ['Für eine belastbare technische Einordnung fehlen mindestens 200 gültige Börsentage',...missing]);
    if(position>0)return decide('HOLD','position-monitor',
      ['Bestehende Position: kein aktuelles bestätigtes technisches Ausstiegssignal'],
      'Technische Schutzschwelle weiter überwachen',
      'Verkaufssignal bei Unterschreitung einer validierten Schutzschwelle');
    if(signal.kind==='reached'){
      const level=unityDecisionSafeNum(input?.entryLimit);
      return decide('BUY','technical-entry',
        ['SMA50-Rücksetzerzone mit technisch gültigem Schlusskurs erreicht','Reine Testsimulation; keine fundamentale Anlageempfehlung'],
        Number.isFinite(level)&&level>0?'Technische Zone bis '+level.toFixed(2)+' '+ref.currency:'Technische Zone erreicht',
        'Unteres Zonenlimit, Trend- oder RSI-Veto bzw. neues Ergebnisereignis');
    }
    return decide('HOLD','no-entry',
      [signal.kind==='watch'?'Rücksetzerzone noch nicht erreicht':
        signal.kind==='broke'?'Technische Einstiegszone unterschritten':
        'Kein bestätigtes technisches Einstiegssignal'],
      'Auf neues, validiertes technisches Signal warten',
      'Technische Lage oder bestätigte Unternehmensereignisse ändern sich');
  }
  // Strict allocation cannot be approved by a technical signal. Confirmed
  // issuer data, valuation, hard checks and 10 % margin remain higher gates.
  if(missing.length>0||!deep)
    return decide('BLOCKED','missing-data',
      ['Fundamentale Anlagefreigabe benötigt noch belegte Pflichtinformationen',...missing],
      '', 'Fehlende Pflichtfelder und Quellen vervollständigen');
  if(position>0)return decide('HOLD','position-monitor',
    ['Bestehender Bestand: kein bestätigtes Ausstiegsveto','Ein schwächeres Neuinvestitionssignal allein ist kein Verkaufsgrund'],
    'Bilanz, Guidance und Ausstiegskriterien weiter überwachen',
    'Quellengebundene Verschlechterung oder neue Schutzschwelle');
  const limit=unityDecisionSafeNum(input?.entryLimit);
  if(deep.investmentReady===true&&signal.kind==='reached'&&Number.isFinite(limit)&&limit>0&&price<=limit){
    return decide('BUY','fundamentally-approved',
      ['Strenge UNITY-Freigabe einschließlich Bewertung, Sicherheitsmarge, Risiken und bestätigtem Earnings-Termin',
       'Schlusskurs liegt innerhalb des berechneten Einstiegslimits'],
      'Referenzkurs bis '+limit.toFixed(2)+' '+ref.currency,
      'Neues Hard-Veto, verletzte Sicherheitsmarge oder invalidierte Investmentthese');
  }
  return decide('HOLD','no-entry',
    ['Strenge Kaufbedingungen nicht vollständig positiv; keine operative neue Position',
     String(deep?.reason||'Bewertung oder Einstiegssignal noch nicht freigegeben')],
    'Bewertung und Einstiegslimit fortlaufend neu prüfen',
    'Kaufthese, Bewertung oder technisches Signal ändern sich');
}
function unityDecisionForStock(s,mode='strict'){
  if(!s)return null;
  if(typeof unityIsCryptoAsset==='function'&&unityIsCryptoAsset(s))return null; // independent crypto policy
  const chosen=mode==='technical'?'technical':'strict';
  const quote=typeof unityHomeQuote==='function'?unityHomeQuote(s):null;
  const x=quote?.x||null,quality=quote?.quality||null;
  const fx=typeof unityEuroRate==='function'?unityEuroRate(s.currency):null;
  const fxOk=!!fx&&Number.isFinite(unityDecisionSafeNum(fx.rate))&&unityDecisionSafeNum(fx.rate)>0;
  const technicalReady=quote?.technical===true;
  const valid=quote?.valid===true&&quality?.canCompare===true&&technicalReady&&
    !!x&&!x.dynamicExperimental&&x.currency===s.currency&&
    typeof x.date==='string'&&!!x.exchange&&Number(x.price)>0&&fxOk;
  const ref=x?{price:Number(x.price),currency:x.currency,exchange:x.exchange,date:x.date,
    source:x.source||x.providerSymbol||'Verzögerter Börsenschlusskurs'}:null;
  const readiness=typeof unityReadinessEvidence==='function'?unityReadinessEvidence(s):null;
  const deep=chosen==='strict'&&typeof unityDeepDecision==='function'?unityDeepDecision(s):null;
  const position=typeof depotPosition==='function'?depotPosition(s):null;
  const qty=Number(position?.qty)||0;
  const technicalSignal=typeof unityPullbackAlert==='function'?unityPullbackAlert(s):{kind:'data'};
  const technicalLimit=Number(technicalSignal?.high),exitLimit=typeof unityAutoExitZone==='function'?unityAutoExitZone(s):NaN;
  const technicalExit=valid&&qty>0&&Number.isFinite(Number(exitLimit))&&Number(exitLimit)>0&&
    Number(x.price)<=Number(exitLimit);
  const userFund=typeof cache!=='undefined'?(cache.fundamentals||[]).find(f=>f.id===s.id)||null:null;
  const fair=unityDecisionSafeNum(userFund?.fairValue);
  const upper=unityDecisionSafeNum(deep?.entryUpper),lower=unityDecisionSafeNum(deep?.entryLower);
  const strictLimit=Number.isFinite(upper)&&upper>0&&Number.isFinite(fair)&&fair>0?
    Math.min(upper,fair*.9):NaN;
  const strictLimitOk=Number.isFinite(strictLimit)&&strictLimit>0&&
    (!Number.isFinite(lower)||strictLimit>=lower);
  let issuerEvidence=null;
  try{issuerEvidence=typeof unityIssuerDecisionEvidence==='function'?unityIssuerDecisionEvidence(s):null}catch(_){}
  const issuerRisk=issuerEvidence?.positionRisk||null;
  const fundamentalExit=issuerRisk?.verified===true&&
    ['guidance-cut','thesis-broken','fundamental-deterioration'].includes(String(issuerRisk.kind||''));
  const earnManual=String(userFund?.earningsConfirmed===true?userFund.earningsDate||'':'');
  const earnIssuer=String(issuerEvidence?.earnings?.confirmed?issuerEvidence.earnings.date||'':'');
  const date=earnIssuer||earnManual;
  const now=Date.now(),t=Date.parse(date);
  const nearEarnings=Number.isFinite(t)&&t>=now-86400000&&t<now+7*86400000;
  const missing=chosen==='strict'?(readiness?.missing||[]).map(f=>f.label):[];
  if(chosen==='strict'&&!deep)missing.push('Strenge UNITY-Tiefenanalyse nicht verfügbar');
  if(chosen==='strict'&&deep&&!deep.investmentReady&&deep.missing?.length)
    missing.push(...deep.missing.filter(x=>!/Vergleichsdaten fehlen|fünf vergleichbare gültige Kursreihen/.test(String(x))));
  const riskAdverse=(readiness?.adverse||[]).filter(v=>
    /Chance-Risiko-Verhältnis|Sicherheitsmarge/.test(v));
  const rr=unityDecisionSafeNum(deep?.rr);
  if(Number.isFinite(rr)&&rr<2)riskAdverse.push('Bestätigtes Chance-Risiko-Verhältnis unter 2:1');
  const blockers=unityDecisionCleanList(riskAdverse);
  const currentBuy=typeof unityAutoBuy==='function'?unityAutoBuy(s):null;
  const pct=currentBuy?.mode===chosen?currentBuy.allocationPct:2;
  const euro=currentBuy?.mode===chosen&&typeof unityAutoEurAmount==='function'?
    unityAutoEurAmount(currentBuy):NaN;
  const input={mode:chosen,positionQty:qty,quoteValid:valid,
    priceRef:ref,technicalReady,technicalSignal,technicalExit,exitLimit,
    entryLimit:chosen==='technical'?technicalLimit:strictLimitOk?strictLimit:NaN,
    deep,nearEarnings,verifiedFundamentalExit:fundamentalExit,exitReason:issuerRisk?.label||'',
    capitalPct:pct,capitalEur:Number.isFinite(euro)&&euro>0?euro:null,
    missing:unityDecisionCleanList(missing),hardVeto:blockers,
    sourceRefs:Object.values(readiness?.fields||{}).map(f=>({key:f.key,status:f.status,
      stamp:f.stamp,source:f.source})),
    signalAt:x?.date||'',dataStatus:!valid?(quality?.level||'missing'):
      chosen==='strict'&&missing.length?'incomplete':'ready'};
  return unityDecisionResolve(input);
}
function unityDecisionLedgerKey(s,d){
  // Stable fingerprint of ACTUAL decision inputs: duplicate views do not create
  // a stream of redundant records or overwrite the first immutable snapshot.
  const state=JSON.stringify([s.id,d.mode,d.action,d.reasonCode,d.dataStatus,d.signalAt,
    d.priceRef,d.scoreBand,d.veto,d.trigger,d.invalidation,d.why,d.positionQty,d.capitalPct,d.capitalEur,d.sourceRefs]);
  let hash=2166136261;
  for(let i=0;i<state.length;i++){hash^=state.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return 'unity-decision-0151-'+String(s.id)+'-'+(hash>>>0).toString(16);
}
const unityDecisionLedgerPending=new Set();
async function unityDecisionLedgerCapture(s,mode='strict',decision=null){
  if(!s||typeof cache==='undefined'||!Array.isArray(cache.analyses)||typeof put!=='function')return false;
  const d=decision||unityDecisionForStock(s,mode);
  if(!d)return false;
  const key=unityDecisionLedgerKey(s,d);
  if(unityDecisionLedgerPending.has(key)||cache.analyses.some(x=>x.id===key))return false;
  unityDecisionLedgerPending.add(key);
  const record={id:key,instrumentId:s.id,kind:'unity-decision-ledger-v1',createdAt:new Date().toISOString(),
    sourceAt:d.signalAt,mode:d.mode,action:d.action,reasonCode:d.reasonCode,
    score:d.scoreBand,decisionSnapshot:{...d,observedAt:new Date().toISOString(),
      stockName:s.name,isin:s.isin||'',ticker:s.ticker||''}};
  try{
    await put('analyses',record);
    if(!cache.analyses.some(x=>x.id===key))cache.analyses.push(record);
    return true;
  }finally{unityDecisionLedgerPending.delete(key)}
}
function unityDecisionPanel(s){
  const deep=unityDecisionForStock(s,'strict'),tech=unityDecisionForStock(s,'technical');
  if(!deep||!tech)return '';
  const escf=typeof esc==='function'?esc:x=>String(x??'');
  const renderReasons=d=>'<ul>'+(d.why||[]).slice(0,5).map(x=>'<li>'+escf(x)+'</li>').join('')+'</ul>';
  const label=d=>d.action==='BLOCKED'?'Keine Freigabe · '+(d.reasonCode==='risk-veto'||d.reasonCode==='event-veto'?'Risikoveto':'Datenprüfung'):
    d.action==='HOLD'?(d.positionQty>0?'Halten':'Abwarten'):
    d.action==='BUY'?'Kaufen · nur Testdepot':'Verkaufen · nur Testdepot';
  const style=d=>d.action==='BUY'?'positive':d.action==='SELL'?'negative':
    d.action==='BLOCKED'?'blocked':'neutral';
  const previous=(typeof cache!=='undefined'?cache.analyses||[]:[])
    .filter(x=>x.kind==='unity-decision-ledger-v1'&&x.instrumentId===s.id)
    .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,3);
  let h='<section class="panel unity-engine-panel" aria-label="Verbindliche UNITY-Entscheidung">'+
    '<small>UNITY 0.15.1 · Hierarchisches Entscheidungssystem</small>'+
    '<h3>Entscheidung: <span class="unity-engine-action '+style(deep)+'">'+escf(label(deep))+'</span></h3>'+
    '<p class="tiny muted">Strenge Anlageprüfung · Datenstatus '+escf(deep.dataStatus)+' · Scoreband '+escf(deep.scoreBand)+
    ' · Konfidenz '+escf(deep.confidence)+'</p>'+renderReasons(deep)+
    '<p class="tiny muted">Kurs: '+(deep.priceRef?
      escf(Number(deep.priceRef.price).toFixed(2)+' '+deep.priceRef.currency+' · '+deep.priceRef.exchange+' · '+deep.priceRef.date):
      'kein belastbarer aktueller Referenzkurs')+'</p>'+
    (deep.veto.length?'<p class="unity-engine-veto"><b>Veto:</b> '+escf(deep.veto.join(' · '))+'</p>':'')+
    '<details class="unity-engine-technical"><summary>Technische Testsimulation separat ansehen</summary>'+
    '<p><b>'+escf(label(tech))+'</b> · '+escf(tech.why.join(' · '))+'</p>'+
    '<p class="tiny muted">'+(Number.isFinite(tech.capitalEur)&&tech.capitalEur>0?
      'Fester Testbetrag '+escf(depotMoney(tech.capitalEur)):
      'Kapitalanteil '+escf(tech.capitalPct)+' % (bisheriger Modus)')+' · '+escf(tech.trigger)+
    '. Eine technische Testsimulation ist keine fundamentale Kaufempfehlung.</p></details>'+
    '<details class="unity-engine-ledger"><summary>Entscheidungsprotokoll ('+previous.length+' zuletzt)</summary>'+
    (previous.length?previous.map(x=>'<p class="tiny">'+escf(x.createdAt.slice(0,16).replace('T',' '))+
      ' · '+escf(x.mode==='strict'?'Streng':'Technisch')+' · '+escf(x.action)+
      ' · Kursstichtag '+escf(x.sourceAt||'–')+'</p>').join(''):
      '<p class="tiny muted">Noch kein Entscheidungsstand protokolliert. Beim Öffnen einer Aktie wird ein neuer Datenstand einmalig lokal erfasst.</p>')+
    '</details><p class="tiny muted">Kein Echtzeithandel, keine garantierte Rendite, keine Brokerorder. Automatik nur im Testdepot bei aktivierter Simulation.</p></section>';
  return h;
}
