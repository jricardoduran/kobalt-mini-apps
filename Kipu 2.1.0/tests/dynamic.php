<?php
declare(strict_types=1);
require __DIR__.'/../src/Qipu.php';
$root=sys_get_temp_dir().'/qipu-nodes-'.bin2hex(random_bytes(6));mkdir($root,0700);$q=new QipuDemo($root);$s=new Storage($root);$n=0;
function check($ok,$msg){global $n;if(!$ok)throw new RuntimeException($msg);$n++;echo "PASS $msg\n";}
try{
 check($q->locked(fn()=>$q->nodes())===[],'N inicialmente vacío; ningún nodo preconstituido');
 try{$q->locked(fn()=>$q->register('Bodega',true));throw new LogicException('Expected interruption');}catch(RuntimeException $e){if($e->getMessage()!=='Simulated interruption before N')throw $e;}
 check($q->locked(fn()=>$q->nodes())===[]&&$s->head('QBodega')['end']===0&&$s->head('RBodega')['end']===0,'Interrupción antes de N: archivos vacíos sin nodo visible');
 try{$q->locked(fn()=>$q->cut('QBodega'));throw new LogicException('Expected rejection');}catch(StorageError $e){check($e->status===404,'Archivos huérfanos no son accesibles desde API');}
 $q=new QipuDemo($root);$a=$q->locked(fn()=>$q->register('Bodega'));check($a['index']===0&&!$a['replayed'],'Reintento completa primera constitución');
 $prefix=$s->read('N',0,Storage::MAX)['bytes'];$a=$q->locked(fn()=>$q->register('Bodega'));check($a['replayed']&&$a['index']===0&&$s->read('N',0,Storage::MAX)['bytes']===$prefix,'Registro repetido idempotente');
 $b=$q->locked(fn()=>$q->register('Tienda-2'));check($b['index']===1&&$q->locked(fn()=>$q->nodes())===['Bodega','Tienda-2'],'Segunda localidad deriva posición 1');
 check($s->read('N',0,strlen($prefix))['bytes']===$prefix,'Prefijo N inmutable');
 $q->locked(fn()=>$q->register('C'));$r=QipuDemo::frame(QipuDemo::REQUEST,QipuDemo::json(['op'=>'sale','sku'=>'SKU-A','qty'=>2]));$q->locked(fn()=>$q->submit('C',0,0,$r));$q->locked(fn()=>$q->decide('C',0,1));check($q->locked(fn()=>$q->pending())['nodes']['C']['responses']===1,'Nodo dinámico puede publicar y adquirir resolución');
 try{$q->locked(fn()=>$q->register('../mal'));throw new LogicException('Expected invalid name');}catch(StorageError $e){check($e->status===400,'Identidad insegura rechazada');}
 $s->create('QOrphan');$s->append('QOrphan',0,'x');try{$q->locked(fn()=>$q->register('Orphan'));throw new LogicException('Expected orphan error');}catch(StorageError $e){check($e->status===503&&!in_array('Orphan',$q->locked(fn()=>$q->nodes()),true),'Archivo huérfano no vacío no se adopta');}
 echo "$n/$n pruebas registro dinámico PHP\n";
}finally{foreach(glob($root.'/*') as $f)unlink($f);rmdir($root);}
