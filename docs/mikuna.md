# Mikuna — Arquitectura conceptual interna

> Mikuna = "comida" en quechua. El ecosistema que nutre el potencial real.

---

## Filosofía central

El objetivo del sistema **no es maximizar ventas**.
El objetivo es maximizar el bienestar del usuario:

```
max Wᵤ = f(C, I, D, E, R↓)
```

| Variable | Significado       |
|----------|-------------------|
| C        | Capacidad         |
| I        | Ingresos          |
| D        | Decisión          |
| E        | Eficiencia        |
| R↓       | Riesgo (reducir)  |

Sujeto a: presupuesto · tiempo · conocimiento · contexto.

**Propiedad más importante:** `dWᵤ/dt > 0` — el bienestar crece en el tiempo.

---

## Estructura del repositorio

```
kobalt-app/
├── index.html                  ← Hub principal / landing
├── apps/
│   ├── marketplace/index.html  ← Motor de ventas (10% comisión)
│   ├── negocio/index.html      ← Bootstrap prearmado ($10M)
│   ├── curso/index.html        ← Curso IA + Kit Digital ($500K)
│   ├── community/index.html    ← Community Manager IA ($500K/mes)
│   ├── open-claw/index.html    ← Búsqueda IA offline-first
│   ├── mercado/index.html      ← Para compradores (gratis)
│   └── ecosistema/index.html   ← Mapa + diagnóstico de ruta
├── shared/
│   ├── style.css               ← Tokens, componentes, dark/light
│   ├── nav.js                  ← Nav compartido + theme toggle
│   └── theme.js                ← Tokens de color en JS
└── docs/
    └── mikuna.md               ← Este archivo
```

---

## Módulos del ecosistema

### 1. Marketplace Kobalt
- **Rol:** Motor de oferta y demanda
- **Modelo:** Gratis para publicar · 10% comisión por venta real
- **Diferenciador:** Ranking por utilidad del cliente, no por pago
- **Dimensión Wᵤ:** ↑I (ingresos) · ↓R (riesgo)

### 2. Negocio Prearmado
- **Rol:** Bootstrap de negocio completo
- **Precio:** $10M pago único + 10% comisión por venta
- **Incluye:** Inventario $8M · Web con pagos · Imágenes IA · Posts · Tráfico
- **Dimensión Wᵤ:** ↑↑I · ↓↓R

### 3. Curso IA + Kit Digital
- **Rol:** Aumentar capacidad operativa con IA
- **Precio:** $500K pago único · acceso de por vida
- **Incluye:** 6 módulos · Web incluida · Stack de apps · Automatización
- **Dimensión Wᵤ:** ↑C (capacidad) · ↑E (eficiencia)

### 4. Community Manager IA
- **Rol:** Marketing continuo automatizado
- **Precio:** $500K/mes · sin permanencia mínima
- **Incluye:** 30+ posts/mes · Campañas · Publicación automática · Reporte
- **Dimensión Wᵤ:** ↑↑I · ↑E

### 5. Open-Claw
- **Rol:** Motor de búsqueda inteligente del ecosistema
- **Tecnología:** Offline-first · Búsqueda semántica · Sin rastreo
- **Diferenciador:** Ranking por utilidad, no por publicidad pagada
- **Dimensión Wᵤ:** ↑D (decisión) · ↑E

### 6. Mercado
- **Rol:** Interfaz del lado comprador
- **Modelo:** Siempre gratis para compradores
- **Modos:** Maximizar ahorro · Maximizar calidad · Mejor relación
- **Dimensión Wᵤ:** ↑D · ahorro real

### 7. Ecosistema (hub)
- **Rol:** Mapa, diagnóstico de ruta y coordinación entre módulos
- **Funcionalidad clave:** Diagnóstico interactivo que recomienda el punto de entrada correcto según el perfil del usuario

---

## Modelo de negocio

| Nivel     | Costo              | Se activa cuando     |
|-----------|--------------------|----------------------|
| Entrada   | Gratis             | Al registrarse       |
| Por venta | 10% de comisión    | Al cerrar venta      |
| Negocio   | $10M + 10%/venta   | Pago único           |
| Curso     | $500K              | Pago único           |
| Community | $500K/mes          | Suscripción mensual  |

**Principio de alineación:** Solo cobramos cuando el cliente gana.
La comisión es variable y proporcional. No hay cuotas fijas obligatorias para empezar.

---

## Stack técnico

- **HTML puro + CSS + JS vanilla** — sin frameworks, sin bundlers, sin npm
- **Offline-capable** — no hay dependencias de build
- **Geist** (Google Fonts CDN) — única fuente tipográfica
- **localStorage** — persistencia del tema dark/light
- **shared/nav.js** — inyecta el nav en todas las páginas dinámicamente
- **shared/style.css** — sistema de diseño completo con tokens CSS

---

## Sistema de diseño

### Paleta Kobalt
```
--k-pink:   #f72585
--k-violet: #7209b7
--k-blue:   #4361ee
--k-cyan:   #4cc9f0
--k-gold:   #f8b500
```

### Modo dark (default)
```
--bg:    #06040f
--card:  #0d0a1e
```

### Modo light
```
--bg:    #f3f2f9
--card:  #ffffff
```

### Clases clave
- `.kb` / `.kb-in` — borde arcoíris animado
- `.gf .gp .gb .gg .gv` — gradientes de texto
- `.btn-p .btn-s .btn-b .btn-v` — botones
- `.pill` — etiqueta de categoría
- `.card` — tarjeta base con hover
- `.fu .d1-.d4` — animación fadeUp con delay

---

## Rutas de entrada por perfil

| Perfil                         | Módulo recomendado  |
|-------------------------------|---------------------|
| Sin capital, tiene producto    | Marketplace gratis  |
| Con capital, quiere velocidad  | Negocio Prearmado   |
| Quiere aprender IA             | Curso IA + Kit      |
| Ya vende, quiere más clientes  | Community IA        |
| Comprador buscando mejor precio| Mercado Kobalt      |

---

*Última actualización: abril 2026*
