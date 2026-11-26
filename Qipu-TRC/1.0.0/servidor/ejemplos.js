/* Application examples only. No storage or interpretation logic. */
'use strict';
globalThis.TRCExamples=(()=>{
 const events=[],add=(treatment,route,content)=>events.push({op:'write',origin:'demo-'+String(events.length+1).padStart(3,'0'),treatment,route,content}),S=(r,x)=>add('SET',r,x),G=(...p)=>p.flat(),M=r=>add('MOUNT',r,['A','']);
 function table(root,t,i,cols){add('TABLE',root,t);const tab=G(root,[0]);add('ID',tab,i);cols.forEach(c=>add('COL',tab,c));return tab}
 function root(t,name,ids,cols){add('TABLE',[],name);ids.forEach(i=>add('ID',[t],i));cols.forEach(c=>add('COL',[t],c))}
 root(0,'Producto',['SKU-A','SKU-B'],['Stock','Precio','Fotos']);S([0,0,0],10);S([0,0,1],5);S([0,1,0],35000);S([0,1,1],65000);
 add('OPEN',[0,2,0],'vector');add('ITEM',[0,2,0],'principal');S([0,2,0,0],'foto-a.jpg');
 root(1,'Cliente',['Ana','Luis'],['Conversacion','Telefono']);S([1,1,0],'3000000000');S([1,1,1],'3100000000');
 const ana=[1,0,0],luis=[1,0,1];M(ana);table(ana,'Interaccion','M1',['Mensaje','Seguimiento']);S(G(ana,[0,0,0]),'Consulta precio');
 const follow=G(ana,[0,1,0]);M(follow);table(follow,'Seguimiento','Actual',['Estado']);S(G(follow,[0,0,0]),'pendiente');
 M(luis);table(luis,'Interaccion','M1',['Mensaje']);S(G(luis,[0,0,0]),'Consulta horario');
 root(2,'Venta',['V1'],['Historia']);const sale=[2,0,0];M(sale);table(sale,'Venta','Actual',['Estado','Entrega','Importe']);S(G(sale,[0,0,0]),'solicitada');S(G(sale,[0,2,0]),35000);
 const delivery=G(sale,[0,1,0]);M(delivery);table(delivery,'Entrega','Actual',['Estado','Guia']);S(G(delivery,[0,0,0]),'esperando');
 root(3,'Proyecto',['P1'],['Historia']);const proj=[3,0,0];M(proj);table(proj,'Proyecto','Actual',['Estado','Colaboradores','Tarea']);S(G(proj,[0,0,0]),'activo');
 const coll=G(proj,[0,1,0]);add('OPEN',coll,'table');add('ID',coll,'Ana');add('ID',coll,'Luis');add('COL',coll,'Rol');S(G(coll,[0,0]),'investigacion');S(G(coll,[0,1]),'desarrollo');
 const task=G(proj,[0,2,0]);M(task);table(task,'Tarea','T1',['Estado','Responsable']);S(G(task,[0,0,0]),'pendiente');S(G(task,[0,1,0]),'Ana');
 root(4,'Documento',['D1'],['Materiales']);const vec=[4,0,0];add('OPEN',vec,'vector');add('ITEM',vec,'Versiones');add('ITEM',vec,'Adjunto');S(G(vec,[1]),['archivo','borrador']);
 const rev=G(vec,[0]);M(rev);table(rev,'Revision','Actual',['Numero','Nota']);S(G(rev,[0,0,0]),1);S(G(rev,[0,1,0]),'borrador');
 const routes=[['Raíz',[]],['Productos', [0]],['Stock',[0,0]],['Stock SKU-A',[0,0,0]],['Fotos',[0,2,0]],['Conversación Ana',ana],['Mensaje Ana',G(ana,[0,0,0])],['Seguimiento Ana',follow],['Estado seguimiento',G(follow,[0,0,0])],['Conversación Luis',luis],['Venta V1',sale],['Estado venta',G(sale,[0,0,0])],['Entrega',delivery],['Estado entrega',G(delivery,[0,0,0])],['Proyecto',proj],['Colaboradores',coll],['Rol Luis',G(coll,[0,1])],['Tarea',task],['Estado tarea',G(task,[0,0,0])],['Materiales',vec],['Revisiones',rev],['Número revisión',G(rev,[0,0,0])],['Adjunto terminal',G(vec,[1])]];
 const actions=[['Responder a Ana','SET',G(ana,[0,0,0]),'Precio 35000'],['Registrar seguimiento','SET',G(follow,[0,0,0]),'contactada'],['Registrar pago informado','SET',G(sale,[0,0,0]),'pagada'],['Registrar guía','SET',G(delivery,[0,1,0]),'GUIA-001'],['Despachar','SET',G(delivery,[0,0,0]),'despachado'],['Reasignar tarea','SET',G(task,[0,1,0]),'Luis'],['Completar tarea','SET',G(task,[0,0,0]),'terminada'],['Incrementar revisión','ADD',G(rev,[0,0,0]),1]];
 return {events,routes,actions}
})();