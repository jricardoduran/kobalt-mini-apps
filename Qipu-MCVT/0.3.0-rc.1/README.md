# Qipu MCVT 0.3.0-rc.1 — ATM 0.2.0

Candidato experimental del 25 de noviembre de 2026. Continuación de Qipu MCVT 0.2.0 y ATM 0.1.0. Integra los runtimes exactos de Kernel 10.2.5 sin modificarlos. No es una nueva versión del kernel.

## API mutable

Metacontrato y metaestructura de la trayectoria determinan su API. Tabla, entidad, vector y acción se resuelven contextual y posicionalmente. Un campo declarado puede carecer todavía de coordenada. Lectura: [], [t], [t,i], [t,i,v], [t,null,v]. Fila/columna dispersas y JSON nominal derivado. Transformación: [SET,t,i,v,x], ADD, SUB; [ID,t,i]; [ACT,a,[[i,...argumentos],...]]; [DEF,tipos,campos,acciones]. Campos: [tabla,nombre,dominio,operaciones,constitutivo]. Acción: [nombre,tabla,entradas,efectos,medida]. Entradas: [nombre,dominio,positivo]; efectos: [parámetro,operación,entrada]. Acciones indexadas por orden de declaración.

## Coordinación

Preparar congela un registro K5B/T120 con origen estable [nodo,índice]. No reinterpretar ante timeout ni conflicto. El kernel planifica contra el corte real de admisión. La cola reduce contención; CAS protege corrección. Reenvío exacto devuelve recibo histórico; mismo origen con bytes diferentes se rechaza. No se cambia KOB10/1, QIPU-META-1 ni T120.

- Browser: ATM.Local.open(dbName,id), init(), read(), json(), stage(q,origin), submit(q,origin), retry(origin), appendPrepared(raw,options), export(). Outbox IndexedDB separado guarda la intención antes de anexar, forget(origin) solo después de decisión terminal y si ya no necesita reenviar. Qipu.Mechanisms.append consolida log, delta, índice y frontera en una transacción. Web Locks por defecto, timeout de adquisición de 10 s, fallback CAS si no hay Web Locks. mirror opcional, inicialmente desactivado. No envolver append con el mismo lock.
- PHP: ATMAuthority(root,id), init(), read(), json(), prepare(q,origin), append(raw,timeout,queue). Emisor conserva raw. Recibo histórico antes de la cola; flock separado por trayectoria, espera acotada, no se promete FIFO. CanonicalLog usa PAO/CAS y replantea al perder el corte. Directorio privado confiable; no incluye endpoint HTTP público ni autenticación: responsabilidad del adaptador.
- OPFS no implementado. No hay coordinación entre dispositivos o autoridades independientes. No hay segundo WAL. El Map completo se adquiere en la consulta IDB actual; la metageometría no recorre los valores ni el historial. La instancia PHP viva recorre sufijos, un proceso nuevo reconstruye.
- Las definiciones base son aditivas e inmutables: una redefinición incompatible requiere identidad/versión nueva. No reutilizar coordenadas.

## Ejecutar

Servir esta carpeta desde localhost o HTTPS y abrir local/index.html. Pruebas Node: node pruebas/model.cjs (Node 22+). Pruebas físicas navegador: pruebas/browser.html, dos conexiones IndexedDB, Web Locks cuando disponible. PHP: php pruebas/php.php (PHP 8.2+, 64 bits, proc_open y fsync). Los tests físicos y Node nativo se incluyen para reproducción, no se afirma que se hayan ejecutado en la publicación. Véase pruebas/RESULTADOS-RC.txt. Este candidato no es un servicio de producción.

## Procedencia

Kernel 10.2.5: Kobalt-Kernel/10.2.5/2026-11-24_Kobalt_Kernel_10.2.5_Economia_Recorridos.zip, blob ee3d8917c791a1a2096f9bb6e0d6a4fd894e652e. Qipu MCVT 0.2.0: blob 58abe9cbfa8d8b6c0f84e7dc6566938b3c9caf9c. Se incluyen kernel.js y Kernel.php intactos, dos documentos de concurrencia y fixture original. Sin datos comerciales reales ni credenciales. La publicación no modifica versiones anteriores.
