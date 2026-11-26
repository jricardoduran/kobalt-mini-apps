'use strict';
require('../local/kernel.js');require('../local/atm.js');const R=require('../local/residue.js'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qipu-qr-c-'));
function rpc(x){return new Promise((resolve,reject)=>{const p=spawn('php',[path.join(__dirname,'cooperation-rpc.php'),root]);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',c=>{try{if(c)throw Error(err);resolve(JSON.parse(out))}catch(e){reject(e)}});p.stdin.end(JSON.stringify(x));})}
async function call(...x){const r=await rpc(x);assert(r.ok,JSON.stringify(r));return r.data}
function check(x,m){assert(x,m);console.log('PASS '+m)}
const decl=['DEF',['Producto'],[['Producto','Nombre','text',['SET'],true],['Producto','Stock','natural',['SET','ADD','SUB'],false]],[]];
(async()=>{
const [a,b,c]=['NodoA','NodoB','NodoC'].map(x=>new R.Node(x,'Comercio-C'));
for(const n of [a,b,c])await call('register',n.id);
for(const n of [a,b,c])await n.fact(decl);
for(const [n,ids] of [[a,['SKU-A','SKU-B']],[b,['SKU-B','SKU-A']],[c,['SKU-C','SKU-A']]])for(const id of ids){await n.fact(['SET','Producto',id,'Nombre',id]);await n.fact(['SET','Producto',id,'Stock',10]);}
check(Qipu.MCVT.get((await a.local()).privateState,'entity',0,0)==='SKU-A'&&Qipu.MCVT.get((await b.local()).privateState,'entity',0,1)==='SKU-A','coordenadas locales distintas');
async function submit(n,q){const r=await n.request(q);await call('submit',n.id,r.index,R.hex(r.raw));return r}
async function admit(n,q){const r=await submit(n,q);await call('decide',n.id,r.index,1);return r}
await admit(a,decl); // DEF translates without reading private state.
await admit(a,['SET',0,0,0,'SKU-A']);await admit(a,['SET',0,0,1,10]);
for(const n of [a,b,c])await n.replica.sync(await call('sync',n.id,await n.replica.cursors()));
const [ra,rb,rc]=await Promise.all([submit(a,['SUB',0,0,1,7]),submit(b,['SUB',0,1,1,6]),submit(c,['SUB',0,1,1,2])]);
check((await b.local()).q.at(-1).x.identity==='SKU-A','traducción local preserva identidad');
await call('decide',a.id,ra.index,1);
const reject=await rpc(['decide',b.id,rb.index,1]);check(!reject.ok,'autoridad rechaza plan con stock insuficiente');await call('decide',b.id,rb.index,0);
const interrupted=await rpc(['decide',c.id,rc.index,1,true]);check(!interrupted.ok,'interrupción inyectada entre C y R');
await call('pending'); // Original recovery reconstructs R from the origin in C.
await call('submit',c.id,rc.index,R.hex(rc.raw));await call('decide',c.id,rc.index,1);
for(const n of [a,b,c]){const p=await call('sync',n.id,await n.replica.cursors()),d=await n.replica.sync(p);check(d.bytesC<d.totalC,'solo sufijo canónico para '+n.id);check(d.metadata.length===0,'ventas no alteran API '+n.id);check(ATM.read(n.replica.state.state,['Producto','SKU-A','Stock'])===1,'estado canónico de '+n.id);}
check((await b.overlay()).status.at(-1)==='rechazada','R conserva rechazo de B');
check((await c.overlay()).status.at(-1)==='incorporada','C/R recuperan reconocimiento de C');
check(a.replica.bytes.length===b.replica.bytes.length&&Qipu.K4B.equal(a.replica.bytes,c.replica.bytes),'tres replicas C byte a byte');
const corrupt=await call('sync',a.id,await a.replica.cursors());corrupt.C.from.sha256='0'.repeat(64);await assert.rejects(a.replica.sync(corrupt));check(ATM.read(a.replica.state.state,[0,0,1])===1,'prefijo incompatible no cambia estado');
const p=await call('sync',a.id,await a.replica.cursors());const d=await a.replica.sync(p);check(d.bytesC===0&&d.bytesR===0,'sin novedad: cero bytes de historia');
console.log('TOTAL cooperación OK; directorio '+root);
})().catch(e=>{console.error(e);process.exitCode=1});
