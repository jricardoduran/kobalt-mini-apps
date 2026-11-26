'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('../0.3.0-rc.3/local/kernel.js');
const src=['comun.js','sparse.js','trayectorias.js'].map(n=>fs.readFileSync(path.join(__dirname,n),'utf8')).join('\n');
const {RC4,U,Sparse}=new Function(src+'\nreturn {RC4,U,Sparse}')(),{World,encode,hex}=RC4,Q=Qipu;
const cat=Q.K4B.cat;
async function pack(p,es){return cat(...await Promise.all(es.map(e=>encode(p,e))))}
async function run(){
 let checks=0;const ck=(x,m)=>{assert(x,m);checks++;console.log('PASS '+m)},data=async(w,r,o)=> (await w.read(r,o)).data;
 const rootA=[['TABLE',[],'Producto'],['ID',[0],'SKU-A'],['COL',[0],'Variantes'],['COL',[0],'Datos']];
 const rootB=[['AXIS',[],'productos'],['GROW',[1],'SKU-A'],['AXIS',[],'cols'],['INTRO',[],['Producto',2]],['INTRO',[0],['Variantes',1]],['INTRO',[0],['Datos',1]]];
 const childA=[['TABLE',[],'Variante'],['ID',[0],'Rojo'],['COL',[0],'Stock'],['SET',[0,0,0],10]];
 const childB=[['AXIS',[],'rows'],['GROW',[1],'Rojo'],['INTRO',[],['Stock',1]],['SET',[0,0],10]];
 for(const [p,root] of [['A',rootA],['B',rootB]])for(const [q,child] of [['A',childA],['B',childB]]){
  const w=await World.replay(p,await pack(p,root)),prefix=await w.export(),seed=await pack(q,child);
  await w.submit(['MOUNT',[0,0,0],[q,hex(seed)]]);const mount=await w.read([0,0,0],{enterFinal:false});const id=mount.data[2],inner=q==='A'?[0,0,0]:[0,0],global=[0,0,0,...inner];
  ck(mount.data[0]==='trajectory'&&mount.data[1]===q&&U.eq(await data(w,global),['value',10]),p+'→'+q+' binario interior reconstruye su propia geometría');
  ck(Q.K4B.equal(await w.export(id),seed),'bytes iniciales interiores exactos '+p+q);
  const old=await w.export();await w.write('SUB',global,3);const now=await w.export();ck(U.eq(await data(w,global),['value',7])&&Q.K4B.equal(now.slice(0,old.length),old),'transformación interior conserva prefijo exterior '+p+q);
  const oldInner=await w.export(id);await assert.rejects(w.write('SUB',global,99));ck(Q.K4B.equal(await w.export(),now)&&Q.K4B.equal(await w.export(id),oldInner),'rechazo no anexa en ninguna trayectoria '+p+q);
  const copy=await World.replay(p,now);ck(U.eq(await data(copy,global),['value',7])&&Q.K4B.equal(await copy.export(id),oldInner),'replay de trayectorias interiores '+p+q);
  await w.submit(['SET',[0,1,0],['MOUNT',[q,hex(seed)]]]);await assert.rejects(w.read([0,1,0,0]));ck((await data(w,[0,1,0]))[0]==='value','contenido lista no se interpreta como trayectoria '+p+q);
  let bad=await encode(q,['SET',inner,22]);bad[bad.length-1]^=1;let before=await w.export();await assert.rejects(w.submit(['APPEND',[0,0,0],hex(cat(await encode(q,['SET',inner,12]),bad))]));ck(Q.K4B.equal(await w.export(),before)&&U.eq(await data(w,global),['value',7]),'sufijo interior corrupto revierte lote completo '+p+q);
  await assert.rejects(w.submit(['APPEND',[0,0,0],hex(await encode(p===q?(q==='A'?'B':'A'):p,['SET',inner,12]))]));ck(U.eq(await data(w,global),['value',7]),'perfil interior no se confunde '+p+q);
  ck(Q.K4B.equal((await w.export()).slice(0,prefix.length),prefix),'prefijo original intacto '+p+q)
 }
 const bw=await World.replay('B',await pack('B',rootB));await bw.submit(['BATCH',[['SET',[0,0,0],10],['ADD',[0,0,0],2]]]);ck(U.eq(await data(bw,[0,0,0]),['value',12]),'BATCH ordinario conserva semántica B');let bbefore=await bw.export();await assert.rejects(bw.submit(['BATCH',[['SET',[0,0,0],20],['MOUNT_LOCAL',[0,1,0],[999,'A']]]]));ck(Q.K4B.equal(await bw.export(),bbefore),'BATCH no puede forjar frontera ni efectos parciales');await Promise.all([bw.submit(['SET',[0,0,0],3]),bw.submit(['ADD',[0,0,0],4])]);ck(U.eq(await data(bw,[0,0,0]),['value',7]),'cola conserva orden de submit concurrentes');
 const a=await World.replay('A',await pack('A',rootA));
 await a.submit(['MOUNT',[0,0,0],['A','']]);await a.write('TABLE',[0,0,0],'Interior');await a.write('ID',[0,0,0,0],'I');await a.write('COL',[0,0,0,0],'C');
 await a.write('MOUNT',[0,0,0,0,0,0],['B',hex(await pack('B',childB))]);
 const dest=[0,0,0,0,0,0,0,0];await a.write('ADD',dest,2);
 ck(U.eq(await data(a,dest),['value',12])&&(await a.read(dest)).boundaries.length===2,'dos fronteras anidadas y cambio de perfil');
 const empty=await a.read([0,0,0],{enterFinal:false});ck((await a.cut(empty.data[2]))===5,'corte interior independiente de coordenada exterior');
 // The same read cursor uses an asynchronous source and a single continuation.
 const s=Sparse.A.zero();for(const e of [['TABLE',[],'T'],['ID',[0],'I'],['COL',[0],'C'],['OPEN',[0,0,0],'vector']])Sparse.A.apply(s,e);
 let r=[0,0,0];for(let i=0;i<100;i++){Sparse.A.apply(s,['ITEM',r,'i']);r.push(0);Sparse.A.apply(s,i===99?['SET',r,42]:['OPEN',r,'vector'])}
 let calls=0,seen=new Set();const get=async k=>{calls++;assert(!seen.has(k));seen.add(k);await Promise.resolve();return s.get(JSON.parse(k)[2])};
 const d=await RC4.cursor(get,RC4.question(r));ck(r.length===103&&d.reads===207&&calls===207&&U.eq(d.result.data,['value',42]),'103 coordenadas y 207 claves, sin límite de 32 ni reinicio');
 const abort=new AbortController();abort.abort();await assert.rejects(RC4.cursor(get,RC4.question(r),{signal:abort.signal}));ck(true,'cancelación explícita sin fallback');
 const x=await World.replay('A',await a.export());ck(U.eq(await data(x,dest),['value',12]),'replay recursivo conserva última manifestación');
 console.log('TOTAL RC4 '+checks);
}
run().catch(e=>{console.error(e);process.exitCode=1});