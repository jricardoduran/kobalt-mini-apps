<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$DATA_DIR = __DIR__ . '/data';

// ── DIR HELPERS ───────────────────────────────────────────────

function ensureDir($path) {
    if (!is_dir($path)) {
        mkdir($path, 0755, true);
    }
}

function initDirs() {
    global $DATA_DIR;
    ensureDir($DATA_DIR);
    ensureDir($DATA_DIR . '/a');
    ensureDir($DATA_DIR . '/b');
    ensureDir($DATA_DIR . '/c');
}

initDirs();

// ── MANIFEST HELPERS ──────────────────────────────────────────

function manifestPath() {
    global $DATA_DIR;
    return $DATA_DIR . '/manifest.json';
}

function readManifest() {
    $path = manifestPath();
    if (!file_exists($path)) return [];
    $raw = file_get_contents($path);
    if ($raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function writeManifest($manifest) {
    $path = manifestPath();
    $json = json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    file_put_contents($path, $json, LOCK_EX);
}

// ── KEY → FILE PATH ───────────────────────────────────────────

function keyToPath($key) {
    global $DATA_DIR;
    // Accepts keys: a:id, b:id, c:id
    if (!preg_match('/^([abc]):(.+)$/', $key, $m)) {
        return null;
    }
    // Sanitise the id segment: only allow alphanum, underscore, hyphen, dot
    $id = preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $m[2]);
    if ($id === '') return null;
    return [
        'path' => $DATA_DIR . '/' . $m[1] . '/' . $id . '.json',
        'dir'  => $DATA_DIR . '/' . $m[1]
    ];
}

// ── REQUEST DISPATCH ──────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];

// ── GET ───────────────────────────────────────────────────────
if ($method === 'GET') {

    // Diagnostic ping
    if (isset($_GET['check'])) {
        echo json_encode([
            'ok'       => true,
            'data_dir' => $DATA_DIR,
            'writable' => is_writable($DATA_DIR),
            'php'      => PHP_VERSION,
        ]);
        exit;
    }

    $key = isset($_GET['key']) ? $_GET['key'] : '';

    if ($key === '') {
        http_response_code(400);
        echo json_encode(['error' => 'missing key']);
        exit;
    }

    // Return manifest as omega object
    if ($key === 'manifest') {
        echo json_encode(readManifest());
        exit;
    }

    // Return entity file
    $info = keyToPath($key);
    if ($info === null) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid key']);
        exit;
    }

    if (!file_exists($info['path'])) {
        http_response_code(404);
        echo json_encode(['error' => 'not found']);
        exit;
    }

    $raw = file_get_contents($info['path']);
    if ($raw === false) {
        http_response_code(500);
        echo json_encode(['error' => 'read error']);
        exit;
    }

    // Return raw JSON content directly (already JSON-encoded)
    header('Content-Type: application/json; charset=utf-8');
    echo $raw;
    exit;
}

// ── POST ──────────────────────────────────────────────────────
if ($method === 'POST') {

    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);

    if (!is_array($body) || !isset($body['action'])) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid body']);
        exit;
    }

    if ($body['action'] === 'push') {

        if (!isset($body['items']) || !is_array($body['items'])) {
            http_response_code(400);
            echo json_encode(['error' => 'missing items']);
            exit;
        }

        $manifest = readManifest();
        $saved    = 0;
        $errors   = [];

        foreach ($body['items'] as $item) {
            if (!isset($item['key']) || !isset($item['payload']) || !isset($item['ts'])) {
                $errors[] = 'incomplete item';
                continue;
            }

            $key = $item['key'];
            $ts  = (int) $item['ts'];

            // Skip if remote is newer (last-write-wins, server side check)
            if (isset($manifest[$key]) && $manifest[$key] > $ts) {
                continue;
            }

            $info = keyToPath($key);
            if ($info === null) {
                $errors[] = 'invalid key: ' . $key;
                continue;
            }

            ensureDir($info['dir']);

            $json = json_encode($item['payload'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            $result = file_put_contents($info['path'], $json, LOCK_EX);

            if ($result === false) {
                $errors[] = 'write error: ' . $key;
                continue;
            }

            $manifest[$key] = $ts;
            $saved++;
        }

        // Persist updated manifest
        if ($saved > 0) {
            writeManifest($manifest);
        }

        echo json_encode([
            'ok'     => true,
            'saved'  => $saved,
            'errors' => $errors,
        ]);
        exit;
    }

    // Unknown action
    http_response_code(400);
    echo json_encode(['error' => 'unknown action: ' . htmlspecialchars($body['action'])]);
    exit;
}

// ── FALLBACK ─────────────────────────────────────────────────
http_response_code(405);
echo json_encode(['error' => 'method not allowed']);
