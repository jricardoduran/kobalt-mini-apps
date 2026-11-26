const SparseTests=(()=>{
const {need,eq,cp}=U;
function run(){let pass=[],ck=(x,m)=>{need(x,m);pass.push('PASS '+m)},fails=fn=>{try{fn();return false}catch{return true}};
const pair=Compare.pair(),logs=[Compare.fixture,pair.lb],engs=[Sparse.A,Sparse.B],old=[A,B];let comparisons=0;
for(let k=0;k<2;k++){let e=engs[k],s=e.zero(),o=old[k].zero(),l=logs[k];
 for(let i=0;i<=l.length;i++){const routes=Compare.enumerate(old[k],o);for(const [r,x] of routes){need(eq(e.read(s,r).data,x),'Divergencia '+k+' '+i+' '+JSON.stringify(r));comparisons++}if(i<l.length){e.apply(s,l[i]);o=old[k].apply(o,l[i])}}
 ck(true,'Materialización dispersa '+['A','B'][k]+' equivale al original en todos los cortes');
 let before=JSON.stringify([...s]);ck(fails(()=>e.plan(s,['SUB',[0,1,0],1]))&&before===JSON.stringify([...s]),'Rechazo sin efecto '+['A','B'][k]);
 ck(fails(()=>e.plan(s,['SET',[0,3,0],17]))&&before===JSON.stringify([...s]),'Geometría no sobrescrita '+['A','B'][k]);
 let p=e.plan(s,['SET',[0,3,0,0,0],9]);ck(p.writes===1&&before===JSON.stringify([...s]),'Plan puro y una sola clave de efecto en tabla anidada '+['A','B'][k]);e.commit(s,p);ck(eq(e.read(s,[0,3,0,0,0]).data,['value',9]),'Manifestación anidada actualizada '+['A','B'][k]);
 let d=e.plan(s,['SET',[0,2,0,1],'otra.jpg']);ck(d.writes===1,'Una clave de efecto en vector anidado '+['A','B'][k]);
}
const sb=Sparse.B.zero();let ob=B.zero();for(const q of Compare.independent){Sparse.B.apply(sb,q);ob=B.apply(ob,q);for(const [r,x] of Compare.enumerate(B,ob))need(eq(Sparse.B.read(sb,r).data,x),'Eje compartido')}ck(true,'B conserva ejes compartidos entre contextos independientes');
let oldB=JSON.stringify([...sb]);ck(fails(()=>Sparse.B.plan(sb,['BATCH',[['SET',[0,0,0],20],['SUB',[0,1,1],99]]]))&&oldB===JSON.stringify([...sb]),'Lote disperso B no muta ante rechazo tardío');
const sa=Sparse.A.zero();for(const q of [['TABLE',[],'T'],['ID',[0],'I'],['COL',[0],'C'],['OPEN',[0,0,0],'vector']])Sparse.A.apply(sa,q);let r=[0,0,0];for(let j=0;j<25;j++){Sparse.A.apply(sa,['ITEM',r,'x']);r=[...r,0];Sparse.A.apply(sa,j===24?['SET',r,123]:['OPEN',r,'vector'])}
ck(r.length===28&&eq(Sparse.A.read(sa,r).data,['value',123])&&Sparse.A.plan(sa,['SET',r,456]).writes===1,'Ruta de 28 coordenadas, un efecto disperso');
function workload(n,m){
 let s=Sparse.A.zero(),e=Sparse.A;for(const q of [['TABLE',[],'Producto'],['COL',[0],'Precio'],['COL',[0],'Stock'],['COL',[0],'Variantes'],['COL',[0],'Fotos']])e.apply(s,q);
 for(let i=0;i<n;i++){e.apply(s,['ID',[0],'SKU-'+i]);e.apply(s,['SET',[0,0,i],1000]);e.apply(s,['SET',[0,1,i],10])}
 for(const q of [['OPEN',[0,2,0],'table'],['COL',[0,2,0],'Stock'],['OPEN',[0,3,0],'vector']])e.apply(s,q);
 for(let i=0;i<m;i++){e.apply(s,['ID',[0,2,0],'V-'+i]);e.apply(s,['SET',[0,2,0,0,i],8]);e.apply(s,['ITEM',[0,3,0],'F-'+i]);e.apply(s,['SET',[0,3,0,i],'f'+i])}
 const a=e.plan(s,['SUB',[0,1,n-1],1]),b=e.plan(s,['SUB',[0,2,0,0,m-1],1]),c=e.plan(s,['SET',[0,3,0,m-1],'reemplazo']),birth=e.plan(s,['ID',[0],'SKU-NUEVO']);
 return {products:n,variants:m,keys:s.size,flatReads:a.reads,flatWrites:a.writes,nestedReads:b.reads,nestedWrites:b.writes,vectorReads:c.reads,vectorWrites:c.writes,newIdWrites:birth.writes,queryNested:e.cell(s,[0,2,0,0,m-1]).reads}
}
let workloads=[[10,10],[1000,100],[10000,1000]].map(x=>workload(...x));
ck(workloads.every(x=>x.flatReads===workloads[0].flatReads&&x.nestedReads===workloads[0].nestedReads&&x.vectorReads===workloads[0].vectorReads&&x.flatWrites===1&&x.nestedWrites===1&&x.vectorWrites===1),'Dependencias de ruta constantes con aumento de cardinalidad');
ck(workloads.every(x=>x.newIdWrites===3),'Nueva identidad escribe tres claves sin rellenar columnas');
return {pass,comparisons,workloads}}
return {run}
})();