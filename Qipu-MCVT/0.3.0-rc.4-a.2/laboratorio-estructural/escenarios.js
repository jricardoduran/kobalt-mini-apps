/* Qipu A.2: structural scenarios. No causal resolver is required in these cases. */
const Structural=(()=>{
 const {World,encode,hex}=RC4,Q=globalThis.Qipu;
 const S=(r,x)=>['SET',r,x], G=(...rs)=>rs.flat(), equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b), bytesEqual=Q.K4B.equal;
 async function pack(es){return Q.K4B.cat(...await Promise.all(es.map(e=>encode('A',e))))}
 const seed=(t,i,cols)=>[['TABLE',[],t],['ID',[0],i],...cols.map(c=>['COL',[0],c])];
 const mount=async(r,es)=>['MOUNT',r,['A',hex(await pack(es))]];
 const ext=async(r,es)=>['APPEND',r,hex(await pack(es))];
 const value=async(w,r)=>(await w.read(r)).data;
 async function create(es){let w=new World('A');for(const e of es)await w.submit(e);return w}
 const c=[0,0,0],p=[0,1,0],n=[0,2,0],z=[0,0,0];
 const definitions=[
 {id:'crm',title:'CRM · Cliente, conversación y seguimiento',description:'Cada cliente tiene su propia conversación. El seguimiento es una trayectoria dentro de esa conversación. Los datos de contacto son manifestaciones terminales.',async build(){
  const w=await create([...seed('Cliente','Ana',['Conversacion','Telefono']),['ID',[0],'Luis'],S(p,'3000000000')]);
  const follow=[...seed('Seguimiento','Actual',['Estado']),S(z,'pendiente')];
  const conversation=[...seed('Interaccion','M1',['Mensaje','Seguimiento']),S(z,'Consulta precio'),await mount(p,follow)];
  await w.submit(await mount(c,conversation));await w.submit(await mount([0,0,1],[...seed('Interaccion','M1',['Mensaje']),S(z,'Consulta horario')]));
  return {w,paths:[['Conversación Ana',c],['Seguimiento Ana',G(c,p)],['Mensaje actual',G(c,z)],['Estado seguimiento',G(c,p,z)],['Conversación Luis',[0,0,1]],['Teléfono',p]],steps:[
   ['Responder a Ana','SET',G(c,z),'Precio 35000'],['Registrar seguimiento','SET',G(c,p,z),'contactada'],['Añadir interacción','ID',G(c,[0]),'M2'],['Registrar segunda interacción','SET',G(c,[0,0,1]),'Acepta cotización']
  ],expected:[ [G(c,z),['value','Precio 35000']], [G(c,p,z),['value','contactada']], [G(c,[0,0,1]),['value','Acepta cotización']], [[0,0,1,0,0,0],['value','Consulta horario']], [p,['value','3000000000']]],histories:[c,G(c,p),[0,0,1]]}
 }},
 {id:'venta',title:'Comercio · Venta y entrega',description:'La venta y la entrega son historias locales. El stock pertenece a la raíz. El ejemplo registra estados explícitos, no inventa una reserva por cambiar el estado.',async build(){
  const w=await create([...seed('Producto','SKU-A',['Stock']),S(z,10),['TABLE',[],'Venta'],['ID',[1],'V1'],['COL',[1],'Historia']]);
  const sale=[1,0,0],delivery=G(sale,p);
  await w.submit(await mount(sale,[...seed('Venta','Actual',['Estado','Entrega']),S(z,'solicitada'),await mount(p,[...seed('Envio','Actual',['Estado','Guia']),S(z,'esperando')])]));
  return {w,paths:[['Stock',z],['Venta',sale],['Estado venta',G(sale,z)],['Entrega',delivery],['Estado entrega',G(delivery,z)],['Guía',G(delivery,p)]],steps:[
   ['Registrar pago informado','SET',G(sale,z),'pagada'],['Registrar guía','SET',G(delivery,p),'GUIA-001'],['Registrar despacho','SET',G(delivery,z),'despachado'],['Registrar entrega','SET',G(delivery,z),'entregado']
  ],expected:[[z,['value',10]],[G(sale,z),['value','pagada']],[G(delivery,z),['value','entregado']],[G(delivery,p),['value','GUIA-001']]],histories:[sale,delivery]}
 }},
 {id:'proyecto',title:'Proyecto · Colaboradores y tareas',description:'Una tabla interior comparte identidades. Una tarea es una trayectoria dentro de la historia del proyecto. Añadir colaboradores no exige crear otra trayectoria.',async build(){
  const w=await create(seed('Proyecto','P1',['Historia']));
  const task=[...seed('Tarea','T1',['Estado','Responsable']),S(z,'pendiente'),S(p,'Ana')];
  const project=[...seed('Proyecto','Actual',['Estado','Colaboradores','Tarea']),S(z,'activo'),['OPEN',p,'table'],['ID',p,'Ana'],['COL',p,'Rol'],S(G(p,[0,0]),'investigacion'),await mount(n,task)];
  await w.submit(await mount(c,project));
  return {w,paths:[['Proyecto',c],['Colaboradores',G(c,p)],['Rol Ana',G(c,p,[0,0])],['Tarea',G(c,n)],['Estado tarea',G(c,n,z)],['Estado proyecto',G(c,z)]],steps:[
   ['Añadir colaborador','ID',G(c,p),'Luis'],['Asignar rol','SET',G(c,p,[0,1]),'desarrollo'],['Reasignar tarea','SET',G(c,n,p),'Luis'],['Completar tarea','SET',G(c,n,z),'terminada'],['Registrar revisión','SET',G(c,z),'revision']
  ],expected:[[G(c,p,[0,0]),['value','investigacion']],[G(c,p,[0,1]),['value','desarrollo']],[G(c,n,z),['value','terminada']],[G(c,n,p),['value','Luis']],[G(c,z),['value','revision']]],histories:[c,G(c,n)]}
 }},
 {id:'vector',title:'Vector · Materiales, revisiones e historia',description:'Un vector interior puede contener una trayectoria en una posición y un contenido terminal en otra. La naturaleza se descubre por el tratamiento, no por apariencia.',async build(){
  const w=await create([...seed('Documento','D1',['Materiales','Contenido']),['OPEN',c,'vector'],['ITEM',c,'Versiones'],['ITEM',c,'Adjunto'],S(G(c,[1]),['lista','terminal']),S(p,0)]);
  const v=G(c,[0]);await w.write('MOUNT',v,['A',hex(await pack([...seed('Revision','Actual',['Numero','Nota']),S(z,1),S(p,'borrador')]))]);
  return {w,paths:[['Vector materiales',c],['Trayectoria versiones',v],['Número revisión',G(v,z)],['Nota',G(v,p)],['Lista terminal',G(c,[1])],['Cero terminal',p]],steps:[
   ['Incrementar revisión','ADD',G(v,z),1],['Registrar nota','SET',G(v,p),'revisado'],['Actualizar adjunto','SET',G(c,[1]),['archivo','final']],['Añadir material','ITEM',c,'Portada'],['Registrar portada','SET',G(c,[2]),'portada.png']
  ],expected:[[G(v,z),['value',2]],[G(v,p),['value','revisado']],[G(c,[1]),['value',['archivo','final']]],[G(c,[2]),['value','portada.png']],[p,['value',0]]],histories:[v]}
 }}
 ];
 async function step(w,s){return w.write(s[1],s[2],s[3])}
 async function compare(){
  // Same final manifestations, distinct admitted histories. Explicit structural flow vs automatic causal flow.
  const root=()=>create([...seed('Padre','P',['Estado','Hija']),S(z,'pendiente')]);
  const child=[...seed('Hija','H',['Estado']),S(z,'esperando')],childPath=p;
  const s=await root(),a=await root();
  await s.submit(await mount(childPath,child));
  await a.submit(await mount(childPath,[...child,['DEPEND',[],[S(z,'reconocido'),S(z,'continuar')]]]));
  const sc=await s.cut(),ac=await a.cut();
  await s.write('SET',z,'reconocido');const middle=await value(s,G(childPath,z));await s.write('SET',G(childPath,z),'continuar');
  const r=await a.record(S(z,'reconocido'));
  return {structural:{rootRecords:(await s.cut())-sc,childRecords:(await s.history(childPath)).records.map(x=>x.event),middle,final:await value(s,G(childPath,z))},causal:{rootRecords:(await a.cut())-ac,childRecords:(await a.history(childPath)).records.map(x=>x.event),resolved:r.resolution.resolved,final:await value(a,G(childPath,z))}}
 }
 async function run(){
  const out=[],ck=(x,m)=>{if(!x)throw Error(m);out.push('PASS '+m)},reject=async f=>{try{await f();return false}catch{return true}};
  let traversals=0,scenarios=[];
  for(const d of definitions){
   const {w,steps,expected,histories}=await d.build(),initial=await w.export(),cut0=await w.cut(),history0=await Promise.all(histories.map(r=>w.history(r)));
   for(const s of steps){let old=await w.export(),count=await w.cut();await step(w,s);ck((await w.cut())===count+1&&bytesEqual((await w.export()).slice(0,old.length),old),d.id+' · '+s[0]+' anexa un único registro exterior')}
   const final=await w.export(),end=await w.cut(),h=await Promise.all(histories.map(r=>w.history(r)));
   ck((await Promise.all(expected.map(async ([r,x])=>equal(await value(w,r),x)))).every(Boolean),d.id+' · manifestaciones esperadas');
   ck(h.every((x,i)=>history0[i].records.every((y,j)=>equal(y,x.records[j]))),d.id+' · historias locales conservan prefijos');
   ck(h.every(x=>x.records.every(y=>!['DEPEND','CAUSE'].includes(y.event[0]))),d.id+' · ninguna regla causal necesaria');
   let rep=await World.replay('A',final);ck(bytesEqual(await rep.export(),final)&&(await Promise.all(expected.map(async ([r,x])=>equal(await value(rep,r),x)))).every(Boolean),d.id+' · replay exacto');
   for(let k=cut0;k<=end;k++){let a=await w.at(k),b=await World.replay('A',await w.export(0,k));for(const r of histories){ck(equal(await a.history(r),await b.history(r)),d.id+' · corte '+k+' historia '+JSON.stringify(r));traversals++}}
   const bad=await reject(()=>w.write('SET',[99999],1));ck(bad&&bytesEqual(final,await w.export()),d.id+' · ruta inválida no modifica prefijo');
   ck(bytesEqual(final.slice(0,initial.length),initial),d.id+' · prefijo inicial intacto');
   scenarios.push({id:d.id,steps:steps.length,initialCut:cut0,finalCut:end,histories:histories.length})
  }
  const {w}=await definitions[3].build(),before=await w.export();ck(await reject(()=>w.write('SET',G(c,[1,0]),'no'))&&bytesEqual(before,await w.export()),'lista terminal no se recorre como geometría');
  // Structural writing at several levels; deepest target receives SET and each ancestor receives one APPEND.
  const deep=await create(seed('T','I',['H']));let dest=c;const branches=[];
  for(let i=0;i<6;i++){await deep.write('MOUNT',dest,['A',hex(await pack([...seed('Nivel','I',['H','Valor']),S(p,0)]))]);branches.push(dest.slice());dest=G(dest,c)}
  const target=G(branches.at(-1),p),old=await deep.export(),counts=await Promise.all(branches.map(r=>deep.history(r)));
  await deep.write('ADD',target,7);
  ck(equal(await value(deep,target),['value',7])&&(await deep.read(target)).boundaries.length===6,'seis fronteras estructurales en una intención');
  for(let i=0;i<branches.length;i++){const h=await deep.history(branches[i]);ck(h.cut===counts[i].cut+1&&h.records.at(-1).event[0]===(i===5?'ADD':'APPEND'),'nivel '+(i+1)+' recibe un solo marco pertinente')}
  ck(bytesEqual((await deep.export()).slice(0,old.length),old),'profundidad conserva bytes exteriores');
  // Direct writes do not magically establish business invariants: explicitly test stock coordination via TX.
  const v=await definitions[1].build(),sale=[1,0,0],rootBefore=await v.w.export();
  const ev=[['SUB',z,2],await ext(sale,[S(z,'confirmada')])],checks=[[z,['value',10]],[G(sale,z),['value','solicitada']]];
  const tx=await v.w.transaction('confirmar-V1',checks,ev),txBytes=await v.w.export();
  ck(!tx.replayed&&equal(await value(v.w,z),['value',8])&&equal(await value(v.w,G(sale,z)),['value','confirmada']),'TX estructural coordina dos efectos cuando el contrato lo exige');
  ck((await v.w.transaction('confirmar-V1',checks,ev)).replayed&&bytesEqual(txBytes,await v.w.export()),'TX reintento exacto no duplica efectos');
  ck(await reject(async()=>v.w.transaction('fallo',[],[await ext(sale,[S(z,'pagada')]),['SUB',z,99]]))&&bytesEqual(txBytes,await v.w.export()),'TX rechazo tardío no altera hija ni raíz');
  ck(bytesEqual(txBytes.slice(0,rootBefore.length),rootBefore),'TX conserva prefijo');
  const comp=await compare();ck(equal(comp.structural.final,comp.causal.final)&&comp.structural.rootRecords===2&&comp.causal.rootRecords===2&&equal(comp.structural.middle,['value','esperando'])&&comp.causal.resolved.length===1,'comparación mismo estado final, diferente responsabilidad y registro causal');
  return {checks:out.length,out,scenarios,traversals,comparison:comp}
 }
 return {definitions,step,run,compare}
})();