/* Qipu MCVT 0.3.0-rc.1 · ATM 0.2.0 */
'use strict';
(function(root){
const Q=root.Qipu,M=Q.Mechanisms,ok=(x,m)=>{if(!x)throw Error(m)},copy=structuredClone,nat=x=>Number.isSafeInteger(x)&&x>=0;
const ar=(x,n)=>{ok(Array.isArray(x)&&x.length===n,'Aridad inválida');return x},get=(s,...k)=>s.get(JSON.stringify(k)),schema=s=>get(s,'schema')||{types:[],fields:[],actions:[]};
function table(s,t){if(typeof t==='string'){ok(schema(s).types.includes(t),'Tipo no declarado');return t}ok(nat(t),'Tabla inválida');const x=get(s,'table',t);ok(x,'Tabla no constituida');return x.name}
function entity(s,t,i){if(typeof i==='string'){Q.Contracts.text(i);return i}ok(nat(i),'Entidad inválida');const x=get(s,'entity',get(s,'tableName',t),i);ok(x!==undefined,'Entidad no constituida');return x}
function field(s,t,v){if(typeof v==='string'){ok(schema(s).fields.some(f=>f.table===t&&f.name===v),'Parámetro no declarado');return v}ok(nat(v),'Vector inválido');const x=get(s,'vector',get(s,'tableName',t),v);ok(x,'Vector no constituido');return x.name}
function action(s,a){const aa=schema(s).actions,x=typeof a==='string'?aa.find(x=>x.name===a):nat(a)?aa[a]:undefined;ok(x,'Acción no declarada');return x}
function meta(s){const c=schema(s);return copy({tipos:c.types.map(t=>{const p=get(s,'tableName',t),m=get(s,'table',p);return {nombre:t,pos:p??null,entidades:m?Array.from({length:m.entities},(_,i)=>get(s,'entity',p,i)):[],parametros:c.fields.filter(f=>f.table===t).map(f=>({nombre:f.name,pos:get(s,'vectorName',p,f.name)??null,dominio:f.domain,operaciones:f.allow,constitutivo:f.constitutive})).sort((a,b)=>(a.pos??Infinity)-(b.pos??Infinity))}}),acciones:c.actions.map((a,i)=>({pos:i,...a}))})}
function read(s,path=[]){ok(Array.isArray(path)&&path.length<=3,'Ruta inválida');if(!path.length)return meta(s);const t=table(s,path[0]),p=get(s,'tableName',t),m=get(s,'table',p);if(path.length===1)return meta(s).tipos.find(x=>x.nombre===t);ok(m,'Tabla no constituida');const vp=v=>{const x=get(s,'vectorName',p,field(s,t,v));ok(x!==undefined,'Vector no constituido');return x};if(path.length===3&&path[1]===null){const v=vp(path[2]);return copy(Array.from({length:m.entities},(_,i)=>[i,get(s,'cell',p,v,i)]).filter(x=>x[1]!==undefined))}const i=get(s,'entityName',p,entity(s,t,path[1]));ok(i!==undefined,'Entidad no constituida');if(path.length===2)return copy(Array.from({length:m.vectors},(_,v)=>[v,get(s,'cell',p,v,i)]).filter(x=>x[1]!==undefined));return copy(get(s,'cell',p,vp(path[2]),i)??null)}
function json(s,t,i){const n=table(s,t),p=get(s,'tableName',n);return {identity:entity(s,n,i),parameters:Object.fromEntries(read(s,[t,i]).map(([v,x])=>[get(s,'vector',p,v).name,x]))}}
function translate(s,q){ok(Array.isArray(q)&&q.length,'Solicitud secuencial');const [op,...r]=q;switch(op){
case 'SET':case 'ADD':case 'SUB':{ar(r,4);const t=table(s,r[0]);return {op:'assert',table:t,identity:entity(s,t,r[1]),parameter:field(s,t,r[2]),operation:op,value:r[3]}}
case 'ID':{ar(r,2);const t=table(s,r[0]);return {op:'identity',table:t,identity:entity(s,t,r[1])}}
case 'ACT':{ar(r,2);const a=action(s,r[0]);ok(Array.isArray(r[1]),'Filas inválidas');return {op:'action',name:a.name,rows:r[1].map(x=>{ok(Array.isArray(x)&&x.length,'Fila inválida');return {identity:entity(s,a.table,x[0]),values:x.slice(1)}})}}
case 'DEF':{ar(r,3);const [types,fields,actions]=r;ok([types,fields,actions].every(Array.isArray),'Declaraciones inválidas');return {op:'contract',types,fields:fields.map(x=>{ar(x,5);return {table:x[0],name:x[1],domain:x[2],allow:x[3],constitutive:x[4]}}),actions:actions.map(x=>{ar(x,5);return {name:x[0],table:x[1],inputs:x[2].map(f=>{ar(f,3);return {name:f[0],domain:f[1],positive:f[2]}}),effects:x[3].map(f=>{ar(f,3);return {parameter:f[0],operation:f[1],input:f[2]}}),measure:x[4]}})}}
default:throw Error('Operación desconocida')}}
function origin(o){ar(o,2);ok(typeof o[0]==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(o[0])&&!/[\r\n]/.test(o[0])&&nat(o[1])&&o[1]<=1000000000,'Origen inválido');return {node:o[0],index:o[1]}}
async function prepare(s,q,o){return Q.Canonical.record(120,{origin:origin(copy(o)),event:translate(s,copy(q))})}
const genesis=()=>Q.Canonical.record(120,{origin:null,event:{op:'genesis',profile:'QIPU-META-1'}});
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
function openOutbox(name){return new Promise((resolve,reject)=>{const r=indexedDB.open(name+'-atm-outbox',1);r.onupgradeneeded=()=>r.result.createObjectStore('intents');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Outbox bloqueado'))})}
async function tx(db,mode,fn){const t=db.transaction('intents',mode),done=new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onabort=()=>reject(t.error||Error('Outbox abortado'))});done.catch(()=>{});try{const r=await fn(t.objectStore('intents'));await done;return r}catch(e){try{t.abort()}catch{}await done.catch(()=>{});throw e}}
class Local{
constructor(db,outbox,id){ok(typeof id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(id),'Contexto inválido');this.db=db;this.outbox=outbox;this.id=id}
static async open(name,id){const db=await M.openDB(name);try{return new Local(db,await openOutbox(name),id)}catch(e){db.close();throw e}}
close(){this.db.close();this.outbox.close()}
key(o){origin(o);return JSON.stringify([this.id,...o])}
async state(){return M.load(this.db,this.id)}
async read(path=[]){const b=await this.state();return {cut:b.count,data:read(b.state,path)}}
async json(t,i){const b=await this.state();return {cut:b.count,data:json(b.state,t,i)}}
async init(){return this.appendPrepared(await genesis())}
async appendPrepared(raw,{expectedRevision,lock=true,timeout=10000,mirror=false}={}){return M.append(this.db,this.id,new Uint8Array(raw).slice(),expectedRevision,{lock,timeout,mirror})}
async stage(q,o){q=copy(q);o=copy(o);const key=this.key(o),signature=JSON.stringify(q);const match=x=>{ok(x.signature===signature,'Origen reutilizado con otra solicitud');return new Uint8Array(x.raw).slice()};let old=await tx(this.outbox,'readonly',s=>req(s.get(key)));if(old)return match(old);const b=await this.state();ok(b.count>0,'Inicialización requerida');const raw=await prepare(b.state,q,o);return tx(this.outbox,'readwrite',async s=>{const x=await req(s.get(key));if(x)return match(x);await req(s.add({signature,raw},key));return raw.slice()})}
async submit(q,o,opts){return this.appendPrepared(await this.stage(q,o),opts)}
async retry(o,opts){const x=await tx(this.outbox,'readonly',s=>req(s.get(this.key(o))));ok(x,'Intención no encontrada');return this.appendPrepared(x.raw,opts)}
// Only after a terminal decision, when caller no longer needs to retry.
async forget(o){return tx(this.outbox,'readwrite',s=>req(s.delete(this.key(o))))}
async export(){return M.exportLog(this.db,this.id)}
}
root.ATM={meta,read,json,translate,prepare,genesis,Local};if(typeof module!=='undefined')module.exports=root.ATM;
})(globalThis);
