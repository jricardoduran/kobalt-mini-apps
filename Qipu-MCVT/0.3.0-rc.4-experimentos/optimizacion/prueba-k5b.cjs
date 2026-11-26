'use strict';
/* Real K2P/K5B from RC.3; isolated experimental types, not assigned protocol numbers. */
require('../../0.3.0-rc.3/local/kernel.js');
const assert=require('node:assert/strict'),Q=Qipu,K=Kobalt;
const T={delta:65530,column:65531,table:65532},W=Q.K2P.Writer,R=Q.K2P.Reader;
function deltaBody(path,x){let w=new W().n(path.length);for(const p of path)w.n(p);return w.n(x,6).bytes()}
function readDelta(b){let r=new R(b),n=r.n(),p=[];for(let j=0;j<n;j++)p.push(r.n());let x=r.n(6);r.finish();return [p,x]}
function columnBody(xs){let w=new W().n(xs.length,6);for(const x of xs)w.n(x,6);return w.bytes()}
function readColumn(b){let r=new R(b),n=r.n(6),a=[];for(let j=0;j<n;j++)a.push(r.n(6));r.finish();return a}
async function run(){let out=[],ck=(x,m)=>{assert(x,m);out.push('PASS '+m);console.log('PASS '+m)},results=[];
for(const n of [10,100,1000,10000]){
 const a=Array(n).fill(10),b=Array(n).fill(35000),path=[0,3,0,0,n-1],oldA=await Q.K5B.seal(T.column,columnBody(a)),oldB=await Q.K5B.seal(T.column,columnBody(b));
 const oldTable=await Q.K5B.seal(T.table,Q.K4B.cat(oldA,oldB));
 const delta=await Q.K5B.seal(T.delta,deltaBody(path,9));const d=await Q.K5B.read(delta);assert.deepEqual(readDelta(d.body),[path,9]);a[n-1]=9;
 const newA=await Q.K5B.seal(T.column,columnBody(a)),newTable=await Q.K5B.seal(T.table,Q.K4B.cat(newA,oldB)),outer=await Q.K5B.read(newTable);
 const parts=await K.Trajectory.scan(outer.body);assert.equal(parts.length,2);assert.deepEqual(readColumn(parts[0].body),a);assert.deepEqual(readColumn(parts[1].body),b);
 assert(Q.K4B.equal(parts[1].raw,oldB));assert(!Q.K4B.equal(oldTable,newTable));
 results.push({identities:n,deltaBody:d.body.length,deltaK5B:delta.length,columnSnapshotK5B:newA.length,nestedTableSnapshotK5B:newTable.length,untouchedColumnK5B:oldB.length});
 if(n===1000){let corrupt=newTable.slice();corrupt[corrupt.length-33]^=1;await assert.rejects(Q.K5B.read(corrupt));await assert.rejects(Q.K5B.read(newTable.slice(0,-1)));ck(true,'Hash externo detecta corrupción y truncamiento');}
}
ck(true,'K2P ruta variable y valor: roundtrip en K5B real');
ck(true,'K5B interior: tabla con dos marcos de columna, parseo explícito');
ck(true,'Modificar un valor cambia snapshot exterior; bytes de columna intacta se conservan');
console.log('K5B_RESULTS '+JSON.stringify(results));return {out,results}}
run().catch(e=>{console.error(e);process.exitCode=1});
