import fs from 'node:fs';
const ID = process.env.MAKEFUN_INPUT_DIR || '/input';
const OD = process.env.MAKEFUN_OUTPUT_DIR || '/output';
// Tiny stack VM, written from ISA.md (make.fun tiny stack ISA v1).
// 32-bit wrapping values, 256-value data stack, 64-deep call stack,
// 256 words of memory, 1,000,000 step limit, 65,536 output limit.
function run(p, inp) {
  const m = new Int32Array(256);
  const s = new Int32Array(256);
  const c = new Int32Array(64);
  let sp = 0, cp = 0, ip = 0, pc = 0, st = 0;
  const o = [];
  const n = p.length;
  const T = (x) => [o, x];
  for (;;) {
    if (st >= 1000000) return T(10);
    if (pc < 0 || pc >= n) return T(9);
    const op = p[pc];
    let np = pc + 1, a, b, v;
    switch (op) {
      case 0: return T(0);
      case 1:
        if (pc + 2 > n) return T(9);
        if (sp > 255) return T(3);
        v = p[pc + 1]; s[sp++] = v > 127 ? v - 256 : v; np = pc + 2; break;
      case 2:
        if (pc + 5 > n) return T(9);
        if (sp > 255) return T(3);
        s[sp++] = p[pc + 1] | p[pc + 2] << 8 | p[pc + 3] << 16 | p[pc + 4] << 24; np = pc + 5; break;
      case 3: if (sp < 1) return T(2); sp--; break;
      case 4:
        if (sp < 1) return T(2);
        if (sp > 255) return T(3);
        s[sp] = s[sp - 1]; sp++; break;
      case 5:
        if (sp < 2) return T(2);
        v = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = v; break;
      case 6:
        if (sp < 2) return T(2);
        if (sp > 255) return T(3);
        s[sp] = s[sp - 2]; sp++; break;
      case 7:
        if (sp < 3) return T(2);
        a = s[sp - 3]; s[sp - 3] = s[sp - 2]; s[sp - 2] = s[sp - 1]; s[sp - 1] = a; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22:
        if (sp < 2) return T(2);
        b = s[--sp]; a = s[sp - 1];
        if (op === 0x10) v = a + b | 0;
        else if (op === 0x11) v = a - b | 0;
        else if (op === 0x12) v = Math.imul(a, b) | 0;
        else if (op === 0x13) { if (!b) return T(4); v = Math.trunc(a / b) | 0; }
        else if (op === 0x14) { if (!b) return T(4); v = a % b | 0; }
        else if (op === 0x15) { if (!b) return T(4); v = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (!b) return T(4); v = (a >>> 0) % (b >>> 0) | 0; }
        else if (op === 0x18) v = a & b;
        else if (op === 0x19) v = a | b;
        else if (op === 0x1a) v = a ^ b;
        else if (op === 0x1c) v = a << (b & 31);
        else if (op === 0x1d) v = a >> (b & 31);
        else if (op === 0x1e) v = a >>> (b & 31) | 0;
        else if (op === 0x20) v = a === b ? 1 : 0;
        else if (op === 0x21) v = a < b ? 1 : 0;
        else v = (a >>> 0) < (b >>> 0) ? 1 : 0;
        s[sp - 1] = v; break;
      case 0x17: if (sp < 1) return T(2); s[sp - 1] = -s[sp - 1] | 0; break;
      case 0x1b: if (sp < 1) return T(2); s[sp - 1] = ~s[sp - 1]; break;
      case 0x30: case 0x31: case 0x32: case 0x33: {
        if (pc + 3 > n) return T(9);
        const off = p[pc + 1] | p[pc + 2] << 8;
        const so = off > 32767 ? off - 65536 : off;
        if (op === 0x30) { np = pc + 3 + so; break; }
        if (op === 0x33) {
          if (cp > 63) return T(7);
          c[cp++] = pc + 3; np = off; break;
        }
        if (sp < 1) return T(2);
        v = s[--sp];
        np = (op === 0x31 ? v === 0 : v !== 0) ? pc + 3 + so : pc + 3; break;
      }
      case 0x34:
        if (cp < 1) return T(8);
        np = c[--cp]; break;
      case 0x40:
        if (sp < 1) return T(2);
        a = s[sp - 1];
        if (a < 0 || a > 255) return T(6);
        s[sp - 1] = m[a]; break;
      case 0x41:
        if (sp < 2) return T(2);
        a = s[sp - 1]; b = s[sp - 2];
        if (a < 0 || a > 255) return T(6);
        m[a] = b; sp -= 2; break;
      case 0x50: {
        if (sp < 1) return T(2);
        const t = String(s[--sp]);
        if (o.length + t.length > 65536) return T(11);
        for (let i = 0; i < t.length; i++) o.push(t.charCodeAt(i));
        break;
      }
      case 0x51:
        if (sp < 1) return T(2);
        if (o.length > 65535) return T(11);
        o.push(s[--sp] & 255); break;
      case 0x52:
        if (sp > 255) return T(3);
        s[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 0x53:
        if (sp < 1) return T(2);
        return T(s[--sp] & 255);
      default: return T(5);
    }
    st++; pc = np;
  }
}
for (const id of fs.readdirSync(ID).sort()) {
  const d = ID + '/' + id;
  if (!fs.statSync(d).isDirectory()) continue;
  const [o, code] = run(fs.readFileSync(d + '/program.bin'), fs.readFileSync(d + '/input.bin'));
  const od = OD + '/' + id;
  fs.mkdirSync(od, { recursive: true });
  fs.writeFileSync(od + '/stdout.bin', Buffer.from(o));
  fs.writeFileSync(od + '/exit.txt', String(code));
}
