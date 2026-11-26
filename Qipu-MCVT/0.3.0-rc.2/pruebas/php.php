<?php
declare(strict_types=1);
require __DIR__.'/../servidor/ATM.php';
if(($argv[1]??'')==='worker'){try{$a=new ATMAuthority($argv[2],'C');$raw=base64_decode(trim(stream_get_contents(STDIN)),true);echo json_encode($a->append($raw));exit(0);}catch(Throwable $e){fwrite(STDERR,$e->getMessage());exit(1);}}
function check(bool $x,string $m):void{if(!$x)throw new RuntimeException($m);echo "PASS $m\n";}
$root=sys_get_temp_dir().'/qipu-atm-'.bin2hex(random_bytes(8));mkdir($root,0700);$a=new ATMAuthority($root,'C');$a->init();
$send=fn($q,$i)=>$a->append($a->prepare($q,['Test',$i]));
$send(['DEF',['Producto'],[['Producto','Nombre','text',['SET'],true],['Producto','Stock','natural',['SET','ADD','SUB'],false]],[]],0);
$send(['SET','Producto','SKU','Nombre','Producto'],1);$send(['SET',0,0,'Stock',10],2);
$raw=$a->prepare(['SUB',0,0,1,1],['Test',3]);$r=$a->append($raw);check(!$r['replayed']&&$a->append($raw)['replayed'],'reenvío exacto');
$jobs=[];for($i=0;$i<15;$i++){$raw=$a->prepare(['SUB',0,0,1,1],['Carga',$i]);$p=proc_open([PHP_BINARY,__FILE__,'worker',$root],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);fwrite($pipes[0],base64_encode($raw));fclose($pipes[0]);$jobs[]=[$p,$pipes];}
$accepted=0;foreach($jobs as [$p,$pipes]){$stdout=stream_get_contents($pipes[1]);$stderr=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);if(proc_close($p)===0)$accepted++;else if(!strlen($stderr))throw new RuntimeException('Worker sin diagnóstico');}
check($accepted===9,'9 admisiones concurrentes');$b=new ATMAuthority($root,'C');check($b->read([0,0,1])['data']===0,'stock y reconstrucción');check($b->read([])['data']['tipos'][0]['parametros'][1]['pos']===1,'metaestructura estable');echo "TOTAL 4/4; datos de prueba: $root\n";
