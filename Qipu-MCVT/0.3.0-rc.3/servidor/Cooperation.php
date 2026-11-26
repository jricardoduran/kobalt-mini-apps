<?php
declare(strict_types=1);
require_once __DIR__.'/Kernel.php';
// Trusted local/CLI adapter; authentication and identity provisioning belong to the host.
final class Cooperation {
    function __construct(private QipuDemo $q,private string $authority){}
    function register(string $node):array{return $this->q->locked(fn()=>$this->q->register($node));}
    function submit(string $node,int $index,string $raw):array{return $this->q->locked(function()use($node,$index,$raw){
        $this->q->stream('Q'.$node);$all=$this->q->cut('Q'.$node);$bytes=$this->q->read('Q'.$node,0,$all['end'])['bytes'];$rs=QipuDemo::scan($bytes);
        QipuDemo::ok($index>=0&&$index<=count($rs),'Request gap',409);
        $offset=$index===count($rs)?strlen($bytes):$rs[$index]['offset'];
        return $this->q->submit($node,$index,$offset,$raw);
    });}
    function decide(string $node,int $i,int $bit,bool $interrupt=false):array{return $this->q->locked(fn()=>$this->q->decide($node,$i,$bit,$interrupt));}
    function pending():array{return $this->q->locked(fn()=>$this->q->pending());}
    function sync(string $node,array $cursors):array{return $this->q->locked(function()use($node,$cursors){
        // Recover C→R recognition first. Read a coherent pair while holding original authority lock.
        $this->q->pending();$out=['authority'=>$this->authority];
        foreach(['C'=>'C','R'=>'R'.$node] as $name=>$stream){
            $x=$cursors[$name]??null;QipuDemo::ok(is_array($x)&&isset($x['offset'],$x['sha256'])&&is_int($x['offset'])&&$x['offset']>=0&&is_string($x['sha256'])&&preg_match('/\A[0-9a-f]{64}\z/',$x['sha256'])===1,'Cursor inválido');
            $old=$this->q->cut($stream,$x['offset']);QipuDemo::ok(hash_equals($old['sha256'],$x['sha256']),'Prefijo incompatible',409);
            $to=$this->q->cut($stream);$suffix=$this->q->read($stream,$x['offset'],$to['end']-$x['offset'])['bytes'];
            QipuDemo::ok(strlen($suffix)===$to['end']-$x['offset'],'Sufijo incompleto',503);
            $out[$name]=['from'=>$x,'to'=>['offset'=>$to['end'],'sha256'=>$to['sha256']],'suffix'=>bin2hex($suffix)];
        }return $out;
    });}
}
