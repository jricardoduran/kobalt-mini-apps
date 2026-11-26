'use strict';
async function run(Q,A,R,K){
const report=[],check=(x,m)=>{if(!x)throw Error(m);report.push('PASS '+m)};
const s=Q.Canonical.zero();let n=0;async function append(raw){const [r]=await K.Trajectory.scan(raw);const p=Q.Canonical.plan(s,r),d=R.metaDelta(s.state,p.delta);Q.Canonical.apply(s,p);return {d,writes:p.delta.length,raw}}
async function add(q){return append(await A.prepare(s.state,q,['Carga',n++]))}
await append(await A.genesis());await add(['DEF',['Producto'],[['Producto','Nombre','text',['SET'],true],['Producto','Precio','natural',['SET'],false],['Producto','Stock','natural',['SET','ADD','SUB'],false]],[]]);
for(let i=0;i<1000;i++){await add(['SET','Producto','SKU-'+i,'Nombre','P'+i]);await add(['SET',0,i,'Precio',100]);await add(['SET',0,i,'Stock',10]);}
const reads=await Q.Mechanisms.acquireSparse(v=>A.read(v,[0,500,2]),k=>Promise.resolve(s.state.get(k)));
check(reads.data===10,'adquisición parcial equivale a consulta completa');
const raw=await A.prepare(s.state,['SUB',0,500,2,1],['Carga',n++]),[r]=await K.Trajectory.scan(raw);
const partial=await Q.Mechanisms.acquireSparse(state=>Q.Canonical.plan({state,origins:s.origins,count:s.count},r),k=>Promise.resolve(s.state.get(k)));
const full=Q.Canonical.plan(s,r);check(Q.Contracts.eq(partial.data.delta,full.delta),'plan disperso exacto');
const m=R.metaDelta(s.state,full.delta);check(m.length===0&&full.delta.length===1,'cambio stock: 0 cambios de API, 1 efecto');
Q.Canonical.apply(s,full);
const decl=await add(['DEF',[],[['Producto','Peso','natural',['SET'],false]],[]]);check(decl.d.length===1&&decl.d[0][1].fields.length===1,'metacontrato incremental: 1 declaración');
const birth=await add(['SET',0,500,'Peso',250]);check(birth.d.some(x=>x[0][0]==='vector')&&A.read(s.state,[0,500,3])===250,'nacimiento vectorial conserva coordenadas');
check(A.read(s.state,[0,500,2])===9,'coordenada anterior estable');
report.push(JSON.stringify({stateKeys:s.state.size,readKeys:reads.reads,planKeys:partial.reads,stockWrites:full.delta.length,metadataStock:m.length,metadataBirth:birth.d.length}));
return report;
}
if(typeof module!=='undefined'){module.exports=run;if(require.main===module){require('../local/kernel.js');require('../local/atm.js');const R=require('../local/residue.js');run(Qipu,ATM,R,Kobalt).then(x=>console.log(x.join('\n'))).catch(e=>{console.error(e);process.exitCode=1})}}
