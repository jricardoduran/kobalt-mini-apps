/* Qipu A — tabla, columna/vector, celda recursiva. */
const A=(()=>{
 const {need,cp,ar,route,nat,add,find,put,transform,summary,list}=U;
 const table=()=>({kind:'table',ids:[],names:[],cols:[]}), vector=()=>({kind:'vector',ids:[],slots:[]});
 const zero=()=>({count:0,root:{kind:'root',names:[],tables:[]}});
 const unwrap=c=>c.kind==='cell'?c.node:c;
 function resolve(s,r){route(r);let c=s.root;
  for(const p of r){c=unwrap(c);need(c,'Ruta sin manifestación');switch(c.kind){
   case 'root':need(p<c.tables.length,'Tabla inexistente');c=c.tables[p];break;
   case 'table':need(p<c.cols.length,'Columna inexistente');c={kind:'column',ids:c.ids,slots:c.cols[p]};break;
   case 'column':case 'vector':need(p<c.ids.length,'Posición inexistente');c={kind:'cell',slots:c.slots,i:p,node:find(c.slots,p)};break;
   default:throw Error('Contenido terminal');
  }}return c}
 function read(s,r=[]){let c=resolve(s,r),n=unwrap(c),z=summary(n);if(z)return z;
  if(n.kind==='root'||n.kind==='table')return list(n.names);if(n.kind==='column'||n.kind==='vector')return list(n.ids);throw Error('Contexto inválido')}
 function apply(base,e){let [op,r,x]=ar(e,3),s=cp(base),c=resolve(s,r),n=unwrap(c);
  if(op==='TABLE'){need(n?.kind==='root','TABLE exige colección de tablas');let i=add(n.names,x);if(!n.tables[i])n.tables.push(table())}
  else if(op==='COL'){need(n?.kind==='table','COL exige tabla');let i=add(n.names,x);if(!n.cols[i])n.cols.push([])}
  else if(op==='ID'){need(n?.kind==='table','ID exige tabla');add(n.ids,x)}
  else if(op==='ITEM'){need(n?.kind==='vector','ITEM exige vector');add(n.ids,x)}
  else if(op==='OPEN'){need(c.kind==='cell'&&['table','vector'].includes(x),'OPEN exige celda y clase');need(!n||n.kind===x,'Clase constituida incompatible');if(!n)put(c.slots,c.i,x==='table'?table():vector())}
  else if(['SET','ADD','SUB'].includes(op)){need(c.kind==='cell','Tratamiento exige celda');put(c.slots,c.i,transform(n,op,x))}
  else throw Error('Tratamiento A desconocido');s.count++;return s}
 return {zero,resolve,read,apply}
})();