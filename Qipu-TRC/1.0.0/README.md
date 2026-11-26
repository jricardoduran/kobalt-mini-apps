# Qipu TRC 1.0.0
**Trayectorias Recursivas Componibles — perfil estructural A**

Distribución independiente de investigación de Kobalt. Versión del mecanismo, no de una aplicación CRM comercial. La trayectoria exterior es la única fuente constitutiva de esta localidad. Los motores JS y PHP interpretan el mismo perfil A y los mismos marcos K5B; la interfaz y la persistencia son adaptadores. Esta versión no modifica ni reemplaza los experimentos históricos de Qipu MCVT RC.3, RC.4 A/B, A.1, A.2 ni el laboratorio estructural.

## Comenzar
JavaScript local (navegador moderno con IndexedDB y Web Crypto):
~~~sh
cd Qipu-TRC/1.0.0
python3 -m http.server 8080 -d local
# Abrir http://localhost:8080/
~~~
PHP (PHP 8.1+ de 64 bits; Linux con flock, rename y fsync de directorio):
~~~sh
cd Qipu-TRC/1.0.0
mkdir -p "$HOME/qipu-trc-lab"
QIPU_TRC_DATA="$HOME/qipu-trc-lab" php -S 127.0.0.1:8081 -t servidor
# Abrir http://127.0.0.1:8081/
~~~
No se instala Node ni dependencias para utilizar las interfaces. Node 22+, PHP y Chrome se utilizan para las pruebas. Mantener los datos fuera del directorio público. API PHP solo POST JSON, por defecto localhost; token opcional en QIPU_TRC_TOKEN (cabecera X-Qipu-Token). No es una política de autenticación multiusuario ni una recomendación de exponer el servidor de desarrollo a Internet. No hay Service Worker.

## Leyes de constitución
1. La sintaxis y los tratamientos existen antes del recorrido. Las tablas, columnas, identidades y geometrías concretas aparecen durante los acontecimientos admisibles.
2. Lo nuevo requiere información suficiente; lo constituido puede referenciarse por posición. Primera aparición por ámbito, no cantidad de registros. Una tabla tiene un eje de identidades común a sus columnas dispersas. La celda hereda la identidad y la posición de columna. Una identidad puede existir sin una manifestación.
3. Una celda admite contenido terminal, geometría interior (tabla/vector) o trayectoria interior. No se deduce la naturaleza de una lista o de sus bytes. OPEN constituye geometría; MOUNT constituye una trayectoria. No se reemplazan estructuras constituidas con SET.
4. La ruta y el contenido se separan. El recorrido de acontecimientos constituye; el recorrido posicional adquiere conocimiento. La trayectoria hija tiene raíz y corte propios, no necesariamente autoridad independiente.
5. Se conserva el prefijo reconocido. Un APPEND aporta un sufijo interior; no sobrescribe el marco donde nació la trayectoria. Cada registro interior conserva el corte exterior en que fue admitido. El cursor de recorrido atraviesa las fronteras automáticamente, sin volver a comenzar por cada clave faltante.
6. Una intención por ruta produce un marco exterior reconocido y los APPEND interiores necesarios. Una transacción conjunta TX puede consolidar varios efectos cuando un invariante lo exige. No se confunde eso con una consecuencia causal posterior. La causalidad automática DEPEND/CAUSE permanece fuera de este perfil.
7. La UI pregunta y expresa intenciones. No mantiene una segunda verdad ni inventa coordenadas. El contrato de negocio define qué hechos y efectos son suficientes. El motor genérico no puede verificar por sí solo si un pago real ocurrió o qué usuario está autorizado a declarar una venta.

## API y formato
La raíz A es una colección de tablas. Los tratamientos locales son TABLE, ID, COL, ITEM, OPEN, SET, ADD, SUB, MOUNT, APPEND y TX (este último solo en raíz). Una tabla interior continúa directamente con columna, celda; una trayectoria interior comienza desde su raíz, por lo que puede requerir el índice de otra tabla. Las rutas no tienen aridad fija; la naturaleza determina cómo se interpreta cada componente. No confundir [t,c,i] con índices de registros históricos.

