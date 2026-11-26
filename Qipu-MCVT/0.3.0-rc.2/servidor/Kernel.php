<?php
declare(strict_types=1);
final class Kernel {
    const VERSION='10.2.5-experimental', PROFILE='KOB10/1', EMIT=0, EXPAND=1, FOLLOW=2, TRAJECTORY=3, MAX=1048576;
    static function need(bool $x,string $m='Invalid material'):void {
        if(!$x)throw new InvalidArgumentException($m);
    }

    static function u32(int $n):string {
        self::need($n>=0&&$n<=0xffffffff,'uint32');
        return pack('N',$n);
    }

    static function u64(int $n):string {
        self::need($n>=0&&$n<=9007199254740991,'uint64');
        return pack('J',$n);
    }

    static function frame(string ...$a):string {
        $out=self::u32(count($a));
        foreach($a as $b)$out.=self::u64(strlen($b)).$b;
        return $out;
    }

    static function unframe(string $b):array {
        self::need(strlen($b)>=4,'Frame truncado');
        $n=unpack('N',$b)[1];
        $p=4;
        $a=[];
        self::need($n<=intdiv(strlen($b)-4,8),'Contador inválido');
        for($i=0; $i<$n; $i++) {
            self::need($p+8<=strlen($b),'Frame truncado');
            $k=unpack('J',substr($b,$p,8))[1];
            $p+=8;
            self::need($k>=0&&$k<=strlen($b)-$p,'Átomo truncado');
            $a[]=substr($b,$p,$k);
            $p+=$k;
        }
        self::need($p===strlen($b),'Bytes sobrantes');
        return $a;
    }

    static function clear():array {
        return ['kind'=>'Clear'];
    }

    static function keyed(string $k):array {
        self::need(strlen($k)===32,'Clave inválida');
        return ['kind'=>'Keyed','key'=>$k];
    }

    static function view(array $v):void {
        self::need(($v['kind']??null)==='Clear'||(($v['kind']??null)==='Keyed'&&is_string($v['key']??null)&&strlen($v['key'])===32),'View inválida');
    }

    static function derive(array $v,string $tag,string ...$a):string {
        self::view($v);
        $b=self::frame(self::PROFILE,$v['kind'],$tag,...$a);
        return $v['kind']==='Clear'?hash('sha256',$b,true):hash_hmac('sha256',$b,$v['key'],true);
    }

    static function identity(array $v,string ...$a):string {
        return self::derive($v,'identity',...$a);
    }

    static function contentId(array $v,string $b):string {
        return self::derive($v,'content',$b);
    }

    static function cell(int $op,string $r):array {
        self::need($op>=0&&$op<4&&strlen($r)===32,'Cell inválida');
        return ['op'=>$op,'ref'=>$r];
    }

    static function encode(array $c):string {
        self::cell($c['op'],$c['ref']);
        return self::u32($c['op']).$c['ref'];
    }

    static function decode(string $b):array {
        self::need(strlen($b)===36,'Cell debe tener 36 bytes');
        return self::cell(unpack('N',$b)[1],substr($b,4));
    }

    static function vector(array $cs):string {
        return implode('',array_map(self::encode(...),$cs));
    }

    static function cells(string $b):array {
        self::need(strlen($b)%36===0,'CellVector inválido');
        return $b===''?[]:array_map(self::decode(...),str_split($b,36));
    }

    static function name(array $v,array $c):string {
        return self::derive($v,'name',self::encode($c));
    }

    static function prefix(string $a,string $b):bool {
        return str_starts_with($b,$a);
    }

    static function commonPrefix(string $a,string $b):string {
        $i=0;
        $n=min(strlen($a),strlen($b));
        while($i<$n&&$a[$i]===$b[$i])$i++;
        return substr($a,0,$i);
    }

    static function k2Encode(int $n,int $w=4):string {
        self::need($n>=0&&$n<=9007199254740991&&$w>=1&&$w<=8,'K2P dominio');
        $b=decbin($n);
        $k=strlen($b);
        self::need($k<=2**$w,'K2P ancho');
        return str_pad(decbin($k-1),$w,'0',STR_PAD_LEFT).$b;
    }

    static function k2Read(string $bits,int &$p,int $w=4):int {
        self::need($w>=1&&$w<=8&&$p>=0&&$p+$w<=strlen($bits),'K2P truncado');
        $head=substr($bits,$p,$w);
        self::need(strspn($head,'01')===$w,'K2P bits');
        $k=bindec($head)+1;
        $p+=$w;
        self::need($k<=53&&$p+$k<=strlen($bits),'K2P truncado');
        $b=substr($bits,$p,$k);
        self::need(strspn($b,'01')===$k&&($k===1||$b[0]==='1'),'K2P no canónico');
        $p+=$k;
        return (int)bindec($b);
    }

    static function k2Text(string $s):string {
        self::need(preg_match('//u',$s)===1,'UTF-8 inválido');
        $b=self::k2Encode(strlen($s),6);
        foreach(str_split($s) as $c)$b.=str_pad(decbin(ord($c)),8,'0',STR_PAD_LEFT);
        return $b;
    }

    static function k2ReadText(string $bits,int &$p):string {
        $n=self::k2Read($bits,$p,6);
        self::need($n<=intdiv(strlen($bits)-$p,8),'Texto truncado');
        $s='';
        for($i=0; $i<$n; $i++) {
            $b=substr($bits,$p,8);
            self::need(strspn($b,'01')===8,'Bits inválidos');
            $s.=chr(bindec($b));
            $p+=8;
        }
        self::need(preg_match('//u',$s)===1,'UTF-8 inválido');
        return $s;
    }

    static function k2Pack(string $bits):string {
        self::need(strspn($bits,'01')===strlen($bits),'Bits inválidos');
        $out='';
        foreach(str_split($bits,8) as $b)$out.=chr(bindec(str_pad($b,8,'0')));
        return $out;
    }

    static function k2Bits(string $b):string {
        $out='';
        foreach(str_split($b) as $x)$out.=str_pad(decbin(ord($x)),8,'0',STR_PAD_LEFT);
        return $out;
    }

    static function k2Finish(string $bits,int $p):void {
        $tail=substr($bits,$p);
        self::need($p>=0&&$p<=strlen($bits)&&strlen($tail)<8&&strspn($tail,'0')===strlen($tail),'Padding no canónico');
    }

    static function width(int $n):int {
        self::need($n>=0&&$n<=self::MAX,'Longitud fuera de límite');
        return $n<=255?1:($n<=65535?2:3);
    }

    static function k4Seal(string $b,string $prefix='',string $domain='QIPU-K4B-1'):string {
        $k=self::width(strlen($b));
        $p=$prefix.chr($k-1).substr(pack('N',strlen($b)),4-$k).$b;
        return $p.hash('sha256',$domain."\0".$p,true);
    }

