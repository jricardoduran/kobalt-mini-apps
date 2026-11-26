'use strict';
require('../../0.3.0-rc.3/local/kernel.js');
const fs=require('node:fs'),p=require('node:path');const code=['../comun.js','../sparse.js','../trayectorias.js','escenarios.js'].map(n=>fs.readFileSync(p.join(__dirname,n),'utf8')).join('\n');
new Function(code+'\nreturn Structural.run();')().then(r=>{for(const x of r.out)console.log(x);console.log('ESTRUCTURAL_RESULT '+JSON.stringify({checks:r.checks,scenarios:r.scenarios,traversals:r.traversals,comparison:r.comparison}));}).catch(e=>{console.error(e);process.exitCode=1});