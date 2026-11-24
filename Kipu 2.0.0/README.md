# Qipu 2.0.0 experimental · PAO 1.1

**Especificación completa y laboratorio autónomo: `public/README.html`.** Abrir directamente en un navegador. Incluye diagramas, contratos, flujos y alcance. El código PAO original permanece intacto.

La primera aparición constitutiva de una identidad determina su posición durante el recorrido. T13 (afirmación nombrada) no distingue CREATE de UPDATE. Los contratos referenciales (por ejemplo, T7 venta) no crean identidades inexistentes. Las celdas derivadas son dispersas, y los índices se reconstruyen. T102 constituye hechos privados, T101 proyecta solicitudes; T111 contiene lotes canónicos reconocidos. No compatible con el formato externo anterior T110; no migración automática.

## Arranque (solo laboratorio, sin autenticación)

```sh
mkdir -m 700 data-v2
php -S 127.0.0.1:8080 -t public
```

Abrir http://127.0.0.1:8080/. PHP ≥8.1 de 64 bits, filesystem POSIX local; navegador moderno con IndexedDB/Web Crypto. Mantener data-v2 fuera del document root. No exponer públicamente ni utilizar datos reales. El navegador usa una base IndexedDB nueva `qipu-pao-v2`.

## Pruebas

```sh
bash tests/run.sh
php tests/pao/run.php
```

37/37 HTTP + JS, 4/4 recuperación PHP y 15/15 PAO original (64 procesos). Consultar resultados de navegador por separado. La transferencia de C/R es incremental; PHP aún recorre la historia, IndexedDB guarda bloques completos y los hashes de prefijo se recalculan. Ver límites detallados en README.html.