    static function k4Read(string $b,int $o=0,int $prefixSize=0,string $domain='QIPU-K4B-1'):array {
        $p=$o+$prefixSize;
        self::need($o>=0&&$prefixSize>=0&&$p<strlen($b),'Encabezado truncado');
        $k=ord($b[$p++])+1;
        self::need($k<=4&&$p+$k<=strlen($b),'Ancho inválido');
        $n=unpack('N',str_pad(substr($b,$p,$k),4,"\0",STR_PAD_LEFT))[1];
        $p+=$k;
        self::need(self::width($n)===$k,'Longitud no canónica');
        $end=$p+$n;
        $stop=$end+32;
        self::need($stop<=strlen($b),'Registro truncado');
        $h=hash('sha256',$domain."\0".substr($b,$o,$end-$o),true);
        self::need(hash_equals($h,substr($b,$end,32)),'Hash no coincide');
        return ['prefix'=>substr($b,$o,$prefixSize),'body'=>substr($b,$p,$n),'end'=>$stop,'hash'=>$h];
    }

    static function k5Seal(int $t,string $b):string {
        self::need($t>=0&&$t<=65535,'Tratamiento inválido');
        return self::k4Seal($b,pack('n',$t),'QIPU-K5B-1');
    }

    static function k5Read(string $b,int $p=0):array {
        $r=self::k4Read($b,$p,2,'QIPU-K5B-1');
        $r['t']=unpack('n',$r['prefix'])[1];
        return $r;
    }

    static function scan(string $b):array {
        $out=[];
        $p=0;
        while($p<strlen($b)) {
            $r=self::k5Read($b,$p);
            $out[]=['position'=>count($out),'offset'=>$p,'end'=>$r['end'],'t'=>$r['t'],'body'=>$r['body'],'hash'=>$r['hash'],'raw'=>substr($b,$p,$r['end']-$p)];
            $p=$r['end'];
        }
        return $out;
    }

    static function validate(array $v,array $c,string $b):void {
        self::encode($c);
        if($c['op']<2)self::need(hash_equals(self::contentId($v,$b),$c['ref']),'ContentId no coincide');
        if(in_array($c['op'],[1,2],true))self::cells($b);
        if($c['op']===3)self::scan($b);
    }

    static function header(array $v):string {
        self::view($v);
        return 'KOB10'.chr(1).chr($v['kind']==='Keyed'?1:0);
    }

    static function seal(array $v,array $c,string $b):array {
        self::validate($v,$c,$b);
        $h=self::header($v);
        $p=self::encode($c).$b;
        if($v['kind']==='Clear')$env=$h.$p.self::derive($v,'envelope-commit',$h,$p);
        else {
            $n=random_bytes(12);
            $ct=openssl_encrypt($p,'aes-256-gcm',self::derive($v,'envelope-key'),OPENSSL_RAW_DATA,$n,$tag,$h,16);
            self::need($ct!==false,'Cifrado falló');
            $env=$h.$n.$ct.$tag;
        }
        return ['name'=>bin2hex(self::name($v,$c)),'envelope'=>$env];
    }

    static function open(array $v,array $c,string $env):string {
        $h=self::header($v);
        self::need(str_starts_with($env,$h),'Vista incompatible');
        if($v['kind']==='Clear') {
            self::need(strlen($env)>=75,'Sobre truncado');
            $p=substr($env,7,-32);
            self::need(hash_equals(self::derive($v,'envelope-commit',$h,$p),substr($env,-32)),'Compromiso inválido');
        }else {
            self::need(strlen($env)>=71,'Sobre truncado');
            $p=openssl_decrypt(substr($env,19,-16),'aes-256-gcm',self::derive($v,'envelope-key'),OPENSSL_RAW_DATA,substr($env,7,12),substr($env,-16),$h);
            self::need($p!==false,'Autenticación inválida');
        }
        self::need(substr($p,0,36)===self::encode($c),'Otra Cell');
        $b=substr($p,36);
        self::validate($v,$c,$b);
        return $b;
    }

    static function recognize(array $v,array $c,array $candidates):array {
        $a=[];
        $r=[];
        foreach($candidates as $i=>$x) {
            try {
                $a[]=['index'=>$i,'body'=>self::open($v,$c,$x)];
            }catch(Throwable $e) {
                $r[]=['index'=>$i,'error'=>$e->getMessage()];
            }
        }
        return ['accepted'=>$a,'rejected'=>$r];
    }

    static function resolve(array $v,array $c,array $candidates):array {
        if(!$candidates)return ['kind'=>'NO_EVIDENCE'];
        $ev=self::recognize($v,$c,$candidates);
        $a=array_column($ev['accepted'],'body');
        if(!$a)return ['kind'=>'UNRECOGNIZED','evidence'=>$ev];
        if($c['op']<2) {
            foreach($a as $x)self::need($x===$a[0],'EXACT_DIVERGENCE');
            return ['kind'=>'EXACT','body'=>$a[0],'evidence'=>$ev];
        }
        $max=$a[0];
        foreach($a as $x)if(strlen($x)>strlen($max))$max=$x;
        foreach($a as $x)if(!self::prefix($x,$max)) {
            $p=array_reduce($a,self::commonPrefix(...),$a[0]);
            $n=0;
            if($c['op']===2)$n=strlen($p)-strlen($p)%36;
            else foreach(self::scan($a[0]) as $r)if($r['end']<=strlen($p))$n=$r['end'];
            return ['kind'=>'FORK','commonPrefix'=>substr($p,0,$n),'candidates'=>$a,'evidence'=>$ev];
        }
        return ['kind'=>$max===''?'EMPTY':'CHAIN','body'=>$max,'evidence'=>$ev];
    }

    static function explore(array $v,array $root,callable $query,int $maxDepth=64,int $maxSteps=10000):array {
        $stack=[[$root,1,[]]];
        $trace=[];
        $leaves=[];
        $cache=[];
        $complete=true;
        while($stack) {
            [$c,$depth,$anc]=array_pop($stack);
            $k=bin2hex(self::encode($c));
            $e=['cell'=>$c,'op'=>['EMIT','EXPAND','FOLLOW','TRAJECTORY'][$c['op']],'depth'=>$depth,'selected'=>[],'cells'=>[]];
            if(count($trace)>=$maxSteps||$depth>$maxDepth) {
                $e['status']='LIMIT';
                $trace[]=$e;
                $complete=false;
                break;
            }
            if(in_array($k,$anc,true)) {
                $e['status']='CYCLE';
                $trace[]=$e;
                $complete=false;
                continue;
            }try {
                $r=$cache[$k]??=self::resolve($v,$c,$query(bin2hex(self::name($v,$c))));
                $e['status']=$r['kind'];
                if(!in_array($r['kind'],['EXACT','CHAIN','EMPTY'],true))$complete=false;
                else {
                    $e['body']=$r['body'];
                    if($c['op']===0||$c['op']===3) {
                        if($c['op']===3)$e['records']=self::scan($r['body']);
                        $leaves[]=$e;
                    }else {
                        $e['cells']=self::cells($r['body']);
                        $n=count($e['cells']);
                        if($c['op']===2&&$n===0) {
                            $e['status']='NO_CURRENT';
                            $complete=false;
                        }else {
                            $e['selected']=$c['op']===2?[$n-1]:array_keys($e['cells']);
                            foreach(array_reverse($e['selected']) as $i)$stack[]=[$e['cells'][$i],$depth+1,[...$anc,$k]];
                        }
                    }
                }
            }catch(Throwable $x) {
                $e['status']='ERROR';
                $e['error']=$x->getMessage();
                $complete=false;
            }
            $trace[]=$e;
        }
        return ['trace'=>$trace,'leaves'=>$leaves,'complete'=>$complete&&!$stack];
    }

