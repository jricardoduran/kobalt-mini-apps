/* Residuo sobre Qipu; no second source of truth. */
'use strict';
(function(root){
const Q=root.Qipu,K=root.Kobalt,ok=(x,m)=>{if(!x)throw Error(m)},eq=Q.Contracts.eq,copy=structuredClone;
const cat=Q.K4B.cat,hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''),sha=async b=>hex(await Q.K4B.hash(b));
const structural=new Set(['table','entity','vector']);
function metaDelta(base,delta){
    const out=[];
    for(const [key,x] of delta){const p=JSON.parse(key);
        if(p[0]==='schema'){const before=base.get(key)||{types:[],fields:[],actions:[]};const suffix={};
            for(const n of ['types','fields','actions']){ok(before[n].length<=x[n].length&&before[n].every((v,i)=>eq(v,x[n][i])),'Contrato no conservativo');const tail=x[n].slice(before[n].length);if(tail.length)suffix[n]=tail;}
            if(Object.keys(suffix).length)out.push([p,suffix]);
        }else if(structural.has(p[0]))out.push([p,copy(x)]);
    }
    return out;
}
// Apply a validated suffix to a private, exclusively owned replica. Stage all changes before commit.
// The returned metadata patches are derivatives; they are not appended as facts.
async function stageSuffix(s,suffix){
    const records=await K.Trajectory.scan(suffix),changes=new Map(),origins=new Set(),patches=[];
    const view={state:{get:k=>changes.has(k)?changes.get(k):s.state.get(k),set:(k,v)=>changes.set(k,v)},origins:{has:k=>origins.has(k)||s.origins.has(k),add:k=>origins.add(k)},count:s.count};
    for(const r of records){const p=Q.Canonical.plan(view,r),d=metaDelta(view.state,p.delta);if(d.length)patches.push({record:view.count,changes:d});Q.Canonical.apply(view,p);}
    return {changes,origins,count:view.count,records,summary:{records:records.length,effects:changes.size,metadata:patches}};
}
function commitSuffix(s,p){Q.MCVT.commit(s.state,p.changes);for(const o of p.origins)s.origins.add(o);s.count=p.count;return p.summary;}
async function extend(s,suffix){return commitSuffix(s,await stageSuffix(s,suffix));}
function cursor(bytes){return sha(bytes).then(hash=>({offset:bytes.length,sha256:hash}))}
function unhex(s){ok(typeof s==='string'&&s.length%2===0&&/^[0-9a-f]*$/i.test(s),'Hex inválido');return Uint8Array.from(s.match(/../g)||[],x=>parseInt(x,16))}
class Replica{
    constructor(authority){this.authority=authority;this.bytes=new Uint8Array();this.R=new Uint8Array();this.state=Q.Canonical.zero();this.tail=Promise.resolve();}
    sync(packet){const job=this.tail.then(()=>this.apply(packet));this.tail=job.catch(()=>{});return job;}
    async cursors(){await this.tail;return {C:await cursor(this.bytes),R:await cursor(this.R)};}
    async prepare(packet){
        ok(packet.authority===this.authority,'Autoridad diferente');
        const inputs=[['C',this.bytes],['R',this.R]],next={};
        for(const [n,b] of inputs){const p=packet[n],old=await cursor(b);ok(p.from.offset===old.offset&&p.from.sha256===old.sha256,'Prefijo incompatible '+n);const suf=unhex(p.suffix);const joined=cat(b,suf);ok(p.to.offset===joined.length&&p.to.sha256===await sha(joined),'Destino incompatible '+n);next[n]={joined,suf};}
        // Validate recognition bytes before mutating C.
        Q.Local.decisions(next.R.joined);
        const p=await stageSuffix(this.state,next.C.suf);
        return {next,p,summary:{...p.summary,bytesC:next.C.suf.length,bytesR:next.R.suf.length,totalC:next.C.joined.length}};
    }
    commit(prepared){commitSuffix(this.state,prepared.p);this.bytes=prepared.next.C.joined;this.R=prepared.next.R.joined;return prepared.summary;}
    async apply(packet){return this.commit(await this.prepare(packet));}
}
// Independent local history: T102 private facts, T101 requests; origin index counts T101 only.
class Node{
    constructor(id,authority){ok(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(id),'Nodo inválido');this.id=id;this.L=new Uint8Array();this.replica=new Replica(authority);this.tail=Promise.resolve();}
    async local(){await this.tail;return Q.Local.local(this.L);}
    mutate(q,request=true){const input=copy(q),job=this.tail.then(async()=>{
        const l=await Q.Local.local(this.L),s=request?l.privateState:l.privateState;
        // Resolve with the local geometry; names cross the boundary. A node must know the intended contract.
        const e=root.ATM.translate(s,input);const raw=await Q.Canonical.record(request?101:102,e);
        if(!request)Q.MCVT.plan(s,e);else Q.Contracts.request(e);
        const out={index:request?l.q.length:null,raw:raw.slice()};
        this.L=cat(this.L,raw);return out;
    });this.tail=job.catch(()=>{});return job;}
    async request(q){return this.mutate(q,true);}
    async fact(q){return this.mutate(q,false);}
    async pending(){const l=await this.local(),r=this.replica.R;return l.q.slice(r.length).map((x,i)=>({index:r.length+i,raw:x.raw}));}
    async overlay(){const l=await this.local();return Q.Local.overlay(this.replica.state,l,this.replica.R,this.id);}
}
root.Residue={metaDelta,extend,stageSuffix,commitSuffix,cursor,sha,hex,unhex,Replica,Node};
if(typeof module!=='undefined')module.exports=root.Residue;
})(globalThis);
