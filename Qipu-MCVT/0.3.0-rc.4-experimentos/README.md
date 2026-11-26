# Qipu RC.4-A / RC.4-B — comparación experimental
## Alcance
Dos motores puros JavaScript nuevos, separados de RC.3. Se comparan sobre el mismo comercio y se conserva el orden [tabla,columna,celda]. No constituyen una versión de producción ni reinterpretan T120. La sintaxis experimental fija tratamientos, pero la topología concreta emerge de acontecimientos. Ningún esquema comercial se predefine.
### A: celda recursiva
Raíz = secuencia de tablas. Tabla = eje I compartido + columnas dispersas. Una celda puede ser una manifestación terminal (incluido JSON), una tabla o un vector. TABLE([],nombre), COL(rutaTabla,nombre), ID(rutaTabla,nombre), ITEM(rutaVector,nombre), OPEN(rutaCelda,tabla/vector), SET/ADD/SUB(rutaCelda,contenido). OPEN constituye la clase en el propio hecho y no puede reemplazar otra clase. Una tabla interior ya es tabla: no se añade un índice artificial de tabla; se continúa con columna y celda. Un vector interior requiere una posición adicional. La raíz de A es colección de tablas; no es la única elección posible para futura gramática.
### B: contextos composables
Ejes constituidos por AXIS; GROW introduce identidades. Cada contexto contiene referencia a un eje, y manifestaciones dispersas independientes. INTRO introduce una identidad en el eje del contexto y opcionalmente constituye allí un contexto vinculado a otro eje; BIND vincula una posición existente. BATCH admite varios tratamientos como un acontecimiento lógico atómico. El eje de productos puede ser compartido por bodegas diferentes sin copiar identidades. En B, compartir eje no equivale a compartir valores o hacer alias de todo un nodo. No se implementa navegación de grafos por enlaces mutables.
### Correspondencia
A puede traducirse a una especialización de B: raíz con eje de tablas, cada tabla con eje de columnas, columnas con el mismo eje de identidades; vector anidado con eje propio. El traductor constituye los ejes al crear contextos; nombres de ejes derivan de la ruta de A y su función. La correspondencia se comprueba en cada corte para todas las rutas alcanzables del ejemplo; no se afirma equivalencia de todas las semánticas RC.3 ni de toda posible topología B. Contraejemplo: B comparte un eje entre dos bodegas, A estricto requiere ejes locales o un mecanismo adicional. El modelo A puede simular la información mediante proyecciones y referencias, pero no tiene compartición de ejes entre tablas como primitiva.
### Invariantes
Posiciones por primera aparición y nunca se reordenan; ruta separada del contenido; lista de contenido no es navegable; identidad puede existir sin manifestación; cero/false/null distintos de ausencia; no reemplazar una geometría por valor; un rechazo no altera estado; replay completo e incremental coinciden. Operaciones sobre celda afectan su manifestación lógica; las implementaciones clonan estado para aislamiento, no prometen escrituras físicas dispersas. Límite técnico 64 coordenadas y 65536 identidades por eje.
### Resultados realmente ejecutados
PASS equivalencia de todas las rutas en los 35 cortes de Comercio
PASS eje común aun cuando SKU-B recibe precio antes que SKU-A
PASS vector dentro de celda: modificación selectiva de una foto
PASS tabla dentro de celda: diferencial de variante
PASS tabla recursiva con vector interno de profundidad seis
PASS ausencia, cero, null y false inequívocos
PASS lista de contenido no es ruta A
PASS no sobrescribir una geometría A
PASS saldo negativo no muta A
PASS posición futura no se inventa A
PASS lista de contenido no es ruta B
PASS no sobrescribir una geometría B
PASS saldo negativo no muta B
PASS posición futura no se inventa B
PASS clase recursiva incompatible rechazada
PASS reafirmación de identidad conserva posiciones
PASS replay completo exacto
PASS reconstrucción incremental desde todo corte
PASS eje compartido entre contextos independientes y manifestaciones distintas
PASS crecimiento de eje compartido sin rellenar celdas
PASS lote B atómico ante rechazo tardío
PASS ruta de 28 coordenadas sin aridad fija
PASS 100 transformaciones adicionales equivalentes en cada corte
23/23 comprobaciones. 34 acontecimientos A, 35 cortes, 573 pares de rutas comparados en el escenario base. Más 100 transformaciones; prueba profundidad 28. JSON compacto: A 802 caracteres, B 1116 caracteres; última actualización A/B 30/30 caracteres. Este ejemplo es ASCII; no incluye enmarcado/hash/origen y no es una comparación de bytes binarios del kernel. No es prueba de optimalidad. Pruebas ejecutadas sobre funciones puras en entorno JS aislado; no se ejecutó UI, PHP, almacenamiento, red, autenticación ni regresión RC.3.
### Método de utilización
1. Descubrir ruta con read/listar. 2. Constituir solo información nueva en su contexto. 3. Utilizar ruta de longitud necesaria + contenido separado. 4. Comparar cortes y preservar invariantes. No elegir aún una versión definitiva: A es candidato de menor cambio para extender MCVT; B es candidato de generalidad y posible semántica común. Antes de integrar comprobar equivalencia de contratos/acciones, JS/PHP, persistencia dispersa, bytes, cooperación, origen/reintentos y autoridad.
