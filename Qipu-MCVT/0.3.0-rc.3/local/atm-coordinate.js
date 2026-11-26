/* ATM-C 0.3 · Coordinate boundary; QIPU-META-1 remains unchanged. */
'use strict';
(function(root){
const Q=root.Qipu,A=root.ATM,M=Q.Mechanisms,ok=(x,m)=>{if(!x)throw Error(m)},get=(s,...k)=>s.get(JSON.stringify(k)),copy=structuredClone;
const nat=x=>Number.isSafeInteger(x)&&x>=0,sel=x=>nat(x)||typeof x==='string',obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),own=(x,k)=>Object.hasOwn(x,k);
const ar=(x,n)=>{ok(Array.isArray(x)&&x.length===n,'Aridad inválida');return x};
function keys(x,ks){ok(obj(x)&&Object.keys(x).length===ks.length&&ks.every(k=>own(x,k)),'Campos externos inválidos')}
function scope(c){ok(typeof c==='string'&&/^[A-Za-z0-9_:.\/-]{1,200}$/.test(c)&&!/[\r\n]/.test(c),'Contexto inválido');return c}
function packet(input,context){scope(context);let p=copy(input),q;
 if(Array.isArray(p)){ar(p,2);ok(p[0]===context,'Contexto incompatible');q=p[1]}
 else{ok(obj(p)&&p.context===context,'Contexto incompatible');let op=p.op;
  if(['SET','ADD','SUB'].includes(op)){if(own(p,'coordinates')){keys(p,['context','op','coordinates','value']);ok(ar(p.coordinates,3).every(nat),'Coordenadas numéricas requeridas');q=[op,p.coordinates,p.value]}else{keys(p,['context','op','table','parameter','identity','value']);ok([p.table,p.parameter,p.identity].every(x=>typeof x==='string'),'Nombres requeridos');q=[op,[p.table,p.parameter,p.identity],p.value]}}
  else if(op==='ID'){keys(p,['context','op','table','identity']);ok(typeof p.table==='string'&&typeof p.identity==='string','Nombres requeridos');q=[op,[p.table,p.identity]]}
  else if(op==='ACT'){keys(p,['context','op','action','rows']);q=[op,p.action,p.rows]}
  else throw Error('Tratamiento externo desconocido');
 }
 ok(Array.isArray(q)&&q.length>0,'Intención inválida');return q
}
function table(s,t){ok(nat(t),'Tabla numérica requerida');const m=get(s,'table',t);ok(m,'Tabla no constituida');return m}
function vector(s,t,v){ok(nat(v),'Vector numérico requerido');const x=get(s,'vector',t,v);ok(x,'Vector no constituido');return x}
function identity(s,t,i){ok(nat(i),'Identidad numérica requerida');const x=get(s,'entity',t,i);ok(x!==undefined,'Identidad no constituida');return x}
function geometry(s,t){const m=table(s,t);return [m.name,Array.from({length:m.entities},(_,i)=>identity(s,t,i)),Array.from({length:m.vectors},(_,v)=>{const x=vector(s,t,v);return [x.name,x.domain]})]}
function read(s,path=[]){ok(Array.isArray(path)&&path.length<=3&&path.every(nat),'Ruta [t,v,i] inválida');if(!path.length)return Array.from({length:get(s,'tableCount')||0},(_,t)=>geometry(s,t));const [t,v,i]=path,m=table(s,t);if(path.length===1)return geometry(s,t);vector(s,t,v);if(path.length===2){let out=[];for(let j=0;j<m.entities;j++){let x=get(s,'cell',t,v,j);if(x!==undefined)out.push([j,x])}return copy(out)}identity(s,t,i);return copy(get(s,'cell',t,v,i)??null)}
function contract(s){const c=get(s,'schema')||{types:[],fields:[],actions:[]},t=n=>c.types.indexOf(n),f=(a,n)=>c.fields.findIndex(x=>x.table===a&&x.name===n);
return copy([c.types,c.fields.map(x=>[t(x.table),x.name,x.domain,x.allow,x.constitutive]),c.actions.map(a=>[a.name,t(a.table),a.inputs.map(x=>[x.name,x.domain,x.positive]),a.effects.map(x=>[f(a.table,x.parameter),x.operation,a.inputs.findIndex(y=>y.name===x.input)]),a.measure.map(n=>a.inputs.findIndex(x=>x.name===n))])])}
function project(s,t,i){const m=table(s,t),id=identity(s,t,i),values=[];for(let v=0;v<m.vectors;v++){let x=get(s,'cell',t,v,i);if(x!==undefined)values.push([v,x])}return [t,i,id,copy(values)]}
function external(s,t,i){let p=project(s,t,i);return {identity:p[2],parameters:Object.fromEntries(p[3].map(([v,x])=>[vector(s,t,v).name,x]))}}
function compile(s,input,context){let q=packet(input,context),op=q[0],legacy,ev;
 if(['SET','ADD','SUB'].includes(op)){ar(q,3);let [t,v,i]=ar(q[1],3);ok([t,v,i].every(sel),'Selector inválido');legacy=[op,t,i,v,q[2]]}
 else if(op==='ID'){ar(q,2);let [t,i]=ar(q[1],2);ok([t,i].every(sel),'Selector inválido');legacy=[op,t,i]}
 else if(op==='ACT'){ar(q,3);ok(sel(q[1])&&Array.isArray(q[2]),'Acción inválida');legacy=q}
 else if(op==='DEF'){ar(q,4);legacy=q}
 else throw Error('Tratamiento desconocido');
 ev=A.translate(s,legacy);Q.Contracts.request(ev);
 // Resolve known coordinates and retain only irreducible names for first appearances.
 let normalized=q;
 if(ev.op==='assert'||ev.op==='identity'){let t=get(s,'tableName',ev.table),i=t===undefined?undefined:get(s,'entityName',t,ev.identity);
 if(ev.op==='assert'){let v=t===undefined?undefined:get(s,'vectorName',t,ev.parameter);normalized=[op,[t??ev.table,v??ev.parameter,i??ev.identity],ev.value];legacy=[op,ev.table,ev.identity,ev.parameter,ev.value]}else{normalized=[op,[t??ev.table,i??ev.identity]];legacy=[op,ev.table,ev.identity]}}
 else if(ev.op==='action'){let c=get(s,'schema'),a=c.actions.findIndex(x=>x.name===ev.name),t=get(s,'tableName',c.actions[a].table);normalized=[op,a,ev.rows.map(r=>[t===undefined?r.identity:get(s,'entityName',t,r.identity)??r.identity,...r.values])];legacy=[op,ev.name,ev.rows.map(r=>[r.identity,...r.values])]}
 return copy({intent:normalized,legacy,event:ev})}
class Local{
 constructor(local,context){this.local=local;this.context=scope(context)}
 static async open(name,id,context){scope(context);return new Local(await A.Local.open(name,id),context)}
 async acquire(fn){let b=await M.sparseRead(this.local.db,this.local.id,fn);return {context:this.context,cut:b.meta.count,data:b.data,reads:b.reads,mode:b.mode}}
 init(){return this.local.init()} close(){this.local.close()} export(){return this.local.export()}
 read(path=[]){let p=copy(path);return this.acquire(s=>read(s,p))}
 contract(){return this.acquire(contract)}
 project(t,i){return this.acquire(s=>project(s,t,i))}
 json(t,i){return this.acquire(s=>external(s,t,i))}
 async stage(input,origin){let p=copy(input),o=copy(origin);let b=await this.acquire(s=>compile(s,p,this.context));return this.local.stage(b.data.legacy,o)}
 async submit(input,origin,options){return this.local.appendPrepared(await this.stage(input,origin),options)}
 retry(origin,options){return this.local.retry(origin,options)}
}
root.ATMC={read,contract,project,external,compile,Local};if(typeof module!=='undefined')module.exports=root.ATMC;
})(globalThis);
