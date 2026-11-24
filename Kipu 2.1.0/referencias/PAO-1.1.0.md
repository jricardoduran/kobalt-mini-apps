# PAO · Especificación canónica v1.1.0

**24 de noviembre de 2026 · Qipu / Kobalt.** Revisión documental de PAO v1.0.0. El código PHP y el formato de intención PAO1 se conservan byte por byte. Esta especificación describe el contrato efectivo, no un nuevo formato de registro.

## 1. Dominio y responsabilidades

Sea Σ = {0,…,255}. Una trayectoria física tiene identidad `id` y contenido F ∈ Σ*. El contenido confirmado T es una cadena finita de bytes. PAO no interpreta registros, no asigna identificadores semánticos y no valida K4B/K5B ni R4/R5. La autoridad autoriza; PAO persiste; Qipu reconoce e interpreta. Un append puede contener un registro, varios o cualquier bloque no vacío que la capa superior considere válido.

## 2. Coordenadas

- `o`: offset de base cero, unidad byte. Un rango `[o,o+k)` incluye `o` y excluye `o+k`.
- `N=|F|`: tamaño físico obtenido con fstat, sin recorrer el archivo.
- `C=|T|`: frontera confirmada. En estado limpio N=C; en recuperación N puede ser mayor que C. No confundir EOF físico con HEAD publicado.
- `r`: bloque solicitado; `k=|r|`, 1 ≤ k ≤ 8 MiB. `o+k` debe ser representable como entero PHP de 64 bits no negativo.
- Posición estable `(id,o)`; para lectura completa de un intervalo se requiere además longitud o un contrato que determine el límite. Para registros homogéneos de ancho w: offset(i)=i·w; para registros variables o tablas Qipu, la transformación de índice lógico a offset es responsabilidad de la capa superior.

## 3. Estado físico y auxiliar

`id.bin`: archivo canónico, inode estable; se crea con `x+b`, se bloquea y lee con `rb`; se escribe mediante descriptor separado `ab`. `id.tmp`: intención sin publicar, reemplazable. `id.pending`: intención publicada; a lo sumo una por trayectoria. Bloqueo exclusivo cooperativo sobre el inode de `.bin`; no es archivo ni lista de espera persistente.

Formato PAO1 (no es K4B/K5B): bytes [0,4) magic ASCII PAO1; [4,12) offset uint64 big endian (restringido a PHP_INT_MAX); [12,16) longitud uint32 big endian; [16,48) SHA-256 binario de los primeros 16 bytes concatenados con r; [48,48+k) r. El hash detecta corrupción accidental, no autentica frente a quien puede modificar los archivos. Overhead temporal 48 bytes; overhead canónico 0 bytes. No hay UUID de intención ni contador externo.

## 4. Contrato abstracto (después de recuperar)

`CREATE(id)` crea una trayectoria vacía; si existe, 409 (el código también usa 409 cuando no puede crear). `HEAD(id)` recupera la intención y devuelve `end=C`. `READ(id,a,l)` recupera, fija C y devuelve `T[a:min(a+l,C)]` con C; a>C produce 416, a=C devuelve vacío. `APPEND(id,o,r)`:

1. Si o=C, publicar intención durable y completar r. Devuelve `{offset:o,length:k,end:o+k,replayed:false}`.
2. Si o<C y o+k≤C y T[o:o+k]=r, devolver `{offset:o,length:k,end:C,replayed:true}`; no escribir de nuevo.
3. En cualquier otro caso, 409; no aceptar un hueco ni anexar a una posición ocupada diferente.

La comparación de rangos **no prueba** una frontera semántica ni identidad de solicitud. Dos clientes con exactamente los mismos bytes y offset se consideran equivalentes para PAO. Un reintento no debe desplazar automáticamente un evento dependiente de historia. Append libre es alternativa no implementada; necesitaría una política adicional de deduplicación. No hay operación de borrar, truncar, sustituir o editar.

## 5. Protocolo y orden de efectos

1. Autenticar en HTTP; validar tamaño, id y offset. 2. Abrir `.bin`, adquirir `flock(LOCK_EX)` bloqueante. 3. Resolver intención publicada previa, si existe. 4. Obtener C y clasificar solicitud. 5. Escribir cabecera, hash y cuerpo en `.tmp` (`wb`), comprobar cada escritura, `fflush` y `fsync`. 6. `rename(tmp,pending)` en el mismo directorio, sincronizar directorio. 7. Validar longitud y checksum de pending, observar N, comprobar que C≤N≤C+k y que los bytes parciales coinciden. 8. Volver a sincronizar directorio; abrir `.bin` con `ab`, anexar únicamente el sufijo pendiente y sincronizar el archivo. 9. Retirar `.pending` mediante unlink y sincronizar directorio. 10. Cerrar descriptor de lock y responder. No hay cola propia; el sistema operativo bloquea las solicitudes competidoras, sin garantía FIFO.

HEAD y READ usan el mismo lock exclusivo y recuperación, no `LOCK_SH`. READ libera el lock tras fijar el corte antes de leer bytes mediante el mismo descriptor. Un GET puede completar una intención previamente autorizada: no es una operación físicamente libre de efectos.

## 6. Recuperación y estados

Con intención P=(o,r,H), tras verificar el formato, sea d=N−o. Si 0≤d≤k y F[o:N]=r[0:d], se escribe r[d:k]. Si d=k, no escribe bytes de datos; sincroniza y limpia. Si d=0, escribe r completo. Si tamaño, hash o prefijo no coinciden, 503 y preservar evidencia; no truncar. La recuperación presupone que el prefijo previo a o no fue alterado externamente; no vuelve a verificar la historia entera. Una intención publicada puede completar aunque no haya respuesta; el modelo es roll-forward, no rollback. Un fallo tras persistir datos pero antes de responder tiene resultado incierto para cliente, resoluble por reintento posicional. Un `.tmp` huérfano sin `.pending` no es intención publicada.

