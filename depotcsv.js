'use strict';
/* CSV transactions are parsed locally. No upload, no automatic overwrite. */
let depotCsvPreview=null;
const depotCsvAliases={
 date:['datum','handelstag','ausfuehrungsdatum','ausfuhrungsdatum','buchungsdatum','date','trade date','execution date'],
 type:['typ','art','vorgang','transaktion','transaktionstyp','buchungstyp','transaction type','type','aktion','orderart'],
 isin:['isin','wertpapier isin','security isin'],ticker:['ticker','symbol','kuerzel','kürzel'],
 name:['wertpapier','wertpapiername','name','bezeichnung','unternehmen','security','instrument'],
 qty:['stueck','stück','stueckzahl','stückzahl','anzahl','menge','quantity','shares','units'],
 price:['kurs','preis','ausfuehrungskurs','ausführungskurs','kaufkurs','verkaufskurs','price','unit price'],
 currency:['waehrung','währung','handelswaehrung','handelswährung','currency','ccy'],
 fx:['fx','wechselkurs','eur je einheit','eur je 1','exchange rate','eur rate'],
 fees:['gebuehren','gebühren','ordergebuehr','ordergebühr','provision','fees','fee','kosten'],
 note:['notiz','bemerkung','beschreibung','note','comment']
};
const depotCsvNorm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function depotCsvParse(text){
  const first=String(text).replace(/^\uFEFF/,'').replace(/^sep=([,;\t])\r?\n/i,'');
  const header=first.split(/\r?\n/)[0]||'';
  const delimiters=[';','\t',','];
  const count=d=>(header.match(new RegExp(d==='\t'?'\\t':d===';'?';':',','g'))||[]).length;
  const sep=delimiters.sort((a,b)=>count(b)-count(a))[0];
  if(!count(sep))throw Error('Keine CSV-Spalten erkannt. Benötigt wird eine CSV mit Überschriften.');
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<first.length;i++){
    const c=first[i];
    if(c==='"'){if(quoted&&first[i+1]==='"'){field+='"';i++}else quoted=!quoted}
    else if(c===sep&&!quoted){row.push(field);field=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&first[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}
    else field+=c;
  }
  if(quoted)throw Error('CSV enthält nicht geschlossene Anführungszeichen.');
  row.push(field);if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length<2)throw Error('Keine Buchungszeilen gefunden.');
  if(rows.length>2501)throw Error('Mehr als 2.500 Buchungen: Bitte die Datei in kleinere Teile aufteilen.');
  const cols=rows.shift().map(depotCsvNorm);
  const indexes={};for(const [key,aliases] of Object.entries(depotCsvAliases)){
    const names=aliases.map(depotCsvNorm);indexes[key]=cols.findIndex(c=>names.includes(c));
  }
  for(const key of ['date','type','qty','price'])if(indexes[key]<0)throw Error('Pflichtspalte fehlt: '+key+'. Gefundene Spalten: '+cols.join(', '));
  if(indexes.isin<0&&indexes.ticker<0&&indexes.name<0)throw Error('Es fehlt eine Spalte zur Wertpapierzuordnung (ISIN, Ticker oder Name).');
  return rows.map((r,i)=>({line:i+2,fields:Object.fromEntries(Object.entries(indexes).map(([k,j])=>[k,j>=0?String(r[j]??'').trim():'']))}));
}
function depotCsvNumber(raw){
  let s=String(raw??'').trim().replace(/[\s\u00a0€$£']/g,'');
  if(!s)return NaN;
  if(s.startsWith('(')&&s.endsWith(')'))s='-'+s.slice(1,-1);
  const c=s.lastIndexOf(','),d=s.lastIndexOf('.');
  if(c>=0&&d>=0)s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(c>=0)s=s.replace(',','.');
  if(!/^-?\d+(\.\d+)?$/.test(s))return NaN;
  return Number(s);
}
function depotCsvDate(raw){
  const s=String(raw??'').trim();let y,m,d;
  let a=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(a){[,y,m,d]=a}else{a=s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);if(a){[,d,m,y]=a}else return null}
  const day=String(y)+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  const date=new Date(day+'T12:00:00.000Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day||date.getTime()>Date.now()+86400000)return null;
  return date.toISOString();
}
function depotCsvType(raw){
  const v=depotCsvNorm(raw);
  if(['kauf','zukauf','buy','purchase','einbuchung'].includes(v))return 'BUY';
  if(['verkauf','sell','sale','ausbuchung'].includes(v))return 'SELL';
  return null;
}
function depotCsvStock(f){
  const list=stocks(),isin=f.isin.toUpperCase().replace(/\s/g,''),ticker=f.ticker.toUpperCase().trim();
  if(isin){const match=list.filter(s=>s.isin?.toUpperCase()===isin);return match.length===1?match[0]:null}
  if(ticker){const match=list.filter(s=>s.ticker?.toUpperCase()===ticker);return match.length===1?match[0]:null}
  const name=depotCsvNorm(f.name);if(!name)return null;
  const match=list.filter(s=>depotCsvNorm(s.name)===name);return match.length===1?match[0]:null;
}
const depotCsvFingerprint=t=>[t.instrumentId,t.type,t.executedAt.slice(0,10),Number(t.quantity).toPrecision(12),Number(t.price).toPrecision(12),Number(t.fx).toPrecision(12),Number(t.fees||0).toPrecision(12)].join('|');
function depotCsvPrepare(parsed){
  const known=new Set(cache.transactions.filter(t=>!t.voidedAt).map(depotCsvFingerprint));
  const results=[],seen=new Set();
  for(const {line,fields:f} of parsed){
    const errors=[],s=depotCsvStock(f),type=depotCsvType(f.type),at=depotCsvDate(f.date);
    const qty=depotCsvNumber(f.qty),price=depotCsvNumber(f.price),fees=f.fees?depotCsvNumber(f.fees):0;
    const currency=(f.currency||s?.currency||'').toUpperCase().trim();
    const fx=f.fx?depotCsvNumber(f.fx):(currency==='EUR'?1:NaN);
    if(!s)errors.push('Aktie nicht eindeutig im lokalen Aktienkatalog gefunden (ISIN/Ticker/Name prüfen)');
    if(!type)errors.push('Kauf/Verkauf nicht erkannt');
    if(!at)errors.push('Datum ungültig');
    if(!(qty>0&&price>0))errors.push('Stückzahl/Kurs ungültig');
    if(!(fees>=0))errors.push('Gebühren ungültig');
    if(!(fx>0))errors.push('EUR-Wechselkurs fehlt oder ungültig');
    if(s&&currency!==s.currency.toUpperCase())errors.push('Währung stimmt nicht mit der Aktie überein');
    const gross=qty*price,amount=type==='SELL'?gross-fees:gross+fees;
    if(type==='SELL'&&!(amount>0))errors.push('Gebühren übersteigen den Verkaufserlös');
    const t=errors.length?null:{id:id(),instrumentId:s.id,type,decidedAt:at,executedAt:at,quantity:qty,price,amount,fx,fees,note:f.note||'',source:'CSV-Import · lokal',createdAt:new Date().toISOString()};
    const key=t?depotCsvFingerprint(t):null;
    const duplicate=!!key&&(known.has(key)||seen.has(key));
    if(key)seen.add(key);
    results.push({line,fields:f,stock:s,transaction:t,key,duplicate,errors});
  }
  const fresh=results.filter(r=>r.transaction&&!r.duplicate).map(r=>r.transaction);
  // Validate entire combined chronological ledger before permitting any write.
  const simulated=[...cache.transactions.filter(t=>!t.voidedAt&&(t.type==='BUY'||t.type==='SELL')),...fresh];
  const balances=new Map();
  simulated.sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.createdAt.localeCompare(b.createdAt));
  for(const t of simulated){
    const before=balances.get(t.instrumentId)||0;
    const after=before+(t.type==='BUY'?Number(t.quantity):-Number(t.quantity));
    if(after < -1e-8){const matching=results.filter(r=>r.stock?.id===t.instrumentId&&!r.errors.length&&!r.duplicate);for(const r of matching)r.errors.push('Verkauf überschreitet den chronologischen Bestand; Import dieser Aktie nicht möglich');}
    balances.set(t.instrumentId,after);
  }
  return results;
}
function depotCsvPanel(){
  const p=depotCsvPreview;
  let h='<section class="panel" id="depot-csv"><h2>Depotbuchungen aus CSV importieren</h2>'+
    '<p class="muted">Die Datei wird <b>nur auf diesem Gerät</b> eingelesen. Keine Übertragung an einen Server. Unterstützt werden Kauf und Verkauf mit Datum, ISIN/Ticker/Name, Stückzahl, Kurs, optionalen Gebühren und EUR-Wechselkurs. Die Übernahme erfolgt erst nach deiner Bestätigung.</p>'+
    '<label class="full">CSV-Datei auswählen<input type="file" id="depot-csv-file" accept=".csv,text/csv,text/plain"></label>'+
    '<p class="tiny muted">Spaltenbeispiel: Datum;ISIN;Typ;Stückzahl;Kurs;Währung;FX;Gebühren. Bei Fremdwährungen ist EUR je 1 Handelswährung erforderlich. Unbekannte Aktien bitte zuerst im Aktienbereich anlegen. Bereits vorhandene Buchungen bleiben erhalten.</p>';
  if(!p)return h+'</section>';
  const err=p.rows.filter(r=>r.errors.length),duplicates=p.rows.filter(r=>r.duplicate&&!r.errors.length),fresh=p.rows.filter(r=>r.transaction&&!r.duplicate&&!r.errors.length);
  h+='<div class="depot-import-summary"><b>'+p.rows.length+' Zeilen geprüft</b><span>'+fresh.length+' neu</span><span>'+duplicates.length+' Dubletten übersprungen</span><span>'+err.length+' zu klären</span></div>';
  if(err.length)h+='<p class="depot-warning">Es gibt ungeklärte Buchungen. Aus Sicherheitsgründen wird die gesamte Datei noch nicht übernommen. Bitte fehlende Aktien oder Spalten korrigieren und erneut auswählen.</p>';
  h+='<div class="depot-import-preview"><table><thead><tr><th>Zeile</th><th>Aktie</th><th>Datum / Art</th><th>Stück / Kurs</th><th>Prüfung</th></tr></thead><tbody>';
  for(const r of p.rows.slice(0,60)){
    const f=r.fields;
    h+='<tr><td>'+r.line+'</td><td>'+esc(r.stock?.name||f.isin||f.ticker||f.name||'–')+'</td><td>'+esc(f.date)+' · '+esc(f.type)+'</td><td>'+esc(f.qty)+' · '+esc(f.price)+'</td><td>'+(r.errors.length?'<span class="negative">'+esc(r.errors.join('; '))+'</span>':r.duplicate?'Bereits vorhanden':'Bereit')+'</td></tr>';
  }
  h+='</tbody></table></div>';
  if(p.rows.length>60)h+='<p class="tiny muted">Vorschau zeigt die ersten 60 Zeilen. Alle '+p.rows.length+' werden vor der Übernahme geprüft.</p>';
  h+='<div class="actions"><button type="button" class="primary" id="depot-csv-confirm" '+(err.length||!fresh.length?'disabled':'')+'>'+fresh.length+' geprüfte Buchungen übernehmen</button><button type="button" class="secondary" id="depot-csv-discard">Vorschau verwerfen</button></div></section>';
  return h;
}
async function depotCsvLoad(file){
  if(!file)return;
  if(file.size>3000000)throw Error('CSV-Datei zu groß (maximal 3 MB).');
  const text=await file.text();
  const parsed=depotCsvParse(text);
  depotCsvPreview={name:file.name,rows:depotCsvPrepare(parsed)};
  render();document.getElementById('depot-csv')?.scrollIntoView({block:'start'});
}
async function depotCsvCommit(){
  const p=depotCsvPreview;if(!p)throw Error('Keine CSV-Vorschau vorhanden.');
  const latest=depotCsvPrepare(p.rows.map(r=>({line:r.line,fields:r.fields})));
  if(latest.some(r=>r.errors.length))throw Error('Die CSV enthält ungeklärte Einträge. Es wurde nichts gespeichert.');
  const fresh=latest.filter(r=>r.transaction&&!r.duplicate).map(r=>r.transaction);
  if(!fresh.length)throw Error('Keine neuen Buchungen vorhanden.');
  if(!confirm(fresh.length+' simulierte Depotbuchungen aus CSV dauerhaft lokal übernehmen? Bestehende Buchungen bleiben unverändert.'))return;
  // Single IndexedDB transaction: all records + audit succeed, or none.
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['transactions','audit'],'readwrite'),store=tx.objectStore('transactions'),log=tx.objectStore('audit');
    for(const t of fresh){store.add(t);log.add({id:id(),at:new Date().toISOString(),type:'CSV_TRADE_IMPORT',ref:t.id,detail:t.type+' · '+t.instrumentId+' · '+t.executedAt.slice(0,10)})}
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  depotCsvPreview=null;await refresh();
  alert(fresh.length+' Buchungen erfolgreich importiert. Vorhandene Daten wurden nicht überschrieben.');
}
document.addEventListener('change',async e=>{
  if(e.target.id!=='depot-csv-file')return;
  try{await depotCsvLoad(e.target.files?.[0])}catch(err){depotCsvPreview=null;render();alert('CSV-Import: '+(err.message||String(err)))}
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='depot-csv-discard'){depotCsvPreview=null;render()}
  if(b.id==='depot-csv-confirm'){try{await depotCsvCommit()}catch(err){alert('CSV-Import: '+(err.message||String(err)))}}
});
