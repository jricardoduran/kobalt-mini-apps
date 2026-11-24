/* K4B: W8 | L (k bytes) | B | H256. H compromete dominio + encabezado + B. */
'use strict';
Qipu.K4B = (()=>{
 const {need}=Qipu.K2P, MAX=1048576;
 const cat=(...parts)=>{const b=new Uint8Array(parts.reduce((a,p)=>a+p.length,0));let i=0;for(const p of parts){b.set(p,i);i+=p.length;}return b;};
 const domain=s=>new TextEncoder().encode(s+'\0');
 const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
 const hash=async b=>{need(globalThis.crypto?.subtle,'Web Crypto no disponible: abra en localhost o HTTPS');return new Uint8Array(await crypto.subtle.digest('SHA-256',b));};
 function lengthBytes(n){need(Number.isInteger(n)&&n>=0&&n<=MAX,'Longitud fuera de límite');let k=n<=255?1:n<=65535?2:3;const a=new Uint8Array(k+1);a[0]=k-1;for(let j=k;j>0;j--){a[j]=n&255;n=Math.floor(n/256);}return a;}
 async function seal(body,prefix=new Uint8Array(),d='QIPU-K4B-1'){need(body instanceof Uint8Array,'Cuerpo binario requerido');const p=cat(prefix,lengthBytes(body.length),body);return cat(p,await hash(cat(domain(d),p)));}
 async function read(bytes,offset=0,prefixSize=0,d='QIPU-K4B-1'){
  need(Number.isSafeInteger(offset)&&offset>=0&&offset<=bytes.length,'Offset inválido');const start=offset;let p=offset+prefixSize;need(p<bytes.length,'Encabezado truncado');const k=bytes[p++]+1;need(k<=4&&p+k<=bytes.length,'Ancho inválido o truncado');let n=0;for(let j=0;j<k;j++)n=n*256+bytes[p++];need(n<=MAX&&lengthBytes(n)[0]===k-1,'Longitud no canónica');const end=p+n,stop=end+32;need(stop<=bytes.length,'Registro truncado');const h=await hash(cat(domain(d),bytes.subarray(start,end)));need(equal(h,bytes.subarray(end,stop)),'Hash no coincide');return {prefix:bytes.slice(start,start+prefixSize),body:bytes.slice(p,end),end:stop,hash:h};
 }
 return {seal,read,cat,equal,MAX};
})();
