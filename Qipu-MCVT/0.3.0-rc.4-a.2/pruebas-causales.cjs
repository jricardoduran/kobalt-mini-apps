'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('../0.3.0-rc.3/local/kernel.js');
const src=['comun.js','sparse.js','trayectorias.js'].map(n=>fs.readFileSync(path.join(__dirname,n),'utf8')).join('\n');
const {RC4,U}=new Function(src+'\nreturn {RC4,U}')(),{World,encode,hex}=RC4,Q=Qipu;
const cat=Q.K4B.cat,eq=Q.K4B.equal,S=(r,x)=>['SET',r,x],G=(a,b)=>[...a,...b];
async function pack(es){return cat(...await Promise.all(es.map(e=>encode('A',e))))}
const seed=(t,i,cols)=>[['TABLE',[],t],['ID',[0],i],...cols.map(c=>['COL',[0],c])];
const rootStatus=[0,1,0],stock=[0,0,0],sale=[1,0,0],other=[1,0,1],status=[0,0,0],delivery=[0,1,0],ds=[0,0,0];
const dep=(source,action)=>['DEPEND',[],[source,action]],mount=async(r,es)=>['MOUNT',r,['A',hex(await pack(es))]],append=async(r,es)=>['APPEND',r,hex(await pack(es))];
async function run(){
 let n=0;const ck=(x,m)=>{assert(x,m);n++;console.log('PASS '+m)},val=async(w,r)=>(await w.read(r)).data[1];
 const w=new World('A');
 for(const e of [...seed('Producto','SKU-A',['Stock','Reserva']),S(stock,10),S(rootStatus,'pendiente'),['TABLE',[],'Venta'],['ID',[1],'V1'],['ID',[1],'V2'],['COL',[1],'Historia']])await w.submit(e);
 const shipSeed=[...seed('Entrega','E1',['Estado']),S(ds,'esperando'),dep(S(status,'confirmada'),S(ds,'preparar'))];
 const saleSeed=[...seed('Venta','V1',['Estado','Entrega']),S(status,'solicitada'),await mount(delivery,shipSeed),dep(S(rootStatus,'reservada-V1'),S(status,'confirmada'))];
 await w.submit(await mount(sale,saleSeed));await w.submit(await mount(other,[...seed('Venta','V2',['Estado']),S(status,'solicitada'),dep(S(rootStatus,'reservada-V2'),S(status,'confirmada'))]));
 ck((await w.resolve()).resolved.length===0,'montar dependencias no fabrica acontecimientos');
 const src=['TX',[],['reserva-V1',[[stock,['value',10]]],[['SUB',stock,2],S(rootStatus,'reservada-V1')]]];
 const paused=await w.record(src,{maxEffects:0}),prefix=await w.export();
 ck(paused.resolution.kind==='pending'&&await val(w,stock)===8&&await val(w,G(sale,status))==='solicitada','primero se reconoce causa, sin efecto simultáneo');
 const past=await w.at(paused.admitted.cut);ck(await val(past,G(sale,status))==='solicitada','corte causal intermedio reproducible');
 const recovered=await World.replay('A',prefix);
 const one=await recovered.resolve({maxEffects:1}),afterOne=await recovered.export();ck(one.kind==='pending'&&one.resolved.length===1&&await val(recovered,G(sale,status))==='confirmada'&&await val(recovered,G(G(sale,delivery),ds))==='esperando','primera consecuencia no requiere simultaneidad de nieta');
 const re=await World.replay('A',afterOne),last=await re.resolve();ck(last.kind==='settled'&&last.resolved.length===1&&await val(re,G(G(sale,delivery),ds))==='preparar','resolver recursivo tras reapertura');
 ck(paused.admitted.cut<one.resolved[0].cut&&one.resolved[0].cut<last.resolved[0].cut&&last.resolved[0].causeCut===one.resolved[0].cut,'orden causal estricto de tres cortes');
 ck(eq((await re.export()).slice(0,prefix.length),prefix)&&await val(re,G(other,status))==='solicitada','prefijo conservado y trayectoria hermana no afectada');
 const final=await re.export(),again=await re.resolve();ck(again.resolved.length===0&&eq(await re.export(),final),'resolver repetido no anexa duplicados');
 const retry=await re.record(src);ck(retry.admitted.replayed&&retry.resolution.resolved.length===0&&await val(re,stock)===8,'reintento de causa reconocida no repite stock ni consecuencias');
 const h=await re.history(sale),dh=await re.history(G(sale,delivery));const a=h.records.find(x=>x.event[0]==='CAUSE'),b=dh.records.find(x=>x.event[0]==='CAUSE');
 ck(a.rootCut===one.resolved[0].cut&&b.rootCut===last.resolved[0].cut&&a.effective[0][2]==='confirmada','historia conserva referencia causal y efecto derivado');
 const dupe=await append(sale,[a.event]);await assert.rejects(re.submit(dupe));ck(eq(await re.export(),final),'CAUSE duplicada rechazada aun por append explícito');
 await assert.rejects(re.submit(await append(other,[['CAUSE',[],[0,paused.admitted.cut-1]]])));ck(eq(await re.export(),final),'causa de hermana incompatible rechazada');
 const direct=await re.register('SET',G(G(sale,delivery),ds),'despachado');ck(direct.resolution.kind==='settled'&&await val(re,G(G(sale,delivery),ds))==='despachado','registro global atraviesa dos fronteras automáticamente');
 const late=await re.register('DEPEND',other,[S(rootStatus,'reservada-V1'),S(status,'tardia')]);ck(late.resolution.resolved.length===0&&await val(re,G(other,status))==='solicitada','dependencia nueva no reacciona retroactivamente');
 // Cause may be valid even when its consequence cannot yet be applied.
 await re.register('DEPEND',other,[S(rootStatus,'bloqueo'),['SUB',status,1]]);
 const failed=await re.record(S(rootStatus,'bloqueo'));ck(failed.resolution.kind==='blocked'&&await val(re,rootStatus)==='bloqueo'&&await val(re,G(other,status))==='solicitada','consecuencia bloqueada no revierte causa reconocida');
 const blockedBytes=await re.export();const blocked=await re.resolve();ck(blocked.kind==='blocked'&&eq(await re.export(),blockedBytes),'bloqueo observable, no bucle ni escritura parcial');
 const rebuilt=await World.replay('A',blockedBytes);ck((await rebuilt.resolve()).kind==='blocked'&&eq(await rebuilt.export(),blockedBytes),'pendiente bloqueado reconstruible desde binarios');
 // Distinct source records with same content are distinct causes; observe event identity, not latest value.
 const q=new World('A');for(const e of [...seed('Padre','P',['Fuente','Hija']),S([0,0,0],0)])await q.submit(e);
 const p=[0,1,0],src2=['ADD',[0,0,0],1];await q.submit(await mount(p,[...seed('Hija','H',['Cuenta']),S(status,0),dep(src2,['ADD',status,1])]));
 await q.record(src2,{maxEffects:0});await q.record(src2,{maxEffects:0});const rr=await q.resolve();ck(rr.resolved.length===2&&await val(q,G(p,status))===2&&rr.resolved[0].parentPosition<rr.resolved[1].parentPosition,'dos acontecimientos iguales tienen dos identidades causales distintas');
 // Wrong future source can't be made valid by same outer admission.
 await assert.rejects(q.submit(await append(p,[['CAUSE',[],[0,999]]])));ck(await val(q,G(p,status))===2,'referencia futura rechazada');
 const old=await q.export();await assert.rejects(q.record(['TX',[],['fallo',[],[['SUB',[0,0,0],99]]]]));ck(eq(await q.export(),old)&&(await q.resolve()).resolved.length===0,'causa rechazada no dispara consecuencia');
 console.log('TOTAL CAUSAL '+n);console.log('CAUSAL_EXAMPLE '+JSON.stringify({cause:paused.admitted.cut,child:one.resolved[0].cut,grandchild:last.resolved[0].cut,stock:await val(re,stock)}));
}
run().catch(e=>{console.error(e);process.exitCode=1});