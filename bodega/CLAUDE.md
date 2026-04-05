# CLAUDE.md — Kobalt Bodega
# Base de conocimiento persistente · actualizada cada sesión
# Generada: 2026-04-05

---

## 0. Cómo leer este archivo

Este archivo es la memoria del proyecto.
Leerlo completo antes de cualquier acción en cada sesión.

---

## 1. Arquitectura

### Propósito
Sistema offline-first de gestión de inventario en bodega con sync bidireccional a servidor PHP.

### Separación de capas
```
UI (HTML + Tailwind/Flowbite)  →  render puro, lee siempre de IDB
LÓGICA (JS vanilla)           →  CRUD sobre IDB, navegación por estado
PERSISTENCIA (IndexedDB)      →  fuente de verdad local
SYNC (fetch + save.php)       →  Δ = Ω_local △ Ω_remoto, LWW
SERVIDOR (save.php)           →  disco tonto, no interpreta payload (S ∩ K = ∅)
CDN CACHE (sw.js)             →  Service Worker cache-first para Tailwind/Flowbite/Fonts

Invariante fundamental:
  El servidor nunca interpreta semántica del payload.
  La UI nunca lee de la red — siempre de IDB.
  Los CDN se descargan 1 vez y se sirven de cache local.
```

### Tecnologías principales
```
Frontend:   HTML + Tailwind CDN + Flowbite CDN (cacheados por SW)
Backend:    save.php (PHP, contrato pasivo)
Storage:    IndexedDB (fuente de verdad local)
Fonts:      JetBrains Mono + IBM Plex Sans (Google Fonts, cacheados)
Deploy:     Cualquier servidor PHP con escritura en ./data/
```

### Estructura de archivos
```
/
├── index.html   ←  app completa (HTML + JS, ~600 líneas)
├── sw.js        ←  Service Worker para cache de CDN
├── save.php     ←  contrato pasivo del servidor
└── data/        ←  generado por save.php
    ├── manifest.json   ←  Ω remoto
    ├── auth.json       ←  hash de contraseña (opcional, para rotación)
    ├── c/              ←  conectores (bodega/estante/nivel)
    ├── a/              ←  artículos
    ├── b/              ←  blob metadata
    └── photos/         ←  binarios de fotos
```

---

## 2. Entidades del dominio

### Conector (C)
```
conector = {
  id:       // string, base36 timestamp + random
  kind:     // 'bodega' | 'estante' | 'nivel'
  nombre:   // string
  members:  // string[], IDs de hijos (conectores o artículos)
  parentId: // string | null
  ts:       // unix timestamp, última modificación
}
IDB key: 'c:' + id
```

### Artículo (A)
```
articulo = {
  id:     // string
  sku:    // string, uppercase, trimmed
  nombre: // string
  ts:     // unix timestamp
}
IDB key: 'a:' + id
```

### Blob meta (B)
```
blob = {
  id:          // string
  articuloId:  // string, referencia al artículo
  mime:        // string
  ext:         // string
  ts:          // unix timestamp
}
IDB key meta: 'b:' + id
IDB key data: 'blob:' + id (ArrayBuffer)
```

### Ω (Omega) — índice de actualidad
```
omega = { [key: string]: number }
// key = 'c:id' | 'a:id' | 'b:id'
// value = ts de última modificación
IDB key: 'm:omega'
```

### Relaciones
```
bodega.members → [estante.id, ...]
estante.members → [nivel.id, ...]
nivel.members → [articulo.id, ...]
blob.articuloId → articulo.id

DAG estricto: bodega → estante → nivel → artículo → blob
Invariante: un miembro pertenece a exactamente un padre
```

---

## 3. Invariantes

```
I1   S∩K=∅           →  El servidor no interpreta payload, solo persiste
I2   UI←IDB          →  La UI siempre renderiza desde IDB, nunca desde red
I3   LWW             →  Resolución de conflictos: last-write-wins via ts
I4   Ω-completo      →  Todo cambio actualiza Ω (índice de actualidad)
I5   DAG-estricto    →  La jerarquía es un árbol: cada nodo tiene 0 o 1 padre
I6   SKU-uppercase   →  Los SKU se normalizan a mayúsculas
I7   CDN-cache-first →  Los recursos CDN se sirven de SW cache tras primera carga
I8   Auth-offline    →  La autenticación funciona sin red (hash embebido)
```

---

## 4. Contrato save.php (canónico)

```
GET  ?check              → diagnóstico completo con write_test
POST {action:"manifest"} → guarda Ω remoto como manifest.json (LOCK_EX)
POST {action:"put"}      → guarda entidad en a/|b/|c/ (LOCK_EX, path validado)
POST {action:"photo"}    → guarda binario en photos/ (move_uploaded_file)

Lecturas: cliente fetch directo a /data/manifest.json y /data/a/id.json
El servidor nunca sirve entidades — solo las escribe.
```

---

## 5. Registro de estado

### Completado ✓
- Migración de CSS custom a Tailwind CDN + Flowbite CDN
- Service Worker para cache local de CDN
- Lightbox de fotos con navegación (flechas, teclado)
- Toda la lógica JS preservada (IDB, sync, auth, CRUD)
- Lock screen, header, breadcrumb, cards, detail, modal, toast migrados

### Pendiente ○
- Búsqueda/filtro de artículos por SKU o nombre
- Edición inline de artículos (nombre, SKU)
- Eliminación de entidades
- Drag-and-drop para reordenar
- Tabla/grid alternativa para vista de artículos
- Precios, cantidades, categorías (campos adicionales)
- Export/import de datos

---

## CHANGELOG

### 2026-04-05 — Migración a Flowbite + Tailwind CDN
- CSS custom (~600 líneas) eliminado, reemplazado por clases Tailwind
- Flowbite CDN añadido para componentes interactivos
- Service Worker (sw.js) creado para cache-first de CDN
- Lightbox de fotos añadido con navegación por teclado
- Lógica JS 100% preservada sin modificaciones funcionales
