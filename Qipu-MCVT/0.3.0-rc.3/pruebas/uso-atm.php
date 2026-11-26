<?php
declare(strict_types=1);
require __DIR__.'/../servidor/ATM.php';
$root=sys_get_temp_dir().'/qipu-uso-'.bin2hex(random_bytes(8));mkdir($root,0700);
$a=new ATMAuthority($root,'C');$a->init();
$qs=json_decode(file_get_contents(__DIR__.'/uso-atm.json'),true,32,JSON_THROW_ON_ERROR);
$out=[];
foreach($qs as $i=>$q){$ok=true;try{$a->append($a->prepare($q,['Uso',$i]));}catch(Throwable $e){$ok=false;}
$out[]=['ok'=>$ok,'meta'=>$a->read([])['data'],'state'=>$a->state()['state'],'cut'=>$a->state()['records']];}
echo json_encode(['steps'=>$out,'bytes'=>base64_encode(file_get_contents($root.'/C.bin'))],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
