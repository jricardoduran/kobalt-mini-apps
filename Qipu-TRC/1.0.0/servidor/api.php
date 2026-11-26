<?php
declare(strict_types=1);
require_once __DIR__.'/TRCStore.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
try{
 TRC::need($_SERVER['REQUEST_METHOD']==='POST','Solo POST');
 TRC::need(str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'),'Content-Type application/json requerido');
 $token=getenv('QIPU_TRC_TOKEN');$remote=$_SERVER['REMOTE_ADDR']??'';
 if($token!==false&&$token!==''){if(!hash_equals($token,$_SERVER['HTTP_X_QIPU_TOKEN']??'')){http_response_code(401);throw new RuntimeException('Token requerido');}}
 else{if(!in_array($remote,['127.0.0.1','::1'],true)){http_response_code(403);throw new RuntimeException('Solo localhost sin token');}}
 $raw=file_get_contents('php://input',false,null,0,2097153);TRC::need($raw!==false&&strlen($raw)<=2097152,'Solicitud demasiado extensa');$q=TRC::parse($raw);TRC::need($q instanceof stdClass,'Solicitud requerida');
 // Prevent untrusted raw submit on HTTP. All writes use stable origins.
 TRC::need(in_array($q->op??'', ['write','transaction','read','history','export','cut'],true),'Operación HTTP no admitida');
 $dir=getenv('QIPU_TRC_DATA');TRC::need(is_string($dir)&&$dir!=='','Configurar QIPU_TRC_DATA fuera del directorio público');
 $r=(new TRCStore($dir))->run($q);echo TRC::json(['ok'=>true]+$r);
}catch(Throwable $e){if(http_response_code()<400)http_response_code(400);echo TRC::json(['ok'=>false,'error'=>$e->getMessage()]);}
