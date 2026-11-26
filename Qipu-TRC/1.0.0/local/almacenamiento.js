/* IndexedDB adapter. The authoritative material is the immutable root K5B prefix. */
'use strict';
globalThis.TRCLocal=(()=>{
 const Q=QipuTRC,req=r=>new Promise((ok,bad)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)});
 function transaction(db,mode,fn){return new Promise((ok,bad)=>{const t=db.transaction(['frames','meta'],mode),f=t.objectStore('frames'),m=t.objectStore('meta');let result,error;t.oncomplete=()=>ok(result);t.onabort=()=>bad(error||t.error||Error('Transacción abortada'));t.onerror=()=>{};Promise.resolve().then(()=>fn(f,m)).then(x=>{result=x},e=>{error=e;try{t.abort()}catch{bad(e)}})})}
 function open(name='qipu-trc-1.0.0'){return new Promise((ok,bad)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('frames');r.result.createObjectStore('meta')};r.onerror=()=>bad(r.error);r.onblocked=()=>bad(Error('Base bloqueada'));r.onsuccess=()=>ok(new Local(r.result))})}
 const stop=signal=>{if(signal?.aborted)throw Error('CANCELADO')};
 class Local{
  #db;#tail=Promise.resolve();
  constructor(db){this.#db=db}
  #queue(fn){const p=this.#tail.then(fn);this.#tail=p.catch(()=>{});return p}
  async snapshot(){return transaction(this.#db,'readonly',async(f,m)=>{const [h,keys,rows]=await Promise.all([req(m.get('head')),req(f.getAllKeys()),req(f.getAll())]);const cut=h??0;if(!Number.isSafeInteger(cut)||cut<0||rows.length!==cut||keys.some((k,i)=>k!==i))throw Error('Prefijo local incoherente');let size=0;for(const r of rows){if(!(r instanceof Uint8Array)||r.length===0)throw Error('Marco local inválido');size+=r.length}const raw=new Uint8Array(size);let p=0;for(const r of rows){raw.set(r,p);p+=r.length}return {cut,raw}})}
  async #commit(base,suffix){return transaction(this.#db,'readwrite',async(f,m)=>{const h=(await req(m.get('head')))??0;if(h!==base)return false;await req(f.add(suffix,base));await req(m.put(base+1,'head'));return true})}
  run(q,{signal}={}){Q.check(q);const owned=JSON.parse(JSON.stringify(q));return this.#queue(async()=>{for(;;){stop(signal);const a=await this.snapshot(),p=await Q.plan(a.raw,owned);if(!p.suffix.length){if(p.cut!==a.cut)throw Error('Corte incoherente');return {result:p.result,cut:p.cut}}stop(signal);if(p.cut!==a.cut+1)throw Error('Corte incoherente');if(await this.#commit(a.cut,p.suffix))return {result:p.result,cut:p.cut};await Promise.resolve()}})}
  close(){this.#db.close()}
 }
 return {open}
})();