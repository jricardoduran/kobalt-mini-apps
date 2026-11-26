'use strict';
require('../local/kernel.js');require('../local/atm.js');
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const qs=JSON.parse(fs.readFileSync(__dirname+'/uso-atm.json','utf8')),Q=Qipu,K=Kobalt,A=ATM;
(async()=>{let s=Q.Canonical.zero(),frames=[],steps=[];
async function append(raw){const [r]=await K.Trajectory.scan(raw);Q.Canonical.apply(s,Q.Canonical.plan(s,r));frames.push(raw)}
function check(x,m){assert(x,m);console.log('PASS '+m)}
await append(await A.genesis());check(A.meta(s.state).tipos.length===0,'raíz vacía antes de declarar');
for(const [i,q] of qs.entries()){let ok=true;try{await append(await A.prepare(s.state,q,['Uso',i]))}catch(e){ok=false}
steps.push({ok,meta:A.meta(s.state),state:Object.fromEntries(s.state),cut:s.count});}
const st=i=>new Map(Object.entries(steps[i].state));
check(steps[0].meta.tipos[0].pos===null&&steps[0].meta.tipos[0].parametros.every(p=>p.pos===null),'declaración no constituye posiciones');
check(A.read(st(1),[0,0]).length===1,'SET constitutivo crea producto parcial');
check(A.read(st(4),[0,0,3])===false&&A.json(st(4),0,0).parameters.Habilitado===false,'false no es ausencia');
check(A.read(st(7),[0,1,3])===null,'vector existente con celda ausente');
check(A.read(st(8),[0,0,2])===8&&A.read(st(8),[0,1,2])===4,'ACT admite dos productos');
check(!steps[9].ok&&steps[9].cut===steps[8].cut&&Q.Contracts.eq(steps[9].state,steps[8].state),'ACT inválida revierte todos los efectos');
check(steps[10].ok&&A.read(st(10),[0,0,2])===7,'precio suministrado 1 admitido: límite contractual actual');
check(steps[11].meta.tipos[0].parametros.find(x=>x.nombre==='Peso').pos===null&&A.read(st(12),[0,0,4])===250,'API mutable: declarar y constituir Peso');
check(!steps[13].ok&&!steps[14].ok&&steps[14].cut===steps[12].cut,'rechazo de dominio y parámetro no declarado');
const native=JSON.parse(execFileSync('php',[__dirname+'/uso-atm.php'],{encoding:'utf8'}));
check(native.steps.length===steps.length&&steps.every((x,i)=>Q.Contracts.eq(x,native.steps[i])),'equivalencia estado y metaestructura JS/PHP por corte');
check(Buffer.from(Q.K4B.cat(...frames)).equals(Buffer.from(native.bytes,'base64')),'trayectoria JS/PHP idéntica byte a byte');
const replay=await Q.Canonical.replay(Q.K4B.cat(...frames));
check(Q.Contracts.eq(Q.MCVT.snapshot(s.state),Q.MCVT.snapshot(replay.state)),'reconstrucción de toda la experiencia');
console.log('TOTAL USO ATM 13/13');
})().catch(e=>{console.error(e);process.exitCode=1});
