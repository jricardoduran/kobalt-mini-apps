<?php
declare(strict_types=1);
/** Binary append-only storage. PHP >= 8.1, 64-bit, local POSIX filesystem. */
final class StorageError extends RuntimeException {
    public function __construct(public readonly int $status, string $message) { parent::__construct($message); }
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
        if (!$f) { if ($this->strict) throw new StorageError(503,'Directory sync unavailable'); return; }
        try { if (!@fsync($f) && $this->strict) throw new StorageError(503,'Directory sync unavailable'); } finally { fclose($f); }
    }
    private function write($f,string $b): void {
        $n=strlen($b); $i=0;
        while ($i<$n) { $w=fwrite($f,substr($b,$i,min(65536,$n-$i))); if (!$w) throw new StorageError(503,'Incomplete write'); $i+=$w; }
    }
    private function readAt($f,int $o,int $n): string {
        if (fseek($f,$o)!==0) throw new StorageError(503,'Seek failed');
        $b=''; while(strlen($b)<$n) { $x=fread($f,min(65536,$n-strlen($b))); if ($x===false || $x==='') throw new StorageError(503,'Incomplete read'); $b.=$x; } return $b;
    }
    private function size($f): int { $s=fstat($f); if ($s===false) throw new StorageError(503,'Stat failed'); return $s['size']; }
    private function locked(string $id, callable $fn): mixed {
        $p=$this->path($id); $f=@fopen($p.'.bin','rb'); // lock and read; writes use a separate append descriptor
        if (!$f) throw new StorageError(404,'Unknown trajectory');
        try { if (!flock($f,LOCK_EX)) throw new StorageError(503,'Lock unavailable'); return $fn($f,$p); }
        finally { fclose($f); }
    }
    public function create(string $id): array {
        $p=$this->path($id); $f=@fopen($p.'.bin','x+b');
        if (!$f) throw new StorageError(409,'Already exists or cannot create');
        try { if (!flock($f,LOCK_EX)) throw new StorageError(503,'Lock unavailable'); $this->sync($f); $this->dirSync(); } finally { fclose($f); }
        return ['offset'=>0];
    }
    private function pending(string $p,int $o,string $b): void {
        // One durable intent, not a queue. Fixed binary header: magic, 64-bit offset, length, SHA-256.
        $h='PAO1'.pack('J',$o).pack('N',strlen($b));
        $tmp=$p.'.tmp'; $f=@fopen($tmp,'wb'); if (!$f) throw new StorageError(503,'Cannot stage');
        try { $this->write($f,$h.hash('sha256',$h.$b,true).$b); $this->sync($f); } finally { fclose($f); }
        if (!rename($tmp,$p.'.pending')) throw new StorageError(503,'Cannot publish intent');
        $this->dirSync();
    }
    private function recover($f,string $p): void {
        clearstatcache(true,$p.'.pending');
        if (!file_exists($p.'.pending')) return;
        $q=@fopen($p.'.pending','rb'); if (!$q) throw new StorageError(503,'Cannot read intent');
        try {
            $size=$this->size($q); if ($size<49 || $size>48+self::MAX) throw new StorageError(503,'Invalid intent length');
            $h=$this->readAt($q,0,16); $u=unpack('Joffset/Nlength',substr($h,4)); $o=$u['offset']; $n=$u['length'];
            if (substr($h,0,4)!=='PAO1'||$o<0||$n<1||$n>self::MAX||$size!==48+$n||$o>PHP_INT_MAX-$n) throw new StorageError(503,'Invalid intent');
            $digest=$this->readAt($q,16,32); $b=$this->readAt($q,48,$n);
            if (!hash_equals($digest,hash('sha256',$h.$b,true))) throw new StorageError(503,'Intent checksum mismatch');
        } finally { fclose($q); }
        $end=$this->size($f); if ($end<$o||$end>$o+$n) throw new StorageError(503,'Physical length conflicts with intent');
        $k=$end-$o; if ($k && !hash_equals(substr($b,0,$k),$this->readAt($f,$o,$k))) throw new StorageError(503,'Physical prefix conflicts with intent');
        // Re-sync directory before touching canonical data, including after a previous failed directory sync.
        $this->dirSync();
        $a=@fopen($p.'.bin','ab'); if (!$a) throw new StorageError(503,'Cannot open append stream');
        try { if ($k<$n) $this->write($a,substr($b,$k)); $this->sync($a); } finally { fclose($a); }
        if (!unlink($p.'.pending')) throw new StorageError(503,'Cannot clear intent');
        $this->dirSync();
    }
    public function head(string $id): array {
        return $this->locked($id,function($f,$p){$this->recover($f,$p); return ['end'=>$this->size($f)];});
    }
    public function append(string $id,int $offset,string $b): array {
        $n=strlen($b); if ($offset<0||$n<1||$n>self::MAX||$offset>PHP_INT_MAX-$n) throw new StorageError(400,'Invalid offset or payload');
        return $this->locked($id,function($f,$p)use($offset,$b,$n){
            $this->recover($f,$p); $end=$this->size($f);
            if ($offset<$end && $offset+$n<=$end && hash_equals($b,$this->readAt($f,$offset,$n))) return ['offset'=>$offset,'length'=>$n,'end'=>$end,'replayed'=>true];
            if ($offset!==$end) throw new StorageError(409,'Offset conflict; current end '.$end);
            $this->pending($p,$offset,$b); $this->recover($f,$p);
            return ['offset'=>$offset,'length'=>$n,'end'=>$offset+$n,'replayed'=>false];
        });
    }
    public function read(string $id,int $offset,int $length): array {
        if ($offset<0||$length<0||$length>self::MAX) throw new StorageError(400,'Invalid range');
        return $this->locked($id,function($f,$p)use($offset,$length){
            $this->recover($f,$p); $end=$this->size($f); if ($offset>$end) throw new StorageError(416,'Beyond end');
            $n=min($length,$end-$offset); flock($f,LOCK_UN); // immutable prefix, same open descriptor
            return ['end'=>$end,'bytes'=>$this->readAt($f,$offset,$n)];
        });
    }
}