    static function cut(array $v,array $c,string $b,int $n):array {
        self::need($c['op']===3,'TRAJECTORY requerida');
        $rs=self::scan($b);
        self::need($n>=0&&$n<=count($rs),'Corte fuera de rango');
        $body=substr($b,0,$n?$rs[$n-1]['end']:0);
        return ['body'=>$body,'count'=>$n,'commitment'=>self::derive($v,'trajectory-cut',self::encode($c),self::u64($n),$body),'cell'=>self::cell(0,self::contentId($v,$body))];
    }

    static function recognizeBase(array $v,array $c,string $base,string $expected):RecognizedTrajectory {
        return RecognizedTrajectory::recognize($v,$c,$base,$expected);
    }
    static function spliceRecognized(RecognizedTrajectory $base,string $suffix,?string $target=null):array {
        return $base->splice($suffix,$target);
    }
    static function splice(array $v,array $c,string $base,string $suffix,string $expected,?string $target=null):array {
        $r=self::recognizeBase($v,$c,$base,$expected)->splice($suffix,$target);
        unset($r['base']); return $r;
    }

    static function paths(int $d,string $p=''):array {
        self::need($d>=1&&$d<=12,'Profundidad 1..12');
        return [$p.'E',$p.'T',...($d>1?[...self::paths($d-1,$p.'F'),...self::paths($d-1,$p.'X')]:[])];
    }

    static function publish(object $s,array $v,array $c,string $b):array {
        $e=self::seal($v,$c,$b);
        $s->put($e['name'],$e['envelope']);
        return $c;
    }

    static function publishExact(object $s,array $v,int $op,string $b):array {
        self::need($op===0||$op===1,'Operador exacto requerido');
        return self::publish($s,$v,self::cell($op,self::contentId($v,$b)),$b);
    }

    static function vectorName(array $v,array $trajectory,int $t,int $p):array {
        return self::cell(2,self::identity($v,'derived-vector/1',$trajectory['ref'],self::u32($t),self::u32($p)));
    }
}

// In-process structural witness, bound to exact bytes, View and Cell; not authority authentication.
final class RecognizedTrajectory {
    private function __construct(private readonly array $v,private readonly array $c,private readonly string $body,private readonly int $count) {}
    public function __serialize():array { throw new LogicException('Base reconocida no serializable'); }
    public function __unserialize(array $data):void { throw new LogicException('Base reconocida no deserializable'); }
    static function recognize(array $v,array $c,string $base,string $expected):self {
        Kernel::need($c['op']===3,'TRAJECTORY requerida');
        // Normalize the context to owned scalar values (even if caller passed PHP references).
        Kernel::view($v);$v=$v['kind']==='Clear'?Kernel::clear():Kernel::keyed($v['key']);
        $c=Kernel::cell($c['op'],$c['ref']);
        $n=count(Kernel::scan($base));
        $commit=Kernel::derive($v,'trajectory-cut',Kernel::encode($c),Kernel::u64($n),$base);
        Kernel::need(hash_equals($commit,$expected),'Corte base incompatible');
        return new self($v,$c,$base,$n);
    }
    function splice(string $suffix,?string $target=null):array {
        $n=$this->count+count(Kernel::scan($suffix));$body=$this->body.$suffix;
        $commit=Kernel::derive($this->v,'trajectory-cut',Kernel::encode($this->c),Kernel::u64($n),$body);
        if($target!==null)Kernel::need(hash_equals($commit,$target),'Corte destino incompatible');
        $cut=['body'=>$body,'count'=>$n,'commitment'=>$commit,'cell'=>Kernel::cell(0,Kernel::contentId($this->v,$body))];
        return ['body'=>$body,'cut'=>$cut,'base'=>new self($this->v,$this->c,$body,$n)];
    }
}


final class MemorySource {
    private array $m=[];
    function put(string $n,string $b):void {
        if(!in_array($b,$this->m[$n]??[],true))$this->m[$n][]=$b;
    }

    function query(string $n):array {
        return $this->m[$n]??[];
    }

    function size():int {
        return count($this->m);
    }
}

final class FileSource {
    function __construct(private readonly string $root) {
        Kernel::need(is_dir($root)&&is_writable($root),'Source no disponible');
    }

    private function directory(string $n):string {
        Kernel::need(preg_match('/\A[0-9a-f]{64}\z/D',$n)===1,'Nombre inválido');
        return $this->root.'/'.$n;
    }

    function put(string $n,string $b):void {
        $dir=$this->directory($n);
        if(!is_dir($dir)&&!@mkdir($dir,0700)&&!is_dir($dir))throw new RuntimeException('No se creó directorio');
        $path=$dir.'/'.hash('sha256',$b).'.bin';
        if(is_file($path)) {
            Kernel::need(file_get_contents($path)===$b,'Colisión de candidato');
            return;
        }
        $tmp=tempnam($dir,'candidate-');
        if($tmp===false)throw new RuntimeException('Sin temporal');
        try {
            Kernel::need(file_put_contents($tmp,$b)===strlen($b),'Escritura incompleta');
            if(!@link($tmp,$path))Kernel::need(is_file($path)&&file_get_contents($path)===$b,'No se publicó candidato');
        }finally {
            @unlink($tmp);
        }
    }

    function query(string $n):array {
        $out=[];
        foreach(glob($this->directory($n).'/*.bin')?:[] as $f) {
            $b=file_get_contents($f);
            if($b===false)throw new RuntimeException('Lectura incompleta');
            $out[]=$b;
        }
        return $out;
    }
}

final class StorageError extends RuntimeException {
    public function __construct(public readonly int $status, string $message) {
        parent::__construct($message);
    }
}

final class Storage {
    public const MAX = 8388608;
    public function __construct(private readonly string $root, private readonly bool $strict = true) {
        if (PHP_INT_SIZE !== 8 || !is_dir($root) || !is_writable($root)) throw new StorageError(503,'Storage unavailable');
    }

    private function path(string $id): string {
        if (!preg_match('/\A[a-zA-Z0-9_-]{1,80}\z/D', $id)) throw new StorageError(400,'Invalid id');
        return $this->root.'/'.$id;
    }

    private function sync($f): void {
        if (!fflush($f) || !fsync($f)) throw new StorageError(503,'Durability uncertain');
    }

    private function dirSync(): void {
        $f = @fopen($this->root,'r');
        if (!$f) {
            if ($this->strict) throw new StorageError(503,'Directory sync unavailable');
            return;
        } try {
            if (!@fsync($f) && $this->strict) throw new StorageError(503,'Directory sync unavailable');
        } finally {
            fclose($f);
        }
    }

    private function write($f,string $b): void {
        $n=strlen($b);
        $i=0;
        while ($i<$n) {
            $w=fwrite($f,substr($b,$i,min(65536,$n-$i)));
            if (!$w) throw new StorageError(503,'Incomplete write');
            $i+=$w;
        }
    }

