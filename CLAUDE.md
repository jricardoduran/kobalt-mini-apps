# CLAUDE.md — Kobalt Mini App System
# Contexto persistente para Claude Code · se actualiza con cada sesión

## 0. Cómo leer este archivo

Este archivo es el skill canónico del proyecto.
Antes de escribir una sola línea de código, leer las secciones 1–4 completas.
Antes de paralelizar trabajo con Ruflo, leer la sección 5.
Antes de actualizar este archivo, leer la sección 6.

---

## 1. Arquitectura — tres regímenes, separación absoluta

```
L  (Local)    →  toda la lógica, semántica, ontología, UI
B  (Bridge)   →  traducción entre L y S, determinado por hash_conector
S  (Storage)  →  persistencia pasiva de bytes, sin semántica

L ∘ B(hash) ∘ S

Invariante fundamental:
  S no interpreta payload
  B no define semántica del dominio
  L funciona aunque B y S fallen (offline-first real)
```

### El continuum de puentes

```
B_php_plain:    objeto → JSON → PUT /data/a/id.json
B_r2_plain:     objeto → JSON → PUT R2/a/id.json
B_kobalt_red:   objeto → D_derive → α(opacidad) → PUT /hex.bin

Composición:    B = B₁ ∘ B₂ ∘ B₃   (cada capa reemplazable)
```

### El hash de conector — toda la infraestructura en un valor

```javascript
const CONNECTOR = {
  hash:      'a3f8...',        // identidad determinista de la config
  type:      'php-plain',      // php-plain | r2-plain | kobalt-red | gitlab
  endpoint:  'https://...',
  transform: 'none',           // none | aes-gcm | kobalt-alpha
  priority:   1,
}
// La app L solo ve: B.put(key, obj) / B.get(key) / B.manifest()
// No sabe si detrás hay PHP, R2, Kobalt Red o cualquier otra cosa
```

---

## 2. Álgebra de archivos — estructura invariante

```
/index.html          ←  app completa (L + B mínimo)
/save.php            ←  adaptador S (Fase α — PHP local)
/data/
  manifest.json      ←  Ω remoto  { key → ts }
  auth.json          ←  { hash }  solo si hay auth
  a/[id].json        ←  entidades del dominio (A)
  c/[id].json        ←  conectores organizativos (C)
  b/[id].json        ←  blob metadata (B)
  photos/[id].ext    ←  binarios
```

### Prefijos IDB — un store, keys estructuradas

```
"a:" + id    →  entidades dominio
"c:" + id    →  conectores organizativos
"b:" + id    →  blob metadata
"blob:" + id →  ArrayBuffer binario
"m:omega"    →  Ω local { key → ts }
"m:session"  →  { unlocked, ts }  solo si hay auth
```

---

## 3. Matemática del sistema

### Identidad

```
id(e) = Date.now().toString(36) + '_' + random(4)
ts    = Math.floor(Date.now() / 1000)   // uint32, segundos Unix

id ⊥ payload    →  id no deriva del contenido
id ⊥ posición   →  mover no cambia identidad
```

### Ω — índice de actualidad

```
Ω : Key → Timestamp
Ω vive en IDB["m:omega"]
Ω es la única fuente de verdad de versiones
```

### Sync — diferencia simétrica

```
Δ = { key : M_L[key] ≠ M_R[key] }

∀ key ∈ Δ:
  ts_L > ts_R  →  PUSH
  ts_R > ts_L  →  PULL
  ts_L = ts_R  →  skip

merge = argmax_ts   (last-write-wins, determinista)
sync ≠ repaint      (DOM solo si pulled > 0)
```

### Auth (cuando aplica)

```
hash = SHA-256(APP_NAME + ":" + contraseña)
hash embebido en código como AUTH_HASH
sesión: IDB["m:session"] = { unlocked, ts }  TTL = 8h
σ_auth ⊥ U   (auth no toca ontología)
```

---

## 4. Fases de madurez del conector

```
Fase α  →  PHP local (save.php)          prioridad: funcionar ya
Fase β  →  Storage remoto claro          prioridad: volumen y distribución
Fase γ  →  Kobalt Red (cifrado/opacado)  prioridad: privacidad y robustez
```

### Errores críticos en save.php (Fase α)

```
SAVE_URL = './save.php'    ←  raíz, NO './data/save.php'
DATA_URL = './data'

file_put_contents(..., LOCK_EX)         ←  siempre LOCK_EX
ensureDir($DATA_DIR . '/photos/x')     ←  antes de move_uploaded_file
initDirs() al arrancar PHP             ←  crea /data/ y subdirectorios

Diagnóstico:  GET /save.php?check=1
  → ok: true = todo correcto
  → ok: false = leer campo que sea false
```

---

## 5. Trabajo con Ruflo subagentes — protocolo de paralelización

### Cuándo paralelizar

```
PARALELIZABLE (lanzar subagentes simultáneos):
  →  mini apps distintas (L_i ∩ L_j = ∅)
  →  fases distintas de la misma app (α → β → γ)
  →  dominios distintos (UI / sync / dominio)
  →  tests o validaciones independientes

NO PARALELIZAR:
  →  cuando hay dependencia de datos entre tareas
  →  cuando una tarea depende del resultado de otra
  →  cuando el CLAUDE.md necesita actualizarse (hacerlo secuencial)
```

### Estructura de prompt para subagente

