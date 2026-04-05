<?php
// ── Kobalt-Checklist · save.php ────────────────────────────────────────────
// SAVE_URL = './save.php'
// DATA_URL = './data'
// Prefijos soportados: 'a' (ítems), 'b' (reservado), 'c' (listas)
// LOCK_EX en todos los file_put_contents

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── DIRECTORIOS ────────────────────────────────────────────────────────────
define('DATA_DIR', __DIR__ . '/data');

function initDirs() {
    $dirs = [
        DATA_DIR,
        DATA_DIR . '/a',
        DATA_DIR . '/b',
        DATA_DIR . '/c',
    ];
    foreach ($dirs as $dir) {
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
    }
}

initDirs();

// ── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Devuelve la ruta de archivo para una clave dada.
 * Claves válidas: 'manifest', 'a:ID', 'b:ID', 'c:ID'
 */
function keyToPath(string $key): ?string {
    if ($key === 'manifest') {
        return DATA_DIR . '/manifest.json';
    }

    if (!preg_match('/^([abc]):([a-z0-9_]+)$/i', $key, $m)) {
        return null;
    }

    $prefix = $m[1];
    $id     = $m[2];

    // Sanitizar id para evitar path traversal
    $id = preg_replace('/[^a-zA-Z0-9_\-]/', '', $id);
    if ($id === '') return null;

    return DATA_DIR . '/' . $prefix . '/' . $id . '.json';
}

/**
 * Escribe un archivo de forma atómica usando LOCK_EX.
 */
function atomicWrite(string $path, string $content): bool {
    $tmp = $path . '.tmp.' . mt_rand(100000, 999999);
    $ok  = file_put_contents($tmp, $content, LOCK_EX);
    if ($ok === false) return false;
    return rename($tmp, $path);
}

/**
 * Lee el manifest actual (array key → ts).
 */
function readManifest(): array {
    $path = DATA_DIR . '/manifest.json';
    if (!file_exists($path)) return [];
    $raw = file_get_contents($path);
    if ($raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Guarda el manifest.
 */
function writeManifest(array $manifest): bool {
    $path = DATA_DIR . '/manifest.json';
    return atomicWrite($path, json_encode($manifest, JSON_UNESCAPED_UNICODE));
}

// ── DIAGNÓSTICO ────────────────────────────────────────────────────────────
if (isset($_GET['check'])) {
    $dirs = [
        'data'   => DATA_DIR,
        'data/a' => DATA_DIR . '/a',
        'data/b' => DATA_DIR . '/b',
        'data/c' => DATA_DIR . '/c',
    ];
    $status = [];
    foreach ($dirs as $label => $path) {
        $status[$label] = [
            'exists'   => is_dir($path),
            'writable' => is_writable($path),
        ];
    }

    $manifest = readManifest();
    echo json_encode([
        'ok'            => true,
        'app'           => 'Kobalt-Checklist',
        'save_url'      => './save.php',
        'data_url'      => './data',
        'dirs'          => $status,
        'manifest_keys' => count($manifest),
        'php'           => PHP_VERSION,
        'ts'            => time(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// ── GET ────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $key = isset($_GET['key']) ? trim($_GET['key']) : '';

    if ($key === '') {
        http_response_code(400);
        echo json_encode(['error' => 'missing key']);
        exit;
    }

    // manifest
    if ($key === 'manifest') {
        $manifest = readManifest();
        echo json_encode($manifest, JSON_UNESCAPED_UNICODE);
        exit;
    }

    // entidad
    $path = keyToPath($key);
    if ($path === null) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid key']);
        exit;
    }

    if (!file_exists($path)) {
        http_response_code(404);
        echo json_encode(['error' => 'not found']);
        exit;
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        http_response_code(500);
        echo json_encode(['error' => 'read error']);
        exit;
    }

    echo $raw;
    exit;
}

// ── POST ───────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    if (!$body) {
        http_response_code(400);
        echo json_encode(['error' => 'empty body']);
        exit;
    }

    $data = json_decode($body, true);
    if (!is_array($data) || !isset($data['action'])) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid json or missing action']);
        exit;
    }

    if ($data['action'] === 'push') {
        if (!isset($data['items']) || !is_array($data['items'])) {
            http_response_code(400);
            echo json_encode(['error' => 'missing items array']);
            exit;
        }

        $manifest = readManifest();
        $saved    = 0;
        $errors   = [];

        foreach ($data['items'] as $item) {
            if (!isset($item['key']) || !isset($item['payload']) || !isset($item['ts'])) {
                $errors[] = 'item missing key/payload/ts';
                continue;
            }

            $key = trim($item['key']);
            $ts  = (int) $item['ts'];

            $path = keyToPath($key);
            if ($path === null) {
                $errors[] = 'invalid key: ' . $key;
                continue;
            }

            // Serializar payload
            $encoded = json_encode($item['payload'], JSON_UNESCAPED_UNICODE);
            if ($encoded === false) {
                $errors[] = 'encode error for key: ' . $key;
                continue;
            }

            if (!atomicWrite($path, $encoded)) {
                $errors[] = 'write error for key: ' . $key;
                continue;
            }

            // Actualizar manifest solo si ts es mayor o igual (PUSH gana si igual)
            $currentTs = isset($manifest[$key]) ? (int)$manifest[$key] : 0;
            if ($ts >= $currentTs) {
                $manifest[$key] = $ts;
            }

            $saved++;
        }

        writeManifest($manifest);

        echo json_encode([
            'ok'     => true,
            'saved'  => $saved,
            'errors' => $errors,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'unknown action: ' . $data['action']]);
    exit;
}

// ── MÉTODO NO SOPORTADO ────────────────────────────────────────────────────
http_response_code(405);
echo json_encode(['error' => 'method not allowed']);
exit;