    private function readAt($f,int $o,int $n): string {
        if (fseek($f,$o)!==0) throw new StorageError(503,'Seek failed');
        $b='';
        while(strlen($b)<$n) {
            $x=fread($f,min(65536,$n-strlen($b)));
            if ($x===false || $x==='') throw new StorageError(503,'Incomplete read');
            $b.=$x;
        } return $b;
    }

    private function size($f): int {
        $s=fstat($f);
        if ($s===false) throw new StorageError(503,'Stat failed');
        return $s['size'];
    }

    private function locked(string $id, callable $fn): mixed {
        $p=$this->path($id);
        $f=@fopen($p.'.bin','rb');
        if (!$f) throw new StorageError(404,'Unknown trajectory');
        try {
            if (!flock($f,LOCK_EX)) throw new StorageError(503,'Lock unavailable');
            return $fn($f,$p);
        } finally {
            fclose($f);
        }
    }

    public function create(string $id): array {
        $p=$this->path($id);
        $f=@fopen($p.'.bin','x+b');
        if (!$f) throw new StorageError(409,'Already exists or cannot create');
        try {
            if (!flock($f,LOCK_EX)) throw new StorageError(503,'Lock unavailable');
            $this->sync($f);
            $this->dirSync();
        } finally {
            fclose($f);
        } return ['offset'=>0];
    }

    private function pending(string $p,int $o,string $b): void {
        $h='PAO1'.pack('J',$o).pack('N',strlen($b));
        $tmp=$p.'.tmp';
        $f=@fopen($tmp,'wb');
        if (!$f) throw new StorageError(503,'Cannot stage');
        try {
            $this->write($f,$h.hash('sha256',$h.$b,true).$b);
            $this->sync($f);
        } finally {
            fclose($f);
        } if (!rename($tmp,$p.'.pending')) throw new StorageError(503,'Cannot publish intent');
        $this->dirSync();
    }

    private function recover($f,string $p): void {
        clearstatcache(true,$p.'.pending');
        if (!file_exists($p.'.pending')) return;
        $q=@fopen($p.'.pending','rb');
        if (!$q) throw new StorageError(503,'Cannot read intent');
        try {
            $size=$this->size($q);
            if ($size<49 || $size>48+self::MAX) throw new StorageError(503,'Invalid intent length');
            $h=$this->readAt($q,0,16);
            $u=unpack('Joffset/Nlength',substr($h,4));
            $o=$u['offset'];
            $n=$u['length'];
            if (substr($h,0,4)!=='PAO1'||$o<0||$n<1||$n>self::MAX||$size!==48+$n||$o>PHP_INT_MAX-$n) throw new StorageError(503,'Invalid intent');
            $digest=$this->readAt($q,16,32);
            $b=$this->readAt($q,48,$n);
            if (!hash_equals($digest,hash('sha256',$h.$b,true))) throw new StorageError(503,'Intent checksum mismatch');
        } finally {
            fclose($q);
        } $end=$this->size($f);
        if ($end<$o||$end>$o+$n) throw new StorageError(503,'Physical length conflicts with intent');
        $k=$end-$o;
        if ($k && !hash_equals(substr($b,0,$k),$this->readAt($f,$o,$k))) throw new StorageError(503,'Physical prefix conflicts with intent');
        $this->dirSync();
        $a=@fopen($p.'.bin','ab');
        if (!$a) throw new StorageError(503,'Cannot open append stream');
        try {
            if ($k<$n) $this->write($a,substr($b,$k));
            $this->sync($a);
        } finally {
            fclose($a);
        } if (!unlink($p.'.pending')) throw new StorageError(503,'Cannot clear intent');
        $this->dirSync();
    }

    public function head(string $id): array {
        return $this->locked($id,function($f,$p) {
            $this->recover($f,$p); return ['end'=>$this->size($f)];
        });
    }

    public function append(string $id,int $offset,string $b): array {
        $n=strlen($b);
        if ($offset<0||$n<1||$n>self::MAX||$offset>PHP_INT_MAX-$n) throw new StorageError(400,'Invalid offset or payload');
        return $this->locked($id,function($f,$p)use($offset,$b,$n) {
            $this->recover($f,$p); $end=$this->size($f); if ($offset<$end && $offset+$n<=$end && hash_equals($b,$this->readAt($f,$offset,$n))) return ['offset'=>$offset,'length'=>$n,'end'=>$end,'replayed'=>true]; if ($offset!==$end) throw new StorageError(409,'Offset conflict; current end '.$end); $this->pending($p,$offset,$b); $this->recover($f,$p); return ['offset'=>$offset,'length'=>$n,'end'=>$offset+$n,'replayed'=>false];
        });
    }

    public function read(string $id,int $offset,int $length): array {
        if ($offset<0||$length<0||$length>self::MAX) throw new StorageError(400,'Invalid range');
        return $this->locked($id,function($f,$p)use($offset,$length) {
            $this->recover($f,$p); $end=$this->size($f); if ($offset>$end) throw new StorageError(416,'Beyond end'); $n=min($length,$end-$offset); flock($f,LOCK_UN); return ['end'=>$end,'bytes'=>$this->readAt($f,$offset,$n)];
        });
    }
}

final class Motor {
    static function zero():array {
        return ['types'=>[],'fields'=>[],'actions'=>[],'tables'=>[],'history'=>[]];
    }

    static function ok(bool $b,string $m='Contrato inválido'):void {
        if(!$b)throw new StorageError(422,$m);
    }

    static function keys(array $x,array $k):void {
        $a=array_keys($x);
        sort($a);
        sort($k);
        self::ok($a===$k,'Campos inválidos');
    }

    static function name(mixed $x):string {
        self::ok(is_string($x)&&preg_match('/\A[A-Za-z][A-Za-z0-9_-]{0,63}\z/',$x)===1,'Nombre contractual inválido');
        return $x;
    }

    static function text(mixed $x):string {
        self::ok(is_string($x)&&strlen($x)>0&&strlen($x)<=200&&preg_match('//u',$x)===1&&!str_starts_with($x,"\xEF\xBB\xBF"),'Texto inválido');
        return $x;
    }

    static function listOf(mixed $x,int $min=0,int $max=256):array {
        self::ok(is_array($x)&&array_is_list($x)&&count($x)>=$min&&count($x)<=$max,'Lista inválida');
        return $x;
    }

    static function nat(mixed $x):int {
        self::ok(is_int($x)&&$x>=0&&$x<=1000000000,'Natural fuera de perfil');
        return $x;
    }

    static function domain(mixed $x):void {
        self::ok(in_array($x,['text','natural','boolean'],true),'Dominio inválido');
    }

    static function value(string $d,mixed $x):void {
        match($d) {
            'text'=>self::text($x),'natural'=>self::nat($x),'boolean'=>self::ok(is_bool($x),'Booleano requerido'),default=>throw new StorageError(422,'Dominio desconocido')
        };
    }

    static function find(array $a,string $name,?string $table=null):?int {
        foreach($a as $i=>$x)if($x['name']===$name&&($table===null||$x['table']===$table))return $i;
        return null;
    }

