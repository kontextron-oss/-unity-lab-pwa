/* UNITY analysis universe: browse first, load data only after selection. */
(()=>{
  const style=`.universe-tabs{display:flex;gap:7px;overflow-x:auto;padding:3px 0 8px;margin:0 -2px}.universe-tabs button{white-space:nowrap;background:#f2f6f8;border:1px solid #d7e1e7;border-radius:18px;padding:8px 11px;color:#35536a;font-weight:700;font-size:13px}.universe-tabs button.active{background:#164d70!important;color:#fff!important;border-color:#164d70!important}.universe-note{margin:10px 0 3px;padding:9px 11px;background:#edf5f0;border-left:3px solid #2c8861;border-radius:6px;font-size:12px;color:#315746}.universe-search{margin-top:9px}`;
  document.head.insertAdjacentHTML('beforeend','<style>'+style+'</style>');
  let timer;
  document.addEventListener('click',e=>{
    const button=e.target.closest('button[data-universe-category]');
    if(!button)return;
    unityUniverseCategory=button.dataset.universeCategory;
    unityUniverseTerm='';
    render();
  });
  document.addEventListener('input',e=>{
    if(e.target.id!=='universe-search')return;
    const value=e.target.value;
    clearTimeout(timer);
    timer=setTimeout(()=>{
      unityUniverseTerm=value;
      render();
      requestAnimationFrame(()=>{const input=document.getElementById('universe-search');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length)}});
    },120);
  });
})();
