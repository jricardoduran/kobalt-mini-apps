<?php
declare(strict_types=1);
require $argv[1].'/src/Qipu.php';
$q=new QipuDemo($argv[2]);
try{$q->locked(fn()=>$q->decide($argv[3],(int)$argv[4],1,true));}catch(RuntimeException $e){if($e->getMessage()==='Simulated interruption after C'){fwrite(STDERR,"Interrupción simulada C→R\n");exit(77);}throw $e;}
throw new RuntimeException('Expected interruption');