    static function field(array $d,string $t,string $p):array {
        $i=self::find($d['fields'],$p,$t);
        self::ok($i!==null,'Parámetro no admitido');
        return $d['fields'][$i];
    }

    static function type(array $d,string $t):void {
        self::ok(in_array($t,$d['types'],true),'Tipo no admitido');
    }

    static function operation(mixed $x):void {
        self::ok(in_array($x,['SET','ADD','SUB'],true),'Tratamiento no admitido');
    }

    static function scalar(mixed $x):void {
        self::ok(is_bool($x)||is_string($x)||is_int($x),'Escalar requerido');
        if(is_string($x))self::text($x);
        if(is_int($x))self::nat($x);
    }

    static function request(array $e):array {
        switch($e['op']??null) {
            case 'contract': self::keys($e,['op','types','fields','actions']);
            foreach(self::listOf($e['types']) as $t)self::name($t);
            foreach(self::listOf($e['fields']) as $f) {
                self::ok(is_array($f));
                self::keys($f,['table','name','domain','allow','constitutive']);
                self::name($f['table']);
                self::name($f['name']);
                self::domain($f['domain']);
                self::ok(is_bool($f['constitutive']));
                $a=self::listOf($f['allow'],1,3);
                foreach($a as $op) {
                    self::operation($op);
                    self::ok($op==='SET'||$f['domain']==='natural','Diferencial solo natural');
                }
                self::ok(count(array_unique($a))===count($a),'Operaciones repetidas');
                self::ok(!$f['constitutive']||in_array('SET',$a,true),'Constitución exige SET');
            } foreach(self::listOf($e['actions']) as $a) {
                self::ok(is_array($a));
                self::keys($a,['name','table','inputs','effects','measure']);
                self::name($a['name']);
                self::name($a['table']);
                $names=[];
                foreach(self::listOf($a['inputs'],1,32) as $f) {
                    self::ok(is_array($f));
                    self::keys($f,['name','domain','positive']);
                    self::name($f['name']);
                    self::domain($f['domain']);
                    self::ok(is_bool($f['positive'])&&(!$f['positive']||$f['domain']==='natural'),'Positivo solo natural');
                    self::ok(!in_array($f['name'],$names,true),'Entrada repetida');
                    $names[]=$f['name'];
                }
                foreach(self::listOf($a['effects'],1,32) as $f) {
                    self::ok(is_array($f));
                    self::keys($f,['parameter','operation','input']);
                    self::name($f['parameter']);
                    self::operation($f['operation']);
                    self::name($f['input']);
                    self::ok(in_array($f['input'],$names,true),'Entrada desconocida');
                }
                $m=self::listOf($a['measure'],0,2);
                self::ok(count($m)===0||count($m)===2,'Medida: dos entradas o ninguna');
                foreach($m as $x) {
                    self::name($x);
                    self::ok(in_array($x,$names,true),'Medida desconocida');
                }
            } self::ok(count($e['types'])+count($e['fields'])+count($e['actions'])>0,'Contrato vacío');
            break;
            case 'identity':self::keys($e,['op','table','identity']);
            self::name($e['table']);
            self::text($e['identity']);
            break;
            case 'assert':self::keys($e,['op','table','identity','parameter','operation','value']);
            self::name($e['table']);
            self::text($e['identity']);
            self::name($e['parameter']);
            self::operation($e['operation']);
            self::scalar($e['value']);
            break;
            case 'action':self::keys($e,['op','name','rows']);
            self::name($e['name']);
            foreach(self::listOf($e['rows'],1,1000) as $r) {
                self::ok(is_array($r));
                self::keys($r,['identity','values']);
                self::text($r['identity']);
                foreach(self::listOf($r['values'],1,32) as $v)self::scalar($v);
            }break;
            default: self::ok(false,'Operación desconocida');
        }
        return $e;
    }

    static function addDefinition(array &$list,array $x,?string $table=null):void {
        $i=self::find($list,$x['name'],$table);
        if($i!==null) {
            self::ok(self::eq($list[$i],$x),'Definición inmutable: use otra identidad/version');
            return;
        }
        $list[]=$x;
    }

    static function contract(array &$d,array $e):void {
        foreach($e['types'] as $t)if(!in_array($t,$d['types'],true))$d['types'][]=$t;
        foreach($e['fields'] as $f) {
            self::type($d,$f['table']);
            self::addDefinition($d['fields'],$f,$f['table']);
        } foreach($e['actions'] as $a) {
            self::type($d,$a['table']);
            foreach($a['effects'] as $ef) {
                $f=self::field($d,$a['table'],$ef['parameter']);
                $inp=$a['inputs'][self::find($a['inputs'],$ef['input'])];
                self::ok($inp['domain']===$f['domain']&&in_array($ef['operation'],$f['allow'],true),'Efecto incompatible con campo');
            }
            foreach($a['measure'] as $n)self::ok($a['inputs'][self::find($a['inputs'],$n)]['domain']==='natural','Medida exige naturales');
            self::addDefinition($d['actions'],$a);
        }
    }

    static function eq(mixed $a,mixed $b):bool {
        if(gettype($a)!==gettype($b))return false;
        if(!is_array($a))return $a===$b;
        if(count($a)!==count($b)||array_is_list($a)!==array_is_list($b))return false;
        foreach($a as $k=>$x)if(!array_key_exists($k,$b)||!self::eq($x,$b[$k]))return false;
        return true;
    }

    static function empty():array {
        return [];
    }

    static function key(mixed ...$p):string {
        return json_encode($p,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_LINE_TERMINATORS);
    }

    static function get(array $s,mixed ...$p):mixed {
        return $s[self::key(...$p)]??null;
    }

