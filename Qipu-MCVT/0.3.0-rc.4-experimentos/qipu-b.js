/* Qipu B — ámbitos arbitrarios y ejes compartibles. */
const B=(()=>{
 const {need,cp,ar,route,nat,name,add,find,put,transform,summary,list}=U;
 const context=axis=>({kind:'context',axis,slots:[]});
 const zero=()=>({count:0,axes:[{name:'root',ids:[]}],root:context(0)});
 const unwrap=c=>c.kind==='cell'?c.node:c;
 function axis(s,a){let i=typeof a==='string'?s.axes.findIndex(x=>x.name===a):a;need(nat(i)&&i<s.axes.length,'Eje inexistente');return i}
 function resolve(s,r){route(r);let c=s.root;for(const p of r){let n=unwrap(c);need(n?.kind==='context','No hay transición');need(p<s.axes[n.axis].ids.length,'Posición inexistente');c={kind:'cell',slots:n.slots,i:p,node:find(n.slots,p)}}return c}
 function read(s,r=[]){let n=unwrap(resolve(s,r)),z=summary(n);return z||list(s.axes[n.axis].ids)}
 function one(s,e){const [op,r,x]=ar(e,3);
  if(op==='AXIS'){need(Array.isArray(r)&&r.length===0&&name(x),'AXIS exige nombre');if(!s.axes.some(a=>a.name===x)){need(s.axes.length<65536,'Capacidad');s.axes.push({name:x,ids:[]})}return}
  if(op==='GROW'){ar(r,1);add(s.axes[axis(s,r[0])].ids,x);return}
  let c=resolve(s,r),n=unwrap(c);
  if(op==='INTRO'){need(n?.kind==='context','INTRO exige contexto');const [label,ref]=ar(x,2),i=add(s.axes[n.axis].ids,label);if(ref!==null){const j=axis(s,ref),old=find(n.slots,i);need(!old||(old.kind==='context'&&old.axis===j),'Eje constituido incompatible');if(!old)put(n.slots,i,context(j))}}
  else if(op==='BIND'){need(c.kind==='cell','BIND exige posición');const j=axis(s,x);need(!n||(n.kind==='context'&&n.axis===j),'Eje constituido incompatible');if(!n)put(c.slots,c.i,context(j))}
  else if(['SET','ADD','SUB'].includes(op)){need(c.kind==='cell','Tratamiento exige posición');put(c.slots,c.i,transform(n,op,x))}
  else throw Error('Tratamiento B desconocido')
 }
 function apply(base,e){let s=cp(base);if(Array.isArray(e)&&e[0]==='BATCH'){ar(e,2);need(Array.isArray(e[1])&&e[1].length>0&&e[1].length<=256,'Lote inválido');e[1].forEach(q=>one(s,q))}else one(s,e);s.count++;return s}
 return {zero,axis,resolve,read,apply}
})();