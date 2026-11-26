'use strict';
globalThis.Qipu = globalThis.Qipu || {};
Qipu.K2P = (() => {
    const need = (ok, msg = 'K2P inválido') => {
        if (!ok)
            throw Error(msg);
    };
    function encode(n, w = 4) {
        need(Number.isSafeInteger(n) && n >= 0, 'Natural fuera de dominio');
        need(Number.isInteger(w) && w >= 1 && w <= 8, 'Perfil W inválido');
        const b = n.toString(2), k = b.length;
        need(k <= 2 ** w, 'Natural fuera del perfil');
        return (k - 1).toString(2).padStart(w, '0') + b;
    }
    class Writer {
        constructor() {
            this.parts = [];
        }
        n(n, w = 4) {
            this.parts.push(encode(n, w));
            return this;
        }
        text(s) {
            need(typeof s === 'string', 'Texto requerido');
            const b = new TextEncoder().encode(s);
            need(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b) === s, 'Unicode no válido');
            this.n(b.length, 6);
            for (const x of b)
                this.parts.push(x.toString(2).padStart(8, '0'));
            return this;
        }
        bytes() {
            let s = this.parts.join('');
            s = s.padEnd(Math.ceil(s.length / 8) * 8, '0');
            return Uint8Array.from(s.match(/.{8}/g) || [], x => parseInt(x, 2));
        }
    }
    class Reader {
        constructor(bytes) {
            need(bytes instanceof Uint8Array, 'Bytes requeridos');
            this.b = bytes;
            this.p = 0;
        }
        take(k) {
            need(Number.isSafeInteger(k) && k >= 0 && this.p + k <= this.b.length * 8, 'Campo truncado');
            let n = 0n;
            for (let j = 0; j < k; j++, this.p++)
                n = (n << 1n) | BigInt((this.b[this.p >> 3] >> (7 - (this.p & 7))) & 1);
            return n;
        }
        n(w = 4) {
            need(Number.isInteger(w) && w >= 1 && w <= 8, 'Perfil W inválido');
            const k = Number(this.take(w)) + 1;
            need(k <= 53, 'Natural fuera del dominio seguro');
            const n = Number(this.take(k));
            need(n.toString(2).length === k, 'Natural no canónico');
            return n;
        }
        text() {
            const k = this.n(6);
            need(k <= Math.floor((this.b.length * 8 - this.p) / 8), 'Texto truncado');
            const b = new Uint8Array(k);
            for (let j = 0; j < k; j++)
                b[j] = Number(this.take(8));
            return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b);
        }
        finish() {
            const k = this.b.length * 8 - this.p;
            need(k < 8 && this.take(k) === 0n, 'Padding no canónico');
        }
    }
    return { encode, Writer, Reader, need };
})();
'use strict';
Qipu.K4B = (() => {
    const { need } = Qipu.K2P, MAX = 1048576;
    const cat = (...parts) => {
        const b = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
        let i = 0;
        for (const p of parts) {
            b.set(p, i);
            i += p.length;
        }
        return b;
    };
    const domain = s => new TextEncoder().encode(s + '\0');
    const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const hash = async (b) => {
        need(globalThis.crypto?.subtle, 'Web Crypto no disponible: abra en localhost o HTTPS');
        return new Uint8Array(await crypto.subtle.digest('SHA-256', b));
    };
    function lengthBytes(n) {
        need(Number.isInteger(n) && n >= 0 && n <= MAX, 'Longitud fuera de límite');
        let k = n <= 255 ? 1 : n <= 65535 ? 2 : 3;
        const a = new Uint8Array(k + 1);
        a[0] = k - 1;
        for (let j = k; j > 0; j--) {
            a[j] = n & 255;
            n = Math.floor(n / 256);
        }
        return a;
    }
    async function seal(body, prefix = new Uint8Array(), d = 'QIPU-K4B-1') {
        need(body instanceof Uint8Array, 'Cuerpo binario requerido');
        const p = cat(prefix, lengthBytes(body.length), body);
        return cat(p, await hash(cat(domain(d), p)));
    }
    async function read(bytes, offset = 0, prefixSize = 0, d = 'QIPU-K4B-1') {
        need(bytes instanceof Uint8Array && Number.isSafeInteger(prefixSize) && prefixSize >= 0 && Number.isSafeInteger(offset) && offset >= 0 && offset <= bytes.length, 'Offset inválido');
        const start = offset;
        let p = offset + prefixSize;
        need(p < bytes.length, 'Encabezado truncado');
        const k = bytes[p++] + 1;
        need(k <= 4 && p + k <= bytes.length, 'Ancho inválido o truncado');
        let n = 0;
        for (let j = 0; j < k; j++)
            n = n * 256 + bytes[p++];
        need(n <= MAX && lengthBytes(n)[0] === k - 1, 'Longitud no canónica');
        const end = p + n, stop = end + 32;
        need(stop <= bytes.length, 'Registro truncado');
        const h = await hash(cat(domain(d), bytes.subarray(start, end)));
        need(equal(h, bytes.subarray(end, stop)), 'Hash no coincide');
        return { prefix: bytes.slice(start, start + prefixSize), body: bytes.slice(p, end), end: stop, hash: h };
    }
    return { seal, read, cat, equal, hash, MAX };
})();
'use strict';
Qipu.K5B = (() => {
    const { need } = Qipu.K2P;
    return {
        async seal(t, b) {
            need(Number.isInteger(t) && t >= 0 && t <= 65535, 'Tratamiento inválido');
            return Qipu.K4B.seal(b, Uint8Array.of(t >> 8, t & 255), 'QIPU-K5B-1');
        },
        async read(b, p = 0) {
            const r = await Qipu.K4B.read(b, p, 2, 'QIPU-K5B-1');
            return { ...r, t: r.prefix[0] * 256 + r.prefix[1] };
        }
    };
})();
'use strict';