    static function plan(array $base,array $e):array {
        self::request($e);
        $changes=[];
        $get=function(...$p)use(&$changes,$base) {
            $k=self::key(...$p);
            return array_key_exists($k,$changes)?$changes[$k]:($base[$k]??null);
        };
        $put=function(array $p,mixed $x)use(&$changes,$get) {
            if(!self::eq($get(...$p),$x))$changes[self::key(...$p)]=$x;
        };
        $schema=$get('schema')??['types'=>[],'fields'=>[],'actions'=>[]];
        $identity=function(string $t,string $id,bool $create)use($get,$put,$schema) {
            self::type($schema,$t);
            $ti=$get('tableName',$t);
            if($ti===null) {
                self::ok($create,'Tabla no constituida');
                $ti=$get('tableCount')??0;
                self::ok($ti<65536,'Capacidad tabla');
                $put(['tableCount'],$ti+1);
                $put(['tableName',$t],$ti);
                $put(['table',$ti],['name'=>$t,'entities'=>0,'vectors'=>0]);
            }
            $tab=$get('table',$ti);
            $i=$get('entityName',$ti,$id);
            if($i===null) {
                self::ok($create,'Identidad no constituida');
                $i=$tab['entities'];
                self::ok($i<65536,'Capacidad entidad');
                $put(['entityName',$ti,$id],$i);
                $put(['entity',$ti,$i],$id);
                $tab['entities']=$i+1;
                $put(['table',$ti],$tab);
            }
            return [$ti,$i];
        };
        $change=function(string $t,string $id,string $p,string $op,mixed $x,bool $create)use($schema,$identity,$get,$put) {
            $f=self::field($schema,$t,$p);
            self::ok(in_array($op,$f['allow'],true),'Operación no permitida');
            self::value($f['domain'],$x);
            [$ti,$i]=$identity($t,$id,$create&&$f['constitutive']&&$op==='SET');
            $vi=$get('vectorName',$ti,$p);
            if($vi===null) {
                self::ok($op==='SET','Vector no constituido');
                $tab=$get('table',$ti);
                $vi=$tab['vectors'];
                self::ok($vi<65536,'Capacidad vector');
                $put(['vectorName',$ti,$p],$vi);
                $put(['vector',$ti,$vi],['name'=>$p,'domain'=>$f['domain']]);
                $tab['vectors']=$vi+1;
                $put(['table',$ti],$tab);
            }
            $k=['cell',$ti,$vi,$i];
            if($op!=='SET') {
                $old=$get(...$k);
                self::ok($old!==null,'Valor aún ausente');
                $x=$old+($op==='ADD'?$x:-$x);
                self::value($f['domain'],$x);
            }
            $put($k,$x);
        };
        switch($e['op']) {
            case 'contract':$d=$schema;
            self::contract($d,$e);
            $put(['schema'],$d);
            break;
            case 'identity':$identity($e['table'],$e['identity'],true);
            break;
            case 'assert':$change($e['table'],$e['identity'],$e['parameter'],$e['operation'],$e['value'],true);
            break;
            case 'action':$ai=self::find($schema['actions'],$e['name']);
            self::ok($ai!==null,'Contrato de acción desconocido');
            $a=$schema['actions'][$ai];
            $sum=0;
            foreach($e['rows'] as $r) {
                self::ok(count($r['values'])===count($a['inputs']),'Aridad incorrecta');
                $identity($a['table'],$r['identity'],false);
                foreach($a['inputs'] as $j=>$f) {
                    self::value($f['domain'],$r['values'][$j]);
                    self::ok(!$f['positive']||$r['values'][$j]>0,'Entrada positiva requerida');
                }
                foreach($a['effects'] as $ef)$change($a['table'],$r['identity'],$ef['parameter'],$ef['operation'],$r['values'][self::find($a['inputs'],$ef['input'])],false);
                if($a['measure']) {
                    $sum+=$r['values'][self::find($a['inputs'],$a['measure'][0])]*$r['values'][self::find($a['inputs'],$a['measure'][1])];
                    self::ok(is_int($sum)&&$sum<=9007199254740991,'Medida fuera de entero seguro');
                }
            }
            $n=$get('historyCount')??0;
            $put(['history',$n],['name'=>$e['name'],'rows'=>$e['rows'],'measure'=>$a['measure']?$sum:null]);
            $put(['historyCount'],$n+1);
            break;
        }
        return array_filter($changes,fn($v,$k)=>!self::eq($base[$k]??null,$v),ARRAY_FILTER_USE_BOTH);
    }

    static function commit(array &$base,array $delta):void {
        foreach($delta as $k=>$v)$base[$k]=$v;
    }

    static function applyOwned(array &$base,array $e):void {
        self::commit($base,self::plan($base,$e));
    }

    static function snapshot(array $base):array {
        $get=fn(...$k)=>self::get($base,...$k);
        $s=$get('schema')??['types'=>[],'fields'=>[],'actions'=>[]];
        $s['tables']=[];
        $s['history']=[];
        for($t=0; $t<($get('tableCount')??0); $t++) {
            $m=$get('table',$t);
            $tab=['name'=>$m['name'],'entities'=>[],'vectors'=>[]];
            for($i=0; $i<$m['entities']; $i++)$tab['entities'][]=$get('entity',$t,$i);
            for($v=0; $v<$m['vectors']; $v++) {
                $vec=$get('vector',$t,$v);
                $values=[];
                for($i=0; $i<$m['entities']; $i++) {
                    $x=$get('cell',$t,$v,$i);
                    if($x!==null)$values[$i]=$x;
                }
                $vec['values']=(object)$values;
                $tab['vectors'][]=$vec;
            }
            $s['tables'][]=$tab;
        }
        for($i=0; $i<($get('historyCount')??0); $i++)$s['history'][]=$get('history',$i);
        return $s;
    }

    static function project(array $s,int $t,int $i):array {
        $tab=self::get($s,'table',$t);
        $id=self::get($s,'entity',$t,$i);
        self::ok($tab!==null&&$id!==null,'Posición inexistente');
        $a=[];
        for($v=0; $v<$tab['vectors']; $v++) {
            $x=self::get($s,'cell',$t,$v,$i);
            if($x!==null)$a[self::get($s,'vector',$t,$v)['name']]=$x;
        }
        return ['identity'=>$id,'parameters'=>(object)$a];
    }
}

final class QipuDemo {
    const CAP=4194304, MAXBODY=1048576, NOTE=100, REQUEST=101, CANON=120;
    const NODE=112;
    static function validNode(mixed $j):bool {
        return is_string($j)&&preg_match('/\A[A-Za-z][A-Za-z0-9_-]{0,31}\z/',$j)===1;
    }

    private Storage $s;
    function __construct(private string $root) {
        $this->s=new Storage($root);
    }

    static function ok(bool $v,string $m='Invalid record',int $status=422):void {
        if(!$v)throw new StorageError($status,$m);
    }

    static function json(mixed $x):string {
        return json_encode($x,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_LINE_TERMINATORS);
    }

    static function frame(int $t,string $body):string {
        return Kernel::k5Seal($t,$body);
    }

    static function scan(string $b):array {
        try {
            return Kernel::scan($b);
        }catch(InvalidArgumentException $e) {
            throw new StorageError(422,$e->getMessage());
        }
    }

    static function obj(string $b):array {
        $shape=json_decode($b,false,32,JSON_THROW_ON_ERROR);
        self::ok($shape instanceof stdClass&&self::json($shape)===$b,'Canonical compact JSON required');
        $walk=function($v)use(&$walk) {
            if($v instanceof stdClass) {
                self::ok(count(get_object_vars($v))>0,'Empty object not allowed');
                foreach($v as $k=>$x) {
                    self::ok(is_string($k)&&!preg_match('/\A[0-9]+\z/',$k),'Numeric object key');
                    $walk($x);
                }
            }elseif(is_array($v)) {
                foreach($v as $x)$walk($x);
            }
        };
        $walk($shape);
        $x=json_decode($b,true,32,JSON_THROW_ON_ERROR);
        self::ok(is_array($x)&&!array_is_list($x),'Object required');
        return $x;
    }

    static function keys(array $a,array $k):void {
        $actual=array_keys($a);
        sort($actual);
        sort($k);
        self::ok($actual===$k,'Invalid fields');
    }

    static function num(mixed $x,int $max=1000000000):int {
        self::ok(is_int($x)&&$x>=0&&$x<=$max,'Natural out of demo range');
        return $x;
    }

    static function txt(mixed $s,int $max=200):string {
        self::ok(is_string($s)&&strlen($s)>0&&strlen($s)<=$max&&preg_match('//u',$s)===1&&!str_starts_with($s,"\xEF\xBB\xBF"),'Invalid text');
        return $s;
    }

