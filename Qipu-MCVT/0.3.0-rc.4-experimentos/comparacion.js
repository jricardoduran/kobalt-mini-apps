/* Comparison: an explicit specialization A -> B, same admitted logical cuts. */
const Compare=(()=>{
 const {need,cp,eq,replay}=U, axisName=(p,k)=>JSON.stringify(p)+':'+k, axisRef=(s,n)=>s.axes.findIndex(x=>x.name===n)>=0?B.axis(s,n):n;
 function translate(sa,sb,e){let [op,p,x]=e, r=A.resolve(sa,p),n=r.kind==='cell'?r.node:r;
  const ax=(path,k)=>axisName(path,k), make=(n)=>['AXIS',[],n];
  if(op==='TABLE'){let i=n.names.indexOf(x);if(i<0)i=n.names.length;let q=[...p,i],cols=ax(q,'cols'),rows=ax(q,'rows');return ['BATCH',[make(cols),make(rows),['INTRO',p,[x,axisRef(sb,cols)]]]]}
  if(op==='COL'){return ['INTRO',p,[x,B.axis(sb,ax(p,'rows'))]]}
  if(op==='ID')return ['GROW',[B.axis(sb,ax(p,'rows'))],x];
  if(op==='ITEM')return ['INTRO',p,[x,null]];
  if(op==='OPEN'){let nm=ax(p,x==='table'?'cols':'items'),ops=[make(nm)];if(x==='table')ops.push(make(ax(p,'rows')));ops.push(['BIND',p,axisRef(sb,nm)]);return ['BATCH',ops]}
  return cp(e)
 }
 const fixture=[
 ['TABLE',[],'Producto'],['ID',[0],'SKU-A'],['ID',[0],'SKU-B'],['COL',[0],'Precio'],['SET',[0,0,1],65000],['SET',[0,0,0],35000],
 ['COL',[0],'Stock'],['SET',[0,1,0],10],['COL',[0],'Fotos'],['OPEN',[0,2,0],'vector'],['ITEM',[0,2,0],'principal'],['SET',[0,2,0,0],'foto-a.jpg'],['ITEM',[0,2,0],'detalle'],['SET',[0,2,0,1],'foto-b.jpg'],
 ['COL',[0],'Variantes'],['OPEN',[0,3,0],'table'],['ID',[0,3,0],'Rojo-M'],['ID',[0,3,0],'Azul-L'],['COL',[0,3,0],'Stock'],['SET',[0,3,0,0,1],8],['SET',[0,3,0,0,0],2],['ADD',[0,3,0,0,0],3],
 ['COL',[0,3,0],'Medidas'],['OPEN',[0,3,0,1,0],'vector'],['ITEM',[0,3,0,1,0],'ancho'],['SET',[0,3,0,1,0,0],24],
 ['COL',[0],'Datos'],['SET',[0,4,0],[1,2,3]],['SET',[0,4,1],false],['ID',[0],'SKU-C'],['SUB',[0,1,0],10],['SET',[0,0,2],0],['SET',[0,4,2],null],['SET',[0,2,0,1],'foto-c.jpg']
 ];
 function pair(log=fixture){let a=A.zero(),b=B.zero(),lb=[],cuts=[[a,b]];for(const e of log){const f=translate(a,b,e);a=A.apply(a,e);b=B.apply(b,f);lb.push(f);cuts.push([a,b])}return {a,b,lb,cuts}}
 function enumerate(engine,s,r=[],out=[]){let x=engine.read(s,r);out.push([r,x]);if(x[0]==='context')for(const [i] of x[1])enumerate(engine,s,[...r,i],out);return out}
 const independent=[
 ['AXIS',[],'Productos'],['GROW',[1],'SKU-A'],['GROW',[1],'SKU-B'],
 ['AXIS',[],'Bodegas'],['INTRO',[],['Bodegas',2]],['INTRO',[0],['Norte',1]],['INTRO',[0],['Sur',1]],
 ['SET',[0,0,0],10],['SET',[0,1,1],7],['GROW',[1],'SKU-C'],['SET',[0,1,0],2]
 ];
 function run(){const out=[],ck=(x,m)=>{need(x,m);out.push('PASS '+m)},reject=(fn)=>{try{fn();return false}catch{return true}},p=pair();
  ck(p.cuts.every(([a,b])=>eq(enumerate(A,a),enumerate(B,b))),'equivalencia de todas las rutas en los 35 cortes de Comercio');
  ck(eq(A.read(p.a,[0,0]),['context',[[0,'SKU-A'],[1,'SKU-B'],[2,'SKU-C']]]),'eje común aun cuando SKU-B recibe precio antes que SKU-A');
  ck(eq(A.read(p.a,[0,2,0,1]),['value','foto-c.jpg']),'vector dentro de celda: modificación selectiva de una foto');
  ck(eq(A.read(p.a,[0,3,0,0,0]),['value',5]),'tabla dentro de celda: diferencial de variante');
  ck(eq(A.read(p.a,[0,3,0,1,0,0]),['value',24]),'tabla recursiva con vector interno de profundidad seis');
  ck(eq(A.read(p.a,[0,1,0]),['value',0])&&eq(A.read(p.a,[0,1,2]),['absent'])&&eq(A.read(p.a,[0,4,2]),['value',null])&&eq(A.read(p.a,[0,4,1]),['value',false]),'ausencia, cero, null y false inequívocos');
  for(const [eng,s] of [[A,p.a],[B,p.b]]){
   const before=cp(s);ck(reject(()=>eng.read(s,[0,4,0,0])),'lista de contenido no es ruta '+(eng===A?'A':'B'));
   ck(reject(()=>eng.apply(s,['SET',[0,3,0],99]))&&eq(s,before),'no sobrescribir una geometría '+(eng===A?'A':'B'));
   ck(reject(()=>eng.apply(s,['SUB',[0,1,0],1]))&&eq(s,before),'saldo negativo no muta '+(eng===A?'A':'B'));
   ck(reject(()=>eng.apply(s,['SET',[0,1,99],2]))&&eq(s,before),'posición futura no se inventa '+(eng===A?'A':'B'));
  }
  ck(reject(()=>A.apply(p.a,['OPEN',[0,2,0],'table'])),'clase recursiva incompatible rechazada');
  const repeat=A.apply(p.a,['ID',[0],'SKU-A']);ck(eq(A.read(repeat,[0,0]),A.read(p.a,[0,0])),'reafirmación de identidad conserva posiciones');
  ck(eq(replay(A,fixture),p.a)&&eq(replay(B,p.lb),p.b),'replay completo exacto');
  ck(p.cuts.every(([a,b],i)=>{for(let j=i;j<fixture.length;j++){a=A.apply(a,fixture[j]);b=B.apply(b,p.lb[j])}return eq(a,p.a)&&eq(b,p.b)}),'reconstrucción incremental desde todo corte');
  const bs=replay(B,independent);ck(eq(B.read(bs,[0,0]),B.read(bs,[0,1]))&&eq(B.read(bs,[0,0,1]),['absent'])&&eq(B.read(bs,[0,1,1]),['value',7]),'eje compartido entre contextos independientes y manifestaciones distintas');
  ck(eq(B.read(bs,[0,0,2]),['absent'])&&eq(B.read(bs,[0,1,2]),['absent']),'crecimiento de eje compartido sin rellenar celdas');
  ck(reject(()=>B.apply(bs,['BATCH',[['SET',[0,0,0],20],['SUB',[0,1,1],99]]]))&&eq(B.read(bs,[0,0,0]),['value',10]),'lote B atómico ante rechazo tardío');
  let aa=A.zero(),bb=B.zero(),deep=[['TABLE',[],'T'],['ID',[0],'I'],['COL',[0],'C'],['OPEN',[0,0,0],'vector']],r=[0,0,0];
  for(let i=0;i<25;i++){deep.push(['ITEM',r,'x']);r=[...r,0];if(i<24)deep.push(['OPEN',r,'vector']);else deep.push(['SET',r,123])}
  let dp=pair(deep);ck(r.length===28&&eq(A.read(dp.a,r),B.read(dp.b,r))&&eq(A.read(dp.a,r),['value',123]),'ruta de 28 coordenadas sin aridad fija');
  const extra=[];for(let i=0;i<100;i++)extra.push(['SET',[0,0,i%3],1000+i]);let ep=pair(fixture.concat(extra));ck(ep.cuts.every(([a,b])=>eq(enumerate(A,a),enumerate(B,b))),'100 transformaciones adicionales equivalentes en cada corte');
  let n=0;for(const [a,b] of p.cuts)n+=enumerate(A,a).length;
  return {out,events:fixture.length,cuts:p.cuts.length,routeComparisons:n,bytesA:JSON.stringify(fixture).length,bytesB:JSON.stringify(p.lb).length,updateA:JSON.stringify(fixture.at(-1)).length,updateB:JSON.stringify(p.lb.at(-1)).length}
 }
 return {fixture,independent,translate,pair,enumerate,run}
})();