<?php
declare(strict_types=1);
require __DIR__.'/../servidor/Cooperation.php';
// Deliberately loopback-only. Test endpoint, not a deployable service.
if(PHP_SAPI!=='cli-server'||!in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true)||($_SERVER['REQUEST_METHOD']??'')!=='POST'){http_response_code(403);exit;}
$root=getenv('QIPU_TEST_ROOT');if(!$root||!is_dir($root)){http_response_code(503);exit;}
header('Content-Type: application/json');
$a=new Cooperation(new QipuDemo($root),'Comercio-C');
try{$x=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);$r=match($x[0]){
'register'=>$a->register($x[1]),'submit'=>$a->submit($x[1],$x[2],hex2bin($x[3])),
'decide'=>$a->decide($x[1],$x[2],$x[3],$x[4]??false),'pending'=>$a->pending(),'sync'=>$a->sync($x[1],$x[2]),default=>throw new RuntimeException('Operación desconocida')};
echo json_encode(['ok'=>true,'data'=>$r],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){echo json_encode(['ok'=>false,'message'=>$e->getMessage(),'status'=>$e instanceof StorageError?$e->status:500],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);}