    static function request(array $e):array {
        return Motor::request($e);
    }

    static function genesis():array {
        return ['op'=>'genesis','profile'=>'QIPU-META-1'];
    }

    static function resolve(array $d,array $e):array {
        Motor::plan($d,$e);
        return $e;
    }

    static function view(array $d):array {
        return Motor::snapshot($d);
    }

    static function canonical(?array $origin,array $event):string {
        return self::frame(self::CANON,self::json(['origin'=>$origin,'event'=>$event]));
    }

    static function intent(array $r):array {
        self::ok($r['t']===self::CANON,'Invalid canonical type');
        $x=self::obj($r['body']);
        self::keys($x,['origin','event']);
        self::ok(is_array($x['event']),'Missing event');
        if($x['origin']===null) {
            self::ok(Motor::eq($x['event'],self::genesis()),'Invalid genesis');
            return ['event'=>$x['event'],'key'=>null];
        }
        $o=$x['origin'];
        self::ok(is_array($o),'Missing origin');
        self::keys($o,['node','index']);
        self::ok(self::validNode($o['node']),'Invalid origin');
        self::num($o['index']);
        return ['event'=>$x['event'],'key'=>$o['node'].':'.$o['index']];
    }

    static function zero():array {
        return ['state'=>Motor::empty(),'origins'=>[],'records'=>0,'end'=>0,'genesisLength'=>0];
    }

    static function planRecord(array $s,array $r):array {
        $p=self::intent($r);
        if($s['records']===0) {
            self::ok($p['key']===null,'Invalid genesis');
            return $p+['delta'=>[]];
        }
        self::ok($p['key']!==null,'Genesis already constituted');
        self::ok(!isset($s['origins'][$p['key']]),'Duplicate recognition');
        return $p+['delta'=>Motor::plan($s['state'],$p['event'])];
    }

    static function advance(array &$s,array $r):void {
        $p=self::planRecord($s,$r);
        Motor::commit($s['state'],$p['delta']);
        $length=strlen($r['raw']);
        if($p['key']===null)$s['genesisLength']=$length;
        else $s['origins'][$p['key']]=['record'=>$s['records'],'ops'=>$p['event'],'offset'=>$s['end'],'length'=>$length];
        $s['records']++;
        $s['end']+=$length;
    }

    static function replay(string $b):array {
        $s=self::zero();
        foreach(self::scan($b) as $r)self::advance($s,$r);
        return $s;
    }

    static function decisionByte(int $i,int $bit):string {
        self::ok($i>=0&&in_array($bit,[0,1],true),'Decisión inválida');
        return chr(128*$bit+$i%128);
    }

    private function ensureEmpty(string $id):void {
        try {
            $n=$this->s->head($id)['end'];
        }catch(StorageError $e) {
            if($e->status!==404)throw $e;
            $this->s->create($id);
            $n=0;
        }
        self::ok($n===0,'Unregistered stream is not empty',503);
    }

    private function init():void {
        foreach(['N','C'] as $id) {
            try {
                $this->s->head($id);
            }catch(StorageError $e) {
                if($e->status!==404)throw $e;
                $this->s->create($id);
            }
        }
        if($this->s->head('C')['end']===0)$this->s->append('C',0,self::canonical(null,self::genesis()));
    }

    function nodes():array {
        $out=[];
        $seen=[];
        foreach(self::scan($this->all('N')) as $r) {
            self::ok($r['t']===self::NODE,'Invalid registry frame');
            $x=self::obj($r['body']);
            self::keys($x,['node']);
            $j=$x['node'];
            self::ok(self::validNode($j)&&!isset($seen[$j]),'Invalid or repeated registered node');
            $seen[$j]=true;
            $out[]=$j;
        }
        return $out;
    }

    function register(string $j,bool $interrupt=false):array {
        self::ok(self::validNode($j),'Invalid node identity',400);
        $nodes=$this->nodes();
        $i=array_search($j,$nodes,true);
        if($i!==false) {
            $this->s->head('Q'.$j);
            $this->s->head('R'.$j);
            return ['node'=>$j,'index'=>$i,'replayed'=>true];
        } $this->ensureEmpty('Q'.$j);
        $this->ensureEmpty('R'.$j);
        if($interrupt)throw new RuntimeException('Simulated interruption before N');
        $this->write('N',$this->s->head('N')['end'],self::frame(self::NODE,self::json(['node'=>$j])));
        return ['node'=>$j,'index'=>count($nodes),'replayed'=>false];
    }

    private function known(string $j):bool {
        return self::validNode($j)&&in_array($j,$this->nodes(),true);
    }

    function locked(callable $f):mixed {
        $l=fopen($this->root.'/authority.lock','c+b');
        if(!$l)throw new StorageError(503,'Authority lock unavailable');
        try {
            self::ok(flock($l,LOCK_EX),'Authority lock unavailable',503);
            $this->init();
            return $f();
        }finally {
            fclose($l);
        }
    }

    private function all(string $id):string {
        $n=$this->s->head($id)['end'];
        self::ok($n<=self::CAP,'Demo stream limit reached',503);
        return $this->s->read($id,0,$n)['bytes'];
    }

    private function write(string $id,int $o,string $b):array {
        self::ok($o+strlen($b)<=self::CAP,'Demo stream limit',413);
        return $this->s->append($id,$o,$b);
    }

    function stream(string $s):string {
        self::ok(in_array($s,['C','N'],true)||((str_starts_with($s,'Q')||str_starts_with($s,'R'))&&$this->known(substr($s,1))),'Unknown stream',404);
        return $s;
    }

    function cut(string $id,?int $o=null):array {
        $b=$this->all($this->stream($id));
        $n=strlen($b);
        $o??=$n;
        self::ok($o>=0&&$o<=$n,'Beyond end',416);
        return ['end'=>$n,'offset'=>$o,'sha256'=>hash('sha256',substr($b,0,$o))];
    }

    function read(string $id,int $o,int $n):array {
        return $this->s->read($this->stream($id),$o,min($n,self::CAP));
    }

    function submit(string $node,int $index,int $o,string $raw):array {
        self::replay($this->all('C'));
        self::ok($this->known($node),'Invalid node',400);
        $r=self::scan($raw);
        self::ok(count($r)===1&&$r[0]['t']===self::REQUEST,'One request frame required');
        self::request(self::obj($r[0]['body']));
        $q=$this->all('Q'.$node);
        $rs=self::scan($q);
        $n=count($rs);
        self::ok($index<=$n,'Request gap',409);
        $expected=$index===$n?strlen($q):$rs[$index]['offset'];
        self::ok($o===$expected,'Request offset mismatch',409);
        if($index<$n)self::ok($rs[$index]['raw']===$raw,'Request conflict',409);
        return $this->write('Q'.$node,$o,$raw);
    }

