// Reverte double-encoding UTF-8→Latin-1→UTF-8 nos caches JSON gerados via subprocess
// no Windows (stdout vinha em CP-1252 e o Node reencodava como UTF-8).
// Idempotente: detecta double-encoding via `Ã`/`â€` e aplica latin1→utf8 só nessas
// strings. Em qualquer string, ainda limpa em-dashes que se fragmentaram em
// `�`+`` (replacement + GS) ou `` solto — sempre eram em-dash no
// texto original do LLM.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALVOS = [
  path.resolve(__dirname, "../src/lib/research-cache.json"),
  path.resolve(__dirname, "../src/lib/dossier-cache.json"),
];

const DOUBLE_ENC = /Ã|â€/;
const undouble = (s) => Buffer.from(s, "latin1").toString("utf8");
const cleanResidual = (s) =>
  s.replace(/�/g, "—").replace(//g, "—").replace(/�/g, "—");

function walk(v) {
  if (typeof v === "string") {
    let out = DOUBLE_ENC.test(v) ? undouble(v) : v;
    out = cleanResidual(out);
    return out;
  }
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === "object") {
    const obj = {};
    for (const [k, vv] of Object.entries(v)) obj[k] = walk(vv);
    return obj;
  }
  return v;
}

for (const f of ALVOS) {
  if (!fs.existsSync(f)) {
    console.log(`skip (not found): ${f}`);
    continue;
  }
  const before = fs.readFileSync(f, "utf8");
  const data = JSON.parse(before);
  const fixed = walk(data);
  const after = JSON.stringify(fixed, null, 2);
  if (after === before) {
    console.log(`ok (no changes): ${path.basename(f)}`);
    continue;
  }
  fs.writeFileSync(f, after);
  const sus_before = (before.match(/Ã|â€|�|/g) || []).length;
  const sus_after = (after.match(/Ã|â€|�|/g) || []).length;
  console.log(`fixed ${path.basename(f)}: ${sus_before} → ${sus_after} chars suspeitos`);
}