Estados conceptuales: LIMPIO → LOCK → PREPARADO (`tmp` sincronizado) → PUBLICADO (`pending` y directorio sincronizados) → PARCIAL/COMPLETO → DURABLE (`fsync` de datos) → LIMPIO (`unlink` y directorio sincronizado). El crash libera el lock por cierre de descriptores; la siguiente operación intenta recuperar. La evidencia incompatible transita a BLOQUEADO POR INCONSISTENCIA (503), no a un estado corregido por truncamiento.

## 7. Invariantes y argumento de preservación

- I1 **Prefijo:** T_i ⪯ T_j para i≤j, bajo modelo de confianza. Equivale a T_j[0:|T_i|]=T_i.
- I2 **Exclusión:** a lo sumo un proceso cooperativo en sección crítica por inode. Trayectorias distintas no tienen orden global.
- I3 **Continuidad:** un append nuevo comienza en C, nunca en un hueco.
- I4 **Intención previa:** ningún byte nuevo de datos se añade sin intención publicada y sincronización de directorio exitosa en modo estricto.
- I5 **Confirmación:** el éxito de un append nuevo exige fsync de datos y limpieza durable. El modo estricto es el utilizado por HTTP; el constructor admite strict=false, que debilita la garantía de directorio y no se recomienda.
- I6 **Recuperación monótona:** si r=p∥q y F=T∥p, entonces F′=F∥q=T∥r. No se altera ningún byte anterior.
- I7 **Lectura consistente:** se selecciona un C después de recuperar bajo lock. El rango entregado pertenece a ese prefijo aunque otro escritor extienda F posteriormente.
- I8 **Reintento posicional:** una coincidencia completa de rango ya confirmado no modifica F.
- I9 **Opacidad:** el archivo canónico contiene exactamente los bloques de usuario concatenados, sin metadatos PAO.

Demostración inductiva condicionada: base T=ε tras CREATE exitoso; paso: con exclusión mutua y o=C, el descriptor ab solo añade al EOF. La intención conserva r; si se interrumpe en un prefijo compatible, completar el sufijo restaura T∥r. El caso replay no cambia T; el conflicto no añade el bloque solicitado (puede haber recuperado otro anterior). El argumento depende de un filesystem que respete lock y fsync, estabilidad de inode y ausencia de modificaciones externas; no es una prueba de tolerancia a corrupción arbitraria, hardware defectuoso o administradores maliciosos.

## 8. Complejidad y alternativas

En régimen normal, HEAD O(1) en bytes históricos; append, replay, recovery y read O(k) en bytes procesados, excluyendo espera/latencia del almacenamiento. Cuando HEAD/READ recuperan una intención, también O(k_pendiente). Dos escrituras del payload por append nuevo (temporal y canónica), 48 bytes auxiliares, memoria O(k), múltiples sincronizaciones. Sin DB, daemon, cron ni cola. Alternativas: append simple (no recuperación autónoma), cliente conserva intención (dependencia del cliente), SQLite (transacciones maduras; no archivo binario canónico), R2 (objetos), D1/Supabase (filas), Durable Objects (coordinación por instancia). `chattr +a` opcional con privilegios y verificación; no protege contra administrador privilegiado ni elimina la necesidad de lock o backups. El código existente usa CREATE con `x+b`; aplicar el atributo luego de crear y validar compatibilidad.

## 9. Seguridad, instalación y límites

PHP ≥8.1 64 bits; filesystem POSIX local; directorio privado existente y durable; solo public/ como document root; HTTPS y rate limits externos. API usa token aleatorio de 256 bits verificado por SHA-256, no frase humana, no HMAC por mensaje. Todos los permisos corresponden a una única autoridad; no hay roles, registro UID ni cifrado de credenciales. La autoridad derivada futura debe ser independiente: Argon2id para frases, HKDF para separar propósitos, HMAC requiere secreto de verificación o firma Ed25519 con clave pública, UID de alta de un uso y AEAD para credenciales cifradas. No implementados aquí. No exponer archivos de datos públicamente: HEAD/READ coordinados excluyen colas parciales. No reemplazar inode, no usar symlinks ni permitir escritores externos. No garantiza FIFO, límites temporales de espera, transacciones entre trayectorias, deduplicación semántica, alta disponibilidad ni protección contra corrupción previa. Los 8 MiB son límite de operación, no de historia. `fsync` es garantía condicionada al sistema real; validar alojamiento.

## 10. Evidencia y trazabilidad

Suite original reejecutada en esta revisión: 15/15 comprobaciones, 64 procesos independientes, 512 bytes de 64 registros distintos de 8 bytes; 4 estados parciales simulados; conflictos, reintentos, rangos, path traversal e integridad. Ver tests/RESULTADOS-v1.1.0.txt. No se simularon cortes eléctricos reales ni se certificó hosting/NFS. Código PHP y tests originales no modificados. La versión documental anterior se conserva en docs/guia-v1.0.0.html. La nomenclatura exacta R4/R5 sigue sin verificarse; Qipu documenta K4B/K5B, pero PAO no depende de sus estructuras.

Referencias: manual PHP [flock](https://www.php.net/manual/es/function.flock.php), [fopen](https://www.php.net/manual/es/function.fopen.php), [fsync](https://www.php.net/manual/es/function.fsync.php), Linux [fsync(2)](https://man7.org/linux/man-pages/man2/fsync.2.html).
