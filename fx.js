'use strict';
/* ECB daily reference FX, EUR per one unit of trade currency. Not spot/settlement FX. */
let unityFx=null,unityFxLoading=false,unityFxError='';
function unityEuroRate(currency){
  if(currency==='EUR')return {rate:1,date:new Date().toISOString().slice(0,10),source:'EUR'};
  const data=unityFx,rate=Number(data?.rates?.[currency]);
  if(!data||data.schemaVersion!==1||!(rate>0)||!Number.isFinite(rate)||
     !/^\d{4}-\d{2}-\d{2}$/.test(data.referenceDate||''))return null;
  const age=(Date.now()-Date.parse(data.referenceDate+'T12:00:00Z'))/86400000;
  if(age < -1||age > 5.5)return null;
  return {rate,date:data.referenceDate,source:'EZB-Referenzkurs (nicht handelbar)'};
}
async function unityLoadFx(){
  if(unityFxLoading)return;
  unityFxLoading=true;
  try{
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
    let response;
    try{response=await fetch('./data/fx.json?t='+Date.now(),{cache:'no-store',signal:c.signal,credentials:'omit'})}
    finally{clearTimeout(timer)}
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(data.schemaVersion!==1||!data.rates||data.unit!=='EUR per 1 foreign currency unit')throw Error('Ungültige Wechselkursdaten');
    unityFx=data;unityFxError='';
  }catch(e){unityFx=null;unityFxError=e.message||String(e)}
  finally{unityFxLoading=false;if(typeof render==='function')render()}
}
unityLoadFx();