```
CONTEXTO:   leer sección [N] de CLAUDE.md
TAREA:      [descripción exacta y acotada]
ENTRADAS:   [archivos o datos disponibles]
SALIDA:     [qué debe producir exactamente]
INVARIANTES:[qué no puede romper]
NO HACER:   [límites explícitos]
```

### Patrón de orquestación

```
Agente orquestador (Claude Code principal):
  1. Lee CLAUDE.md completo
  2. Descompone el trabajo en tareas independientes
  3. Lanza subagentes con Ruflo para tareas paralelas
  4. Espera resultados
  5. Integra y valida invariantes
  6. Actualiza CLAUDE.md si hay nueva claridad

Subagente (Claude Code via Ruflo):
  1. Lee las secciones indicadas de CLAUDE.md
  2. Ejecuta solo la tarea asignada
  3. No modifica CLAUDE.md
  4. Devuelve resultado + lista de invariantes verificados
```

---

## 6. Protocolo de actualización de este archivo

**Este archivo se actualiza cuando:**
- Se clarifica matemáticamente algo que estaba implícito
- Se resuelve un error que no estaba documentado
- Se agrega un nuevo tipo de conector (Fase β o γ)
- Se descubre un invariante nuevo
- Se define una nueva mini app con ontología distinta

**Este archivo NO se actualiza cuando:**
- Se implementa código que ya estaba especificado aquí
- Se corrige un bug de implementación (va en el código, no aquí)
- Se cambia la UI de una mini app específica

**Formato de actualización:**
```
## CHANGELOG — [fecha]
- [qué se clarificó]
- [qué invariante se añadió]
- [qué error se documentó]
```

---

## 7. Mini apps activas — registro

| App | Fase | Conector | Store IDB | Auth | Estado |
|-----|------|----------|-----------|------|--------|
| Kobalt-Offline-Abril2026 | α | PHP-plain | data_Kobalt-Offline-Abril2026 | SHA-256/BORGES | ✓ funcionando |
| Kobalt-Notas | α | PHP-plain | data_Kobalt-Notas | no | ✓ funcionando |
| Kobalt-Gastos | α | PHP-plain | data_Kobalt-Gastos | no | ✓ funcionando |
| Kobalt-Checklist | α | PHP-plain | data_Kobalt-Checklist | no | ✓ funcionando |
| Kobalt-Visitas | α | PHP-plain | data_Kobalt-Visitas | no | ✓ funcionando |

---

## 8. Invariantes globales — nunca se rompen

```
I1   id ⊥ payload              →  id no deriva del contenido
I2   id ⊥ posición             →  mover no cambia identidad
I3   Ω es fuente de verdad     →  versiones por Ω, no por los objetos
I4   merge = argmax_ts         →  last-write-wins, siempre determinista
I5   sync ≠ repaint            →  DOM solo si pulled > 0
I6   L funciona sin red        →  offline es modo normal, no modo degradado
I7   S no interpreta           →  bytes opacos para el servidor
I8   B determinado por hash    →  un hash describe toda la infraestructura
I9   un store IDB              →  prefijos, nunca multiplicar stores
I10  SAVE_URL ≠ DATA_URL       →  save.php en raíz, /data/ es carpeta
```

---

## 9. Errores conceptuales a evitar

| Error | Por qué está mal |
|-------|-----------------|
| `SAVE_URL = DATA_URL + '/save.php'` | Rompe la separación raíz/datos |
| `id = hash(contenido)` | Viola I1 |
| Lógica de negocio en save.php | Viola `S no interpreta` |
| Repaint tras cada sync | Viola I5 |
| `file_put_contents` sin `LOCK_EX` | Race condition en concurrencia |
| `move_uploaded_file` sin `ensureDir` | Falla silenciosa en fotos |
| Modificar CLAUDE.md desde subagente | Viola protocolo sección 6 |

---

## 10. Comandos frecuentes

```bash
# Calcular hash de contraseña para nueva mini app
echo -n "APP_NAME:CONTRASEÑA" | sha256sum

# Diagnóstico de save.php
curl https://mi-servidor.com/save.php?check=1

# Ver Ω local en DevTools
# Application → IndexedDB → data_[APP_NAME] → kv → m:omega

# Verificar manifest remoto
curl https://mi-servidor.com/data/manifest.json
```

---

## CHANGELOG

### 2026-04-05
- Documento inicial creado desde sesión de clarificación
- Arquitectura L/B/S formalizada
- Hash de conector definido como primitiva de configuración
- Protocolo de subagentes Ruflo establecido
- Invariantes I1–I10 definidos
- Error SAVE_URL/DATA_URL documentado como crítico
- Error ensureDir/photos documentado como crítico

### 2026-04-05 (sesión 2)
- Hub portal /index.html creado (sin IDB, sin sync, solo navegación)
- Hub usa indexedDB.databases() para detectar datos locales por app (punto verde)
- Primera tanda de 4 mini apps producidas en paralelo con subagentes:
  Kobalt-Notas, Kobalt-Gastos, Kobalt-Checklist, Kobalt-Visitas
- Estructura de carpetas: /[app]/index.html + /[app]/save.php + /[app]/data/
- Aislamiento confirmado: IDB store distinto por app, /data/ por carpeta
- blob:* keys excluidas del sync manifest en Visitas (solo binarios locales + upload directo)
- toggleItem en Checklist: flip boolean + actualiza ts, id no cambia (I2 verificado)
