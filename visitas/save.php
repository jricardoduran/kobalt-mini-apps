<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Rutas ─────────────────────────────────────────────────────────────────────
$DATA_DIR = __DIR__ . '/data';

// ── initDirs: crea todos los directorios necesarios ──────────────────────────
function initDirs($dataDir) {
    $dirs = [
        $dataDir,
        $dataDir . '/a',
        $dataDir . '/b',
        $dataDir . '/c',
        $dataDir . '/photos',
    ];
    foreach ($dirs as $d) {
        if (!is_dir($d)) {
            mkdir($d, 0755, true);
        }
    }
}

function ensureDir($path) {
    if (!is_dir($path)) {
        mkdir($path, 0755, true);
    }
}

initDirs($DATA_DIR);

// ── Sanitizar identificadores ─────────────────────────────────────────────────
function sanitizeId($id) {
    return preg_replace('/[^a-z0-9_\-]/i', '', (string)$id);
}

function sanitizeExt($ext) {
    return preg_replace('/[^a-z0-9]/i', '', strtolower((string)$ext));
}

// ── Leer / escribir manifest ──────────────────────────────────────────────────
function readManifest($dataDir) {
    $path = $dataDir . '/manifest.json';
    if (!file_exists($path)) return [];
    $raw = file_get_contents($path);
    if ($raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function writeManifest($dataDir, $manifest) {
    $path = $dataDir . '/manifest.json';
    file_put_contents($path, json_encode($manifest, JSON_PRETTY_PRINT), LOCK_EX);
}

// ── Ruta de una entidad ───────────────────────────────────────────────────────
function entityPath($dataDir, $key) {
    // key formato "a:id", "b:id", "c:id"
    if (!preg_match('/^([abc]):(.+)$/', $key, $m)) return null;
    $prefix = $m[1];
    $id     = sanitizeId($m[2]);
    if ($id === '') return null;
    return $dataDir . '/' . $prefix . '/' . $id . '.json';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // ?check=1 — diagnóstico
    if (isset($_GET['check'])) {
        $photosDir = $DATA_DIR . '/photos';
        echo json_encode([
            'ok'          => true,
            'data_dir'    => is_dir($DATA_DIR)   ? 'ok' : 'missing',
            'photos_dir'  => is_dir($photosDir)  ? 'ok' : 'missing',
            'writable'    => is_writable($DATA_DIR) ? 'yes' : 'no',
            'dirs'        => [
                'a' => is_dir($DATA_DIR . '/a') ? 'ok' : 'missing',
                'b' => is_dir($DATA_DIR . '/b') ? 'ok' : 'missing',
                'c' => is_dir($DATA_DIR . '/c') ? 'ok' : 'missing',
            ]
        ]);
        exit;
    }

    // ?key=manifest
    if (isset($_GET['key']) && $_GET['key'] === 'manifest') {
        echo json_encode(readManifest($DATA_DIR));
        exit;
    }

    // ?key=a:id  |  b:id  |  c:id
    if (isset($_GET['key'])) {
        $key  = $_GET['key'];
        $path = entityPath($DATA_DIR, $key);
        if ($path && file_exists($path)) {
            $raw = file_get_contents($path);
            echo $raw !== false ? $raw : json_encode(null);
        } else {
            http_response_code(404);
            echo json_encode(null);
        }
        exit;
    }

    echo json_encode(['error' => 'unknown request']);
    exit;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // ── Subida de foto (multipart) ─────────────────────────────────────────
    if (isset($_FILES['photo'])) {
        $id  = sanitizeId($_POST['id']  ?? '');
        $ext = sanitizeExt($_POST['ext'] ?? 'jpg');

        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'missing id']);
            exit;
        }

        if ($_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'upload error ' . $_FILES['photo']['error']]);
            exit;
        }

        // Garantizar directorio photos ANTES de move_uploaded_file
        $photosDir = $DATA_DIR . '/photos';
        ensureDir($photosDir);

        $dest = $photosDir . '/' . $id . '.' . $ext;
        if (move_uploaded_file($_FILES['photo']['tmp_name'], $dest)) {
            echo json_encode(['ok' => true, 'id' => $id, 'ext' => $ext]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'move_uploaded_file failed']);
        }
        exit;
    }

    // ── JSON body ─────────────────────────────────────────────────────────
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);

    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid JSON']);
        exit;
    }

    // ── action: push ──────────────────────────────────────────────────────
    if (($body['action'] ?? '') === 'push') {
        $items = $body['items'] ?? [];
        if (!is_array($items)) {
            http_response_code(400);
            echo json_encode(['error' => 'items must be array']);
            exit;
        }

        $manifest = readManifest($DATA_DIR);
        $saved    = 0;
        $errors   = [];

        foreach ($items as $item) {
            $key     = $item['key']     ?? '';
            $payload = $item['payload'] ?? null;
            $ts      = isset($item['ts']) ? (int)$item['ts'] : 0;

            // Validar key: solo a:, b:, c: — NO blob:
            if (!preg_match('/^[abc]:/', $key)) {
                $errors[] = 'skipped key: ' . $key;
                continue;
            }

            $path = entityPath($DATA_DIR, $key);
            if ($path === null) {
                $errors[] = 'invalid key: ' . $key;
                continue;
            }

            // Garantizar directorio padre
            ensureDir(dirname($path));

            // Guardar entidad con LOCK_EX
            $written = file_put_contents(
                $path,
                json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
                LOCK_EX
            );

            if ($written !== false) {
                $manifest[$key] = $ts;
                $saved++;
            } else {
                $errors[] = 'write failed: ' . $key;
            }
        }

        // Actualizar manifest con LOCK_EX
        writeManifest($DATA_DIR, $manifest);

        $resp = ['ok' => true, 'saved' => $saved];
        if (!empty($errors)) $resp['errors'] = $errors;
        echo json_encode($resp);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'unknown action']);
    exit;
}

// ─────────────────────────────────────────────────────────────────────────────
http_response_code(405);
echo json_encode(['error' => 'method not allowed']);
