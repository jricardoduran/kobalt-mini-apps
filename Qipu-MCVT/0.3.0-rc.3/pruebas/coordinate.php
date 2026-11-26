<?php
declare(strict_types=1);
require __DIR__.'/../servidor/ATMCoordinate.php';
$root=sys_get_temp_dir().'/atmc-'.bin2hex(random_bytes(8));mkdir($root,0700);
$a=new ATMAuthority($root,'C');$x=new ATMCoordinateAuthority($a,'C');$x->init();$rs=json_decode(stream_get_contents(STDIN),true,64,JSON_THROW_ON_ERROR);$out=[];
foreach($rs as $i=>$q){$ok=true;$intent=null;try{$g=new ATMCoordinate($a->state()['state']);$intent=$g->compile($q,'C')['intent'];$x->submit($q,['Test',$i]);}catch(Throwable $e){$ok=false;}
$out[]=['ok'=>$ok,'intent'=>$intent,'geometry'=>$x->read()['data'],'contract'=>$x->contract()['data'],'state'=>$a->state()['state'],'cut'=>$a->state()['records']];}
echo json_encode(['steps'=>$out,'bytes'=>base64_encode(file_get_contents($root.'/C.bin'))],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
