<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── DIRS ─────────────────────────────────────────────────────────────────────
function initDirs(): void {
    $base = __DIR__ . '/data';
    foreach ([$base, "$base/a", "$base/b", "$base/c"] as $dir) {
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
    }
}

initDirs();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function jsonOut(mixed $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function manifestPath(): string {
    return __DIR__ . '/data/manifest.json';
}

function readManifest(): array {
    $path = manifestPath();
    if (!file_exists($path)) return [];
    $raw = file_get_contents($path);
    if ($raw === false) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function writeManifest(array $manifest): void {
    $path = manifestPath();
    $json = json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    file_put_contents($path, $json, LOCK_EX);
}

/**
 * Parse key like "a:someId" or "b:someId" into [prefix, id].
 * Returns null if key is invalid.
 */
function parseKey(string $key): ?array {
    if (preg_match('/^([abc]):(.+)$/', $key, $m)) {
        return ['prefix' => $m[1], 'id' => $m[2]];
    }
    return null;
}

function entityPath(string $prefix, string $id): string {
    // Sanitize id: keep only safe characters
    $safeId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $id);
    if ($safeId === '' || $safeId !== $id) return '';
    return __DIR__ . "/data/{$prefix}/{$safeId}.json";
}

// ─── GET ──────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // Diagnostic
    if (isset($_GET['check'])) {
        $checks = [
            'data_dir'     => is_dir(__DIR__ . '/data'),
            'data_a_dir'   => is_dir(__DIR__ . '/data/a'),
            'data_b_dir'   => is_dir(__DIR__ . '/data/b'),
            'data_c_dir'   => is_dir(__DIR__ . '/data/c'),
            'data_writable'=> is_writable(__DIR__ . '/data'),
            'php_version'  => PHP_VERSION,
        ];
        jsonOut(['ok' => !in_array(false, $checks, true), 'checks' => $checks]);
    }

    $key = $_GET['key'] ?? '';

    if ($key === '') {
        jsonOut(['error' => 'Missing key'], 400);
    }

    // Manifest
    if ($key === 'manifest') {
        jsonOut(readManifest());
    }

    // Entity
    $parts = parseKey($key);
    if ($parts === null) {
        jsonOut(['error' => 'Invalid key format'], 400);
    }

    $path = entityPath($parts['prefix'], $parts['id']);
    if ($path === '') {
        jsonOut(['error' => 'Invalid id'], 400);
    }

    if (!file_exists($path)) {
        jsonOut(['error' => 'Not found'], 404);
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        jsonOut(['error' => 'Read error'], 500);
    }

    $data = json_decode($raw, true);
    jsonOut($data ?? []);
}

// ─── POST ─────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    if ($body === false || $body === '') {
        jsonOut(['error' => 'Empty body'], 400);
    }

    $req = json_decode($body, true);
    if (!is_array($req)) {
        jsonOut(['error' => 'Invalid JSON'], 400);
    }

    $action = $req['action'] ?? '';

    if ($action === 'push') {
        $items = $req['items'] ?? [];
        if (!is_array($items) || count($items) === 0) {
            jsonOut(['error' => 'No items'], 400);
        }

        $manifest = readManifest();
        $saved    = 0;
        $errors   = [];

        foreach ($items as $item) {
            $key     = $item['key']     ?? '';
            $payload = $item['payload'] ?? null;
            $ts      = $item['ts']      ?? 0;

            if ($key === '' || $payload === null) {
                $errors[] = "Invalid item: missing key or payload";
                continue;
            }

            $parts = parseKey($key);
            if ($parts === null) {
                $errors[] = "Invalid key format: $key";
                continue;
            }

            $path = entityPath($parts['prefix'], $parts['id']);
            if ($path === '') {
                $errors[] = "Invalid id in key: $key";
                continue;
            }

            $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
            $written = file_put_contents($path, $json, LOCK_EX);

            if ($written === false) {
                $errors[] = "Write failed for key: $key";
                continue;
            }

            $manifest[$key] = (int)$ts;
            $saved++;
        }

        if ($saved > 0) {
            writeManifest($manifest);
        }

        $response = ['ok' => true, 'saved' => $saved];
        if (!empty($errors)) {
            $response['errors'] = $errors;
        }
        jsonOut($response);
    }

    jsonOut(['error' => 'Unknown action'], 400);
}

// ─── FALLBACK ─────────────────────────────────────────────────────────────────
jsonOut(['error' => 'Method not allowed'], 405);
