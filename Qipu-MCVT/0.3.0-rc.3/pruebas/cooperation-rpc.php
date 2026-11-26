<?php
declare(strict_types=1);
require __DIR__.'/../servidor/Cooperation.php';
$root=$argv[1]??'';if(!is_dir($root))throw new RuntimeException('Directorio de pruebas requerido');
$a=new Cooperation(new QipuDemo($root),'Comercio-C');
try{$x=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);$r=match($x[0]){
 'register'=>$a->register($x[1]),
 'submit'=>$a->submit($x[1],$x[2],hex2bin($x[3])),
 'decide'=>$a->decide($x[1],$x[2],$x[3],$x[4]??false),
 'pending'=>$a->pending(),
 'sync'=>$a->sync($x[1],$x[2]),
 default=>throw new RuntimeException('Operación desconocida')};echo json_encode(['ok'=>true,'data'=>$r],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){echo json_encode(['ok'=>false,'message'=>$e->getMessage(),'status'=>$e instanceof StorageError?$e->status:500],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);}