    private function snapshot(bool $recover=true):array {
        $c=self::replay($this->all('C'));
        $q=[];
        $r=[];
        foreach($this->nodes() as $j) {
            $q[$j]=self::scan($this->all('Q'.$j));
            foreach($q[$j] as &$rec) {
                self::ok($rec['t']===self::REQUEST,'Invalid Q type');
                $rec['request']=self::request(self::obj($rec['body']));
            }unset($rec);
            $r[$j]=$this->all('R'.$j);
            self::ok(strlen($r[$j])<=count($q[$j]),'Response ahead of requests');
            for($i=0; $i<strlen($r[$j]); $i++) {
                $b=ord($r[$j][$i]);
                self::ok(($b%128)===$i%128,'Response marker mismatch');
                self::ok(($b>=128)===isset($c['origins'][$j.':'.$i]),'Recognition mismatch');
            }
        } foreach($c['origins'] as $key=>$origin) {
            [$j,$i]=explode(':',$key);
            $i=(int)$i;
            self::ok(isset($q[$j][$i]),'Origin without request');
            self::ok($q[$j][$i]['request']===$origin['ops'],'Canonical effect differs from request');
            if($i>=strlen($r[$j])) {
                self::ok($i===strlen($r[$j]),'Recognition gap');
                if($recover) {
                    $b=self::decisionByte($i,1);
                    $this->write('R'.$j,$i,$b);
                    $r[$j].=$b;
                }
            }
        }
        return ['c'=>$c,'q'=>$q,'r'=>$r];
    }

    function pending():array {
        $z=$this->snapshot();
        $out=[];
        foreach($this->nodes() as $j) {
            $i=strlen($z['r'][$j]);
            $out[$j]=['requests'=>count($z['q'][$j]),'responses'=>$i,'next'=>$z['q'][$j][$i]['request']??null,'nextIndex'=>$i];
        }
        return ['nodes'=>$out?:new stdClass(),'canonical'=>self::view($z['c']['state']),'records'=>$z['c']['records']];
    }

    function decide(string $j,int $i,int $bit,bool $interrupt=false):array {
        self::ok($this->known($j)&&in_array($bit,[0,1],true),'Invalid decision',400);
        $z=$this->snapshot();
        $n=strlen($z['r'][$j]);
        if($i<$n) {
            self::ok(ord($z['r'][$j][$i])===ord(self::decisionByte($i,$bit)),'Decision immutable',409);
            return ['status'=>'replayed'];
        }
        self::ok($i===$n&&isset($z['q'][$j][$i]),'Not next pending request',409);
        if($bit) {
            $ops=self::resolve($z['c']['state'],$z['q'][$j][$i]['request']);
            $o=$z['c']['end'];
            $this->write('C',$o,self::canonical(['node'=>$j,'index'=>$i],$ops));
            if($interrupt)throw new RuntimeException('Simulated interruption after C');
        }
        $this->write('R'.$j,$i,self::decisionByte($i,$bit));
        return ['status'=>'constituted'];
    }
}

final class LocalTrajectory {
    static function decisions(string $b):array {
        $out=[];
        for($i=0; $i<strlen($b); $i++) {
            $x=ord($b[$i]);
            Kernel::need($x%128===$i%128,'Marca M3E1 inválida');
            $out[]=$x>>7;
        }
        return $out;
    }

    static function read(string $b):array {
        $q=[];
        $history=[];
        $private=Motor::empty();
        foreach(QipuDemo::scan($b) as $r) {
            $x=QipuDemo::obj($r['body']);
            switch($r['t']) {
                case 100:QipuDemo::keys($x,['text']);
                Motor::text($x['text']);
                $history[]=['kind'=>'local','text'=>$x['text']];
                break;
                case 101:Motor::request($x);
                $history[]=['kind'=>'request','index'=>count($q),'request'=>$x];
                $q[]=$r+['x'=>$x];
                break;
                case 102:Motor::applyOwned($private,$x);
                $history[]=['kind'=>'localFact','fact'=>$x];
                break;
                default:throw new InvalidArgumentException('Tipo local inválido');
            }
        }
        return ['q'=>$q,'history'=>$history,'privateState'=>$private];
    }

    static function overlay(array $c,array $l,string $r,string $node):array {
        $bits=self::decisions($r);
        $s=$c['state'];
        $status=[];
        Kernel::need(count($bits)<=count($l['q']),'R excede solicitudes');
        foreach($l['q'] as $i=>$q) {
            $inc=isset($c['origins'][$node.':'.$i]);
            $bit=$bits[$i]??null;
            Kernel::need(!($inc&&$bit===0),'Contradicción C/R');
            if($inc) {
                $status[]='incorporada';
                continue;
            }
            if($bit===0) {
                $status[]='rechazada';
                continue;
            }try {
                Motor::applyOwned($s,$q['x']);
                $status[]=$bit===1?'aceptada; falta C':'provisional';
            }catch(Throwable $e) {
                $status[]='conflicto: '.$e->getMessage();
            }
        }
        return ['state'=>$s,'status'=>$status];
    }
}


final class CanonicalLog {
    private array $derived;
    function __construct(private readonly Storage $storage,private readonly string $id) {
        $this->derived=QipuDemo::zero();
    }

    function synchronize():array {
        $head=$this->storage->head($this->id)['end'];
        $start=$this->derived['end'];
        QipuDemo::ok($head>=$start,'Confirmed prefix disappeared',503);
        QipuDemo::ok($head<=QipuDemo::CAP,'Demo stream limit',413);
        if($head===$start)return $this->derived;
        $bytes=$this->storage->read($this->id,$start,$head-$start)['bytes'];
        QipuDemo::ok(strlen($bytes)===$head-$start,'Incomplete confirmed suffix',503);
        $next=$this->derived;
        foreach(QipuDemo::scan($bytes) as $r)QipuDemo::advance($next,$r);
        QipuDemo::ok($next['end']===$head,'Invalid derived frontier',503);
        $this->derived=$next;
        return $this->derived;
    }

    function append(string $raw):array {
        $records=QipuDemo::scan($raw);
        QipuDemo::ok(count($records)===1,'One complete record required');
        $r=$records[0];
        $p=QipuDemo::intent($r);
        for($attempt=0;$attempt<32;$attempt++) {
            $base=$this->synchronize();
            $known=$p['key']===null?($base['records']>0?['record'=>0,'offset'=>0,'length'=>$base['genesisLength']]:null):($base['origins'][$p['key']]??null);
            if($known!==null) {
                $old=$this->storage->read($this->id,$known['offset'],$known['length'])['bytes'];
                QipuDemo::ok(hash_equals($old,$raw),'Origin conflict: different bytes',409);
                return ['record'=>$known['record'],'cut'=>$known['record']+1,'end'=>$known['offset']+$known['length'],'head'=>$base['end'],'replayed'=>true];
            }
            QipuDemo::planRecord($base,$r);
            QipuDemo::ok($base['end']+strlen($raw)<=QipuDemo::CAP,'Demo stream limit',413);
            try {
                $result=$this->storage->append($this->id,$base['end'],$raw);
            } catch(StorageError $e) {
                if($e->status===409)continue;
                throw $e;
            }
            return ['record'=>$base['records'],'cut'=>$base['records']+1,'end'=>$base['end']+strlen($raw),'head'=>$result['end'],'replayed'=>$result['replayed']];
        }
        throw new StorageError(409,'Contention; retry same origin and bytes');
    }
}
