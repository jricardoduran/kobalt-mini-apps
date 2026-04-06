<?php
// save.php — Kobalt-Inspeccion

/**
 * save.php — Kobalt-Inspeccion
 *
 * Contrato pasivo del servidor (S ∩ K = ∅):
 *   GET  ?check              ← diagnóstico: verifica permisos y estructura
 *   POST {action:"manifest"} ← guarda Ω remoto completo
 *   POST {action:"put"}      ← guarda entidad individual (a/, b/, c/)
 *
 * Lecturas: los clientes leen directamente /data/manifest.json y /data/a/id.json
 * El servidor solo escribe — nunca interpreta semántica del payload.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$DATA_DIR = __DIR__ . '/data';
$SUBDIRS  = ['c', 'a', 'b'];

function ensureDir($path) {
    $dir = is_dir($path) ? $path : dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
}

function initDirs($base, $subs) {
    if (!is_dir($base)) mkdir($base, 0755, true);
    foreach ($subs as $s) {
        $p = $base . '/' . $s;
        if (!is_dir($p)) mkdir($p, 0755, true);
    }
}

initDirs($DATA_DIR, $SUBDIRS);

function out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ── GET ?check — diagnóstico ──────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    global $DATA_DIR, $SUBDIRS;
    $c = [];
    $c['data_exists']   = is_dir($DATA_DIR);
    $c['data_writable'] = is_writable($DATA_DIR);
    foreach ($SUBDIRS as $s) $c["dir_$s"] = is_dir($DATA_DIR . "/$s");
    $c['manifest'] = file_exists($DATA_DIR . '/manifest.json');

    $t = $DATA_DIR . '/.test';
    $w = @file_put_contents($t, '1') !== false;
    if ($w) @unlink($t);
    $c['write_test'] = $w;

    out(['ok' => $c['data_writable'] && $w, 'checks' => $c,
         'php' => PHP_VERSION, 'data_dir' => $DATA_DIR, 'cwd' => __DIR__]);
}

// ── POST — parsear body ───────────────────────────────────────
$ct     = $_SERVER['CONTENT_TYPE'] ?? '';
$isJson = str_contains($ct, 'application/json');
$input  = $isJson ? (json_decode(file_get_contents('php://input'), true) ?? []) : [];
$action = $input['action'] ?? '';

// ── MANIFEST ─────────────────────────────────────────────────
if ($action === 'manifest') {
    $data = $input['data'] ?? null;
    if (!is_array($data)) out(['error' => 'data must be object'], 400);
    $n = file_put_contents($DATA_DIR . '/manifest.json',
             json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    if ($n === false) out(['error' => 'write failed'], 500);
    out(['ok' => true, 'bytes' => $n]);
}

// ── PUT — entidad individual ──────────────────────────────────
if ($action === 'put') {
    $rp = $input['path'] ?? '';
    if (!preg_match('/^[abc]\/[a-z0-9_\-]+\.json$/i', $rp))
        out(['error' => 'invalid path: ' . $rp], 400);
    $data = $input['data'] ?? null;
    if ($data === null) out(['error' => 'data required'], 400);
    $fp = $DATA_DIR . '/' . $rp;
    ensureDir($fp);
    $n = file_put_contents($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    if ($n === false) out(['error' => 'write failed: ' . $rp], 500);
    out(['ok' => true, 'path' => $rp, 'bytes' => $n]);
}

out(['error' => 'unknown action: ' . $action], 400);
