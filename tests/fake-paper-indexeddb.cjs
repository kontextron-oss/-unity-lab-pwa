'use strict';
/* Minimal IndexedDB-like transactional simulator. Changes commit ALL-OR-NONE
   after async requests; injected faults abort without modifying any store. */
function createPaperDB(cache){
  let failure=null,transactions=0;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const db={
    failNextPut(store){failure=String(store)},
    get transactionCount(){return transactions},
    transaction(storeNames,mode){
      if(mode!=='readwrite')throw Error('Test must use a readwrite transaction');
      transactions++;
      const names=Array.isArray(storeNames)?storeNames:[storeNames];
      const shadow={};
      for(const name of names){
        if(!Array.isArray(cache[name]))throw Error('Unknown test store '+name);
        shadow[name]=clone(cache[name]);
      }
      let pending=0,closed=false,aborted=false,commitScheduled=false;
      const tx={oncomplete:null,onabort:null,onerror:null,error:null,
        objectStore(name){
          if(!names.includes(name))throw Error('Store not in transaction: '+name);
          const items=shadow[name];
          const makeRequest=read=>{
            const req={onsuccess:null,onerror:null,result:undefined};
            pending++;
            queueMicrotask(()=>{
              if(aborted){pending--;return}
              try{
                req.result=read();
                if(req.onsuccess)req.onsuccess({target:req});
              }catch(err){abort(err)}
              pending--;
              scheduleCommit();
            });
            return req;
          };
          return {
            get(id){return makeRequest(()=>clone(items.find(x=>x.id===id)||null))},
            getAll(){return makeRequest(()=>clone(items))},
            put(item){
              if(closed||aborted)throw Error('Transaction already settled');
              if(failure===name){failure=null;abort(Error('Injected simulated storage failure: '+name));return}
              const record=clone(item),i=items.findIndex(x=>x.id===record.id);
              if(i<0)items.push(record);else items[i]=record;
              return {onsuccess:null};
            }
          };
        }
      };
      function abort(err){
        if(aborted||closed)return;
        aborted=true;tx.error=err;
        queueMicrotask(()=>tx.onabort?.({target:tx}));
      }
      function scheduleCommit(){
        if(aborted||closed||pending!==0||commitScheduled)return;
        commitScheduled=true;
        queueMicrotask(()=>{
          commitScheduled=false;
          if(aborted||closed||pending>0)return;
          for(const name of names)cache[name].splice(0,cache[name].length,...shadow[name]);
          closed=true;tx.oncomplete?.({target:tx});
        });
      }
      queueMicrotask(scheduleCommit);
      return tx;
    }
  };
  return db;
}
module.exports={createPaperDB};
