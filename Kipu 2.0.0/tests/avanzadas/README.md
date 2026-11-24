# Qipu 2.0.0 · Pruebas avanzadas 0.1.0

Esta suite es complementaria al ZIP original de Qipu 2.0.0 y PAO 1.1.0. No modifica su código ni sus archivos publicados. Requiere Linux/POSIX, Python 3, PHP CLI de 64 bits (8.1+) y Node.js moderno (22 usado). Ejecutar solamente en entorno aislado; no hay autenticación.

```sh
python3 run.py /ruta/2026-11-24_1312_Qipu_2.0.0_PAO_1.1.0.zip
```

Se verifica SHA-256 del archivo original, se extrae a un directorio temporal y se crea otra copia experimental. Para los experimentos 1 y 2, la copia habilita el nodo C en la lista NODES, inicialización/validación de streams PHP y validación de origen en JS. No hay cambios de semántica, contratos, PAO, protocolo ni aplicación de navegador. El experimento 3 y la prueba de límite se ejecutan sobre la versión original. Se inicia un servidor PHP con PHP_CLI_SERVER_WORKERS=4 en un puerto efímero de loopback, cada ejecución con almacén vacío. Se comprueba que varios PIDs acepten conexiones en cada experimento de concurrencia. El script termina todos los servidores y borra sus directorios temporales. Se escribe resultados.json; redirigir stdout a resultados.txt para conservar nueva evidencia. Las seis permutaciones de envío HTTP varían el orden, sin imponer el orden efectivo del lock. Los resultados concretos pueden variar; se prueban invariantes, no un ganador predeterminado.

## Experimentos
1. Tres nodos solicitan 9, 8 y 7 unidades con stock 20. Nueve envíos concurrentes (seis reintentos), tres aprobaciones paralelas, rechazo explícito de la inviable, convergencia, prefijos y reintentos. Seis rondas, 138 comprobaciones identificadas.
2. Nueve afirmaciones desde tres nodos, con primeras apariciones coincidentes, parámetros disjuntos y clases incompatibles en Nivel. Se comprueba posición estable, no constitución parcial de entidad rechazada, celdas dispersas, privacidad local y replay PHP/JS. Seis rondas, 162 comprobaciones identificadas.
3. Dos nodos originales; interrupciones simuladas en procesos PHP separados después de C y antes de R, reintentos concurrentes, adquisición en ambos órdenes, 127 rechazos y rollover M3E1 en índice 128. 32 comprobaciones identificadas. El proceso termina por excepción controlada y salida 77, no por corte eléctrico ni SIGKILL durante fsync.
4. Límite de versión: el original rechaza el tercer nodo (2 comprobaciones).

334 comprobaciones avanzadas identificadas y todas superadas; además, 37 HTTP/JS y 4 recuperación de Qipu, 15 PAO originales reejecutadas (390 en total). Hay aserciones internas adicionales que no se cuentan como comprobaciones identificadas. Resultados de referencia en resultados.txt, resultados.json, regresion-qipu.txt y regresion-pao.txt. Las pruebas originales se ejecutan desde la carpeta extraída con `bash tests/run.sh` y `php tests/pao/run.php`.

## Alcance y limitaciones
No se prueba IndexedDB real, navegador offline ni despliegue público, red hostil, autenticación, pérdida de energía, alta disponibilidad, rendimiento a gran escala ni todos los interleavings posibles. El modelo JS se ejecuta en Node.js. El lock de autoridad serializa las operaciones canónicas; la concurrencia se genera por clientes HTTP y procesos PHP distintos, no se afirma ejecución simultánea dentro de la sección crítica. La ampliación a tres nodos es una variante de prueba, no registro dinámico ni nueva versión de Qipu. Una aceptación inviable retorna HTTP 409 y permanece pendiente hasta la decisión explícita de rechazo. Los ejemplos son datos sintéticos y no certifican protección contra ventas físicas offline. Las pruebas confirman las propiedades para los escenarios ejecutados, no una demostración exhaustiva de corrección.
