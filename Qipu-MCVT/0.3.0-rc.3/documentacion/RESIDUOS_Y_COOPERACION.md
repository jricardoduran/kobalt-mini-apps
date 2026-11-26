# Residuos y cooperación — Qipu MCVT 0.3.0-rc.2

Principio: una operación debe adquirir la información que necesita, no necesariamente el universo completo. Separar adquisición de conocimiento, planificación, validación de coherencia, constitución y propagación.

## Los cinco residuos
1. Metageometría. Una venta cambia datos, no necesariamente API; un vector recién constituido sí cambia la API. Se deriva el residuo de las claves estructurales modificadas por MCVT. Declaración y nacimiento son distintos.
2. Conocimiento. IndexedDB adquiere claves demandadas por el planificador en una lectura coherente. Una ausencia conocida también es conocimiento. Los planes grandes pueden requerir adquisición completa; no se redefine MCVT.
3. Constitución. Sobre el mismo corte, el plan disperso equivale al plan completo. Se escriben los efectos, no una copia del universo. El CAS permanece obligatorio.
4. Coordinación. Origen estable, recepción, admisión y reconocimiento no son sinónimos. La cola/Web Locks reduce conflictos locales; CAS protege el corte. PHP conserva la autoridad y PAO; el reenvío usa los mismos bytes.
5. Recorrido. Se verifica el cursor de prefijo (offset y SHA-256), el destino y el sufijo. Sin novedades no se anexan bytes históricos; sí existe costo de verificación/transporte. No se afirma costo O(residuo) global.

## Localidades autónomas
L_j contiene hechos privados T102 y solicitudes T101; el índice de origen cuenta solicitudes. Q_j conserva solicitudes recibidas por la autoridad; C incorpora únicamente hechos admitidos T120; R_j reconoce sus decisiones. La réplica C no sustituye L. Dos geometrías locales diferentes pueden referir el mismo SKU: ATM traduce identidad al cruzar la frontera. El coproducto conserva procedencia y no decide admisibilidad.

Invariantes: C crece por extensión; el mismo origen con los mismos bytes no produce doble efecto; el rechazo no constituye un hecho en C; el reconocimiento positivo corresponde a un origen en C; C y R se adquieren de un corte coherente; una conexión local obsoleta no sobrescribe L; la reapertura reconstruye desde bytes.

## Escenario reproducido
1.000 productos; estado final 5.013 claves. Lectura de una celda: 7 claves. Plan de disminución: 6 claves. Escritura del stock: 1 clave. Cambios de API por stock: 0; nacimiento vectorial: 2 cambios estructurales. Son conteos de claves, no benchmarks de tiempo.
Stock inicial 10. A solicita 7, B solicita 6, C solicita 2. A y C admitidos, B rechazado tras reevaluar; stock final 1. Interrupción inyectada entre C y R recuperada por la autoridad. Las tres réplicas C convergen byte por byte. Chrome verifica además reapertura de L/C/R y solicitudes, conflicto CAS, rechazo de sufijo inválido.

## Límites
Tres localidades lógicas en un runner, no tres máquinas ni WAN. El adaptador cooperativo reconstruye L y calcula hashes de prefijos completos. PHP conserva el recorrido de recuperación original. El endpoint HTTP es de laboratorio, solo loopback. OPFS, autenticación, autorización, pérdida abrupta de energía, particiones prolongadas y mediciones de latencia/memoria quedan fuera del ensayo. Candidato RC, no certificación de producción.
Evidencia: 6b9cea63fbbfc8ed58486ca8f861878b81746046; ejecución 45726600963; 63/63 PASS.
