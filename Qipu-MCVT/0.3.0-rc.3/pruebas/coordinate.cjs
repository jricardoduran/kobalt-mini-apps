'use strict';
require('../local/kernel.js');require('../local/atm.js');require('../local/atm-coordinate.js');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),Q=Qipu,A=ATMC,K=Kobalt;
const p=(...x)=>['C',x],obj=(op,coordinates,value)=>({context:'C',op,coordinates,value}),named=(op,table,parameter,identity,value)=>({context:'C',op,table,parameter,identity,value});
const fields=[['Producto','Nombre','text',['SET'],true],['Producto','Precio','natural',['SET'],false],['Producto','Stock','natural',['SET','ADD','SUB'],false],['Producto','Habilitado','boolean',['SET'],false],['Cliente','Nombre','text',['SET'],true]];
const action=['Venta','Producto',[['q','natural',true],['p','natural',true]],[['Stock','SUB','q']],['q','p']];
const qs=[p('DEF',['Cliente','Producto'],fields,[action]),p('ID',['Producto','A']),named('SET','Producto','Stock','A',10),named('SET','Producto','Precio','A',35000),named('SET','Producto','Nombre','A','Camisa'),p('ID',[0,'B']),p('SET',[0,0,1],5),p('SET',[0,1,1],65000),p('SET',[0,2,1],'Bolso'),named('SET','Producto','Habilitado','A',false),p('ADD',[0,0,0],2),obj('SUB',[0,0,0],3),obj('SET',[0,1,0],42000),p('ACT',0,[[0,2,42000],[1,1,65000]]),p('ACT',0,[[0,1,42000],[1,9,65000]]),obj('SUB',[0,0,1],5),p('SET',[0,0,7],3),named('SET','Producto','Fantasma','A',1),['OTRO',['SET',[0,0,0],999]],{...obj('SET',[0,0,0],1),identity:'A'},p('SET',[0,0,0],-1),p('SET',[0,0,0],0),named('SET','Cliente','Nombre','C','Ana'),p('DEF',[],[['Producto','Peso','natural',['SET'],false]],[]),p('SET',[0,'Peso',1],250)];
(async()=>{const s=Q.Canonical.zero(),frames=[],steps=[];const ck=(x,m)=>{assert(x,m);console.log('PASS '+m)};
async function append(raw){const [r]=await K.Trajectory.scan(raw);Q.Canonical.apply(s,Q.Canonical.plan(s,r));frames.push(raw)}
await append(await ATM.genesis());ck(A.read(s.state).length===0,'geometría vacía sin duplicación');
for(const [i,q] of qs.entries()){let ok=true,intent=null;try{const z=A.compile(s.state,q,'C');intent=z.intent;await append(await ATM.prepare(s.state,z.legacy,['Test',i]))}catch(e){ok=false}
steps.push({ok,intent,geometry:A.read(s.state),contract:A.contract(s.state),state:Object.fromEntries(s.state),cut:s.count})}
const state=i=>new Map(Object.entries(steps[i].state));const yes=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,21,22,23,24];
ck(qs.every((_,i)=>steps[i].ok===yes.includes(i)),'admisión y rechazo esperados en 25 solicitudes');
ck(steps[0].geometry.length===0&&steps[0].contract[0][0]==='Cliente','contrato no equivale a geometría constituida');
ck(steps[1].geometry[0][0]==='Producto'&&steps[1].geometry[0][2].length===0,'ID independiente y orden de primera aparición');
ck(steps[2].intent[1][0]===0&&steps[2].intent[1][1]==='Stock'&&steps[2].intent[1][2]===0,'solo nombre irreducible para vector nuevo');
ck(steps[4].geometry[0][2][0][0]==='Stock'&&steps[4].geometry[0][2][2][0]==='Nombre','orden vectorial real, no de declaración');
ck(A.read(state(9),[0,3,0])===false&&A.read(state(9),[0,3,1])===null,'false y ausencia');
ck(A.read(state(13),[0,0,0])===7&&A.read(state(13),[0,0,1])===4,'SET ADD SUB ACT con eje vectorial');
ck(steps[13].cut===steps[14].cut&&Q.Contracts.eq(steps[13].state,steps[14].state),'acción multi-fila rechazada sin efectos');
ck([15,16,17,18,19,20].every(i=>steps[i].cut===steps[14].cut),'rechazos de saldo, posición, contrato, contexto, forma y dominio no anexan');
ck(A.read(state(21),[0,0,0])===0,'cero no es ausencia');
ck(A.read(s.state,[0,0]).length===2&&A.project(s.state,0,1)[2]==='B','vector y proyección transversal');
ck(A.external(s.state,0,0).parameters.Precio===42000&&A.external(s.state,0,0).parameters.Habilitado===false,'JSON derivado no pierde false');
const n=A.compile(s.state,named('SET','Producto','Precio','A',42000),'C'),p0=A.compile(s.state,obj('SET',[0,1,0],42000),'C');
ck(Q.Contracts.eq(n,p0),'traducciones nominal y posicional convergen');
ck(Buffer.from(await ATM.prepare(s.state,n.legacy,['Same',0])).equals(Buffer.from(await ATM.prepare(s.state,p0.legacy,['Same',0]))),'bytes exactos de traducciones equivalentes');
ck(A.read(s.state,[0,4,1])===250&&A.read(s.state,[0,4,0])===null,'parámetro tardío y vector disperso');
ck(steps[22].geometry[1][0]==='Cliente'&&steps[22].contract[0][0]==='Cliente','no confundir posición contractual con constituida');
const php=JSON.parse(execFileSync('php',[__dirname+'/coordinate.php'],{input:JSON.stringify(qs),encoding:'utf8'}));
ck(steps.every((x,i)=>Q.Contracts.eq(x,php.steps[i])),'JS PHP equivalentes por corte en geometría, contrato, intención y estado');
ck(Buffer.from(Q.K4B.cat(...frames)).equals(Buffer.from(php.bytes,'base64')),'trayectoria T120 idéntica JS PHP');
const replay=await Q.Canonical.replay(Q.K4B.cat(...frames));ck(Q.Contracts.eq(A.read(replay.state),A.read(s.state))&&Q.Contracts.eq(A.external(replay.state,0,0),A.external(s.state,0,0)),'reconstrucción conserva traducción y geometría');
console.log('TOTAL ATM-C 20/20');
})().catch(e=>{console.error(e);process.exitCode=1});
