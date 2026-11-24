/* K5B: composición de reconocimiento T16 con K4B; dominio separado. */
'use strict';
Qipu.K5B=(()=>{const {need}=Qipu.K2P;return {
 async seal(t,b){need(Number.isInteger(t)&&t>=0&&t<=65535,'Tratamiento inválido');return Qipu.K4B.seal(b,Uint8Array.of(t>>8,t&255),'QIPU-K5B-1');},
 async read(b,p=0){const r=await Qipu.K4B.read(b,p,2,'QIPU-K5B-1');return {...r,t:r.prefix[0]*256+r.prefix[1]};}
};})();
