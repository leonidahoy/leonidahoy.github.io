// Verifica content/quiz.json (preguntas del test) antes de publicar.
// Uso: node scripts/check-quiz.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const E = (m) => errors.push(m);
let d;
try {
  d = JSON.parse(fs.readFileSync(path.join(ROOT, "content/quiz.json"), "utf8"));
} catch (e) {
  console.error(`✗ content/quiz.json no es JSON válido: ${e.message}`);
  process.exit(1);
}
const guias = JSON.parse(fs.readFileSync(path.join(ROOT, "content/guias.json"), "utf8")).guides.map((g) => g.id);
const LINKS = ["release", "guide", "leonida", "cheats", "reviews", "finds", "clips", "patches", "guides", "news"];
const banned = /\b(spoilers?|final del juego|ending|muere|dies|traición|betray|glitch|exploit|mods?|hack|filtrad[oa]|leak(?:ed)?)\b/i;

if (!/^\d{4}-\d{2}-\d{2}$/.test(d.updated || "")) E("«updated» debe ser AAAA-MM-DD.");
if (!Array.isArray(d.items) || d.items.length < (d.count || 10)) E(`Hacen falta al menos ${d.count || 10} preguntas (hay ${(d.items || []).length}).`);
const ids = new Set();
for (const [i, q] of (d.items || []).entries()) {
  const w = `pregunta ${i + 1} (${q.id || "sin id"})`;
  if (!/^[a-z0-9-]{3,40}$/.test(q.id || "")) E(`${w}: «id» corto, en minúsculas y con guiones.`);
  if (ids.has(q.id)) E(`${w}: id repetido.`);
  ids.add(q.id);
  if (!(LINKS.includes(q.link) || (q.link?.startsWith("g:") && guias.includes(q.link.slice(2))))) E(`${w}: «link» debe ser una sección de la web (${LINKS.join(", ")}) o «g:<id de guía>».`);
  if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) E(`${w}: «a» es el índice de la respuesta correcta (0 a 3).`);
  for (const lang of ["es", "en"]) {
    const qq = q.q?.[lang], oo = q.o?.[lang], xx = q.x?.[lang];
    if (!qq || qq.length > 140) E(`${w}: falta q.${lang} o es demasiado larga.`);
    if (!Array.isArray(oo) || oo.length !== 4 || oo.some((o) => !o || o.length > 80)) E(`${w}: o.${lang} debe tener exactamente 4 opciones cortas.`);
    else if (new Set(oo.map((o) => o.toLowerCase())).size !== 4) E(`${w}: o.${lang} tiene opciones repetidas.`);
    if (!xx || xx.length > 260) E(`${w}: falta la explicación x.${lang} o es demasiado larga.`);
    const all = [qq, ...(oo || []), xx].join(" ");
    if (banned.test(all)) E(`${w}: contiene «${all.match(banned)[0]}». Sin spoilers ni trampas: solo datos confirmados del juego.`);
  }
}
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} error(es) en content/quiz.json.`);
  process.exit(1);
}
console.log(`✓ quiz.json listo: ${d.items.length} preguntas (cada partida usa ${d.count || 10}).`);
