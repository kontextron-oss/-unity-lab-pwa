'use strict';
/* UNITY 0.17.1 – outcome checks for immutable paper-decision snapshots.
   This module never writes, re-scores or rewrites a prior decision. */
const UNITY_REVIEW_VERSION='UNITY Review 0.17.2';
const unityReviewNum=v=>v===null||v===undefined||v===''?NaN:Number(v);
function unityReviewPoints(stock){
  let item=null;
  try{item=typeof unityMarketForStock==='function'?unityMarketForStock(stock):null}catch(_){}
  if(!item)try{item=typeof unityMarketItem==='function'?unityMarketItem(stock?.isin):null}catch(_){}
  return (Array.isArray(item?.points)?item.points:[]).map(p=>({date:String(p?.date||''),close:unityReviewNum(p?.close)}))
    .filter(p=>p.date&&Number.isFinite(p.close)&&p.close>0).sort((a,b)=>a.date.localeCompare(b.date));
}
function unityDecisionReview(decision,stock){
  const snapshot=decision?.decisionSnapshot||decision||{};
  const reference=unityReviewNum(snapshot?.priceRef?.price),date=String(snapshot?.priceRef?.date||decision?.sourceAt||'');
  const plan=Array.isArray(snapshot.reviewPlan)&&snapshot.reviewPlan.length?snapshot.reviewPlan:
    [5,20,60].map(sessions=>({sessions,label:sessions+' Handelstage'}));
  const day=/^\d{4}-\d{2}-\d{2}/.exec(date)?.[0]||'';
  const valid=Number.isFinite(reference)&&reference>0&&!!day&&
    Number.isFinite(Date.parse(day));
  const points=valid?unityReviewPoints(stock):[],after=points.filter(p=>p.date>day);
  return {reference,date:day,available:valid,
    checkpoints:plan.map(item=>{
      const sessions=Math.max(1,Math.floor(unityReviewNum(item?.sessions)||0)),point=after[sessions-1]||null;
      const change=point&&Number.isFinite(reference)&&reference>0?(point.close/reference-1)*100:NaN;
      return {sessions,label:String(item?.label||sessions+' Handelstage'),point,change,state:valid&&point?'completed':'pending'};
    })};
}
function unityDecisionReviewPanel(stock,records=[]){
  const escf=typeof esc==='function'?esc:x=>String(x??'');
  const latest=[...(Array.isArray(records)?records:[])].filter(x=>x?.mode==='strict')
    .sort((a,b)=>String(b.createdAt||b.sourceAt||'').localeCompare(String(a.createdAt||a.sourceAt||'')))[0]||null;
  if(!latest)return '<section class="panel unity-review-panel"><h3>Lernkontrolle · 5 / 20 / 60 Handelstage</h3><p class="tiny muted">Sie beginnt, sobald ein strenger Entscheidungsstand lokal protokolliert ist. Frühere Entscheidungen bleiben unverändert.</p></section>';
  const review=unityDecisionReview(latest,stock);
  const rows=review.checkpoints.map(c=>{
    if(c.state==='pending')return '<li><b>'+escf(c.label)+':</b> noch nicht vollständig in der verfügbaren Tageskursreihe</li>';
    const sign=c.change>=0?'+':'',tone=c.change>=0?'positive':'negative';
    return '<li><b>'+escf(c.label)+':</b> '+escf(c.point.date)+' · <span class="'+tone+'">'+escf(sign+c.change.toFixed(1)+' %')+'</span> gegenüber '+escf(review.date)+'</li>';
  }).join('');
  return '<section class="panel unity-review-panel" aria-label="UNITY Lernkontrolle">'+
    '<small>'+UNITY_REVIEW_VERSION+' · Ergebnisabgleich</small><h3>Lernkontrolle · 5 / 20 / 60 Handelstage</h3>'+
    (review.available?'<p class="tiny muted">Vergleich mit dem eingefrorenen Entscheidungs-Kurs '+escf(review.reference.toFixed(2)+' '+String(latest.decisionSnapshot?.priceRef?.currency||''))+' vom '+escf(review.date)+'. Die ursprüngliche Entscheidung wird nicht umgeschrieben.</p><ul>'+rows+'</ul>':'<p class="tiny muted">Für diesen archivierten Entscheidungsstand fehlt die vollständige Kursreferenz. Er bleibt sichtbar, wird aber nicht nachträglich bewertet.</p>')+
    '</section>';
}
