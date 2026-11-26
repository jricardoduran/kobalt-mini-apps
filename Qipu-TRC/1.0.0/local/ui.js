/* Shared UI for local JS and server PHP; all operations go through an adapter. */
'use strict';
(async()=>{
 const $=s=>document.getElementById(s),show=(id,v)=>$(id).textContent=typeof v==='string'?v:JSON.stringify(v,null,2),E=TRCExamples;
 const mode=document.body.dataset.mode;let backend,locked=false,currentCut=0;
 const controls=['seed','ask','boundary','history','export','write','origin','route','cut','suggest','action','token'];
 function freeze(v){locked=v;for(const x of controls)if($(x))$(x).disabled=v}
 async function task(fn){if(locked)return;freeze(true);try{await fn()}catch(e){show('status','Rechazo/error: '+e.message)}finally{freeze(false)}}
 function route(){return JSON.parse($('route').value)}
 function historical(){const x=$('cut').value;return x===''?{}:{cut:Number(x)}}
 function unique(){return 'ui-'+crypto.randomUUID()}
 async function send(q){const r=await backend.run(q);currentCut=r.cut;show('head',r.cut);return r.result}
 async function query(op,extra={}){
  const q={op,route:route(),...historical(),...extra},v=await send(q);show('answer',v);
  $('children').replaceChildren();
  if(v.data?.[0]==='context')for(const [i,name] of v.data[1]){const b=document.createElement('button');b.textContent=i+' · '+name;b.className='alt';b.onclick=()=>task(async()=>{$('route').value=JSON.stringify([...route(),i]);await query('read')});$('children').append(b)}
  show('status','Consulta realizada; no anexa acontecimientos.');return v
 }
 for(const [name,r] of E.routes){const o=document.createElement('option');o.textContent=name;o.value=JSON.stringify(r);$('suggest').append(o)}
 for(let i=0;i<E.actions.length;i++){const o=document.createElement('option');o.value=i;o.textContent=E.actions[i][0];$('action').append(o)}
 $('suggest').onchange=()=>task(async()=>{$('route').value=$('suggest').value;await query('read')});
 $('action').onchange=()=>{const [,treatment,route,content]=E.actions[Number($('action').value)];$('command').value=JSON.stringify({op:'write',origin:unique(),treatment,route,content},null,2)};
 $('ask').onclick=()=>task(()=>query('read'));$('boundary').onclick=()=>task(()=>query('read',{enterFinal:false}));
 $('history').onclick=()=>task(()=>{const from=$('from').value,to=$('to').value;return query('history',{...(from!==''?{from:Number(from)}:{}),...(to!==''?{to:Number(to)}:{})})});
 $('export').onclick=()=>task(async()=>{const r=await query('export');const bytes=Uint8Array.from(r.hex.match(/../g)||[],x=>parseInt(x,16));const u=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));const a=document.createElement('a');a.href=u;a.download='qipu-trc.k5b';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)});
 $('origin').onclick=()=>{try{const q=JSON.parse($('command').value);q.origin=unique();$('command').value=JSON.stringify(q,null,2)}catch(e){show('status',e.message)}};
 $('write').onclick=()=>task(async()=>{const q=JSON.parse($('command').value);if(!['write','transaction'].includes(q.op))throw Error('Utilizar write o transaction');const v=await send(q);show('answer',v);show('status',v.replayed?'Recibo anterior, sin anexar.':'Reconocido.');$('cut').value='';if(q.route)$('route').value=JSON.stringify(q.route)});
 $('seed').onclick=()=>task(async()=>{
  const h=await send({op:'history',route:[]});
  if(h.cut>E.events.length||!h.records.every((r,i)=>r.event[0]==='TX'&&r.event[2][0]===E.events[i].origin))throw Error('La base no es un prefijo del ejemplo; utilice una localidad nueva para el laboratorio.');
  for(const e of E.events){await send(e);show('status','Constituyendo '+e.origin+' / '+E.events.length)}
  $('cut').value='';$('route').value='[]';await query('read');show('status','Ejemplo constituido. Las escrituras reconocidas no se repiten.')
 });
 try{
  if(mode==='local')backend=await TRCLocal.open('qipu-trc-1.0.0-lab');
  else backend={run:async q=>{const token=$('token').value;const r=await fetch('api.php',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Qipu-Token':token}:{})},body:JSON.stringify(q),cache:'no-store'});const j=await r.json();if(!j.ok)throw Error(j.error);return j}};
  $('command').value=JSON.stringify({op:'write',origin:unique(),treatment:'TABLE',route:[],content:'Producto'},null,2);
  await task(()=>query('read'));document.body.dataset.ready='yes';
 }catch(e){show('status','No se pudo iniciar: '+e.message)}
})();