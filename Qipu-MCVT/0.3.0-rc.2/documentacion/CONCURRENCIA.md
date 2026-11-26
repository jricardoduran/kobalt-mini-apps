# 10.2.0 — Constitución condicional e idempotencia por origen

## Invariante

Para una trayectoria identificada y de prefijos inmutables, D_c = Fold(Γ[0:c]), c ≤ n. El registro T120 confirmado por el almacenamiento constituye el hecho. El derivado puede atrasarse, pero no debe representar un estado parcial con un cursor que afirma coherencia. El recibo al cliente no constituye el hecho.

## Algoritmo

1. Reconocer el registro K5B y su intención T120. Génesis tiene origen nulo y solo ocupa la posición 0. Los demás orígenes son (nodo, índice).
2. Reconocer la frontera del log y el estado correspondiente. Si el origen ya existe, localizar el registro histórico. En este perfil se exige igualdad exacta de los bytes K5B para un reenvío: una serialización distinta se rechaza aunque represente una intención semánticamente equivalente. El emisor conserva el mismo origen y los mismos bytes hasta resolver el resultado.
3. Planificar mediante MCVT; si el contrato rechaza, no anexar. El overlay candidato no cambia el estado base.
4. Anexar condicionado a la frontera realmente evaluada. Si otro escritor gana, volver a leer y planificar; nunca transportar Δ a otro corte.
5. Materializar desde el log o consolidar el plan con el mismo corte en una transacción. Un derivado parcial no puede utilizarse como base de reanudación.
6. Distinguir la posición original `record` (base cero), `cut` (número de registros hasta ese hecho), `head` (frontera observada en bytes, que puede avanzar) y `replayed` (reenvío). No se promete actualidad permanente del recibo.

## JavaScript

`Qipu.Mechanisms.append(db,id,raw,expectedRevision?)` reconoce un único registro T120 y consolida log, efectos dispersos, índice de origen y meta en una transacción IndexedDB. Si no se indica revisión, reintenta hasta 32 veces ante conflicto de corte; si se indica, rechaza una extensión nueva sobre revisión obsoleta. Un reenvío exacto retorna el recibo histórico incluso con revisión antigua. La lectura base todavía carga el Map completo. El índice nuevo guarda la posición; entradas booleanas históricas se resuelven leyendo el log. `rebuild` reconstruye posiciones y efectos, condicionado a la revisión. El nombre y versión de base por defecto se conservan para compatibilidad; hacer respaldo antes de uso. El índice y el estado son reconstruibles; no editar directamente los stores.

## PHP

`CanonicalLog` utiliza `Storage` (PAO) como punto único de confirmación y conserva un estado derivado exclusivamente en RAM. `synchronize()` lee el sufijo desde el byte confirmado que representa su estado, verifica K5B y aplica el recorrido sobre un candidato privado. Solo sustituye su estado coherente si concluye todo el recorrido. `append(raw)` valida y anexa con CAS por offset, vuelve a planificar ante 409 hasta 32 intentos y devuelve recibo sin esperar una segunda materialización. Una nueva instancia reconstruye desde cero; una instancia viva aprovecha el sufijo. No se introduce una caché durable ni un WAL duplicado. El límite de demostración sigue siendo 4 MiB por trayectoria. Para PHP de vida corta el costo de reconstrucción es explícito. El adaptador es para trayectorias independientes en un directorio confiable: no escribir directamente sobre C de QipuDemo ni sustituir su autoridad.

En la autoridad existente `QipuDemo::decide` utiliza el offset de la misma historia sobre la que evaluó el contrato, no un HEAD consultado posteriormente. Conserva el protocolo C→R y requiere `locked()` y control exclusivo de escrituras. El CAS no reemplaza autenticación, admisión ni coordinación entre historias divergentes.

## Verificación y alcance

Ejecutar `sh pruebas/run.sh`. Incluye 16 procesos PHP coordinados por barrera, con ocho orígenes únicos y ocho duplicados; 12 verificaciones de concurrencia, pérdida de caché, rechazo e idempotencia. La prueba JS en consola es un modelo determinista que utiliza planificador real, no una transacción IndexedDB real. Prueba real de navegador en `pruebas/concurrencia.html`; servir la raíz por HTTP local. Chromium bloqueó la navegación en el entorno de construcción. No se verificó IndexedDB real ni OPFS; no se implementa OPFS. No hay prueba universal de equivalencia ni de persistencia en todos los sistemas. PAO conserva su intención durable y roll-forward; un marco K5B no prueba atomicidad física. No truncar colas desconocidas. Los cuatro operadores y el formato KOB10/1 / QIPU-META-1 / T120 permanecen intactos.

## Revisión 10.2.1

La recuperación de un origen ya constituido es una consulta histórica, no una extensión condicional. `receipt()` consulta en una transacción de lectura la frontera observada, el índice y los bytes históricos. Elimina la comparación con una revisión anterior y evita cargar el Map en reenvíos normales. Si el origen aparece durante una carrera, se vuelve a consultar antes de resolver un conflicto de corte. Se conserva la comprobación exacta de bytes, incluidos índices históricos booleanos. El CAS de nuevas escrituras no cambia.

En 10.2.1 la cola era una composición externa. Desde 10.2.2 `append` adquiere el lock por defecto; si se envuelve externamente debe pasarse `{lock:false}` como quinto argumento. Ver REVISION_10.2.2.md. Los participantes deben compartir origen web, ámbito de bloqueo y nombre de recurso; no protege frente a escritores externos. No garantiza terminación frente a interrupciones, bloqueo indefinido o errores contractuales. Las nuevas pruebas están en `pruebas/estres-idb.*` y `pruebas/estres-php*.php`. La prueba de navegador continúa pendiente en el entorno de construcción. Ver REVISION_10.2.1.md.
