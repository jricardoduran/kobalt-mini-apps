# ATM — Unidad estructural: sintaxis, declaración y constitución

Clarificación conceptual del 25 de noviembre de 2026. No modifica RC.2.

La sintaxis del intérprete precede a la trayectoria: fija cómo declarar, constituir, consultar y transformar. La estructura particular de una trayectoria surge de las declaraciones reconocidas mediante esa sintaxis. Los contratos son constitutivos de esa estructura, no una descripción externa que deba mantenerse duplicada.

Ejemplo: declarar Producto, Precio y Stock ya establece el espacio lógico en que pueden existir identidades y manifestaciones. La estructura vacía es significativa. Incorporar SKU-A y asignar valores extiende ese espacio efectivo; no exige otro esquema independiente.

En RC.2 existe una distinción operativa: schema registra declaraciones en su orden, mientras tableName/vectorName asignan coordenadas de materialización por primera constitución. ID puede constituir tabla e identidad sin crear vectores de parámetros. Esa diferencia es real en el código, pero no exige dos ontologías ni dos ramas públicas de API.

Hipótesis preferida para estudiar: una sola estructura lógica derivada de la trayectoria; la posición de un tipo o parámetro declarado puede ser su coordenada lógica desde la declaración, incluso sin manifestaciones. Las identidades particulares adquieren posiciones al constituirse. Los vectores comparten el eje de identidades. La coordenada de contenido sigue el orden tipo/tabla, parámetro/vector, identidad. El almacenamiento puede conservar materialización dispersa por primera aparición, con traducción derivada; no se presume que ambos órdenes coincidan en RC.2.

La diferencia entre posibilidad declarada y manifestación existente se conserva sin duplicar estructura. Antes de declarar un parámetro no existe su posibilidad en el contrato; después de declararlo puede existir su coordenada lógica aunque todavía no haya valores. Ausencia no equivale a cero ni false.

Alternativa conservadora: mantener las dos coordenadas físicas actuales dentro de una sola representación estructural. Alternativa más radical: hacer coincidir coordenadas lógicas de declaración y materialización desde el comienzo, lo que cambiaría la semántica posicional de RC.2 y requiere verificar compatibilidad. No se elige formato binario ni se implementa una nueva gramática en esta nota.

API: lenguaje posicional para conocer la estructura que determina las preguntas y transformaciones admisibles en el corte actual. No hace falta generar una segunda API ni un árbol de metacontrato/metaestructura/contenido por obligación. Los nombres y JSON nominales son proyecciones o manifestaciones cuando se necesitan. La sintaxis común es anterior a la trayectoria; el vocabulario específico puede ser inicial o evolucionar mediante declaraciones admitidas.

Siguiente decisión experimental: comprobar si una sola coordenada lógica por tipo y parámetro basta para las primeras apariciones, extensión conservativa y consultas vectoriales, sin modificar el formato histórico ni romper coordenadas existentes. La propuesta no es todavía una propiedad verificada del motor.
