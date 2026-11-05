'use strict';
/* Research lifecycle: conserve refresh work without deleting decision evidence. */
function unityResearchLifecycle(stock){
  const qty=typeof depotPosition==='function'?Number(depotPosition(stock)?.qty):0;
  if(Number.isFinite(qty)&&qty>1e-8)return {key:'active',title:'Aktiv',detail:'Offene Testposition: Kurs, Risiko und Ereignisse haben Vorrang bei der Aktualisierung.'};
  if(stock?.watchArchivedAt)return {key:'archive',title:'Archiv',detail:'Keine laufende Detailrecherche. Historische Kurse, Quellen, Analysen und abgeschlossene Testbuchungen bleiben erhalten.'};
  return {key:'watch',title:'Beobachtung',detail:'Regelmäßige Kurs- und Quellenprüfung; vertiefte Abrufe nur bei manueller Prüfung oder relevanter Veränderung.'};
}
function unityResearchRefreshTargets(mode='background'){
  const list=typeof stockRecords==='function'?stockRecords():(typeof stocks==='function'?stocks():[]);
  return list.filter(stock=>{
    const state=unityResearchLifecycle(stock);
    if(mode==='manual')return state.key!=='archive';
    if(state.key==='active')return true;
    return typeof unityHomeSelected!=='undefined'&&unityHomeSelected===stock.id;
  });
}
function unityResearchLifecyclePanel(){
  const list=typeof stockRecords==='function'?stockRecords():(typeof stocks==='function'?stocks():[]);
  const counts={active:0,watch:0,archive:0};
  for(const stock of list)counts[unityResearchLifecycle(stock).key]++;
  return '<details class="unity-archive-panel"><summary>Daten-Lebenszyklus · '+counts.active+' aktiv · '+counts.watch+' Beobachtung · '+counts.archive+' Archiv</summary>'+
    '<p class="tiny muted"><b>Aktiv</b>: offene Testpositionen werden bevorzugt aktualisiert. <b>Beobachtung</b>: reguläre Prüfung, aber keine unnötigen Detailabrufe. <b>Archiv</b>: keine laufende Recherche.</p>'+
    '<p class="tiny muted">Archivieren löscht nichts: Entscheidungssnapshots, Testbuchungen, Kursreihen, Quellen und Strategieversionen bleiben für das Lernsystem erhalten. Nur kurzlebige technische Zwischencaches dürfen später automatisch bereinigt werden.</p></details>';
}
