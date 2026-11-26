# Convención del proyecto — distribución de mecanismos
**Adoptada para Qipu TRC 1.0.0 (25 noviembre de 2026)**

Cuando un mecanismo sea realizable localmente en JavaScript y en servidor PHP, conservar ambas realizaciones bajo una misma versión y contrato semántico.

- local/: mecanismo JS puro, adaptador de persistencia local separado, HTML que lo carga, UI y ejemplos separados del motor, documentación ejecutable o explicativa. Preferir tecnologías nativas y sin dependencias innecesarias.
- servidor/: mecanismo PHP puro, adaptador físico y endpoint separados, HTML que consulta el endpoint, misma familia de preguntas y ejemplos. No implementar la lógica de negocio dentro del HTML.
- pruebas/: escenarios comunes, equivalencia de resultados y bytes si comparten representación, pruebas físicas de cada localidad, rechazos y reconstrucción.
- README.md y documentación HTML: leyes, naturaleza de los elementos, gramática, primera aparición, flujos de lectura/escritura, contratos, límites, coordinación, ejemplos y evidencia reproducible.
- ZIP de distribución fechado en UTC-5, código fuente y documentación, misma copia verificada en repo privado de investigación y Mini Apps cuando corresponda. No incluir datos operacionales, claves, credenciales, estado de pruebas, ni dependencias innecesarias.

Primero esclarecer qué se constituye, qué se deriva, cómo se pregunta, cómo se admite y qué invariantes deben preservarse. Después realizarlo; después medir la economía. No confundir equivalencia semántica con algoritmos físicos idénticos. Colas, CAS, exclusión, atomicidad, reconocimiento y autoridad resuelven preguntas distintas. No introducir metaregistros, APIs ni mecanismos nuevos si la información necesaria ya emerge del recorrido. No declarar verificado lo que no se probó.
