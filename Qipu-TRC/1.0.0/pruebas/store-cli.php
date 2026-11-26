<?php
declare(strict_types=1);
require_once __DIR__.'/../servidor/TRCStore.php';
try{$q=TRC::parse(stream_get_contents(STDIN));$r=(new TRCStore($argv[1]))->run($q);echo TRC::json(['ok'=>true]+$r);}
catch(Throwable $e){echo TRC::json(['ok'=>false,'error'=>$e->getMessage()]);exit(1);}
