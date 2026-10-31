'use strict';
/* Lightweight, self-contained SVG charts from dated daily close history.
   No synthetic interpolation of missing trading days, no intraday claims. */
let unityChartRange='1Y',unityChartMA=true;
const unityRangeDays={'1M':22,'3M':66,'6M':132,'1Y':260};
function unityChartData(item,range){
  if(!item||!Array.isArray(item.points))return [];
  const source=item.points.filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(Number(p.close))&&Number(p.close)>0);
  const max=unityRangeDays[range]||260;
  return source.slice(-max);
}
function unityChartSvg(item,range='1Y',small=false,showMA=true){
  const data=unityChartData(item,range);
  if(data.length<2)return '<div class="chart-empty">Kein Kursdiagramm verfügbar</div>';
  const all=item.points.map(p=>Number(p.close));
  const ma=(idx,n)=>idx+1<n?null:all.slice(idx+1-n,idx+1).reduce((a,b)=>a+b,0)/n;
  const offset=all.length-data.length;
  const close=data.map(p=>Number(p.close));
  const ma50=showMA&&!small?data.map((_,i)=>ma(offset+i,50)):[],
        ma200=showMA&&!small?data.map((_,i)=>ma(offset+i,200)):[];
  const values=close.concat(ma50.filter(Number.isFinite),ma200.filter(Number.isFinite));
  const min=Math.min(...values),max=Math.max(...values),spread=max-min||Math.max(max*.02,1);
  const pad=spread*.1,lo=min-pad,hi=max+pad;
  const w=small?160:720,h=small?54:260;
  const left=small?2:62,right=small?2:14,top=small?4:16,bottom=small?4:35;
  const x=i=>left+(w-left-right)*i/(data.length-1);
  const y=v=>top+(hi-v)/(hi-lo)*(h-top-bottom);
  const path=arr=>arr.map((v,i)=>Number.isFinite(v)?(i===0||!Number.isFinite(arr[i-1])?'M':'L')+x(i).toFixed(2)+' '+y(v).toFixed(2):'').filter(Boolean).join(' ');
  const rising=close.at(-1)>=close[0];
  const line=rising?'#137858':'#b54d45';
  const pricePath=path(close);
  const area=pricePath+' L'+x(data.length-1).toFixed(2)+' '+(h-bottom)+' L'+left+' '+(h-bottom)+' Z';
  const title='Kursverlauf '+(item.name||item.providerSymbol||'Aktie')+' von '+data[0].date+' bis '+data.at(-1).date+', '+close[0].toFixed(2)+' bis '+close.at(-1).toFixed(2)+' '+(item.currency||'');
  let svg='<svg class="'+(small?'unity-sparkline':'unity-main-chart')+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(title)+'" xmlns="http://www.w3.org/2000/svg">';
  if(!small){
    for(let i=0;i<=4;i++){
      const v=lo+(hi-lo)*i/4,py=y(v);
      svg+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+py.toFixed(2)+'" y2="'+py.toFixed(2)+'" stroke="#e0e9ef" stroke-width="1"/>';
      svg+='<text x="'+(left-8)+'" y="'+(py+4).toFixed(2)+'" text-anchor="end" font-size="12" fill="#536979">'+number(v,1)+'</text>';
    }
    svg+='<text x="'+left+'" y="'+(h-7)+'" font-size="12" fill="#536979">'+esc(data[0].date)+'</text>';
    svg+='<text x="'+(w-right)+'" y="'+(h-7)+'" text-anchor="end" font-size="12" fill="#536979">'+esc(data.at(-1).date)+'</text>';
  }
  svg+='<path d="'+area+'" fill="'+line+'" fill-opacity="'+(small?'.09':'.07')+'"/>';
  if(!small&&showMA){
    svg+='<path d="'+path(ma50)+'" fill="none" stroke="#d48a26" stroke-width="1.8" stroke-dasharray="5 4"/>';
    svg+='<path d="'+path(ma200)+'" fill="none" stroke="#527ca5" stroke-width="1.8" stroke-dasharray="5 4"/>';
  }
  svg+='<path d="'+pricePath+'" fill="none" stroke="'+line+'" stroke-width="'+(small?2.5:2.8)+'" stroke-linecap="round" stroke-linejoin="round"/>';
  if(!small)svg+='<circle cx="'+x(data.length-1).toFixed(2)+'" cy="'+y(close.at(-1)).toFixed(2)+'" r="4" fill="'+line+'"/>';
  return svg+'</svg>';
}
function unityChartPanel(item){
  if(!item)return '<p class="muted">Für diese Aktie liegen keine Kursreihen vor. Ein Diagramm wird nicht geschätzt.</p>';
  const data=unityChartData(item,unityChartRange);
  const change=data.length>1?(data.at(-1).close/data[0].close-1)*100:NaN;
  let h='<div class="unity-chart-box"><div class="unity-chart-heading"><div><strong>Kursentwicklung · '+esc(unityChartRange)+'</strong><div class="tiny muted">Tages-Schlusskurse · '+esc(item.currency)+' · '+esc(item.exchange||'Börsenplatz unbekannt')+'</div></div><strong class="'+(change>=0?'positive':'negative')+'">'+unityPct(change)+'</strong></div>';
  h+='<div class="unity-range" aria-label="Zeitraum des Kursdiagramms">';
  for(const r of ['1M','3M','6M','1Y'])h+='<button type="button" class="'+(r===unityChartRange?'active':'')+'" data-chart-range="'+r+'">'+r+'</button>';
  h+='</div>'+unityChartSvg(item,unityChartRange,false,unityChartMA);
  h+='<div class="unity-chart-footer"><label class="unity-ma-toggle"><input type="checkbox" id="unity-chart-ma" '+(unityChartMA?'checked':'')+'> SMA 50 / SMA 200 anzeigen</label><span>Letzter Kurs: <b>'+number(Number(item.price),2)+' '+esc(item.currency)+'</b> · '+esc(item.date)+'</span></div>';
  h+='<p class="tiny muted">Datenquelle: '+esc(item.source||'inoffizieller Kursfeed')+'. Historische Schlusskurse, nicht Echtzeit. Fehlende Börsentage werden nicht ergänzt.</p></div>';
  return h;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-chart-range]');if(!b)return;
  const r=b.dataset.chartRange;if(!Object.hasOwn(unityRangeDays,r))return;
  unityChartRange=r;render();
  document.getElementById('unity-company-detail')?.scrollIntoView({block:'start'});
});
document.addEventListener('change',e=>{
  if(e.target.id==='unity-chart-ma'){unityChartMA=!!e.target.checked;render();document.getElementById('unity-company-detail')?.scrollIntoView({block:'start'})}
});
