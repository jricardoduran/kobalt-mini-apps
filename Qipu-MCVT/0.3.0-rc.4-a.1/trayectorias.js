/* RC.4 experimental: typed binary trajectories; A and B reuse the same cursor.
   K5B framing unchanged. No public type numbers assigned. */
'use strict';
const RC4=(()=>{
 const {need,ar,nat,route,cp,value}=U,Q=globalThis.Qipu,types={A:65520,B:65521},enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
 const key=(...a)=>JSON.stringify(a), local=(scope,k)=>key('state',scope,k), meta=(scope,k)=>key('meta',scope,k), hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
 function unhex(s){need(typeof s==='string'&&s.length%2===0&&/^[0-9a-f]*$/.test(s),'Hex canónico requerido');let b=new Uint8Array(s.length/2);for(let i=0;i<b.length;i++)b[i]=parseInt(s.slice(i*2,i*2+2),16);return b}
 function profile(p){need(Object.hasOwn(types,p),'Perfil desconocido');return p}
 async function encode(p,e){profile(p);value(e);return Q.K5B.seal(types[p],enc.encode(JSON.stringify(e)))}
 async function decode(p,bytes,offset){const f=await Q.K5B.read(bytes,offset);need(f.t===types[p],'Perfil de marco incompatible');const str=dec.decode(f.body),e=JSON.parse(str);need(JSON.stringify(e)===str,'JSON de marco no canónico');value(e);return {event:e,end:f.end,raw:bytes.slice(offset,f.end)}}
 function overlay(base){const delta=new Map();return {get:k=>delta.has(k)?delta.get(k):base.get(k),set:(k,x)=>delta.set(k,x),commit:()=>{for(const [k,x] of delta)base.set(k,x)},delta}}
 function init(v,id,p){profile(p);v.set(meta(id,'profile'),p);v.set(meta(id,'count'),0);for(const [k,x] of Sparse[p].zero())v.set(local(id,k),x)}
 function state(v,id){return {get:k=>v.get(local(id,k))}}
 function applyLocal(v,id,p,e){const pl=Sparse[p].plan(state(v,id),e);for(const [k,x] of pl.delta)v.set(local(id,k),cp(x))}
 function locate(v,id,p,r){return Sparse[p].locate(state(v,id),r)}
 // A recognized outer event may carry several local effects, but is one root record.
 function syncQuestion(v,r){let gen=question(r),g=gen.next();while(!g.done)g=gen.next(v.get(g.value));return g.value.data}
 async function effect(v,id,p,e,rootCut,allowTx=false,raw){
  need(Array.isArray(e),'Acontecimiento inválido');const op=e[0];let r,x;if(op==='BATCH'){ar(e,2);r=e[1]}else{[,r,x]=ar(e,3);route(r)}
  if(op==='TX'){
   need(allowTx&&id===0&&r.length===0,'TX solo en raíz exterior');
   const [origin,checks,events]=ar(x,3);need(U.name(origin)&&Array.isArray(checks)&&Array.isArray(events)&&events.length>0,'TX inválida');
   need(v.get(key('receipt',origin))===undefined,'Origen ya reconocido');
   for(const c of checks){const [path,expected]=ar(c,2);route(path);need(U.eq(syncQuestion(v,path),expected),'PRECONDICION_NO_CUMPLIDA')}
   for(const q of events)await effect(v,id,p,q,rootCut,false);
   v.set(key('receipt',origin),{cut:rootCut,raw:raw.slice()});return
  }
  if(op==='MOUNT'){
    const [childP,body]=ar(x,2);profile(childP);const bytes=unhex(body),c=locate(v,id,p,r);
    need(c.parent&&!c.n,'Montaje exige celda ausente');
    const child=v.get(key('next'));need(nat(child)&&Number.isSafeInteger(child+1),'Capacidad de identificador');v.set(key('next'),child+1);
    applyLocal(v,id,p,['MOUNT_LOCAL',r,[child,childP]]);init(v,child,childP);
    await fold(v,child,childP,bytes,rootCut)
  }else if(op==='APPEND'){
    const c=locate(v,id,p,r);need(c.n?.kind==='trajectory','APPEND exige trayectoria constituida');const bytes=unhex(x);need(bytes.length>0,'Sufijo vacío');
    await fold(v,c.n.id,c.n.profile,bytes,rootCut)
  }else{need(op!=='MOUNT_LOCAL','Tratamiento reservado');if(op==='BATCH'){need(p==='B'&&Array.isArray(r)&&r.every(q=>Array.isArray(q)&&!['TX','MOUNT_LOCAL','MOUNT','APPEND','BATCH'].includes(q[0])),'Lote contiene tratamiento de frontera');}applyLocal(v,id,p,e)}
 }
 async function fold(v,id,p,raw,rootCut,allowTx=false){
  let offset=0;
  while(offset<raw.length){const f=await decode(p,raw,offset);
   await effect(v,id,p,f.event,rootCut,allowTx,f.raw);
   const n=v.get(meta(id,'count'));v.set(meta(id,'record:'+n),f.raw);v.set(meta(id,'rootCut:'+n),rootCut);v.set(meta(id,'count'),n+1);offset=f.end
  }
 }
 // Generator continuation: each key is acquired once per request; no restart or full-state fallback.
 function* navigate(r,scope=0,enterFinal=true){
  route(r);let n=yield local(scope,key('root')),localPath=[],boundaries=[];
  function* enter(){while(n?.kind==='trajectory'){boundaries.push({scope,path:localPath.slice(),child:n.id,profile:n.profile});scope=n.id;localPath=[];n=yield local(scope,key('root'))}}
  for(const p of r){yield* enter();need(n&&n.kind!=='value','Ruta terminal o ausente');const len=yield local(scope,key('count',n.axis));need(nat(len)&&p<len,'Posición inexistente');n=yield local(scope,key('slot',n.id,p));localPath.push(p)}
  if(enterFinal)yield* enter();
  return {scope,n,localPath,boundaries}
 }
 function* question(r,enterFinal=true){const c=yield* navigate(r,0,enterFinal),n=c.n;let data;
  if(!n)data=['absent'];else if(n.kind==='value')data=['value',cp(n.value)];else if(n.kind==='trajectory')data=['trajectory',n.profile,n.id];else{
   const len=yield local(c.scope,key('count',n.axis));need(nat(len),'Eje inexistente');const xs=[];for(let i=0;i<len;i++)xs.push([i,yield local(c.scope,key('name',n.axis,i))]);data=['context',xs]
  }
  return {data,scope:c.scope,localPath:c.localPath,boundaries:c.boundaries}
 }
 async function cursor(get,gen,{signal}={}){
  const cache=new Map();let steps=0,g=gen.next();
  while(!g.done){if(signal?.aborted)throw Error('RECORRIDO_CANCELADO');const k=g.value;if(!cache.has(k))cache.set(k,await get(k));steps++;g=gen.next(cache.get(k))}
  if(signal?.aborted)throw Error('RECORRIDO_CANCELADO');return {result:g.value,reads:cache.size,steps}
 }
 class World{
  #s=new Map();#tail=Promise.resolve();#profile;
  constructor(p){this.#profile=profile(p);this.#s.set(key('next'),1);init(this.#s,0,p)}
  enqueue(fn){const j=this.#tail.then(fn);this.#tail=j.catch(()=>{});return j}
  async #appendOwned(owned,strict=false){const f=await decode(this.#profile,owned,0);need(f.end===owned.length,'Un acontecimiento exterior por append');
   if(f.event?.[0]==='TX'){const [,r,x]=ar(f.event,3);route(r);need(r.length===0,'TX solo raíz');const [origin]=ar(x,3);need(U.name(origin),'Origen inválido');const prior=this.#s.get(key('receipt',origin));if(prior){need(!strict,'Origen repetido físicamente en replay');need(Q.K4B.equal(prior.raw,owned),'CONFLICTO_ORIGEN');return {cut:prior.cut,replayed:true}}}
   const v=overlay(this.#s),cut=this.#s.get(meta(0,'count'))+1;await fold(v,0,this.#profile,owned,cut,true);v.commit();
   return f.event?.[0]==='TX'?{cut,replayed:false}:cut
  }
  append(raw){need(raw instanceof Uint8Array&&raw.length>0,'Marco requerido');const owned=raw.slice();return this.enqueue(()=>this.#appendOwned(owned))}
  submit(e){value(e);const owned=cp(e);return this.enqueue(async()=>this.#appendOwned(await encode(this.#profile,owned)))}
  read(r=[],opts={}){const p=r.slice(),options={...opts};return this.enqueue(async()=>{const x=await cursor(k=>this.#s.get(k),question(p,options.enterFinal!==false),options);return {...x.result,reads:x.reads,steps:x.steps,cut:this.#s.get(meta(0,'count'))}})}
  // Route is transparent on reads. Write route is explicit: local treatments never cross a boundary.
  // For convenience, compile a global target into nested APPEND frames in the same consistent cut.
  write(op,r,x){const p=r.slice(),v=cp(x);return this.enqueue(async()=>{
    need(!['TX','MOUNT_LOCAL','APPEND','AXIS','GROW','BATCH'].includes(op),'Use submit/APPEND explícito para tratamiento contextual');
    const c=(await cursor(k=>this.#s.get(k),navigate(p,0,op!=='MOUNT'))).result;
    const childP=this.#s.get(meta(c.scope,'profile'));let raw=await encode(childP,[op,c.localPath,v]);
    for(let i=c.boundaries.length-1;i>=0;i--){const b=c.boundaries[i],p0=this.#s.get(meta(b.scope,'profile'));raw=await encode(p0,['APPEND',b.path,hex(raw)])}
    return this.#appendOwned(raw)
  })}
  #bytes(scope,end){const n=this.#s.get(meta(scope,'count'));need(nat(n),'Trayectoria desconocida');const k=end===undefined?n:end;need(nat(k)&&k<=n,'Corte fuera de rango');let size=0;for(let i=0;i<k;i++)size+=this.#s.get(meta(scope,'record:'+i)).length;const bytes=new Uint8Array(size);let off=0;for(let i=0;i<k;i++){let r=this.#s.get(meta(scope,'record:'+i));bytes.set(r,off);off+=r.length}return bytes}
  export(scope=0,end){return this.enqueue(()=>this.#bytes(scope,end))}
  async at(cut){return World.replay(this.#profile,await this.export(0,cut))}
  transaction(origin,checks,events){return this.submit(['TX',[],[origin,checks,events]])}
  history(r=[],{from=0,to}={}){const path=r.slice();return this.enqueue(async()=>{
   let id=0;if(path.length){const c=(await cursor(k=>this.#s.get(k),navigate(path,0,false))).result;need(c.n?.kind==='trajectory','Ruta no constituye trayectoria');id=c.n.id}
   const p=this.#s.get(meta(id,'profile')),n=this.#s.get(meta(id,'count')),stop=to===undefined?n:to;need(nat(from)&&nat(stop)&&from<=stop&&stop<=n,'Rango histórico inválido');
   const records=[];for(let i=from;i<stop;i++){const raw=this.#s.get(meta(id,'record:'+i)),f=await decode(p,raw,0);records.push({position:i,rootCut:this.#s.get(meta(id,'rootCut:'+i)),event:f.event,hex:hex(raw)})}
   return {scope:id,profile:p,cut:n,rootCut:this.#s.get(meta(0,'count')),from,to:stop,records}
  })}
  cut(scope=0){return this.enqueue(()=>{const n=this.#s.get(meta(scope,'count'));need(nat(n),'Trayectoria desconocida');return n})}
  static async replay(p,bytes){const raw=bytes.slice(),w=new World(p);let offset=0;while(offset<raw.length){const f=await Q.K5B.read(raw,offset);await w.#appendOwned(raw.slice(offset,f.end),true);offset=f.end}return w}
 }
 return {World,encode,hex,unhex,cursor,question,navigate}
})();