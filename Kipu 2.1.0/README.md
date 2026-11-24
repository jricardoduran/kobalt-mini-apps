# Qipu 2.1.0 experimental · PAO 1.1 intacto

**Especificación autónoma: `public/README.html`.** La documentación completa 2.0.0 se conserva en `referencias/Qipu-2.0.0-README.html`.

N es la trayectoria de identidades de localidad (T112). La primera aparición deriva su posición. La autoridad prepara Q/R vacíos antes de constituir N. Reintento de alta recupera archivos vacíos; una identidad ya constituida no se duplica. El nodo abre su espacio local en IndexedDB sin red y publica Q posteriormente. C/T111 y R/M3E1 conservan sus contratos; PAO no se modifica.

## Ejecutar (sin autenticación, solo localhost)

```sh
mkdir -m 700 data-v21
php -S 127.0.0.1:8080 -t public
```

Abrir http://127.0.0.1:8080/. PHP 8.1+ 64 bits, filesystem POSIX local. Base IndexedDB `qipu-pao-v21`; no migración automática de 2.0.0. No usar datos reales ni exponer la API públicamente.

## Pruebas reproducibles

```sh
bash tests/run.sh
php tests/pao/run.php
php tests/dynamic.php
python tests/avanzadas/run.py
python tests/browser.py
```

400 comprobaciones superadas: 37 HTTP/JS + 4 recuperación + 15 PAO + 10 registro PHP + 2 registro HTTP + 332 avanzadas. Chromium bloqueó localhost por política administrativa: las comprobaciones de IndexedDB/UI siguen pendientes; `browser.py` sale 77 en ese caso. No se ejecutó prueba masiva de registros. Requiere Playwright y un Chromium permitido para la suite de navegador. Véanse resultados.
