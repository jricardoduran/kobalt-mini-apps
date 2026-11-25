'use strict';
globalThis.Qipu = globalThis.Qipu || {};
Qipu.K2P = (() => {
    const need = (ok, msg = 'K2P inválido') => {
        if (!ok)
            throw Error(msg);
    };
    function encode(n, w = 4) {
        need(Number.isSafeInteger(n) && n >= 0, 'Natural fuera de dominio');
        need(Number.isInteger(w) && w >= 1 && w <= 8, 'Perfil W inválido');
        const b = n.toString(2), k = b.length;
        need(k <= 2 ** w, 'Natural fuera del perfil');
        return (k - 1).toString(2).padStart(w, '0') + b;
    }
    class Writer {
        constructor() {
            this.parts = [];
        }
        n(n, w = 4) {
            this.parts.push(encode(n, w));
            return this;
        }
        text(s) {
            need(typeof s === 'string', 'Texto requerido');
            const b = new TextEncoder().encode(s);
            need(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b) === s, 'Unicode no válido');
            this.n(b.length, 6);
            for (const x of b)
                this.parts.push(x.toString(2).padStart(8, '0'));
            return this;
        }
        bytes() {
            let s = this.parts.join('');
            s = s.padEnd(Math.ceil(s.length / 8) * 8, '0');
            return Uint8Array.from(s.match(/.{8}/g) || [], x => parseInt(x, 2));
        }
    }
    class Reader {
        constructor(bytes) {
            need(bytes instanceof Uint8Array, 'Bytes requeridos');
            this.b = bytes;
            this.p = 0;
        }
        take(k) {
            need(Number.isSafeInteger(k) && k >= 0 && this.p + k <= this.b.length * 8, 'Campo truncado');
            let n = 0n;
            for (let j = 0; j < k; j++, this.p++)
                n = (n << 1n) | BigInt((this.b[this.p >> 3] >> (7 - (this.p & 7))) & 1);
            return n;
        }
        n(w = 4) {
            need(Number.isInteger(w) && w >= 1 && w <= 8, 'Perfil W inválido');
            const k = Number(this.take(w)) + 1;
            need(k <= 53, 'Natural fuera del dominio seguro');
            const n = Number(this.take(k));
            need(n.toString(2).length === k, 'Natural no canónico');
            return n;
        }
        text() {
            const k = this.n(6);
            need(k <= Math.floor((this.b.length * 8 - this.p) / 8), 'Texto truncado');
            const b = new Uint8Array(k);
            for (let j = 0; j < k; j++)
                b[j] = Number(this.take(8));
            return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b);
        }
        finish() {
            const k = this.b.length * 8 - this.p;
            need(k < 8 && this.take(k) === 0n, 'Padding no canónico');
        }
    }
    return { encode, Writer, Reader, need };
})();
'use strict';
Qipu.K4B = (() => {
    const { need } = Qipu.K2P, MAX = 1048576;
    const cat = (...parts) => {
        const b = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
        let i = 0;
        for (const p of parts) {
            b.set(p, i);
            i += p.length;
        }
        return b;
    };
    const domain = s => new TextEncoder().encode(s + '\0');
    const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const hash = async (b) => {
        need(globalThis.crypto?.subtle, 'Web Crypto no disponible: abra en localhost o HTTPS');
        return new Uint8Array(await crypto.subtle.digest('SHA-256', b));
    };
    function lengthBytes(n) {
        need(Number.isInteger(n) && n >= 0 && n <= MAX, 'Longitud fuera de límite');
        let k = n <= 255 ? 1 : n <= 65535 ? 2 : 3;
        const a = new Uint8Array(k + 1);
        a[0] = k - 1;
        for (let j = k; j > 0; j--) {
            a[j] = n & 255;
            n = Math.floor(n / 256);
        }
        return a;
    }
    async function seal(body, prefix = new Uint8Array(), d = 'QIPU-K4B-1') {
        need(body instanceof Uint8Array, 'Cuerpo binario requerido');
        const p = cat(prefix, lengthBytes(body.length), body);
        return cat(p, await hash(cat(domain(d), p)));
    }
    async function read(bytes, offset = 0, prefixSize = 0, d = 'QIPU-K4B-1') {
        need(bytes instanceof Uint8Array && Number.isSafeInteger(prefixSize) && prefixSize >= 0 && Number.isSafeInteger(offset) && offset >= 0 && offset <= bytes.length, 'Offset inválido');
        const start = offset;
        let p = offset + prefixSize;
        need(p < bytes.length, 'Encabezado truncado');
        const k = bytes[p++] + 1;
        need(k <= 4 && p + k <= bytes.length, 'Ancho inválido o truncado');
        let n = 0;
        for (let j = 0; j < k; j++)
            n = n * 256 + bytes[p++];
        need(n <= MAX && lengthBytes(n)[0] === k - 1, 'Longitud no canónica');
        const end = p + n, stop = end + 32;
        need(stop <= bytes.length, 'Registro truncado');
        const h = await hash(cat(domain(d), bytes.subarray(start, end)));
        need(equal(h, bytes.subarray(end, stop)), 'Hash no coincide');
        return { prefix: bytes.slice(start, start + prefixSize), body: bytes.slice(p, end), end: stop, hash: h };
    }
    return { seal, read, cat, equal, hash, MAX };
})();
'use strict';
Qipu.K5B = (() => {
    const { need } = Qipu.K2P;
    return {
        async seal(t, b) {
            need(Number.isInteger(t) && t >= 0 && t <= 65535, 'Tratamiento inválido');
            return Qipu.K4B.seal(b, Uint8Array.of(t >> 8, t & 255), 'QIPU-K5B-1');
        },
        async read(b, p = 0) {
            const r = await Qipu.K4B.read(b, p, 2, 'QIPU-K5B-1');
            return { ...r, t: r.prefix[0] * 256 + r.prefix[1] };
        }
    };
})();
'use strict';
const Motor = (() => {
    const need = Qipu.K2P.need, enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
    const keys = (x, k) => need(obj(x) && Object.keys(x).length === k.length && k.every(n => Object.hasOwn(x, n)), 'Campos inválidos');
    const name = x => need(typeof x === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(x) && !/[\r\n]/.test(x), 'Nombre contractual inválido');
    const text = x => need(typeof x === 'string' && enc.encode(x).length > 0 && enc.encode(x).length <= 200 && !x.startsWith('\uFEFF') && dec.decode(enc.encode(x)) === x, 'Texto inválido');
    const list = (x, min = 0, max = 256) => {
        need(Array.isArray(x) && x.length >= min && x.length <= max, 'Lista inválida');
        return x;
    };
    const nat = x => need(Number.isSafeInteger(x) && x >= 0 && x <= 1e9, 'Natural fuera de perfil');
    const domain = x => need(['text', 'natural', 'boolean'].includes(x), 'Dominio inválido');
    const value = (d, x) => d === 'text' ? text(x) : d === 'natural' ? nat(x) : need(d === 'boolean' && typeof x === 'boolean', 'Booleano requerido');
    const operation = x => need(['SET', 'ADD', 'SUB'].includes(x), 'Tratamiento no admitido');
    const scalar = x => typeof x === 'string' ? text(x) : typeof x === 'boolean' ? undefined : nat(x);
    const find = (a, n, t = null) => a.findIndex(x => x.name === n && (t === null || x.table === t));
    const type = (d, t) => need(d.types.includes(t), 'Tipo no admitido');
    const field = (d, t, p) => {
        let i = find(d.fields, p, t);
        need(i >= 0, 'Parámetro no admitido');
        return d.fields[i];
    };
    function request(e) {
        need(obj(e), 'Objeto requerido');
        switch (e.op) {
            case 'contract':
                keys(e, ['op', 'types', 'fields', 'actions']);
                list(e.types).forEach(name);
                for (let f of list(e.fields)) {
                    keys(f, ['table', 'name', 'domain', 'allow', 'constitutive']);
                    name(f.table);
                    name(f.name);
                    domain(f.domain);
                    need(typeof f.constitutive === 'boolean', 'Constitutive inválido');
                    let a = list(f.allow, 1, 3);
                    for (let op of a) {
                        operation(op);
                        need(op === 'SET' || f.domain === 'natural', 'Diferencial solo natural');
                    }
                    need(new Set(a).size === a.length, 'Operaciones repetidas');
                    need(!f.constitutive || a.includes('SET'), 'Constitución exige SET');
                }
                for (let a of list(e.actions)) {
                    keys(a, ['name', 'table', 'inputs', 'effects', 'measure']);
                    name(a.name);
                    name(a.table);
                    let names = [];
                    for (let f of list(a.inputs, 1, 32)) {
                        keys(f, ['name', 'domain', 'positive']);
                        name(f.name);
                        domain(f.domain);
                        need(typeof f.positive === 'boolean' && (!f.positive || f.domain === 'natural'), 'Positivo solo natural');
                        need(!names.includes(f.name), 'Entrada repetida');
                        names.push(f.name);
                    }
                    for (let f of list(a.effects, 1, 32)) {
                        keys(f, ['parameter', 'operation', 'input']);
                        name(f.parameter);
                        operation(f.operation);
                        name(f.input);
                        need(names.includes(f.input), 'Entrada desconocida');
                    }
                    let m = list(a.measure, 0, 2);
                    need(m.length === 0 || m.length === 2, 'Medida: dos entradas o ninguna');
                    for (let n of m) {
                        name(n);
                        need(names.includes(n), 'Medida desconocida');
                    }
                }
                need(e.types.length + e.fields.length + e.actions.length > 0, 'Contrato vacío');
                break;
            case 'identity':
                keys(e, ['op', 'table', 'identity']);
                name(e.table);
                text(e.identity);
                break;
            case 'assert':
                keys(e, ['op', 'table', 'identity', 'parameter', 'operation', 'value']);
                name(e.table);
                text(e.identity);
                name(e.parameter);
                operation(e.operation);
                scalar(e.value);
                break;
            case 'action':
                keys(e, ['op', 'name', 'rows']);
                name(e.name);
                for (let r of list(e.rows, 1, 1000)) {
                    keys(r, ['identity', 'values']);
                    text(r.identity);
                    list(r.values, 1, 32).forEach(scalar);
                }
                break;
            default: throw Error('Operación desconocida');
        }
        return e;
    }
    function eq(a, b) {
        if (a === b)
            return true;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b))
            return false;
        let k = Object.keys(a);
        return k.length === Object.keys(b).length && k.every(x => Object.hasOwn(b, x) && eq(a[x], b[x]));
    }
    function add(a, x, t = null) {
        let i = find(a, x.name, t);
        if (i >= 0) {
            need(eq(a[i], x), 'Definición inmutable: use otra identidad/version');
            return;
        }
        a.push(structuredClone(x));
    }
    function contract(d, e) {
        for (let t of e.types)
            if (!d.types.includes(t))
                d.types.push(t);
        for (let f of e.fields) {
            type(d, f.table);
            add(d.fields, f, f.table);
        }
        for (let a of e.actions) {
            type(d, a.table);
            for (let ef of a.effects) {
                let f = field(d, a.table, ef.parameter), inp = a.inputs[find(a.inputs, ef.input)];
                need(inp.domain === f.domain && f.allow.includes(ef.operation), 'Efecto incompatible con campo');
            }
            for (let n of a.measure)
                need(a.inputs[find(a.inputs, n)].domain === 'natural', 'Medida exige naturales');
            add(d.actions, a);
        }
    }
    return { request, contract, eq, name, text, domain, operation, value };
})();
const MCVT = (() => {
    const need = (x, m) => {
        if (!x)
            throw Error(m);
    }, key = (...a) => JSON.stringify(a), eq = Motor.eq;
    const empty = () => new Map();
    function plan(base, e) {
        Motor.request(e);
        const changes = new Map();
        const get = (...k) => {
            let p = key(...k);
            return changes.has(p) ? changes.get(p) : base.get(p);
        };
        const put = (k, x) => {
            let p = key(...k);
            if (!eq(get(...k), x))
                changes.set(p, x);
        };
        const schema = get('schema') || { types: [], fields: [], actions: [] };
        const findField = (t, p) => {
            let f = schema.fields.find(x => x.table === t && x.name === p);
            need(f, 'Parámetro no admitido');
            return f;
        };
        function identity(t, id, create) {
            need(schema.types.includes(t), 'Tipo no admitido');
            let ti = get('tableName', t);
            if (ti === undefined) {
                need(create, 'Tabla no constituida');
                ti = get('tableCount') || 0;
                need(ti < 65536, 'Capacidad tabla');
                put(['tableCount'], ti + 1);
                put(['tableName', t], ti);
                put(['table', ti], { name: t, entities: 0, vectors: 0 });
            }
            let tab = get('table', ti), i = get('entityName', ti, id);
            if (i === undefined) {
                need(create, 'Identidad no constituida');
                i = tab.entities;
                need(i < 65536, 'Capacidad entidad');
                put(['entityName', ti, id], i);
                put(['entity', ti, i], id);
                put(['table', ti], { ...tab, entities: i + 1 });
            }
            return [ti, i];
        }
        function change(t, id, p, op, x, create) {
            let f = findField(t, p);
            need(f.allow.includes(op), 'Operación no permitida');
            Motor.value(f.domain, x);
            let [ti, i] = identity(t, id, create && f.constitutive && op === 'SET');
            let vi = get('vectorName', ti, p);
            if (vi === undefined) {
                need(op === 'SET', 'Vector no constituido');
                let tab = get('table', ti);
                vi = tab.vectors;
                need(vi < 65536, 'Capacidad vector');
                put(['vectorName', ti, p], vi);
                put(['vector', ti, vi], { name: p, domain: f.domain });
                put(['table', ti], { ...tab, vectors: vi + 1 });
            }
            let k = ['cell', ti, vi, i];
            if (op !== 'SET') {
                let old = get(...k);
                need(old !== undefined, 'Valor aún ausente');
                x = old + (op === 'ADD' ? x : -x);
                Motor.value(f.domain, x);
            }
            put(k, x);
        }
        if (e.op === 'contract') {
            let d = structuredClone(schema);
            Motor.contract(d, e);
            put(['schema'], { types: d.types, fields: d.fields, actions: d.actions });
        }
        else if (e.op === 'identity')
            identity(e.table, e.identity, true);
        else if (e.op === 'assert')
            change(e.table, e.identity, e.parameter, e.operation, e.value, true);
        else if (e.op === 'action') {
            let a = schema.actions.find(x => x.name === e.name);
            need(a, 'Contrato de acción desconocido');
            let sum = 0;
            for (let r of e.rows) {
                need(r.values.length === a.inputs.length, 'Aridad incorrecta');
                identity(a.table, r.identity, false);
                a.inputs.forEach((f, j) => {
                    Motor.value(f.domain, r.values[j]);
                    need(!f.positive || r.values[j] > 0, 'Entrada positiva requerida');
                });
                for (let ef of a.effects)
                    change(a.table, r.identity, ef.parameter, ef.operation, r.values[a.inputs.findIndex(x => x.name === ef.input)], false);
                if (a.measure.length) {
                    sum += r.values[a.inputs.findIndex(x => x.name === a.measure[0])] * r.values[a.inputs.findIndex(x => x.name === a.measure[1])];
                    need(Number.isSafeInteger(sum), 'Medida fuera de entero seguro');
                }
            }
            let n = get('historyCount') || 0;
            put(['history', n], { name: e.name, rows: structuredClone(e.rows), measure: a.measure.length ? sum : null });
            put(['historyCount'], n + 1);
        }
        return [...changes].filter(([k, x]) => !eq(base.get(k), x));
    }
    function commit(base, delta) {
        for (const [k, v] of delta)
            base.set(k, v);
        return base;
    }
    function snapshot(base) {
        const get = (...k) => base.get(key(...k));
        let s = structuredClone(get('schema') || { types: [], fields: [], actions: [] });
        s.tables = [];
        s.history = [];
        for (let t = 0; t < (get('tableCount') || 0); t++) {
            let m = get('table', t), tab = { name: m.name, entities: [], vectors: [] };
            for (let i = 0; i < m.entities; i++)
                tab.entities.push(get('entity', t, i));
            for (let v = 0; v < m.vectors; v++) {
                let vec = { ...get('vector', t, v), values: {} };
                for (let i = 0; i < m.entities; i++) {
                    let x = get('cell', t, v, i);
                    if (x !== undefined)
                        vec.values[i] = x;
                }
                tab.vectors.push(vec);
            }
            s.tables.push(tab);
        }
        for (let i = 0; i < (get('historyCount') || 0); i++)
            s.history.push(structuredClone(get('history', i)));
        return s;
    }
    return { empty, plan, commit, snapshot };
})();
(function (root) {
    const Qipu = root.Qipu;
    const { K2P, K4B, K5B } = Qipu;
    const need = (x, m) => {
        if (!x)
            throw Error(m);
    }, bytes = b => {
        need(b instanceof Uint8Array, 'Se requieren bytes');
        return b;
    }, copy = b => bytes(b).slice(), cat = K4B.cat, equal = K4B.equal, utf8 = s => new TextEncoder().encode(s), text = b => new TextDecoder('utf-8', { fatal: true }).decode(b), hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    const unhex = s => {
        need(typeof s === 'string' && s.length % 2 === 0 && /^[0-9a-f]*$/i.test(s), 'Hex inválido');
        return Uint8Array.from(s.match(/../g) || [], x => parseInt(x, 16));
    };
    const u32 = n => {
        need(Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff, 'uint32 inválido');
        let b = new Uint8Array(4);
        new DataView(b.buffer).setUint32(0, n);
        return b;
    };
    const u64 = n => {
        need(Number.isSafeInteger(n) && n >= 0, 'uint64 inválido');
        let b = new Uint8Array(8);
        new DataView(b.buffer).setBigUint64(0, BigInt(n));
        return b;
    };
    const read32 = (b, p = 0) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(p);
    const frame = (...a) => cat(u32(a.length), ...a.flatMap(b => [u64(bytes(b).length), b]));
    function unframe(b) {
        bytes(b);
        need(b.length >= 4, 'Frame truncado');
        let p = 4, n = read32(b), out = [];
        need(n <= Math.floor((b.length - 4) / 8), 'Contador inválido');
        for (let i = 0; i < n; i++) {
            need(p + 8 <= b.length, 'Frame truncado');
            let k = new DataView(b.buffer, b.byteOffset + p, 8).getBigUint64(0);
            p += 8;
            need(k <= BigInt(b.length - p), 'Átomo truncado');
            let len = Number(k);
            out.push(b.slice(p, p + len));
            p += len;
        }
        need(p === b.length, 'Bytes sobrantes');
        return out;
    }
    const sha = K4B.hash;
    const id = b => {
        need(bytes(b).length === 32, 'Identificador debe tener 32 bytes');
        return b;
    };
    const clear = () => ({ kind: 'Clear' }), keyed = k => ({ kind: 'Keyed', key: copy(id(k)) });
    function view(v) {
        need(v && ['Clear', 'Keyed'].includes(v.kind), 'View inválida');
        if (v.kind === 'Keyed')
            id(v.key);
        return v;
    }
    async function derive(v, tag, ...atoms) {
        view(v);
        const b = frame(utf8('KOB10/1'), utf8(v.kind), utf8(tag), ...atoms);
        if (v.kind === 'Clear')
            return sha(b);
        const k = await crypto.subtle.importKey('raw', v.key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        return new Uint8Array(await crypto.subtle.sign('HMAC', k, b));
    }
    const identity = (v, ...a) => derive(v, 'identity', ...a), contentId = (v, b) => derive(v, 'content', bytes(b));
    const Ops = Object.freeze({ EMIT: 0, EXPAND: 1, FOLLOW: 2, TRAJECTORY: 3 }), names = Object.keys(Ops);
    function cell(op, r) {
        need(Number.isInteger(op) && op >= 0 && op < 4, 'Descriptor desconocido');
        return { op, ref: copy(id(r)) };
    }
    function encode(c) {
        return cat(u32(cell(c.op, c.ref).op), c.ref);
    }
    function decode(b) {
        need(bytes(b).length === 36, 'Cell debe tener 36 bytes');
        return cell(read32(b), b.subarray(4));
    }
    function vector(cs) {
        return cat(...cs.map(encode));
    }
    function cells(b) {
        need(bytes(b).length % 36 === 0, 'CellVector no múltiplo de 36');
        let out = [];
        for (let i = 0; i < b.length; i += 36)
            out.push(decode(b.subarray(i, i + 36)));
        return out;
    }
    const name = (v, c) => derive(v, 'name', encode(c)), key = c => hex(encode(c)), exact = c => c.op < 2;
    const isPrefix = (a, b) => a.length <= b.length && equal(a, b.subarray(0, a.length));
    function commonPrefix(a, b) {
        let i = 0;
        while (i < Math.min(a.length, b.length) && a[i] === b[i])
            i++;
        return a.slice(0, i);
    }
    async function scan(b) {
        bytes(b);
        let p = 0, out = [];
        while (p < b.length) {
            const r = await K5B.read(b, p);
            out.push({ position: out.length, offset: p, end: r.end, t: r.t, body: r.body, hash: r.hash, raw: b.slice(p, r.end) });
            p = r.end;
        }
        return out;
    }
    async function validate(v, c, b) {
        bytes(b);
        cell(c.op, c.ref);
        if (exact(c))
            need(equal(await contentId(v, b), c.ref), 'ContentId no coincide');
        if (c.op === 1 || c.op === 2)
            cells(b);
        if (c.op === 3)
            await scan(b);
        return b;
    }
    const magic = utf8('KOB10'), header = v => cat(magic, Uint8Array.of(1, v.kind === 'Keyed' ? 1 : 0));
    async function aes(v) {
        return crypto.subtle.importKey('raw', await derive(v, 'envelope-key'), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }
    async function seal(v, c, b) {
        await validate(v, c, b);
        const h = header(v), p = cat(encode(c), b);
        let env;
        if (v.kind === 'Clear')
            env = cat(h, p, await derive(v, 'envelope-commit', h, p));
        else {
            const n = crypto.getRandomValues(new Uint8Array(12));
            env = cat(h, n, new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: n, additionalData: h, tagLength: 128 }, await aes(v), p)));
        }
        return { name: hex(await name(v, c)), envelope: env };
    }
    async function open(v, expected, env) {
        view(v);
        bytes(env);
        const h = header(v);
        need(env.length >= h.length && equal(env.subarray(0, h.length), h), 'Sobre o vista incompatible');
        let p;
        if (v.kind === 'Clear') {
            need(env.length >= h.length + 36 + 32, 'Sobre truncado');
            p = env.slice(h.length, -32);
            need(equal(env.slice(-32), await derive(v, 'envelope-commit', h, p)), 'Compromiso inválido');
        }
        else {
            need(env.length >= h.length + 12 + 36 + 16, 'Sobre truncado');
            p = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: env.slice(h.length, h.length + 12), additionalData: h, tagLength: 128 }, await aes(v), env.slice(h.length + 12)));
        }
        const c = decode(p.slice(0, 36));
        need(key(c) === key(expected), 'Otra Cell');
        const b = p.slice(36);
        await validate(v, c, b);
        return b;
    }
    async function recognize(v, c, candidates) {
        const accepted = [], rejected = [];
        for (const [i, x] of candidates.entries()) {
            try {
                accepted.push({ index: i, body: await open(v, c, x) });
            }
            catch (e) {
                rejected.push({ index: i, error: e.message });
            }
        }
        return { accepted, rejected };
    }
    async function resolve(v, c, candidates) {
        need(Array.isArray(candidates), 'Se requiere lista de evidencias');
        if (!candidates.length)
            return { kind: 'NO_EVIDENCE' };
        const evidence = await recognize(v, c, candidates);
        if (!evidence.accepted.length)
            return { kind: 'UNRECOGNIZED', evidence };
        const a = evidence.accepted.map(x => x.body);
        if (exact(c)) {
            need(a.every(x => equal(a[0], x)), 'EXACT_DIVERGENCE');
            return { kind: 'EXACT', body: a[0], evidence };
        }
        let max = a.reduce((x, y) => x.length >= y.length ? x : y);
        if (!a.every(x => isPrefix(x, max))) {
            let p = a.reduce(commonPrefix);
            if (c.op === 2)
                p = p.slice(0, p.length - p.length % 36);
            else {
                const rec = await scan(a[0]);
                p = p.slice(0, rec.filter(r => r.end <= p.length).at(-1)?.end || 0);
            }
            return { kind: 'FORK', commonPrefix: p, candidates: a, evidence };
        }
        return { kind: max.length ? 'CHAIN' : 'EMPTY', body: max, evidence };
    }
    function memory() {
        const m = new Map();
        return { async put(n, b) {
                const a = m.get(n) || [];
                if (!a.some(x => equal(x, b)))
                    a.push(copy(b));
                m.set(n, a);
            }, async query(n) {
                return (m.get(n) || []).map(copy);
            }, size: () => m.size };
    }
    async function publish(s, v, c, b) {
        const e = await seal(v, c, b);
        await s.put(e.name, e.envelope);
        return c;
    }
    async function publishExact(s, v, op, b) {
        need(op === 0 || op === 1, 'Operador exacto requerido');
        return publish(s, v, cell(op, await contentId(v, b)), b);
    }
    function traversal(v, rootCell, query, { maxDepth = 64, maxSteps = 10000 } = {}) {
        const pending = [{ cell: rootCell, depth: 1, ancestors: [] }], trace = [], leaves = [], cache = new Map();
        let stopped = false;
        async function step() {
            if (!pending.length || stopped)
                return null;
            const t = pending.shift(), c = t.cell, k = key(c), event = { ...t, op: names[c.op], selected: [], cells: [] };
            trace.push(event);
            if (trace.length > maxSteps || t.depth > maxDepth) {
                event.status = 'LIMIT';
                stopped = true;
                return event;
            }
            if (t.ancestors.includes(k)) {
                event.status = 'CYCLE';
                return event;
            }
            try {
                if (!cache.has(k))
                    cache.set(k, await resolve(v, c, await query(hex(await name(v, c)))));
                const r = cache.get(k);
                event.status = r.kind;
                event.body = r.body;
                if (!['EXACT', 'CHAIN', 'EMPTY'].includes(r.kind))
                    return event;
                if (c.op === 0 || c.op === 3) {
                    event.records = c.op === 3 ? await scan(r.body) : undefined;
                    leaves.push(event);
                    return event;
                }
                event.cells = cells(r.body);
                if (c.op === 2 && !event.cells.length) {
                    event.status = 'NO_CURRENT';
                    return event;
                }
                event.selected = c.op === 2 ? [event.cells.length - 1] : event.cells.map((_, i) => i);
                pending.unshift(...event.selected.map(i => ({ cell: event.cells[i], depth: t.depth + 1, ancestors: [...t.ancestors, k] })));
                return event;
            }
            catch (e) {
                event.status = 'ERROR';
                event.error = e.message;
                return event;
            }
        }
        async function run() {
            while (pending.length && !stopped)
                await step();
            return { trace, leaves, complete: !pending.length && !stopped && trace.every(x => ['EXACT', 'CHAIN', 'EMPTY'].includes(x.status)), pending };
        }
        return { pending, trace, leaves, step, run, get stopped() {
                return stopped;
            } };
    }
    async function cut(v, c, b, n) {
        need(c.op === 3, 'Se requiere TRAJECTORY');
        const records = await scan(b);
        need(Number.isInteger(n) && n >= 0 && n <= records.length, 'Corte fuera de rango');
        const body = b.slice(0, n ? records[n - 1].end : 0);
        return { body, count: n, commitment: await derive(v, 'trajectory-cut', encode(c), u64(n), body), cell: cell(0, await contentId(v, body)) };
    }
    function paths(d, p = '') {
        need(Number.isInteger(d) && d >= 1 && d <= 12, 'Profundidad 1..12');
        return [p + 'E', p + 'T', ...(d > 1 ? [...paths(d - 1, p + 'F'), ...paths(d - 1, p + 'X')] : [])];
    }
    root.Kobalt = Object.freeze({ version: '10.2.5-experimental', profile: 'KOB10/1 experimental', Ops, names, Bytes: { utf8, text, hex, unhex, cat, equal, u32, u64 }, Frame: { frame, unframe }, View: { clear, keyed, derive }, Derivation: { identity, contentId, name }, Cell: { make: cell, encode, decode, key, exact }, Sequence: { isPrefix, commonPrefix }, CellVector: { encode: vector, decode: cells }, ReferenceIndex: { encode: vector, decode: cells }, ReferenceHistory: { encode: vector, decode: cells }, Trajectory: { scan, cut }, Envelope: { seal, open }, Recognition: { recognize }, Resolution: { resolve }, MemorySource: memory, Publication: { publish, publishExact }, Explore: traversal, Combinatorics: { paths }, K2P, K4B, K5B, Qipu });
})(globalThis);
(function (K, Q) {
    const need = Q.K2P.need, { Bytes: B, Trajectory: T, View: V, Derivation: D, Cell: C } = K;
    const get = (s, ...p) => s.get(JSON.stringify(p));
    const zero = () => ({ state: MCVT.empty(), origins: new Set(), count: 0 });
    const originKey = (n, i) => n + ':' + i;
    const validNode = n => typeof n === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(n) && !/[\r\n]/.test(n);
    const keys = (x, k) => need(x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === k.length && k.every(n => Object.hasOwn(x, n)), 'Campos inválidos');
    const parse = b => {
        let s = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b), x = JSON.parse(s);
        need(JSON.stringify(x) === s, 'JSON compacto canónico requerido');
        return x;
    };
    const record = (t, x) => Q.K5B.seal(t, B.utf8(JSON.stringify(x)));
    function canonicalIntent(r) {
        need(r.t === 120, 'Tipo canónico inválido');
        const x = parse(r.body);
        keys(x, ['origin', 'event']);
        if (x.origin === null) {
            need(Motor.eq(x.event, { op: 'genesis', profile: 'QIPU-META-1' }), 'Génesis incompatible');
            return { x, origin: null };
        }
        keys(x.origin, ['node', 'index']);
        need(validNode(x.origin.node) && Number.isSafeInteger(x.origin.index) && x.origin.index >= 0 && x.origin.index <= 1e9, 'Origen inválido');
        return { x, origin: originKey(x.origin.node, x.origin.index) };
    }
    function canonicalPlan(s, r) {
        const { x, origin } = canonicalIntent(r);
        if (s.count === 0) {
            need(origin === null, 'Génesis incompatible');
            return { delta: [], origin: null };
        }
        need(origin !== null, 'Génesis ya constituido');
        need(!s.origins.has(origin), 'Origen duplicado');
        return { delta: MCVT.plan(s.state, x.event), origin };
    }
    function canonicalApply(s, p) {
        MCVT.commit(s.state, p.delta);
        if (p.origin !== null)
            s.origins.add(p.origin);
        s.count++;
        return s;
    }
    async function replay(b) {
        const s = zero();
        for (const r of await T.scan(b))
            canonicalApply(s, canonicalPlan(s, r));
        return s;
    }
    async function extend(s, b) {
        const next = { state: new Map(s.state), origins: new Set(s.origins), count: s.count };
        for (const r of await T.scan(b))
            canonicalApply(next, canonicalPlan(next, r));
        return next;
    }
    // Only for structurally scanned bytes. Same KOB10/1 commitment and content ID.
    async function knownCut(v, c, body, count) {
        return { body, count, commitment: await V.derive(v, 'trajectory-cut', C.encode(c), B.u64(count), body), cell: C.make(0, await D.contentId(v, body)) };
    }
    const recognized = new WeakMap();
    function ownView(v) {
        need(v && (v.kind === 'Clear' || v.kind === 'Keyed'), 'View inválida');
        return v.kind === 'Clear' ? V.clear() : V.keyed(ownBytes(v.key));
    }
    function ownBytes(b) { need(b instanceof Uint8Array, 'Se requieren bytes'); return new Uint8Array(b); }
    function ownToken(v, c, body, count, commitment) {
        const token = Object.freeze({ count, length: body.length, commitment: B.hex(commitment) });
        recognized.set(token, {v,c,body,count});
        return token;
    }
    async function recognizeBase(v, c, base, expected) {
        v=ownView(v); c=C.make(c.op,ownBytes(c.ref)); base=ownBytes(base); expected=ownBytes(expected);
        need(c.op===3, 'Se requiere TRAJECTORY');
        const n=(await T.scan(base)).length;
        const commitment=await V.derive(v,'trajectory-cut',C.encode(c),B.u64(n),base);
        need(B.equal(commitment,expected),'Corte base incompatible');
        return ownToken(v,c,base,n,commitment);
    }
    async function spliceRecognized(token, suffix, target) {
        const old=recognized.get(token);
        need(old,'Base reconocida inválida');
        suffix=ownBytes(suffix); if(target!==undefined)target=ownBytes(target);
        const n=(await T.scan(suffix)).length;
        const joined=B.cat(old.body,suffix);
        const cut=await knownCut(old.v,old.c,joined,old.count+n);
        if(target!==undefined)need(B.equal(cut.commitment,target),'Corte destino incompatible');
        // The caller may mutate returned bytes; the next token retains its own copy.
        return {body:joined,cut,base:ownToken(old.v,old.c,joined.slice(),cut.count,cut.commitment)};
    }
    async function splice(v, c, base, suffix, expected, target) {
        // Snapshot all mutable inputs before the first await.
        suffix=ownBytes(suffix); if(target!==undefined)target=ownBytes(target);
        const token=await recognizeBase(v,c,base,expected);
        const {body,cut}=await spliceRecognized(token,suffix,target);
        return {body,cut};
    }
    // Stage only changed keys/origins. Caller owns s exclusively until completion.
    function stageRecords(s, records) {
        const changes=new Map(), origins=new Set();
        const next={state:{get:k=>changes.has(k)?changes.get(k):s.state.get(k),set:(k,v)=>changes.set(k,v)},
            origins:{has:k=>origins.has(k)||s.origins.has(k),add:k=>origins.add(k)},count:s.count};
        for(const r of records) canonicalApply(next,canonicalPlan(next,r));
        return {changes,origins,count:next.count};
    }
    function commitStage(s,p) {
        MCVT.commit(s.state,p.changes);
        for(const o of p.origins)s.origins.add(o);
        s.count=p.count; return s;
    }
    async function extendOwned(s,b) {
        const records=await T.scan(ownBytes(b));
        return commitStage(s,stageRecords(s,records));
    }
    const decisions = b => Array.from(b, (x, i) => {
        need(x % 128 === i % 128, 'Marca M3E1 inválida');
        return x >> 7;
    });
    const decisionByte = (i, d) => {
        need(Number.isSafeInteger(i) && i >= 0 && (d === 0 || d === 1), 'Decisión inválida');
        return 128 * d + i % 128;
    };
    async function local(b) {
        let q = [], history = [], privateState = MCVT.empty();
        for (const r of await T.scan(b)) {
            const x = parse(r.body);
            if (r.t === 100) {
                keys(x, ['text']);
                Motor.text(x.text);
                history.push({ kind: 'local', text: x.text });
            }
            else if (r.t === 101) {
                Motor.request(x);
                history.push({ kind: 'request', index: q.length, request: x });
                q.push({ ...r, x });
            }
            else if (r.t === 102) {
                MCVT.commit(privateState, MCVT.plan(privateState, x));
                history.push({ kind: 'localFact', fact: x });
            }
            else
                throw Error('Tipo local inválido');
        }
        return { q, history, privateState };
    }
    function overlay(c, l, r, node) {
        let bits = decisions(r), state = new Map(c.state), status = [];
        need(bits.length <= l.q.length, 'R excede solicitudes locales');
        for (let i = 0; i < l.q.length; i++) {
            let included = c.origins.has(originKey(node, i)), bit = bits[i];
            need(!(included && bit === 0), 'Contradicción C/R');
            if (included) {
                status.push('incorporada');
                continue;
            }
            if (bit === 0) {
                status.push('rechazada');
                continue;
            }
            try {
                MCVT.commit(state, MCVT.plan(state, l.q[i].x));
                status.push(bit === 1 ? 'aceptada; falta C' : 'provisional');
            }
            catch (e) {
                status.push('conflicto: ' + e.message);
            }
        }
        return { state, status };
    }
    const request = r => new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
    function openDB(name = 'kobalt-10-1') {
        return new Promise((resolve, reject) => {
            let r = indexedDB.open(name, 1);
            r.onupgradeneeded = () => {
                for (const s of ['meta', 'log', 'state', 'origins', 'materials'])
                    r.result.createObjectStore(s);
            };
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
            r.onblocked = () => reject(Error('IndexedDB bloqueada'));
        });
    }
    async function tx(db, stores, mode, fn) {
        const t = db.transaction(stores, mode), done = new Promise((res, rej) => {
            t.oncomplete = res;
            t.onabort = () => rej(t.error || Error('Transacción abortada'));
        });
        done.catch(() => {
        });
        try {
            const r = await fn(s => t.objectStore(s));
            await done;
            return r;
        }
        catch (e) {
            try {
                t.abort();
            }
            catch {
            }
            await done.catch(() => {
            });
            throw e;
        }
    }
    const range = id => IDBKeyRange.bound([id], [id, []], false, true);
    async function load(db, id) {
        return tx(db, ['meta', 'state', 'origins'], 'readonly', async (o) => {
            const meta = await request(o('meta').get(id)) || { revision: 0, count: 0, end: 0 };
            const ks = await request(o('state').getAllKeys(range(id))), vs = await request(o('state').getAll(range(id))), os = await request(o('origins').getAllKeys(range(id)));
            return { meta, state: new Map(ks.map((k, i) => [k[1], vs[i]])), origins: new Set(os.map(k => k[1])), count: meta.count };
        });
    }
    // Optional per-connection private mirror. It is a disposable derivative, never authority.
    const mirrors=new WeakMap();
    function mirrorSlot(db,id) {
        let slots=mirrors.get(db); if(!slots)mirrors.set(db,slots=new Map());
        let slot=slots.get(id); if(!slot)slots.set(id,slot={tail:Promise.resolve(),base:null});
        return slot;
    }
    async function mirrorSync(db,id,slot) {
        const base=slot.base;
        if(!base) return slot.base=await load(db,id);
        const read=await tx(db,['meta','log'],'readonly',async o=>{
            const meta=await request(o('meta').get(id))||{revision:0,count:0,end:0};
            if(Motor.eq(meta,base.meta))return {meta,unchanged:true};
            // A rebuild increases revision without extending count; reload coherently.
            const n=meta.count-base.count;
            if(n<=0||meta.revision-base.meta.revision!==n||meta.end<=base.meta.end)return {reload:true};
            const r=IDBKeyRange.bound([id,base.count],[id,meta.count],false,true);
            const ks=await request(o('log').getAllKeys(r)),rs=await request(o('log').getAll(r));
            need(ks.length===n&&rs.length===n&&ks.every((k,i)=>k[0]===id&&k[1]===base.count+i),'Hueco en sufijo local');
            return {meta,rs};
        });
        if(read.reload)return slot.base=await load(db,id);
        if(read.unchanged)return base;
        const records=[];let length=0;
        for(const raw of read.rs){const rs=await T.scan(raw);need(rs.length===1,'Registro local inválido');records.push(rs[0]);length+=raw.length;}
        need(base.meta.end+length===read.meta.end,'Frontera local incoherente');
        const staged=stageRecords(base,records);
        need(staged.count===read.meta.count,'Cursor local incoherente');
        commitStage(base,staged);base.meta=read.meta;
        return base;
    }
    function prepare(base,r,origin,expectedRevision) {
        const known=origin===null?base.count>0:base.origins.has(origin);
        if(known)return {meta:base.meta,known};
        if(expectedRevision!==undefined&&expectedRevision!==base.meta.revision)throw new CutConflict();
        return {meta:base.meta,known:false,p:canonicalPlan(base,r)};
    }
    function prepareMirror(db,id,r,origin,expectedRevision) {
        const slot=mirrorSlot(db,id);
        // Serialize only private mirror acquisition/planning, not the persistent commit.
        const job=slot.tail.then(async()=>{
            let base;
            try{base=await mirrorSync(db,id,slot);}catch(e){slot.base=null;throw e;}
            return prepare(base,r,origin,expectedRevision);
        });
        slot.tail=job.then(()=>{},()=>{});return job;
    }
    function forgetMirror(db,id) { mirrors.get(db)?.delete(id); }
    class CutConflict extends Error {
        constructor() { super('Corte local obsoleto; recargar'); this.code = 'CUT_CONFLICT'; }
    }
    async function receipt(db, id, origin, raw) {
        const existing = await tx(db, ['meta', 'log', 'origins'], 'readonly', async o => {
            const now = await request(o('meta').get(id));
            if (!now || !now.count) return null;
            const position = origin === null ? 0 : await request(o('origins').get([id, origin]));
            if (position === undefined) return null;
            if (position === true) return { now, legacy: await request(o('log').getAll(range(id))) };
            need(Number.isSafeInteger(position) && position >= 0 && position < now.count, 'Índice de origen incoherente');
            const bytes = await request(o('log').get([id, position]));
            need(bytes instanceof Uint8Array, 'Registro de origen ausente');
            return { now, position, bytes };
        });
        if (!existing) return null;
        if (existing.legacy) {
            const old = (await T.scan(B.cat(...existing.legacy))).find(x => canonicalIntent(x).origin === origin);
            need(old, 'Origen histórico ausente');
            existing.position = old.position; existing.bytes = old.raw;
        }
        need(B.equal(existing.bytes, raw), 'Conflicto de origen: bytes diferentes');
        return { meta: existing.now, record: existing.position, cut: existing.position + 1, head: existing.now.end, replayed: true, writes: 0 };
    }
    async function append(db, id, raw, expectedRevision, { lock = true, timeout = 10000, mirror = false } = {}) {
        raw = new Uint8Array(raw).slice();
        const records = await T.scan(raw);
        need(records.length === 1, 'Un registro completo requerido');
        const r = records[0], { origin } = canonicalIntent(r);
        const run = () => appendCAS(db, id, raw, r, origin, expectedRevision, mirror);
        const locks = lock ? globalThis.navigator?.locks : null;
        if (!locks || typeof locks.request !== 'function') return run();
        need(Number.isInteger(timeout) && timeout > 0 && timeout <= 2147483647, 'Timeout de cola inválido');
        const old = await receipt(db, id, origin, raw);
        if (old) return old;
        const controller = new AbortController();
        let granted = false;
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            return await locks.request('qipu:' + db.name + ':' + id, { signal: controller.signal }, () => {
                granted = true;
                clearTimeout(timer);
                return run();
            });
        } catch (e) {
            if (!granted && controller.signal.aborted) {
                const error = new Error('Tiempo de espera de la cola agotado');
                error.name = 'TimeoutError'; error.code = 'LOCK_TIMEOUT';
                throw error;
            }
            throw e;
        } finally { clearTimeout(timer); }
    }
    async function appendCAS(db, id, raw, r, origin, expectedRevision, mirror) {
        for (let attempt = 0; attempt < 32; attempt++) {
            const old = await receipt(db, id, origin, raw);
            if (old) return old;
            try {
                const base = mirror ? await prepareMirror(db,id,r,origin,expectedRevision) : prepare(await load(db,id),r,origin,expectedRevision);
                if (base.known) {
                    const existing=await receipt(db,id,origin,raw);
                    need(existing,'Origen histórico ausente'); return existing;
                }
                const p=base.p;
                return await tx(db, ['meta', 'log', 'state', 'origins'], 'readwrite', async o => {
                    const now = await request(o('meta').get(id)) || { revision: 0, count: 0, end: 0 };
                    if (!Motor.eq(now, base.meta)) throw new CutConflict();
                    await request(o('log').add(raw, [id, now.count]));
                    for (const [k, v] of p.delta) await request(o('state').put(v, [id, k]));
                    if (p.origin !== null) await request(o('origins').add(now.count, [id, p.origin]));
                    const next = { revision: now.revision + 1, count: now.count + 1, end: now.end + raw.length };
                    await request(o('meta').put(next, id));
                    return { meta: next, record: now.count, cut: now.count + 1, head: next.end, replayed: false, writes: p.delta.length };
                });
            } catch (e) {
                if (!(e instanceof CutConflict)) throw e;
                const existing = await receipt(db, id, origin, raw);
                if (existing) return existing;
                if (expectedRevision !== undefined) throw e;
            }
        }
        throw new CutConflict();
    }
    async function exportLog(db, id) {
        return tx(db, ['meta', 'log'], 'readonly', async (o) => {
            let m = await request(o('meta').get(id)) || { count: 0, end: 0 }, ks = await request(o('log').getAllKeys(range(id))), vs = await request(o('log').getAll(range(id)));
            need(ks.length === m.count && ks.every((k, i) => k[1] === i), 'Hueco en log');
            let b = B.cat(...vs);
            need(b.length === m.end, 'Frontera local incoherente');
            return b;
        });
    }
    async function rebuild(db, id) {
        const original = await tx(db, ['meta', 'log'], 'readonly', async (o) => {
            const meta = await request(o('meta').get(id)) || { revision: 0, count: 0, end: 0 };
            const ks = await request(o('log').getAllKeys(range(id))), rs = await request(o('log').getAll(range(id)));
            need(ks.length === meta.count && ks.every((k, i) => k[1] === i), 'Hueco en log');
            const bytes = B.cat(...rs);
            need(bytes.length === meta.end, 'Frontera local incoherente');
            return { meta, bytes };
        });
        const s = zero(), positions = new Map();
        for (const r of await T.scan(original.bytes)) {
            const p = canonicalPlan(s, r);
            if (p.origin !== null) positions.set(p.origin, r.position);
            canonicalApply(s, p);
        }
        need(s.count === original.meta.count, 'Cursor inválido');
        return tx(db, ['meta', 'state', 'origins'], 'readwrite', async (o) => {
            const now = await request(o('meta').get(id)) || { revision: 0, count: 0, end: 0 };
            need(Motor.eq(now, original.meta), 'Corte local obsoleto');
            await request(o('state').delete(range(id)));
            await request(o('origins').delete(range(id)));
            for (const [k, v] of s.state)
                await request(o('state').put(v, [id, k]));
            for (const [k, position] of positions)
                await request(o('origins').put(position, [id, k]));
            const next = { ...now, revision: now.revision + 1 };
            await request(o('meta').put(next, id));
            return next;
        });
    }
    function idbSource(db) {
        return { async put(n, b) {
                const q = B.hex(await Q.K4B.hash(b));
                await tx(db, ['materials'], 'readwrite', o => request(o('materials').put(b, [n, q])));
            }, async query(n) {
                return tx(db, ['materials'], 'readonly', o => request(o('materials').getAll(range(n))));
            } };
    }
    async function vectorName(v, trajectory, t, p) {
        return C.make(2, await D.identity(v, B.utf8('derived-vector/1'), trajectory.ref, B.u32(t), B.u32(p)));
    }
    Q.MCVT = Object.freeze({ ...MCVT, get, project(s, t, i) {
            const tab = get(s, 'table', t);
            need(tab && get(s, 'entity', t, i) !== undefined, 'Posición inexistente');
            const entries = [];
            for (let v = 0; v < tab.vectors; v++) {
                let x = get(s, 'cell', t, v, i);
                if (x !== undefined)
                    entries.push([get(s, 'vector', t, v).name, x]);
            }
            return { identity: get(s, 'entity', t, i), parameters: Object.fromEntries(entries) };
        } });
    Q.Contracts = Object.freeze(Motor);
    Q.Canonical = { zero, record, parse, intent: canonicalIntent, plan: canonicalPlan, apply: canonicalApply, replay, extend, extendOwned };
    Q.Local = { local, overlay, decisions, decisionByte };
    Q.Mechanisms = { splice, recognizeBase, spliceRecognized, forgetMirror, vectorName, openDB, load, append, exportLog, rebuild, idbSource };
})(Kobalt, Qipu);