Ejemplos de solicitudes JSON:
~~~json
{"op":"write","origin":"ej-1","treatment":"TABLE","route":[],"content":"Producto"}
{"op":"write","origin":"ej-2","treatment":"ID","route":[0],"content":"SKU-A"}
{"op":"write","origin":"ej-3","treatment":"COL","route":[0],"content":"Stock"}
{"op":"write","origin":"ej-4","treatment":"SET","route":[0,0,0],"content":10}
{"op":"write","origin":"ej-5","treatment":"SUB","route":[0,0,0],"content":2,"checks":[[[0,0,0],["value",10]]]}
{"op":"read","route":[0,0,0]}
{"op":"read","route":[0,0,0],"cut":4}
{"op":"history","route":[],"from":0,"to":5}
{"op":"export","route":[]}
~~~
Cada línea es una solicitud independiente. El origen se conserva para el reenvío exacto; un origen con bytes distintos se rechaza. El motor compone la escritura global en un TX de raíz, con precondiciones sobre el corte previo y efectos locales encapsulados. Si no se necesita una nueva escritura, se devuelve el recibo anterior. Un lote explícito TX recibe events locales de raíz; APPEND contiene hex de marcos hijos. El op submit es una primitiva de laboratorio del motor, no expuesta por HTTP ni por la UI; no ofrece reconocimiento universal de origen. Los contratos comerciales son responsabilidad de la capa que admite las intenciones.

El tratamiento K5B experimental 65520 conserva el formato del perfil A de RC.4: T16 (2 B), encabezado de longitud canónico (2–4 B), contenido, SHA-256 de dominio + prefijo/longitud/cuerpo (32 B). Cuerpo JSON canónico según serialización ECMAScript, sin números no finitos, enteros seguros, Unicode válido; se admiten listas y objetos terminales. MOUNT/APPEND llevan los bytes hijos en hex dentro del JSON. No se afirma asignación oficial del tipo ni formato de red definitivo. No se optimiza aún la amplificación del hex en profundidad. La longitud K5B máxima es 1 MiB por cuerpo, 65536 identidades por eje, nombres hasta 200 unidades UTF-16, 64 niveles de contenido JSON. No existe el antiguo límite de 32 claves ni un límite de aridad de ruta; los recursos físicos y límites del marco siguen existiendo.

## Coherencia física
- JS: cola de una instancia, adquisición de prefijo coherente IndexedDB, plan fuera de transacción, CAS de head y add del nuevo marco en una transacción readwrite. Si otro escritor gana, reevalúa desde su corte. No hay presupuesto fijo de reintentos; AbortSignal en run permite cancelar antes del commit. El CAS no es la cola y un recibo de origen no es una prueba de autorización.
- PHP: bloqueo compartido de lectura y exclusivo de admisión (flock), un marco por archivo de posición estable; temporal, escritura completa, fflush, fsync del marco, rename y fsync del directorio. No reescribe el marco anterior. Un temporal abandonado no constituye un hecho. Discontinuidad o hash incorrecto se rechaza. Si falla después de rename, el resultado puede ser incierto: reenviar el mismo origen y bytes. No se prueba pérdida eléctrica o sistemas de archivos remotos. El directorio es de confianza y debe protegerse.
- En ambos, el motor puro deriva la geometría desde bytes; la implementación de persistencia actual lee/reproduce el prefijo completo por solicitud. Los descriptores y el cursor permiten adquisición posicional en memoria; no se afirma materialización física dispersa incremental. Se prioriza claridad y paridad antes de optimizar.

## Preguntas, ejemplos y pruebas
Abrir documentacion.html e index.html en cada localidad. Los ejemplos comparten exactamente las mismas intenciones JSON: catálogo, CRM, venta/entrega, proyecto/colaboradores/tarea y vector de documentos/revisiones. Las UI permiten recorrer posiciones, consultar fronteras, historia local y cortes exteriores, exportar bytes y registrar intenciones. El ejemplo no borra datos existentes y solo se reanuda sobre su propio prefijo.
~~~sh
node pruebas/paridad.cjs
node pruebas/browser-run.cjs
~~~
La primera prueba compara respuestas y sufijos exactos JS/PHP y ensaya persistencia PHP en múltiples procesos. La segunda utiliza Chrome real, dos conexiones IndexedDB, HTTP PHP y las dos interfaces. RESULTADOS.txt recoge la evidencia de la ejecución publicada.
## Fuentes de diseño
Manifiesto de Kobalt (24 noviembre, Kernel 10.2.2), ley de primera aparición, separación ruta/contenido, RC.4 A/B, trayectorias interiores, A.1 histórica, A.2 causal, laboratorio estructural. No se afirma que TRC sea el kernel completo ni que implemente cooperación Q/R/C, autoridades independientes o publicación EMIT/FOLLOW/EXPAND/TRAJECTORY. Es un mecanismo local recursivo que puede integrarse en ese ecosistema.
