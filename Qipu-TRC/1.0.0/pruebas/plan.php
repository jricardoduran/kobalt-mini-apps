<?php
declare(strict_types=1);
require_once __DIR__.'/../servidor/QipuTRC.php';
$raw='';
while(($line=fgets(STDIN))!==false){
 try{$x=TRC::parse($line);TRC::need($x instanceof stdClass,'Solicitud');$p=TRCWorld::plan(isset($x->raw)?TRC::unhex($x->raw):$raw,$x->q);if(!isset($x->raw))$raw.=$p['suffix'];echo TRC::json(['ok'=>true,'result'=>$p['result'],'cut'=>$p['cut'],'suffix'=>bin2hex($p['suffix'])])."\n";}
 catch(Throwable $e){echo TRC::json(['ok'=>false,'error'=>$e->getMessage()])."\n";}
}
