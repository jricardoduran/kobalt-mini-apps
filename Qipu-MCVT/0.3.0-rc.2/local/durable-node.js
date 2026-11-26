/* Three independent append-only streams L, C replica and R in one local IndexedDB. */
'use strict';
(function(root){
const Q=root.Qipu,X=root.Residue,K=root.Kobalt,cat=Q.K4B.cat,ok=(x,m)=>{if(!x)throw Error(m)},eq=Q.Contracts.eq,copy=structuredClone;
const streams=['L','C','R'],request=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function tx(db,mode,fn){
    const t=db.transaction(['head','segments'],mode),done=new Promise((res,rej)=>{t.oncomplete=res;t.onabort=()=>rej(t.error||Error('Transacción abortada'));});done.catch(()=>{});
    try{const out=await fn(n=>t.objectStore(n));await done;return out;}catch(e){try{t.abort()}catch{}await done.catch(()=>{});throw e;}
}
function database(name){return new Promise((res,rej)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('head');r.result.createObjectStore('segments')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej(Error('IndexedDB bloqueada'));});}
function conflict(){const e=Error('Corte local obsoleto; reabrir o refrescar');e.code='LOCAL_CUT_CONFLICT';return e;}
async function readAll(db,id,authority){
    return tx(db,'readwrite',async o=>{
        let head=await request(o('head').get('current'));
        if(!head){head={id,authority,revision:0,L:0,C:0,R:0};await request(o('head').add(head,'current'));}
        ok(head.id===id&&head.authority===authority,'Identidad local incompatible');
        const ks=await request(o('segments').getAllKeys()),vs=await request(o('segments').getAll()),chunks={L:[],C:[],R:[]},ends={L:0,C:0,R:0};
        for(let i=0;i<ks.length;i++){const [n,p]=ks[i],b=vs[i];ok(streams.includes(n)&&p===ends[n]&&b instanceof Uint8Array&&b.length>0,'Hueco local');chunks[n].push(b);ends[n]+=b.length;}
        for(const n of streams)ok(ends[n]===head[n],'Frontera local incoherente '+n);
        return {head,bytes:Object.fromEntries(streams.map(n=>[n,cat(...chunks[n])]))};
    });
}
// C/R packet is received under one authority lock. All recognized origins of this node
// must correspond to the original local T101 and to the exact response bit.
function validateRecognition(id,local,oldOrigins,newOrigins,rbytes,newRecords){
    const bits=Q.Local.decisions(rbytes);
    ok(bits.length<=local.q.length,'R excede L');
    for(let i=0;i<local.q.length;i++){
        const origin=id+':'+i,has=oldOrigins.has(origin)||newOrigins.has(origin);
        ok(has===(bits[i]===1),'Reconocimiento C/R incompatible');
    }
    for(const rec of newRecords){const p=Q.Canonical.intent(rec);if(p.x.origin?.node!==id)continue;const i=p.x.origin.index;ok(local.q[i]&&eq(local.q[i].x,p.x.event),'C difiere de solicitud local');}
}
class DurableNode{
    constructor(db,id,authority){this.db=db;this.id=id;this.authority=authority;this.tail=Promise.resolve();}
    static async open(name,id,authority){
        ok(typeof id==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(id),'Nodo inválido');
        const db=await database(name),node=new DurableNode(db,id,authority);try{await node.reload();return node}catch(e){db.close();throw e;}
    }
    async reload(){
        const x=await readAll(this.db,this.id,this.authority),l=await Q.Local.local(x.bytes.L),r=new X.Replica(this.authority),p=await X.stageSuffix(r.state,x.bytes.C);
        validateRecognition(this.id,l,r.state.origins,p.origins,x.bytes.R,p.records);
        X.commitSuffix(r.state,p);r.bytes=x.bytes.C;r.R=x.bytes.R;
        this.head=x.head;this.L=x.bytes.L;this.replica=r;
    }
    enqueue(fn){const job=this.tail.then(fn);this.tail=job.catch(()=>{});return job;}
    refresh(){return this.enqueue(()=>this.reload());}
    async close(){await this.tail;this.db.close();}
    async commit(parts){
        const expected=this.head;
        const next=await tx(this.db,'readwrite',async o=>{
            const h=await request(o('head').get('current'));if(!eq(h,expected))throw conflict();
            const next={...h};let changed=false;
            for(const n of streams){const b=parts[n];if(!b?.length)continue;await request(o('segments').add(b.slice(),[n,h[n]]));next[n]+=b.length;changed=true;}
            if(changed){next.revision++;await request(o('head').put(next,'current'));}return next;
        });this.head=next;
    }
    mutate(q,ask){
        const input=copy(q);
        return this.enqueue(async()=>{
            const l=await Q.Local.local(this.L),event=root.ATM.translate(l.privateState,input);
            if(ask)Q.Contracts.request(event);else Q.MCVT.plan(l.privateState,event);
            const raw=await Q.Canonical.record(ask?101:102,event);
            await this.commit({L:raw});this.L=cat(this.L,raw);
            return {index:ask?l.q.length:null,raw:raw.slice()};
        });
    }
    request(q){return this.mutate(q,true);}
    fact(q){return this.mutate(q,false);}
    async local(){await this.tail;return Q.Local.local(this.L);}
    async cursors(){await this.tail;return this.replica.cursors();}
    sync(packet){const owned=copy(packet);return this.enqueue(async()=>{
        const p=await this.replica.prepare(owned),l=await Q.Local.local(this.L);
        validateRecognition(this.id,l,this.replica.state.origins,p.p.origins,p.next.R.joined,p.p.records);
        await this.commit({C:p.next.C.suf,R:p.next.R.suf});
        return this.replica.commit(p);
    });}
    async pending(){await this.tail;const l=await Q.Local.local(this.L);return l.q.slice(this.replica.R.length).map((r,i)=>({index:this.replica.R.length+i,raw:r.raw.slice()}));}
    async overlay(){await this.tail;return Q.Local.overlay(this.replica.state,await Q.Local.local(this.L),this.replica.R,this.id);}
    async canonical(path=[]){await this.tail;return root.ATM.read(this.replica.state.state,path);}
}
root.DurableNode=DurableNode;
})(globalThis);
