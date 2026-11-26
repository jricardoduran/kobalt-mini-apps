'use strict';
async function run(Q,A,K,fixture){
const checks=[];function check(x,m){if(!x)throw Error('FAIL '+m);checks.push('PASS '+m)}
const s=Q.Canonical.zero(),frames=[];let idx=0;
async function append(raw){const [r]=await K.Trajectory.scan(raw);const p=Q.Canonical.plan(s,r);Q.Canonical.apply(s,p);frames.push(raw)}
async function send(q){await append(await A.prepare(s.state,q,['Prueba',idx++]))}
await append(await A.genesis());
await send(['DEF',['Producto'],[['Producto','Nombre','text',['SET'],true],['Producto','Precio','natural',['SET'],false],['Producto','Stock','natural',['SET','ADD','SUB'],false]],[]]);
await send(['SET','Producto','SKU-A','Nombre','Camisa']);await send(['SET',0,0,'Precio',35000]);await send(['SET',0,0,'Stock',20]);
check(A.read(s.state,[0,0,1])===35000,'consulta posicional');
check(A.json(s.state,0,0).parameters.Stock===20,'JSON nominal derivado');
let rejected=false;try{A.translate(s.state,['SET',0,0,'Peso',250])}catch{rejected=true}check(rejected,'campo no declarado rechazado');
await send(['DEF',[],[['Producto','Peso','natural',['SET'],false]],[]]);check(A.meta(s.state).tipos[0].parametros.find(x=>x.nombre==='Peso').pos===null,'declaración sin nacimiento vectorial');
await send(['SET',0,0,'Peso',250]);check(A.read(s.state,[0,0,3])===250&&A.read(s.state,[0,0,1])===35000,'extensión conservativa');
let x=await A.prepare(s.state,['SET',0,0,1,36000],['Prueba',99]),y=await A.prepare(s.state,['SET','Producto','SKU-A','Precio',36000],['Prueba',99]);check(Q.K4B.equal(x,y),'nominal y posicional producen bytes idénticos');
const before=s.count;rejected=false;try{await send(['SUB',0,0,2,21])}catch{rejected=true}check(rejected&&s.count===before&&A.read(s.state,[0,0,2])===20,'contrato inválido no modifica estado');
const replay=await Q.Canonical.replay(Q.K4B.cat(...frames));check(Q.Contracts.eq(Q.MCVT.snapshot(replay.state),Q.MCVT.snapshot(s.state)),'replay exacto ATM/T120');
const orig=await Q.Canonical.replay(fixture);check(orig.count===22,'fixture original K5B/T120: 22 registros');
return checks;
}
if(typeof module!=='undefined'){module.exports=run;if(require.main===module){require('../local/kernel.js');const A=require('../local/atm.js');run(Qipu,A,Kobalt,new Uint8Array(require('node:fs').readFileSync(__dirname+'/fixtures/ejemplo.qipu'))).then(x=>console.log(x.join('\n')+'\nTOTAL '+x.length+'/'+x.length)).catch(e=>{console.error(e);process.exitCode=1})}}
