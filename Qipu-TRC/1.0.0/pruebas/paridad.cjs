'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync,spawn}=require('node:child_process');
require('../local/qipu-trc.js');require('../local/ejemplos.js');
const Q=QipuTRC,E=TRCExamples;
const W=(origin,treatment,route,content,checks=[])=>({op:'write',origin,treatment,route,content,checks});
async function main(){
 const requests=[],answers=[];let raw=new Uint8Array(),n=0,expectedRejects=0;
 async function req(q,reject=false,override){const packet={q,...(override?{raw:Q.hex(override)}:{})};requests.push(packet);
  let p;try{p=await Q.plan(override||raw,q)}catch(e){if(!reject)throw Error('JS '+JSON.stringify(q)+': '+e.message);answers.push({ok:false});expectedRejects++;return}
  assert(!reject,'JS admitió solicitud inválida '+JSON.stringify(q));if(!override)raw=Q.cat(raw,p.suffix);answers.push({ok:true,result:p.result,cut:p.cut,suffix:Q.hex(p.suffix)});return p}
 for(const e of E.events)await req(e);
 for(const [,route] of E.routes){await req({op:'read',route});await req({op:'read',route,enterFinal:false})}
 const seedCut=E.events.length;
 const sale=[2,0,0],status=[...sale,0,0,0],stock=[0,0,0];
 const app=async value=>['APPEND',sale,Q.hex(await Q.encode(['SET',[0,0,0],value]))];
 const tx={op:'transaction',origin:'reserva-001',checks:[[stock,['value',10]],[status,['value','solicitada']]],events:[['SUB',stock,2],await app('confirmada')]};
 const txRes=await req(tx);assert.equal(txRes.cut,seedCut+1);assert.equal((await req({op:'read',route:stock})).result.data[1],8);
 const retry=await req(tx);assert.equal(retry.suffix.length,0);assert.equal(retry.result.replayed,true);
 await req({...tx,events:[['SUB',stock,3]]},true);
 await req({op:'transaction',origin:'fallo-tardio',events:[await app('pagada'),['SUB',stock,99]]},true);
 assert.equal((await req({op:'read',route:status})).result.data[1],'confirmada');
 for(const [i,[,treatment,route,content]] of E.actions.entries())await req(W('action-'+i,treatment,route,content));
 const again=await req(W('action-0',E.actions[0][1],E.actions[0][2],E.actions[0][3]));assert(again.result.replayed);assert(!again.suffix.length);
 await req(W('action-0','SET',E.actions[0][2],'distinto'),true);
 await req(W('bad-route','SET',[99999],1),true);await req(W('bad-sub','SUB',stock,99),true);
 await req(W('bad-open','OPEN',stock,'table'),true);await req(W('bad-mount','MOUNT',stock,['A','']),true);
 await req(W('wrong-profile','MOUNT',[1,0,0],['B','']),true);
 await req(W('bad-check','SET',stock,0,[[stock,['value',10]]]),true);
 await req(W('bad-list','SET',[4,0,0,1,0],'no'),true);
 await req(W('geometry','SET',sale,'no'),true);
 const val=[0,2,0,0];for(const [i,x] of [null,false,0,['lista',true,42],{z:'Bogotá 💡','10':false,'2':null,a:'\u2028'},9007199254740991].entries()){
  await req(W('domain-'+i,'SET',val,x));assert.deepEqual((await req({op:'read',route:val})).result.data,['value',x])
 }
 await req(W('unsafe-add','ADD',val,1),true);
 const hpaths=[[1,0,0],[1,0,0,0,1,0],[1,0,1],sale,[...sale,0,1,0],[3,0,0],[3,0,0,0,2,0],[4,0,0,0]];
 for(const route of hpaths){const h=await req({op:'history',route});await req({op:'history',route,from:0,to:Math.min(2,h.result.cut)});await req({op:'export',route});await req({op:'history',route,cut:seedCut})}
 await req({op:'history',route:stock},true);await req({op:'read',route:[],cut:0});await req({op:'read',route:stock,cut:seedCut});await req({op:'read',route:stock,cut:seedCut+1});await req({op:'export',route:[]});
 const bad=raw.slice();bad[bad.length-1]^=1;await req({op:'cut'},true,bad);await req({op:'cut'},true,raw.slice(0,-1));await req({op:'cut'},true,Q.cat(raw,txRes.suffix));
 // Reuse a single process and compare both exact suffix and complete response at every step.
 const p=spawnSync('php',[path.join(__dirname,'plan.php')],{input:requests.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',maxBuffer:32*1024*1024});
 assert.equal(p.status,0,p.stderr);const got=p.stdout.trim().split('\n').map(JSON.parse);assert.equal(got.length,answers.length,p.stderr);
 for(let i=0;i<answers.length;i++){if(!answers[i].ok)assert(!got[i].ok,'PHP admitió '+JSON.stringify(requests[i]));else{try{assert.deepEqual(got[i],answers[i])}catch(e){throw Error('Divergencia '+i+' '+JSON.stringify(requests[i])+': '+e.message)}}n++}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trc-store-'));let count=0;
 function store(q,expect=true){const r=spawnSync('php',[path.join(__dirname,'store-cli.php'),dir],{input:JSON.stringify(q),encoding:'utf8',maxBuffer:16*1024*1024});const o=JSON.parse(r.stdout);assert.equal(o.ok,expect,JSON.stringify(o));count++;return o}
 function concurrent(q){return new Promise((ok,bad)=>{let p=spawn('php',[path.join(__dirname,'store-cli.php'),dir]),s='',err='';p.stdout.on('data',x=>s+=x);p.stderr.on('data',x=>err+=x);p.on('error',bad);p.on('close',c=>{try{assert.equal(c,0,err+s);const x=JSON.parse(s);assert(x.ok);count++;ok(x)}catch(e){bad(e)}});p.stdin.end(JSON.stringify(q))})}
 try{
  for(const e of E.events.slice(0,9))store(e);
  const before=store({op:'export',route:[]}).result.hex;
  const increments=Array.from({length:8},(_,i)=>W('par-'+i,'ADD',stock,1));
  await Promise.all(increments.map(concurrent));assert.equal(store({op:'read',route:stock}).result.data[1],18);
  const end=store({op:'export',route:[]}).result.hex;assert(end.startsWith(before));assert(store(increments[0]).result.replayed);
  assert.equal(store({op:'export',route:[]}).result.hex,end);assert.equal((await Q.plan(Q.unhex(end),{op:'read',route:stock})).result.data[1],18);
  fs.writeFileSync(path.join(dir,'.tmp-abandonado'),'resto');assert.equal(store({op:'read',route:stock}).result.data[1],18);
  const files=fs.readdirSync(dir).filter(x=>x.endsWith('.k5b')).sort();const first=path.join(dir,files[0]),saved=fs.readFileSync(first),corrupt=Buffer.from(saved);corrupt[corrupt.length-1]^=1;fs.writeFileSync(first,corrupt);store({op:'cut'},false);fs.writeFileSync(first,saved);fs.renameSync(first,first+'.bak');store({op:'cut'},false);fs.renameSync(first+'.bak',first);assert.equal(store({op:'export',route:[]}).result.hex,end);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
 console.log('PASS JS_PHP_EXACT '+n+' solicitudes; '+expectedRejects+' rechazos; semilla '+seedCut+' eventos');
 console.log('PASS PHP_STORE '+count+' operaciones; 8 escritores concurrentes, reenvío, prefijo, temporal abandonado, corrupción y hueco');
 console.log('TRC_RESULT '+JSON.stringify({parity:n,rejections:expectedRejects,seed:seedCut,phpStorage:count,bytes:raw.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
