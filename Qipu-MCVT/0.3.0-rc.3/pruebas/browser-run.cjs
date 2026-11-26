'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawn,spawnSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qipu-physical-')),profile=path.join(root,'chrome');fs.mkdirSync(profile);const storage=path.join(root,'pao');fs.mkdirSync(storage);
const cwd=path.join(__dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function until(fn,ms=45000){const end=Date.now()+ms;let last;while(Date.now()<end){try{const r=await fn();if(r)return r}catch(e){last=e;}await sleep(100);}throw Error('Timeout '+(last?.message||''));}
function choose(){for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser'])if(spawnSync(name,['--version'],{stdio:'ignore'}).status===0)return name;throw Error('Chrome no disponible');}
async function connect(url){const ws=new WebSocket(url),pending=new Map();let id=0;await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const [r,j]=pending.get(m.id);pending.delete(m.id);if(m.error)j(Error(JSON.stringify(m.error)));else r(m.result);}});
return {call(method,params={}){const n=++id;return new Promise((r,j)=>{pending.set(n,[r,j]);ws.send(JSON.stringify({id:n,method,params}));})},close:()=>ws.close()};}
(async()=>{let server,chrome,cdp;try{
const p=await port(),http='http://127.0.0.1:'+p;server=spawn('php',['-S','127.0.0.1:'+p,'-t',cwd],{cwd,env:{...process.env,QIPU_TEST_ROOT:storage,PHP_CLI_SERVER_WORKERS:'4'},detached:true,stdio:'ignore'});
await until(async()=>{const r=await fetch(http+'/pruebas/browser.html');return r.ok},10000);
chrome=spawn(choose(),['--headless','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const portFile=path.join(profile,'DevToolsActivePort'),dp=await until(()=>fs.existsSync(portFile)&&fs.readFileSync(portFile,'utf8').split('\n')[0],15000);
const page=await until(async()=>{const xs=await (await fetch('http://127.0.0.1:'+dp+'/json/list')).json();return xs.find(x=>x.type==='page')});cdp=await connect(page.webSocketDebuggerUrl);
for(const [file,done] of [['browser.html','FIN'],['cooperation-browser.html','TOTAL COOPERACION BROWSER OK']]){
await cdp.call('Page.navigate',{url:http+'/pruebas/'+file});
const result=await until(async()=>{const x=await cdp.call('Runtime.evaluate',{expression:'({href:location.href,out:document.getElementById("out")?.textContent||""})',returnByValue:true});const v=x.result.value;if(!v?.href.endsWith('/'+file))return null;if(v.out.includes('FAIL')||v.out.includes(done))return v.out;return null;},60000);
console.log(result);if(result.includes('FAIL')||!result.includes(done))throw Error('Fallo navegador '+file);
}
}finally{cdp?.close();chrome?.kill('SIGTERM');if(server)try{process.kill(-server.pid,'SIGTERM')}catch{};await sleep(200);fs.rmSync(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