'use strict';
const U=(()=>{
 const MAX=64, need=(x,m)=>{if(!x)throw Error(m)}, cp=x=>JSON.parse(JSON.stringify(x)), eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b), nat=x=>Number.isSafeInteger(x)&&x>=0, name=x=>typeof x==='string'&&x.length>0&&x.length<=200, ar=(x,n)=>{need(Array.isArray(x)&&x.length===n,'Aridad inválida');return x}, route=r=>{need(Array.isArray(r)&&r.every(nat),'Ruta inválida');return r};
 function value(x,d=0){need(d<=MAX,'Contenido demasiado profundo');if(x===null||typeof x==='boolean'||typeof x==='string'||Number.isSafeInteger(x))return;if(Array.isArray(x)){x.forEach(y=>value(y,d+1));return}need(x&&Object.getPrototypeOf(x)===Object.prototype,'Contenido JSON no admitido');for(const y of Object.values(x))value(y,d+1)}
 function add(a,n){need(name(n),'Nombre inválido');let i=a.indexOf(n);if(i<0){need(a.length<65536,'Capacidad');i=a.length;a.push(n)}return i}
 const find=(xs,i)=>xs.find(x=>x[0]===i)?.[1], put=(xs,i,x)=>{let j=xs.findIndex(x=>x[0]===i);if(j<0)xs.push([i,x]);else xs[j][1]=x};
 function transform(old,op,x){value(x);if(op==='SET'){need(!old||old.kind==='value','No sustituir geometría constituida');return {kind:'value',value:cp(x)}}need(op==='ADD'||op==='SUB','Tratamiento inválido');need(old?.kind==='value'&&nat(old.value)&&nat(x),'Diferencial requiere natural existente');let y=old.value+(op==='ADD'?x:-x);need(nat(y),'Natural fuera de dominio');return {kind:'value',value:y}}
 const summary=(n)=>!n?['absent']:n.kind==='value'?['value',cp(n.value)]:null;
 const list=names=>['context',names.map((n,i)=>[i,n])];
 const replay=(engine,log,n=log.length)=>{need(nat(n)&&n<=log.length,'Corte inválido');let s=engine.zero();for(let i=0;i<n;i++)s=engine.apply(s,log[i]);return s};
 return {MAX,need,cp,eq,nat,name,ar,route,value,add,find,put,transform,summary,list,replay}
})();
/* Qipu RC.4 A/B — materialización dispersa experimental; no cambia la trayectoria. */
'use strict';
const Sparse=(()=>{
 const {need,cp,eq,nat,ar,route,transform,summary}=U;
 const key=(...x)=>JSON.stringify(x);
 function zero(profile){need(profile==='A'||profile==='B','Perfil');const s=new Map();
 const put=(x,...k)=>s.set(key(...k),x);
 put(1,'seq');put(0,'count',0);put({kind:profile==='A'?'root':'context',id:0,axis:0},'root');
 if(profile==='B'){put(1,'axisCount');put(0,'axisIndex',0);put(0,'axisName','root')}return s}
 function view(base){const delta=new Map(),seen=new Set();
  function get(...k){let p=key(...k);if(delta.has(p))return delta.get(p);seen.add(p);return base.get(p)}
  function put(x,...k){let p=key(...k);if(!eq(get(...k),x))delta.set(p,x)}
  return {get,put,delta,seen}}
 function engine(profile){
  function count(v,a){const n=v.get('count',a);need(nat(n),'Eje inexistente');return n}
  function alloc(v){let id=v.get('seq');v.put(id+1,'seq');return id}
  function newAxis(v){let id=alloc(v);v.put(0,'count',id);return id}
  function introduce(v,a,n){need(U.name(n),'Nombre inválido');let i=v.get('pos',a,n);if(i!==undefined)return i;i=count(v,a);need(i<65536,'Capacidad');v.put(n,'name',a,i);v.put(i,'pos',a,n);v.put(i+1,'count',a);return i}
  function node(v,kind,axis,rows){return {kind,id:alloc(v),axis,...(rows===undefined?{}:{rows})}}
  function table(v){return node(v,'table',newAxis(v),newAxis(v))}
  function vector(v){return node(v,'vector',newAxis(v))}
  function resolve(v,r){route(r);let n=v.get('root'),parent=null,i;
   for(const p of r){need(n&&n.kind!=='value'&&n.kind!=='trajectory','Contenido terminal, ausente o frontera de trayectoria');need(p<count(v,n.axis),'Posición inexistente');parent=n;i=p;n=v.get('slot',n.id,p)}
   return {n,parent,i}}
  function bound(v,c,x){need(c.parent,'Se requiere posición');v.put(x,'slot',c.parent.id,c.i)}
  function axis(v,a){let k=typeof a==='string'?v.get('axisName',a):nat(a)?v.get('axisIndex',a):undefined;need(k!==undefined,'Eje inexistente');return k}
  function one(v,e){const [op,r,x]=ar(e,3);
   if(profile==='B'&&op==='AXIS'){need(Array.isArray(r)&&r.length===0&&U.name(x),'AXIS exige nombre');if(v.get('axisName',x)===undefined){let j=v.get('axisCount'),a=newAxis(v);need(j<65536,'Capacidad');v.put(a,'axisName',x);v.put(a,'axisIndex',j);v.put(j+1,'axisCount')}return}
   if(profile==='B'&&op==='GROW'){ar(r,1);introduce(v,axis(v,r[0]),x);return}
   const c=resolve(v,r),n=c.n;
   if(op==='MOUNT_LOCAL'){need(c.parent&&(profile==='B'||['column','vector'].includes(c.parent.kind))&&!n,'Montaje exige celda ausente');const [id,p]=ar(x,2);need(nat(id)&&['A','B'].includes(p),'Descriptor inválido');bound(v,c,{kind:'trajectory',id,profile:p});return}
   if(profile==='A'){
    if(op==='TABLE'){need(n?.kind==='root','TABLE exige raíz');let i=introduce(v,n.axis,x);if(v.get('slot',n.id,i)===undefined)v.put(table(v),'slot',n.id,i);return}
    if(op==='COL'){need(n?.kind==='table','COL exige tabla');let i=introduce(v,n.axis,x);if(v.get('slot',n.id,i)===undefined)v.put(node(v,'column',n.rows),'slot',n.id,i);return}
    if(op==='ID'){need(n?.kind==='table','ID exige tabla');introduce(v,n.rows,x);return}
    if(op==='ITEM'){need(n?.kind==='vector','ITEM exige vector');introduce(v,n.axis,x);return}
    if(op==='OPEN'){need(c.parent&&['column','vector'].includes(c.parent.kind)&&['table','vector'].includes(x),'OPEN exige celda y clase');need(!n||n.kind===x,'Clase incompatible');if(!n)bound(v,c,x==='table'?table(v):vector(v));return}
   }else{
    if(op==='INTRO'){need(n?.kind==='context','INTRO exige contexto');let [nm,ref]=ar(x,2),i=introduce(v,n.axis,nm);if(ref!==null){let a=axis(v,ref),old=v.get('slot',n.id,i);need(!old||(old.kind==='context'&&old.axis===a),'Eje incompatible');if(!old)v.put(node(v,'context',a),'slot',n.id,i)}return}
    if(op==='BIND'){need(c.parent,'BIND exige posición');let a=axis(v,x);need(!n||(n.kind==='context'&&n.axis===a),'Eje incompatible');if(!n)bound(v,c,node(v,'context',a));return}
   }
   need(['SET','ADD','SUB'].includes(op),'Tratamiento desconocido');need(c.parent&&(profile==='B'||['column','vector'].includes(c.parent.kind)),'Se requiere celda');bound(v,c,transform(n,op,x))
  }
  function plan(base,e){const v=view(base);if(profile==='B'&&e?.[0]==='BATCH'){ar(e,2);need(Array.isArray(e[1])&&e[1].length>0&&e[1].length<=256,'Lote inválido');for(const q of e[1])one(v,q)}else one(v,e);return {delta:v.delta,reads:v.seen.size,writes:v.delta.size}}
  function commit(s,p){for(const [k,x] of p.delta)s.set(k,cp(x));return s}
  function apply(s,e){return commit(s,plan(s,e))}
  function read(s,r=[]){const v=view(s),n=resolve(v,r).n;let data=summary(n);if(!data){const a=n.axis,len=count(v,a);data=['context',Array.from({length:len},(_,i)=>[i,v.get('name',a,i)])]}return {data,reads:v.seen.size}}
  function cell(s,r){const v=view(s),c=resolve(v,r);need(c.parent&&(profile==='B'||['column','vector'].includes(c.parent.kind)),'Se requiere celda');let n=c.n;return {data:!n?['absent']:n.kind==='value'?['value',cp(n.value)]:['context',n.kind],reads:v.seen.size}}
  return {zero:()=>zero(profile),plan,commit,apply,read,cell,locate:(s,r)=>resolve(view(s),r)}
 }
 return {A:engine('A'),B:engine('B')}
})();
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
  async #compile(op,p,v){
    need(!['TX','MOUNT_LOCAL','APPEND','AXIS','GROW','BATCH'].includes(op),'Use submit/APPEND explícito para tratamiento contextual');
    const c=(await cursor(k=>this.#s.get(k),navigate(p,0,op!=='MOUNT'))).result;
    const childP=this.#s.get(meta(c.scope,'profile'));let raw=await encode(childP,[op,c.localPath,v]);
    for(let i=c.boundaries.length-1;i>=0;i--){const b=c.boundaries[i],p0=this.#s.get(meta(b.scope,'profile'));raw=await encode(p0,['APPEND',b.path,hex(raw)])}
    return raw
  }
  write(op,r,x){const p=r.slice(),v=cp(x);return this.enqueue(async()=>this.#appendOwned(await this.#compile(op,p,v)))}
  recognized(origin,checks,op,r,x){const p=r.slice(),v=cp(x),c=cp(checks);return this.enqueue(async()=>{const raw=await this.#compile(op,p,v),e=(await decode(this.#profile,raw,0)).event;return this.#appendOwned(await encode(this.#profile,['TX',[],[origin,c,[e]]]))})}
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

/* Public TRC profile A; strict interoperable JSON domain. */
globalThis.QipuTRC=(()=>{
 const {World,encode,hex,unhex}=RC4,Q=globalThis.Qipu,need=U.need;
 const MAX=9007199254740991;
 function check(x,d=0){need(d<=64,'Contenido demasiado profundo');if(typeof x==='string'){need(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(new TextEncoder().encode(x))===x,'Unicode inválido');return}
 if(x===null||typeof x==='boolean'||Number.isSafeInteger(x))return;
 if(Array.isArray(x)){for(let i=0;i<x.length;i++){need(Object.hasOwn(x,i),'Lista dispersa inválida');check(x[i],d+1)}return}
 need(x&&Object.getPrototypeOf(x)===Object.prototype,'JSON inválido');for(const k of Object.keys(x)){check(k,d+1);check(x[k],d+1)}}
 function onlyA(e){need(Array.isArray(e),'Acontecimiento requerido');const op=e[0];need(['TABLE','COL','ID','ITEM','OPEN','SET','ADD','SUB','MOUNT','APPEND','TX'].includes(op),'Tratamiento fuera de TRC-A');if(op==='MOUNT')need(e[2]?.[0]==='A','TRC utiliza perfil A');}
 async function validate(raw,root=true){let o=0;while(o<raw.length){const f=await Q.K5B.read(raw,o);need(f.t===65520,'TRC-A requiere tratamiento 65520');const str=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(f.body),e=JSON.parse(str);check(e);need(JSON.stringify(e)===str,'JSON de marco no canónico');await verifyEvent(e,root);o=f.end}}
 async function verifyEvent(e,root=true){onlyA(e);if(e[0]==='MOUNT')await validate(unhex(e[2][1]),false);if(e[0]==='APPEND')await validate(unhex(e[2]),false);if(e[0]==='TX'){need(root,'TX solo raíz');need(Array.isArray(e[2]?.[2]),'TX inválida');for(const q of e[2][2])await verifyEvent(q,false)}}
 async function open(raw=new Uint8Array()){await validate(raw);return World.replay('A',raw)}
 function cat(a,b){return Q.K4B.cat(a,b)}
 async function execute(w,q){check(q);need(q&&typeof q==='object'&&!Array.isArray(q),'Solicitud requerida');const r=q.route??[];
  switch(q.op){
   case 'write':need(['TABLE','COL','ID','ITEM','OPEN','SET','ADD','SUB','MOUNT'].includes(q.treatment),'Tratamiento inválido');if(q.treatment==='MOUNT'){need(q.content?.[0]==='A','TRC utiliza perfil A');await validate(unhex(q.content[1]),false)}return w.recognized(q.origin,q.checks??[],q.treatment,r,q.content);
   case 'submit':await verifyEvent(q.event);return w.submit(q.event);
   case 'transaction':await verifyEvent(['TX',[],[q.origin,q.checks??[],q.events]]);return w.transaction(q.origin,q.checks??[],q.events);
   case 'read':{const v=q.cut==null?w:await w.at(q.cut);return v.read(r,{enterFinal:q.enterFinal!==false})}
   case 'history':{const v=q.cut==null?w:await w.at(q.cut);return v.history(r,{from:q.from??0,to:q.to??undefined})}
   case 'export':{const v=q.cut==null?w:await w.at(q.cut);let scope=0;if(r.length){const h=await v.history(r,{from:0,to:0});scope=h.scope}return {hex:hex(await v.export(scope,q.end??undefined)),cut:await v.cut(scope)}}
   case 'cut':return {cut:await w.cut()};
   default:throw Error('Operación desconocida')
  }
 }
 async function plan(raw,q){const w=await open(raw),before=await w.cut(),result=await execute(w,q),after=await w.cut(),all=await w.export();need(after===before||after===before+1,'Un marco raíz por solicitud');need(Q.K4B.equal(all.slice(0,raw.length),raw),'Prefijo alterado');return {result,cut:after,suffix:all.slice(raw.length)}}
 return {version:'1.0.0',open,execute,plan,encode:async e=>{check(e);await verifyEvent(e);return encode('A',e)},hex,unhex,cat,check,validate}
})();
