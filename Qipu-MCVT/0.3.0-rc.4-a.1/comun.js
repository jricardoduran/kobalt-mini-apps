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