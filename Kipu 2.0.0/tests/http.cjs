const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
global.window=global;for(const f of ['k2p','k4b','k5b','contratos','model'])vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../public/js',f+'.js'),'utf8'),{filename:f+'.js'});
const M=Model,url=process.env.QIPU_URL||'http://127.0.0.1:18931/api.php';let passes=0;
async function api(op,params={},body,expected=200){let r=await fetch(url+'?'+new URLSearchParams({op,...params}),body===undefined?{}:{method:'POST',body});assert.equal(r.status,expected,await r.clone().text());return r;}
const j=async(...x)=>(await api(...x)).json();const check=(v,n)=>{assert.ok(v,n);console.log('PASS',n);passes++};
const stateStock=s=>s.state[0].vectors[2].values[0];
async function read(s,offset=0){let r=await api('read',{stream:s,offset,length:M.CAP}),b=new Uint8Array(await r.arrayBuffer());assert.equal(Number(r.headers.get('X-Confirmed-End')),offset+b.length);return b;}
async function submit(node,index,offset,raw,expected=200){return j('submit',{node,index,offset},raw,expected);}
(async()=>{
 let genesis=await read('C'),c0=await M.extend(M.zero(),genesis);check(stateStock(c0)===20,'Génesis PHP leído y K2P/K5B decodificado en JS');
 let note=await M.frame(M.NOTE,{text:'Revisión local'}),a=await M.frame(M.REQUEST,{op:'sale',sku:'SKU-A',qty:12}),b=await M.frame(M.REQUEST,{op:'sale',sku:'SKU-A',qty:8}),b2=await M.frame(M.REQUEST,{op:'product',sku:'SKU-B',name:'Zapato',price:80000,stock:15});
 let la=await M.local(M.cat(note,a)),lb=await M.local(M.cat(b,b2));check(la.history.length===2&&la.q.length===1&&la.q[0].x.qty===12,'Nota no pertenece a Q y posición L distinta de Q');check(stateStock(M.overlay(c0,la,M.empty(),'A'))===8&&stateStock(M.overlay(c0,lb,M.empty(),'B'))===12,'Derivados provisionales independientes');check((await j('head',{stream:'QA'})).end===0,'Constitución local no escribe en PHP');
 await submit('A',0,0,a);await submit('B',0,0,b);await submit('B',1,b.length,b2);check((await submit('A',0,0,a)).replayed,'Reintento de solicitud idéntica no duplica');await submit('A',0,0,b,409);await submit('A',2,a.length,a,409);check((await j('head',{stream:'QA'})).end===a.length,'Conflicto y hueco no modifican Q');
 await j('decide',{node:'B',index:1,bit:1},'',409);check((await j('pending')).nodes.B.nextIndex===0,'Resolución sin saltos');
 await j('decide',{node:'A',index:0,bit:1},'');let ra=await read('RA');check(ra.length===1&&ra[0]===128&&stateStock(M.overlay(c0,la,ra,'A'))===8,'Respuesta antes de C conserva provisional');let delta=await read('C',genesis.length),c1=await M.extend(c0,delta);check(stateStock(c1)===8&&stateStock(M.overlay(c1,la,M.empty(),'A'))===8,'C antes de R elimina doble descuento');
 await j('decide',{node:'B',index:0,bit:0},'');let rb=await read('RB');check(rb[0]===0&&stateStock(M.overlay(c0,lb,rb,'B'))===20,'Rechazo retira efecto provisional sin borrar historia');
 await j('decide',{node:'B',index:1,bit:1},'');let delta2=await read('C',genesis.length+delta.length),c2=await M.extend(c1,delta2),full=await read('C'),replay=await M.extend(M.zero(),full);check(JSON.stringify(c2.state)===JSON.stringify(replay.state),'Replay incremental = completo');check(c2.state[0].entities.join(',')==='SKU-A,SKU-B'&&Object.values(c2.state[0].vectors[2].values).join(',')==='8,15','Constitución de entidad y vectores por posiciones');check(M.equal(genesis,full.slice(0,genesis.length)),'Prefijo canónico inmutable');let cut=await j('cut',{stream:'C',offset:genesis.length});check(cut.sha256===M.hex(await M.hash(genesis)),'Constatación de corte sin descargar prefijo');rb=await read('RB');check(rb[1]===129,'M3E1: respuesta 1 en posición 1');check(JSON.stringify(M.overlay(c2,la,ra,'A').state)===JSON.stringify(M.overlay(c2,lb,rb,'B').state),'Convergencia de A y B a igual corte');check((await j('decide',{node:'A',index:0,bit:1},'')).status==='replayed','Decisión idempotente');await j('decide',{node:'A',index:0,bit:0},'',409);check(M.equal(full,await read('C')),'Decisión histórica no cambia C');
 // Invalid frame and overselling do not alter canonical stream.
 let corrupt=a.slice();corrupt[corrupt.length-1]^=1;await submit('A',1,a.length,corrupt,422);let too=await M.frame(M.REQUEST,{op:'sale',sku:'SKU-A',qty:999});await submit('A',1,a.length,too);await j('decide',{node:'A',index:1,bit:1},'',409);check(M.equal(full,await read('C'))&&(await read('RA')).length===1,'Solicitud inviable: no hay efecto ni respuesta prematura');await j('decide',{node:'A',index:1,bit:0},'');
 // CPA: no existence-dependent generation of CREATE contracts.
 const first=await M.scan(genesis);let inners=[];for(let f of first[0].x.frames){let bytes=Uint8Array.from(atob(f),c=>c.charCodeAt(0));inners.push((await Qipu.K5B.read(bytes)).t);}check(inners.join(',')==='13,13,13','Génesis sin CREATE: tres afirmaciones nombradas T13');
 const newFacts=[
 {op:'fact',scope:'table',table:'Cliente'},
 {op:'fact',scope:'table',table:'Cliente'},
 {op:'fact',scope:'vector',table:'Cliente',parameter:'Activo',kind:3},
 {op:'fact',scope:'entity',table:'Cliente',identity:'C-0'},
 {op:'fact',scope:'cell',table:'Cliente',identity:'C-1',parameter:'Activo',kind:3,value:true},
 {op:'fact',scope:'cell',table:'Cliente',identity:'C-1',parameter:'Nombre',kind:0,value:'Lucía'},
 {op:'fact',scope:'cell',table:'Producto',identity:'SKU-B',parameter:'Color',kind:0,value:'Azul'},
 {op:'fact',scope:'cell',table:'Producto',identity:'SKU-B',parameter:'Color',kind:0,value:'Verde'},
 {op:'fact',scope:'cell',table:'Producto',identity:'SKU-B',parameter:'Color',kind:0,value:'Verde'},
 {op:'fact',scope:'cell',table:'Cliente',identity:'C-0',parameter:'Edad',kind:1,value:35},
 {op:'fact',scope:'cell',table:'Cliente',identity:'C-0',parameter:'Activo',kind:3,value:false}
 ];
 let bi=2,bo=b.length+b2.length,prev=await read('C');let state=await M.extend(M.zero(),prev),before=JSON.stringify(state.state),localA=state,raws=[];
 for(const fact of newFacts){let raw=await M.frame(M.REQUEST,M.request(fact));raws.push(raw);await submit('B',bi,bo,raw);let expect=await Qipu.Contratos.encode(13,...M.factArgs(fact));await j('decide',{node:'B',index:bi,bit:1},'');let ext=await read('C',prev.length),rr=await M.scan(ext);assert.equal(rr.length,1);let got=Uint8Array.from(atob(rr[0].x.frames[0]),c=>c.charCodeAt(0));assert.ok(M.equal(expect,got),'PHP/JS T13 bytes identical');localA=await M.extend(localA,ext);prev=M.cat(prev,ext);bo+=raw.length;bi++;}
 check(true,'11 afirmaciones T13 interoperables byte a byte PHP/JS, ámbitos y cuatro clases de valor (stock en génesis)');
 let dt=localA.state,cl=dt[1];check(dt.length===2&&cl.name==='Cliente'&&cl.entities.join(',')==='C-0,C-1','Primera aparición constituye tipo y entidades; repetición no duplica');
 check(cl.vectors.map(v=>v.name).join(',')==='Activo,Nombre,Edad'&&cl.vectors[0].values[0]===false&&cl.vectors[0].values[1]===true,'Orden de parámetros, valor booleano false y posiciones compartidas');
 check(!Object.hasOwn(cl.vectors[1].values,0)&&cl.vectors[1].values[1]==='Lucía','Celdas dispersas; ausencia no se confunde con valor');
 check(dt[0].entities.join(',')==='SKU-A,SKU-B'&&dt[0].vectors[3].values[1]==='Verde'&&!Object.hasOwn(dt[0].vectors[3].values,0),'Parámetro nuevo sin rellenar entidades; repetición actualiza mismo slot');
 check(localA.count===state.count+newFacts.length&&JSON.stringify(state.state)===before,'Afirmación repetida conserva acontecimiento y origen, sin mutar corte anterior');
 check(JSON.stringify((await M.extend(M.zero(),prev)).state)===JSON.stringify(dt),'Replay completo e incremental idénticos tras CPA');
 check(JSON.stringify((await j('pending')).canonical)===JSON.stringify(dt),'Derivados PHP y JS idénticos, incluyendo celdas dispersas');
 let badFact={op:'fact',scope:'cell',table:'Cliente',identity:'C-NUEVO',parameter:'Activo',kind:0,value:'sí'},raw=await M.frame(M.REQUEST,badFact);await submit('B',bi,bo,raw);await j('decide',{node:'B',index:bi,bit:1},'',409);check(M.equal(prev,await read('C'))&&(await read('RB')).length===bi,'Tipo incompatible no constituye entidad parcial, C ni R');await j('decide',{node:'B',index:bi,bit:0},'');bi++;bo+=raw.length;
 let missing=await M.frame(M.REQUEST,{op:'sale',sku:'NO-EXISTE',qty:1});await submit('B',bi,bo,missing);await j('decide',{node:'B',index:bi,bit:1},'',409);check(M.equal(prev,await read('C')),'Venta referencial jamás crea SKU');await j('decide',{node:'B',index:bi,bit:0},'');
 // Same names, different kinds in different tables are independent. UTF-8 exact.
 let d=[],a13=[3,'Otro','__proto__','Activo',0,'sí'];M.apply(d,13,a13);M.apply(d,13,[2,'Otro','constructor']);check(d[0].entities.length===2&&d[0].vectors[0].values[0]==='sí','Identidades especiales y espacios separados seguros en índice');
 M.apply(d,9,[0,0,0]);check(Object.hasOwn(d[0].vectors[0].values,0)&&d[0].vectors[0].values[0]===null,'Nulo explícito diferenciado de ausencia');M.apply(d,10,[0,0,0]);check(!Object.hasOwn(d[0].vectors[0].values,0),'Quitar valor no elimina identidad');
 let z=new Qipu.K2P.Writer().text('\uFEFFa').bytes();let zr=new Qipu.K2P.Reader(z);check(zr.text()==='\uFEFFa','K2P preserva BOM como carácter, no lo descarta');zr.finish();

 let privateFact=await M.frame(M.LOCAL_FACT,{op:'fact',scope:'cell',table:'Notas',identity:'N-0',parameter:'Texto',kind:0,value:'Solo A'});let l1=await M.extendLocal(la,privateFact);check(l1.q.length===la.q.length&&l1.privateState[0].name==='Notas'&&l1.privateState[0].vectors[0].values[0]==='Solo A','CPA estrictamente local: estructuras privadas sin solicitud');check(JSON.stringify(l1.privateState)===JSON.stringify((await M.local(M.cat(note,a,privateFact))).privateState),'Recorrido local incremental equivalente a completo');await submit('A',2,a.length+too.length,privateFact,422);check((await j('head',{stream:'QA'})).end===a.length+too.length,'T102 local no puede publicarse por API Q');
 console.log(`${passes}/${passes} comprobaciones HTTP + JS correctas`);
})().catch(e=>{console.error(e);process.exitCode=1});
