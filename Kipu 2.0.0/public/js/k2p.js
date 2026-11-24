/* Qipu K2P: natural canónico, MSB primero. Independiente de entidades. */
'use strict';
window.Qipu = window.Qipu || {};
Qipu.K2P = (() => {
  const need = (ok,msg='K2P inválido') => {if(!ok) throw Error(msg);};
  function encode(n,w=4){need(Number.isSafeInteger(n)&&n>=0,'Natural fuera de dominio');need(Number.isInteger(w)&&w>=1&&w<=8,'Perfil W inválido');const b=n.toString(2),k=b.length;need(k<=2**w,'Natural fuera del perfil');return (k-1).toString(2).padStart(w,'0')+b;}
  class Writer {
    constructor(){this.parts=[];}
    n(n,w=4){this.parts.push(encode(n,w));return this;}
    text(s){need(typeof s==='string','Texto requerido');const b=new TextEncoder().encode(s);need(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b)===s,'Unicode no válido');this.n(b.length,6);for(const x of b)this.parts.push(x.toString(2).padStart(8,'0'));return this;}
    bytes(){let s=this.parts.join('');s=s.padEnd(Math.ceil(s.length/8)*8,'0');return Uint8Array.from(s.match(/.{8}/g)||[],x=>parseInt(x,2));}
  }
  class Reader {
    constructor(bytes){this.b=bytes;this.p=0;}
    take(k){need(this.p+k<=this.b.length*8,'Campo truncado');let n=0n;for(let j=0;j<k;j++,this.p++)n=(n<<1n)|BigInt((this.b[this.p>>3]>>(7-(this.p&7)))&1);return n;}
    n(w=4){const k=Number(this.take(w))+1;need(k<=53,'Natural fuera del dominio seguro');const n=Number(this.take(k));need(n.toString(2).length===k,'Natural no canónico');return n;}
    text(){const k=this.n(6);need(k<=Math.floor((this.b.length*8-this.p)/8),'Texto truncado');const b=new Uint8Array(k);for(let j=0;j<k;j++)b[j]=Number(this.take(8));return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);}
    finish(){const k=this.b.length*8-this.p;need(k<8&&this.take(k)===0n,'Padding no canónico');}
  }
  return {encode,Writer,Reader,need};
})();
