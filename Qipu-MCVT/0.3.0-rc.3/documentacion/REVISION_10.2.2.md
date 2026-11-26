# 10.2.2 — Economía de coordinación

Base exacta: ZIP 10.2.1 Atlas Leyes Emergentes (2026-11-24_1908). Se conserva el archivo PHP, la fixture, los formatos y el intérprete constitutivo; solo cambia la entrada de append en el adaptador IndexedDB de JS. La actualización del Atlas mantiene los 99 casos anteriores, modifica el caso 62 para no adquirir recursivamente el mismo lock y agrega 100–102.

## Ley y flujo

D_c = Fold(Γ[0:c]), con el cursor y los efectos consolidados en una transacción. Para un origen conocido o en conflicto, la lectura histórica coherente basta: no se solicita lock ni se carga el Map. Para un origen nuevo, el lock exclusivo por recurso reduce la contención; dentro se vuelve a reconocer el origen, se lee la base, se calcula el plan y se verifica la revisión dentro de la transacción de escritura. El CAS permanece necesario: un escritor que no usa la cola puede avanzar. La revisión explícita obsoleta solo se admite para reenvíos exactos ya constituidos.

La cola no crea hechos, ni define autoridad, ni sustituye el CAS. Su nombre se conserva compatible con la envoltura histórica `qipu:${db.name}:${id}`. Si los nombres contienen `:` puede haber alias entre pares distintos; eso solo serializa recursos de más, no mezcla registros. Evitar esos nombres ambiguos. Web Locks coordina participantes del mismo ámbito de almacenamiento del navegador, no otros dispositivos, perfiles ni PHP. No es reentrante: nunca envolver append con el mismo lock salvo que se desactive la cola interna. Tampoco usar `steal`.

## API

```js
await Qipu.Mechanisms.append(db,id,raw);
await Qipu.Mechanisms.append(db,id,raw,revision,{timeout:2000});
await Qipu.Mechanisms.append(db,id,raw,undefined,{lock:false});
```

El quinto argumento es opcional. Timeout por defecto: 10 000 ms, entero positivo; solo se usa si hay API y cola habilitada. Se usa AbortController y se cancela el temporizador al conceder el lock. Esto evita depender de AbortSignal.timeout y evita temporizadores activos innecesarios. El temporizador solo cubre espera de adquisición, no la lectura histórica, el escritor activo ni la ejecución suspendida del navegador. Si expira: Error con name TimeoutError y code LOCK_TIMEOUT. No se reintenta sin lock por detrás. El cliente conserva raw/origen y puede reenviar; otro escritor pudo constituir el mismo hecho. Si no existe navigator.locks, se utiliza appendCAS sin cola. Los errores reales de API se propagan, no se confunden con timeout. Se copia raw antes del primer await, incluso si llega como ArrayBuffer, evitando que el emisor lo modifique mientras espera. Se valida un solo registro y se reutiliza su interpretación, sin volver a escanearlo por entrar en la cola.

## Verificación

`node pruebas/cola-modelo.cjs`: usa el append real y dos adaptadores simulados en Node. No prueba atomicidad física ni rendimiento del navegador. Comprueba recibo sin lock, conflicto de bytes, timeout sin escritura, CAS sin cola, reenvío posterior, doble intención en cola, revisión explícita, ejecución concedida más larga que timeout, ausencia de API, raw mutable, registro inválido y replay final.

`python pruebas/estres-idb.py`: cuatro pestañas reales, dos modalidades de 200 llamadas, regresión histórica, 11 casos originales y nueve del Atlas. Se cambió la prueba de cola para llamar append por defecto, sin lock externo. El intento aquí falla en navegación HTTP local con net::ERR_BLOCKED_BY_ADMINISTRATOR; no es evidencia de un fallo del kernel. No se dispone de los logs/scripts del informe Chrome externo; sus 200/200 y 0,60–0,67 s son resultados reportados, no reproducidos aquí. Ejecutar en navegador permitido desde raíz HTTP/HTTPS. Los casos 100–102 pueden ejecutarse directamente en local/atlas.html.

## Próxima optimización, no aplicada

El espejo incremental solo merece incorporarse después de medir el coste por tamaño de estado y concurrencia. Medir 100, 1000, 10000 entidades, 1/2/4 pestañas, hechos con 1 o muchos efectos, reenvíos históricos y escrituras nuevas por separado; usar p50/p95, bytes y cantidad de claves cargadas, reintentos CAS y tiempo de espera/admisión. No confundir el beneficio de eliminar conflictos con el coste creciente de cargar Map. Si se implementa espejo, debe reconocer identidad y corte, invalidarse ante reconstrucción o generación incompatible y avanzar solo sobre sufijos coherentes. No constituye otra realidad.
