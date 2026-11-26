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
   for(const p of r){need(n&&n.kind!=='value','Contenido terminal o ausente');need(p<count(v,n.axis),'Posición inexistente');parent=n;i=p;n=v.get('slot',n.id,p)}
   return {n,parent,i}}
  function bound(v,c,x){need(c.parent,'Se requiere posición');v.put(x,'slot',c.parent.id,c.i)}
  function axis(v,a){let k=typeof a==='string'?v.get('axisName',a):nat(a)?v.get('axisIndex',a):undefined;need(k!==undefined,'Eje inexistente');return k}
  function one(v,e){const [op,r,x]=ar(e,3);
   if(profile==='B'&&op==='AXIS'){need(Array.isArray(r)&&r.length===0&&U.name(x),'AXIS exige nombre');if(v.get('axisName',x)===undefined){let j=v.get('axisCount'),a=newAxis(v);need(j<65536,'Capacidad');v.put(a,'axisName',x);v.put(a,'axisIndex',j);v.put(j+1,'axisCount')}return}
   if(profile==='B'&&op==='GROW'){ar(r,1);introduce(v,axis(v,r[0]),x);return}
   const c=resolve(v,r),n=c.n;
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
  return {zero:()=>zero(profile),plan,commit,apply,read,cell}
 }
 return {A:engine('A'),B:engine('B')}
})();