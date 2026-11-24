// Generador estático de Leónida Hoy. Sin dependencias: `node scripts/build.mjs`.
// Lee site.config.json + content/ y escribe la web completa (español + inglés) en _site/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { LOCALES } from "./i18n.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(ROOT, process.env.OUT_DIR || "_site");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
if (process.env.SITE_URL) cfg.siteUrl = process.env.SITE_URL;
if (process.env.ADSENSE_CLIENT) cfg.adsense.client = process.env.ADSENSE_CLIENT;

const SITE = cfg.siteUrl.replace(/\/$/, "");
const BASE = new URL(SITE + "/").pathname.replace(/\/$/, "");
const ADS = cfg.adsense?.client?.trim() || "";
const GA = cfg.analytics?.ga4?.trim() || "";
const CF = cfg.analytics?.cloudflare?.trim() || ""; // Cloudflare Web Analytics: sin cookies
const BUILD_TIME = new Date().toISOString();
const BUILD_ID = crypto.createHash("sha1").update(BUILD_TIME).digest("hex").slice(0, 10);
const ISSUES_URL = "https://github.com/leonidahoy/leonidahoy.github.io/issues";
// Versión de CSS/JS según su contenido: cada cambio obliga al navegador a descargarlos de nuevo.
const assetVer = (f) => crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, "assets", f))).digest("hex").slice(0, 8);
const CSS_V = assetVer("styles.css");
const JS_V = assetVer("app.js");
const FONTS_V = assetVer("fonts.css");

// ---------- utilidades ----------
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const u = (p = "/") => BASE + p;
const abs = (p = "/") => SITE + p;
const fmtDate = (L, iso, opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) => {
  const s = new Intl.DateTimeFormat(L.intl, { ...opts, timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const write = (rel, content) => {
  const file = path.join(OUT, rel.replace(/^\//, ""), rel.endsWith("/") ? "index.html" : "");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const fail = (msg) => {
  console.error("✗ " + msg);
  process.exit(1);
};

// ---------- contenido ----------
const briefDir = path.join(ROOT, "content/briefs");
const rawBriefs = fs
  .readdirSync(briefDir)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => JSON.parse(fs.readFileSync(path.join(briefDir, f), "utf8")))
  .sort((a, b) => b.date.localeCompare(a.date));
if (!rawBriefs.length) fail("No hay resúmenes en content/briefs/");

const validate = (b, where) => {
  if (!b.title || !b.summary) fail(`${where}: faltan title/summary`);
  if (!Array.isArray(b.stories) || b.stories.length < 1) fail(`${where}: sin historias`);
  b.stories.forEach((s, i) => {
    if (!s.title || !s.change) fail(`${where}: historia ${i + 1} sin title/change`);
    if (!s.sources?.length) fail(`${where}: historia ${i + 1} sin fuente (regla: nada sin fuente)`);
    s.sources.forEach((src) => /^https?:\/\//.test(src.url) || fail(`${where}: URL inválida ${src.url}`));
  });
  for (const [k, list] of [["more", b.more || []], ["rumors", b.rumors || []]]) {
    list.forEach((s, i) => {
      if (!s.title || !s.change) fail(`${where}: ${k} ${i + 1} sin title/change`);
      if (!s.sources?.length) fail(`${where}: ${k} ${i + 1} sin fuente (regla: nada sin fuente con nombre)`);
      if (k === "rumors" && !["alta", "media", "baja"].includes(s.reliability)) fail(`${where}: rumor ${i + 1} sin reliability (alta|media|baja)`);
    });
  }
};

// Versión de un resumen en un idioma: español = campos principales; otro idioma = bloque `<código>`
// con los textos traducidos (las fuentes y fechas se reutilizan del original).
const localize = (b, code) => {
  if (code === "es") return b;
  const tr = b[code];
  if (!tr) return null;
  const out = {
    ...b,
    title: tr.title,
    summary: tr.summary,
    lead: tr.lead,
    stories: b.stories.map((s, i) => ({ ...s, ...(tr.stories?.[i] || {}), sources: s.sources })),
    posts: tr.posts || [],
    context: (b.context || []).map((c, i) => ({ ...c, ...(tr.context?.[i] || {}), sources: c.sources, date: c.date })),
    more: (b.more || []).map((s, i) => ({ ...s, ...(tr.more?.[i] || {}), sources: s.sources })),
    rumors: (b.rumors || []).map((s, i) => ({ ...s, ...(tr.rumors?.[i] || {}), sources: s.sources, reliability: s.reliability })),
  };
  if (tr.stories && tr.stories.length !== b.stories.length) fail(`content/briefs/${b.date}.json: «${code}.stories» no tiene las mismas historias`);
  return out;
};

const slugify = (t) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, "");
const DATA = {};
for (const code of Object.keys(LOCALES)) {
  const briefs = rawBriefs.map((b) => localize(b, code)).filter(Boolean);
  briefs.forEach((b) => validate(b, `content/briefs/${b.date}.json [${code}]`));
  const gfile = path.join(ROOT, code === "es" ? "content/guide.json" : `content/guide.${code}.json`);
  const guide = fs.existsSync(gfile) ? JSON.parse(fs.readFileSync(gfile, "utf8")) : null;
  // Cada noticia y cada rumor es un elemento con página propia
  const P = LOCALES[code].paths;
  const items = [];
  for (const b of briefs) {
    [...b.stories, ...(b.more || [])].forEach((s, i) =>
      items.push({ ...s, kind: "news", date: b.date, key: `item:news:${b.date}:${i}`, top: i < b.stories.length, big: i === (b.biggest ?? 0), path: P.newsItem(b.date, slugify(s.title)) })
    );
    (b.rumors || []).forEach((s, i) => items.push({ ...s, kind: "rumor", date: b.date, key: `item:rumor:${b.date}:${i}`, path: P.rumorItem(b.date, slugify(s.title)) }));
  }
  const paths = new Set(items.map((i) => i.path));
  if (paths.size !== items.length) fail(`[${code}] hay dos noticias o rumores con el mismo título el mismo día`);
  DATA[code] = { briefs, guide, dates: new Set(briefs.map((b) => b.date)), items, byKey: new Map(items.map((i) => [i.key, i])) };
}
const ACTIVE = Object.keys(LOCALES).filter((c) => DATA[c].briefs.length && DATA[c].guide);
const LEONIDA = JSON.parse(fs.readFileSync(path.join(ROOT, "content/leonida.json"), "utf8"));
const REVIEWS = JSON.parse(fs.readFileSync(path.join(ROOT, "content/reviews.json"), "utf8"));
// Los textos listos para redes («Listo para publicar») no se muestran en la web pública: son para el editor
const SHOW_POSTS = false;
const TRUCOS = JSON.parse(fs.readFileSync(path.join(ROOT, "content/trucos.json"), "utf8"));
const FINDS = JSON.parse(fs.readFileSync(path.join(ROOT, "content/descubrimientos.json"), "utf8"));
const PATCHES = JSON.parse(fs.readFileSync(path.join(ROOT, "content/parches.json"), "utf8"));
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
FINDS.items.sort(byDateDesc);
PATCHES.entries.sort(byDateDesc);
// ---------- clips de la comunidad ----------
// Solo enlaces a plataformas con reproductor oficial. Título y autor salen de la propia plataforma (oEmbed)
// al publicar en GitHub (CLIPS_VERIFY=1): si un vídeo se borró o no permite insertarse, no se publica.
const clipInfo = (url) => {
  let m;
  try {
    const x = new URL(url);
    const h = x.hostname.replace(/^www\.|^m\./, "");
    if ((h === "youtube.com" || h === "youtube-nocookie.com") && x.pathname === "/watch" && /^[\w-]{11}$/.test(x.searchParams.get("v") || "")) return { platform: "youtube", vid: x.searchParams.get("v"), vertical: false };
    if (h === "youtube.com" && (m = x.pathname.match(/^\/shorts\/([\w-]{11})/))) return { platform: "youtube", vid: m[1], vertical: true };
    if (h === "youtu.be" && (m = x.pathname.match(/^\/([\w-]{11})/))) return { platform: "youtube", vid: m[1], vertical: false };
    if (h === "tiktok.com" && (m = x.pathname.match(/^\/@[\w.-]+\/video\/(\d{8,25})/))) return { platform: "tiktok", vid: m[1], vertical: true };
    if ((h === "x.com" || h === "twitter.com") && (m = x.pathname.match(/^\/\w{1,15}\/status\/(\d{5,25})/))) return { platform: "x", vid: m[1], vertical: false };
  } catch {}
  return null;
};
const PLATFORM = { youtube: "YouTube", tiktok: "TikTok", x: "X" };
const oembed = { youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`, tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`, x: (u) => `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(u)}` };
const loadClips = async () => {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "content/clips.json"), "utf8"));
  const verify = process.env.CLIPS_VERIFY === "1";
  const out = [];
  // orden estable: más reciente primero y, el mismo día, el orden del archivo
  const list = (raw.items || []).map((c, i) => ({ ...c, _i: i })).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a._i - b._i)).slice(0, 60);
  await Promise.all(
    list.map(async (c) => {
      const info = clipInfo(c.url);
      if (!info) return console.warn(`⚠ clip «${c.id}»: enlace no admitido (${c.url})`);
      const clip = { ...c, ...info, title: c.title || "", author: c.by || "", authorUrl: "" };
      if (verify) {
        try {
          const res = await fetch(oembed[info.platform](c.url), { signal: AbortSignal.timeout(10000), headers: { "user-agent": "Mozilla/5.0 (compatible; LeonidaHoyBot/1.0)" } });
          if (!res.ok) return console.warn(`⚠ clip «${c.id}» no publicado: ${PLATFORM[info.platform]} responde ${res.status} (borrado, privado o sin permiso para insertarlo)`);
          const j = await res.json();
          if (/rockstar ?games/i.test(j.author_name || "")) return console.warn(`⚠ clip «${c.id}» no publicado: es un vídeo oficial, no de la comunidad`);
          clip.title = j.title || clip.title || (j.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
          clip.author = j.author_name || clip.author;
          clip.authorUrl = j.author_url || "";
        } catch (e) {
          return console.warn(`⚠ clip «${c.id}» no publicado: no se pudo comprobar (${e.name})`);
        }
      }
      if (!clip.author) clip.author = "";
      if (!clip.title) clip.title = c.note?.es || c.id;
      out.push(clip);
    })
  );
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a._i - b._i));
  console.log(`· clips: ${out.length} publicados${verify ? " (comprobados en cada plataforma)" : " (sin comprobar: vista previa local)"}`);
  return { updated: raw.updated, items: out };
};
const CLIPS = await loadClips();
const PROG = JSON.parse(fs.readFileSync(path.join(ROOT, "content/progreso.json"), "utf8"));
for (const it of PROG.items) { if (!/^[a-z0-9-]+$/.test(it.id || "") || !["check", "count"].includes(it.kind) || (it.kind === "count" && !(Number.isInteger(it.max) && it.max > 0)) || !it.t?.es || !it.t?.en || !it.d?.es || !it.d?.en) throw new Error(`content/progreso.json: revisa «${it.id}» (id, kind check|count, max entero, t y d en es/en)`); }
const QUIZ = JSON.parse(fs.readFileSync(path.join(ROOT, "content/quiz.json"), "utf8"));
const GUIAS = JSON.parse(fs.readFileSync(path.join(ROOT, "content/guias.json"), "utf8")).guides;
for (const g of GUIAS) for (const k of ["slug", "title", "desc", "h1", "lead", "quick"]) for (const c of ["es", "en"]) if (!g[k]?.[c]) throw new Error(`content/guias.json: a la guía «${g.id}» le falta ${k}.${c}`);
(REVIEWS.reviews || []).forEach((r, i) => {
  const w = `content/reviews.json: reviews[${i}]`;
  if (!r.outlet || typeof r.score !== "number" || typeof r.max !== "number" || r.max <= 0 || r.score < 0 || r.score > r.max) fail(`${w}: necesita outlet, score y max (número, score ≤ max)`);
  if (!/^https?:\/\//.test(r.url || "")) fail(`${w}: url inválida`);
});
(REVIEWS.aggregates || []).forEach((a, i) => {
  if (!a.name || typeof a.score !== "number" || !/^https?:\/\//.test(a.url || "") || !a.source) fail(`content/reviews.json: aggregates[${i}] necesita name, score, url y source`);
});
const reviewList = (REVIEWS.reviews || []).map((r) => ({ ...r, pct: Math.round((r.score / r.max) * 100) })).sort((a, b) => b.pct - a.pct);
const reviewAvg = reviewList.length ? Math.round(reviewList.reduce((t, r) => t + r.pct, 0) / reviewList.length) : null;
const LAUNCH_UTC_CLOUD = "2026-11-19T06:00:00Z"; // 1:00 ET del 19 (Xbox Cloud, según Microsoft)
const crumbsLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(p) })),
});

// Equivalencias entre idiomas: clave de página → ruta en cada idioma (si existe)
const counterparts = (key) => {
  const out = {};
  for (const code of ACTIVE) {
    const P = LOCALES[code].paths;
    if (key.startsWith("brief:")) {
      const d = key.slice(6);
      if (DATA[code].dates.has(d)) out[code] = P.brief(d);
    } else if (key.startsWith("item:")) {
      const it = DATA[code].byKey.get(key);
      if (it) out[code] = it.path;
    } else if (key.startsWith("g:")) {
      const g = GUIAS.find((x) => x.id === key.slice(2));
      if (g?.slug?.[code]) out[code] = P.guideItem(g.slug[code]);
    } else if (typeof P[key] === "string") out[code] = P[key];
  }
  return out;
};

// ---------- piezas comunes ----------
const icon = {
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.9 2.3h7l4.8 6.4 5.5-6.4Zm-1.2 17.9h1.9L7.1 4.2H5.1l11.9 16Z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z"/></svg>',
  tg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2l-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 9h10v12H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M7 17 17 7M9 7h8v8"/></svg>',
  rss: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 17a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3 10a11 11 0 0 1 11 11h-3a8 8 0 0 0-8-8v-3Zm0-6a17 17 0 0 1 17 17h-3A14 14 0 0 0 3 7V4Z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 3.8 5.8 3.8 9s-1.2 6.2-3.8 9c-2.6-2.8-3.8-5.8-3.8-9S9.4 5.8 12 3Z"/></g></svg>',
};
const tabIcon = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  news: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v10a2 2 0 0 1-2 2M8 9h5M8 13h5M8 17h3"/></g></svg>',
  rumors: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/></g></svg>',
  reviews: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  guide: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></g></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></g></svg>',
  add: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></g></svg>',
  dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></g></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  finds: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5c3.9 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3.1-11 7-11z"/><path d="m5.6 12.5 2.4-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2.4 1.5"/></g></svg>',
  community: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="3.5"/><path d="M10 9v6l5-3z" fill="currentColor"/></g></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></g></svg>',
  cheats: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10a5 5 0 0 1 4.9 6l-.8 4a2.6 2.6 0 0 1-4.6 1.1L15 16H9l-1.5 2.1A2.6 2.6 0 0 1 2.9 17l-.8-4A5 5 0 0 1 7 7z"/><path d="M7 10.5v3M5.5 12h3"/></g><circle cx="16" cy="11" r="1.2" fill="currentColor"/><circle cx="18" cy="13.2" r="1.2" fill="currentColor"/></svg>',
};
// Icono en línea con el texto (botones, avisos, etiquetas): mismo trazo y tamaño en todos los móviles
const I = (svg) => (svg || "").replace("<svg ", '<svg class="i" ');
const uiIcon = {
  swipe: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8 3 12l4 4M17 8l4 4-4 4M3 12h18"/></g></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></g></svg>',
  offline: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19.2" r="1" fill="currentColor"/></g></svg>',
  theme: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/></g></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></g></svg>',
  install: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7.5v7M9 11.5l3 3 3-3"/></g></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.4v.01"/></g></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3l2.2 6.3L20.5 12l-6.3 2.2L12 20.5l-2.2-6.3L3.5 12l6.3-2.7z"/></svg>',
};
// Botón «Guardar para luego» (se guarda solo en el dispositivo; lo gestiona app.js)
const bookmarkSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z"/></svg>';
const saveBtn = (L, { u: url, t, k }, { label = false } = {}) =>
  `<button type="button" class="save${label ? " save--label" : ""}" data-save='${esc(JSON.stringify({ u: url, t: String(t).slice(0, 140), k }))}' aria-pressed="false" aria-label="${esc(L.t.save.save)}: ${esc(String(t).slice(0, 80))}" title="${esc(L.t.save.save)}">${bookmarkSvg}${label ? `<span data-save-label data-on="${esc(L.t.save.saved)}" data-off="${esc(L.t.save.save)}">${esc(L.t.save.save)}</span>` : ""}</button>`;
// Firma de cada sección: si cambia desde la última visita, su pestaña muestra un punto de «novedades»
const sig = (parts) => crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 10);
// Iconos propios de la sección de trucos
const cheatIcon = {
  money: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></g></svg>',
  player: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></g></svg>',
  armor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  ammo: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 21V10c0-3 1.2-5.5 2.5-7 1.3 1.5 2.5 4 2.5 7v11z"/><path d="M14 21V10c0-3 1.2-5.5 2.5-7 1.3 1.5 2.5 4 2.5 7v11z"/><path d="M5 17h5M14 17h5"/></g></svg>',
  police: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="m12 3 2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16l-5.1 2.7L8 13 3.7 9l5.8-.7z"/></svg>',
  vehicles: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15v-3l2.2-4.6A2 2 0 0 1 7 6.3h10a2 2 0 0 1 1.8 1.1L21 12v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/></g></svg>',
  world: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
  combat: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></g></svg>',
  dpad: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M9 2.5h6v6.5h6.5v6H15v6.5H9V15H2.5V9H9z"/><path fill="currentColor" d="m12 4.5 1.6 2.2h-3.2zM12 19.5l-1.6-2.2h3.2zM4.5 12l2.2-1.6v3.2zM19.5 12l-2.2 1.6v-3.2z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></g></svg>',
  hold: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5c1.4-2.2 3.4-3.3 5.5-3.3h1.5M21 9.5c-1.4-2.2-3.4-3.3-5.5-3.3H14"/><rect x="2.5" y="11" width="7" height="6.5" rx="2"/><rect x="14.5" y="11" width="7" height="6.5" rx="2"/></g></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></g></svg>',
};
const gIcon = {
  ...cheatIcon,
  globe: uiIcon.globe,
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8.5 20.5h7M9.5 17h5v3.5h-5z"/></g></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 4h12.5L20 7.5V20H4z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></g></svg>',
  car: cheatIcon.vehicles,
  fuel: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6.5 8h5"/><path d="M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3"/></g></svg>',
  gym: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></g></svg>',
  focus: cheatIcon.player,
  stealth: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 20 20 4"/></g></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></g></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8.5 20.5h7M9.5 17h5v3.5h-5z"/></g></svg>',
  store: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3.5 9 5 4h14l1.5 5a3 3 0 0 1-5.7 1.3A3 3 0 0 1 12 12a3 3 0 0 1-2.8-1.7A3 3 0 0 1 3.5 9z"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/></g></svg>',
  gem: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3.5h12l3.5 5.5L12 21 2.5 9z"/><path d="M2.5 9h19M9 3.5 7.5 9 12 21l4.5-12L15 3.5"/></g></svg>',
  vault: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3.5" width="18" height="16" rx="2.5"/><circle cx="12" cy="11.5" r="4"/><path d="M12 7.5v1.5M12 14v1.5M8 11.5h1.5M14.5 11.5H16M6 19.5V21M18 19.5V21"/></g></svg>',
  cheat: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10a5 5 0 0 1 4.9 6l-.8 4a2.6 2.6 0 0 1-4.6 1.1L15 16H9l-1.5 2.1A2.6 2.6 0 0 1 2.9 17l-.8-4A5 5 0 0 1 7 7z"/><path d="M7 10.5v3M5.5 12h3"/></g></svg>',
  radio: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="12.5" rx="2.5"/><path d="m7 8 9.5-4.5"/><circle cx="15.5" cy="14.2" r="3"/><path d="M6 12.5h3M6 16h3"/></g></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></g></svg>',
  tips: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"/></g></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5zM12 6.5V20"/></g></svg>',
};
const findIcon = {
  easter: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5c3.9 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3.1-11 7-11z"/><path d="m5.6 12.5 2.4-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2.4 1.5"/></g></svg>',
  reference: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="12" rx="2.5"/><path d="M8 21h8M12 17.5V21M10 9.5l4 2-4 2z"/></g></svg>',
  curiosity: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01"/></g></svg>',
  tip: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"/></g></svg>',
  secret: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14.5 8.5l2 2"/></g></svg>',
  record: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18M6 20V11M11 20V5M16 20v-6M21 9l-4-4-4 4"/></g></svg>',
  tech: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="13" height="13" rx="2"/><path d="M9.5 9.5h5v5h-5zM9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/></g></svg>',
  update: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/></g></svg>',
  issue: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/></g></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z"/></svg>',
};
const seg2 = (L, cur) =>
  `<nav class="seg" aria-label="${esc(L.t.ux.seg2Label)}"><a href="${u(L.paths.clips)}"${cur === "clips" ? ' aria-current="page"' : ""}>${I(tabIcon.community)}${esc(L.t.ux.seg2.clips)} <span>${CLIPS.items.length}</span></a><a href="${u(L.paths.finds)}"${cur === "finds" ? ' aria-current="page"' : ""}>${I(tabIcon.finds)}${esc(L.t.ux.seg2.finds)} <span>${FINDS.items.length}</span></a></nav>`;
const findCard = (L, f, { compact = false } = {}) => {
  const T = L.t.finds;
  const c = L.code;
  const g = f.link && GUIAS.find((x) => x.id === f.link);
  return `<article class="find find--${f.cat}" data-cat="${esc(f.cat)}" id="${esc(f.id)}">
    <div class="find__top"><span class="find__ic" aria-hidden="true">${findIcon[f.cat] || findIcon.curiosity}</span><span class="find__cat">${esc(T.cats[f.cat] || f.cat)}</span>${isFresh(f.date, 3) ? `<span class="find__new">${esc(T.isNew)}</span>` : ""}<time datetime="${f.date}">${esc(fmtDate(L, f.date, { day: "numeric", month: "short" }))}</time>${compact ? "" : saveBtn(L, { u: `${u(L.paths.finds)}#${f.id}`, t: f.title[c] || f.title.es, k: "find" })}</div>
    <h3>${esc(f.title[c] || f.title.es)}</h3>
    ${compact ? "" : `<p>${esc(f.text[c] || f.text.es)}</p>${g ? `<a class="tip__more" href="${u(L.paths.guideItem(g.slug[c]))}">${esc(T.related)}</a>` : ""}${sourcesHtml(L, f.sources)}`}
  </article>`;
};
const clipCard = (L, c, { compact = false } = {}) => {
  const T = L.t.clips;
  const pf = PLATFORM[c.platform];
  return `<article class="clip clip--${c.platform}${c.vertical ? " clip--v" : ""}${compact ? " clip--compact" : ""}" data-clang="${esc(c.lang)}" id="clip-${esc(c.id)}">
    <div class="clip__player" data-clip-player data-platform="${c.platform}" data-vid="${esc(c.vid)}" data-vertical="${c.vertical ? 1 : 0}" data-title="${esc(c.title)}">
      <button type="button" class="clip__face" data-play aria-label="${esc(T.playLabel(c.title, c.author || pf))}">
        <span class="clip__thumb" aria-hidden="true"></span>
        <span class="clip__pf">${pf}${c.vertical ? ` · ${esc(T.vertical)}` : ""}</span>
        <span class="clip__btn" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg></span>
        <span class="clip__ttl">${esc(c.title)}</span>
        ${c.author ? `<span class="clip__au">${esc(c.author)}</span>` : ""}
      </button>
    </div>
    <div class="clip__meta">
      <p class="clip__by">${c.author ? `${esc(T.by)} ${c.authorUrl ? `<a href="${esc(c.authorUrl)}" target="_blank" rel="noopener nofollow">${esc(c.author)}</a>` : `<b>${esc(c.author)}</b>`} ${esc(T.on(pf))}` : esc(T.on(pf).replace(/^./, (x) => x.toUpperCase()))}</p>
      ${compact ? "" : `<p class="clip__note">${esc(c.note?.[L.code] || c.note?.es || "")}</p>`}
      <div class="clip__tags"><span>${esc(T.langs[c.lang] || c.lang)}</span>${c.cat ? `<span>${esc(T.cats[c.cat] || c.cat)}</span>` : ""}<time datetime="${c.date}">${esc(fmtDate(L, c.date, { day: "numeric", month: "short" }))}</time><a class="clip__open" href="${esc(c.url)}" target="_blank" rel="noopener nofollow">${esc(T.open(pf))}</a>${compact ? "" : saveBtn(L, { u: `${u(L.paths.clips)}#clip-${c.id}`, t: c.title, k: "clip" })}</div>
    </div>
  </article>`;
};
// Flecha de la cruceta (una sola forma, girada)
const dirRot = { U: 0, R: 90, D: 180, L: 270 };
const dirKey = (L, d) =>
  `<li class="pad pad--${d}" title="${esc(L.t.cheats.dirs[d])}"><svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${dirRot[d]}deg)"><path fill="currentColor" d="M12 4.5 19.5 15h-15z"/></svg><span class="sr-only">${esc(L.t.cheats.dirs[d])}</span></li>`;
const stepIcons = { ios: ["share", "add", "check"], iosChrome: ["share", "add", "check"], android: ["dots", "add", "check"] };
const stepsHtml = (L, variant) =>
  `<ol class="steps">${L.t.inst[variant].map((t, i) => `<li><span class="steps__n">${i + 1}</span><span class="steps__ic">${tabIcon[stepIcons[variant][i]]}</span><span class="steps__t">${t}</span></li>`).join("")}</ol>`;
const TAB_ORDER = ["home", "news", "cheats", "community", "guide"];
// Las páginas de rumores cuentan como «Noticias» (es la misma pestaña, con un selector Confirmadas | Rumores)
const SECTION_SIG = {};
const tabKey = (active) => (active === "rumors" ? "news" : active === "finds" || active === "clips" ? "community" : active);
const tabbar = (L, active) => `
<nav class="tabbar" aria-label="${esc(L.t.tabsLabel)}">
  ${TAB_ORDER.map((k, i) => `<a href="${u(k === "guide" ? L.paths.guides : k === "community" ? L.paths.clips : L.paths[k])}" data-tab="${i}"${SECTION_SIG[L.code]?.[k] ? ` data-sig="${k}:${SECTION_SIG[L.code][k]}"` : ""}${k === tabKey(active) ? ' aria-current="page"' : ""}>${tabIcon[k]}<span>${esc(L.t.tabs[k])}</span></a>`).join("")}
</nav>`;
const installSheet = (L) => `
<div class="sheet" data-install-sheet hidden>
  <div class="sheet__backdrop" data-sheet-close></div>
  <div class="sheet__panel" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <span class="sheet__grip" aria-hidden="true"></span>
    <div class="sheet__head">
      <img src="${u("/assets/icon-maskable-192.png")}" alt="" width="56" height="56">
      <div><h2 id="sheet-title">${esc(L.t.inst.title)}</h2><p>${esc(L.t.inst.sub)}</p></div>
      <button type="button" class="sheet__x" data-sheet-close aria-label="${esc(L.t.app.close)}">×</button>
    </div>
    <div data-variant="prompt" hidden><button type="button" class="btn btn--primary btn--block btn--big" data-install-go>${I(uiIcon.install)}${esc(L.t.appCta)}</button></div>
    <div data-variant="ios" hidden>${stepsHtml(L, "ios")}</div>
    <div data-variant="iosChrome" hidden>${stepsHtml(L, "iosChrome")}</div>
    <div data-variant="android" hidden>${stepsHtml(L, "android")}</div>
    <p class="sheet__inapp" data-variant="inapp" hidden>${L.t.inst.inapp}</p>
    <div class="sheet__foot"><a href="${u(L.paths.app)}">${esc(L.t.inst.how)} →</a><button type="button" class="btn btn--ghost" data-sheet-later>${esc(L.t.inst.later)}</button></div>
  </div>
</div>`;
const markSvg = fs
  .readFileSync(path.join(ROOT, "assets/logo-mark.svg"), "utf8")
  .replace(/ id="lh-/g, ' id="m-lh-')
  .replace(/url\(#lh-/g, "url(#m-lh-")
  .replace(/href="#lh-/g, 'href="#m-lh-')
  .replace("<svg ", '<svg class="mark" aria-hidden="true" ')
  .replace(/ role="img" aria-label="[^"]*"/, "");

const palmSvg = (cls) =>
  `<svg class="hero__palm ${cls}" viewBox="-30 -26 60 120" aria-hidden="true"><path d="M-1.6 0 C1 14 3.4 28 4 94 L8.2 94 C7.6 28 4.6 13 1.9 -.6 Z"/><path d="M0 0 C-8 -6 -18 -4 -25 4.5 C-17 -1 -9 -1 0 2.2 Z"/><path d="M0 0 C-6 -10 -15.5 -13.5 -23 -10.5 C-13.5 -9 -7 -5 0 1.2 Z"/><path d="M0 0 C-3 -9 -2 -16.5 2.4 -21.5 C0 -14 .6 -7 1.2 1 Z"/><path d="M0 0 C8 -9.5 18.5 -9.5 25 -3 C16.5 -5.2 9 -3 1 2 Z"/><path d="M0 0 C9.5 -3 18 2 22 10.5 C14.5 4.2 8 2 0 2.6 Z"/><circle cx=".6" cy="2.4" r="1.7"/><circle cx="-1.6" cy="1.6" r="1.4"/></svg>`;

const shareLinks = (L, text, url) => {
  const t = encodeURIComponent(text);
  const full = encodeURIComponent(`${text} ${url}`);
  return `
    <a class="share share--x" href="https://x.com/intent/post?text=${t}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="${esc(L.t.shareOn("X"))}">${icon.x}</a>
    <a class="share share--wa" href="https://wa.me/?text=${full}" target="_blank" rel="noopener" aria-label="${esc(L.t.shareWa)}">${icon.wa}</a>
    <a class="share share--tg" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${t}" target="_blank" rel="noopener" aria-label="${esc(L.t.shareOn("Telegram"))}">${icon.tg}</a>`;
};

const adUnit = (L, name, extra = "") => {
  const slot = cfg.adsense?.slots?.[name];
  if (!ADS || !slot) return ""; // sin slot manual: Auto ads coloca los anuncios
  return `<aside class="ad ad--${name} ${extra}" aria-label="${esc(L.t.ads)}"><span class="ad__label">${esc(L.t.ads)}</span>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(ADS)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;
};

const countdown = (L, size = "lg") => `
  <div class="countdown countdown--${size}" data-countdown="${esc(cfg.launchDate)}" role="timer" aria-live="off">
    <div class="countdown__label">${esc(L.t.cdLabel)}</div>
    <div class="countdown__grid">
      ${["d", "h", "m", "s"].map((k, i) => `<div><b data-unit="${k}">–</b><span>${esc(L.t.cdUnits[i])}</span></div>`).join("")}
    </div>
    <div class="countdown__done" hidden><span class="countdown__done-title">${esc(L.t.cdDone)}</span><small>${esc(L.t.cdDoneSub)}</small><span class="countdown__done-cta"><a class="btn btn--primary" href="${u(L.paths.cheats)}">${I(tabIcon.cheats)}${esc(L.t.ux.doneCheats)}</a><a class="btn btn--ghost" href="${u(L.paths.finds)}">${I(tabIcon.finds)}${esc(L.t.ux.doneFinds)}</a></span></div>
  </div>`;

const langSwitch = (L, alts) => `
      <nav class="lang" aria-label="${esc(L.t.langSwitch)}">${icon.globe}
        ${ACTIVE.map((code) => {
          const href = alts[code] || LOCALES[code].paths.home;
          const cur = code === L.code;
          return `<a href="${u(href)}" hreflang="${code}" lang="${code}" data-lang="${code}"${cur ? ' aria-current="true"' : ""}>${LOCALES[code].label}</a>`;
        }).join("")}
      </nav>`;

const header = (L, active, alts) => {
  const P = L.paths;
  const nav = [
    [P.home, L.t.nav.home, "home"],
    [P.news, L.t.nav.news, "news"],
    [P.cheats, L.t.tabs.cheats, "cheats"],
    [P.clips, L.t.tabs.community, "community"],
    [P.guides, L.t.nav.guide, "guide"],
  ];
  return `
  <header class="site-header">
    <div class="wrap site-header__inner">
      <a class="brand" href="${u(P.home)}" aria-label="${esc(cfg.name)}, ${esc(L.t.home)}">
        ${markSvg}
        <span class="brand__text"><span class="brand__name">LEÓNIDA<em>Hoy</em></span><span class="brand__tag">${esc(L.t.tagline)}</span></span>
      </a>
      <nav class="nav" aria-label="${esc(L.t.mainNav)}">
        ${nav.map(([href, label, key]) => `<a href="${u(href)}"${key === tabKey(active) ? ' aria-current="page"' : ""}${SECTION_SIG[L.code]?.[key] ? ` data-sig="${key}:${SECTION_SIG[L.code][key]}"` : ""}>${esc(label)}</a>`).join("")}
      </nav>
      ${langSwitch(L, alts)}
      <div class="pill-count" data-countdown-mini="${esc(cfg.launchDate)}" data-done="${esc(L.t.miniDone)}" aria-hidden="true"><span class="dot"></span><span class="pill-pre" data-mini-pre>${esc(L.t.miniPre)}</span><span data-mini>19/11</span></div>
      <button class="search-btn" type="button" data-search-open aria-label="${esc(L.t.ux.search.label)}" title="${esc(L.t.ux.search.open)} (/)">${tabIcon.search}</button>
      <button class="theme-toggle" type="button" data-theme-toggle data-to-light="${esc(L.t.themeToLight)}" data-to-dark="${esc(L.t.themeToDark)}" aria-label="${esc(L.t.themeTitle)}" title="${esc(L.t.themeTitle)}">
        <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></svg>
        <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.4 14.6A8.5 8.5 0 0 1 9.4 3.6a.6.6 0 0 0-.8-.7 9.6 9.6 0 1 0 12.5 12.5.6.6 0 0 0-.7-.8Z"/></svg>
      </button>
    </div>
    <div class="progress" aria-hidden="true"><span data-progress></span></div>
  </header>`;
};

const langHint = (L, alts) => {
  const other = ACTIVE.find((c) => c !== L.code);
  if (!other) return "";
  const href = alts[other] || LOCALES[other].paths.home;
  return `
  <div class="lang-hint" data-lang-hint="${other}" hidden>
    <div class="wrap lang-hint__inner"><span lang="${other}">${esc(L.t.langHint)}</span>
      <a href="${u(href)}" lang="${other}" hreflang="${other}" data-lang="${other}">${esc(L.t.langHintCta)}</a>
      <button type="button" data-lang-hint-close aria-label="${esc(L.t.langHintClose)}">×</button></div>
  </div>`;
};

const footer = (L) => {
  const soc = Object.entries(cfg.social || {}).filter(([, v]) => v);
  const P = L.paths;
  return `
  <footer class="site-footer">
    <div class="wrap site-footer__inner">
      <div>
        <a class="brand brand--sm" href="${u(P.home)}">${markSvg}<span class="brand__name">LEÓNIDA<em>Hoy</em></span></a>
        <p class="muted small">${esc(L.t.footerNote)}</p>
      </div>
      <nav class="footer-cols" aria-label="${esc(L.t.footerNav)}">
        <div><h2>${esc(L.t.ux.foot.now)}</h2>
          <a href="${u(P.home)}">${esc(L.t.nav.home)}</a>
          <a href="${u(P.news)}">${esc(L.t.nav.news)}</a>
          <a href="${u(P.rumors)}">${esc(L.t.nav.rumors)}</a>
          <a href="${u(P.archive)}">${esc(L.t.footerLinks.archive)}</a>
          <a href="${u(P.feed)}" class="rss">${icon.rss} RSS</a>
        </div>
        <div><h2>${esc(L.t.ux.foot.community)}</h2>
          <a href="${u(P.clips)}">${esc(L.t.clips.tile)}</a>
          <a href="${u(P.quiz)}">${esc(L.t.quiz.tile)}</a>
          <a href="${u(P.progress)}">${esc(L.t.prog.tile)}</a>
          <a href="${u(P.finds)}">${esc(L.t.tabs.finds)}</a>
        </div>
        <div><h2>${esc(L.t.ux.foot.play)}</h2>
          <a href="${u(P.cheats)}">${esc(L.t.tabs.cheats)}</a>
          <a href="${u(P.patches)}">${esc(L.t.patch.tile)}</a>
          <a href="${u(P.guides)}">${esc(L.t.nav.guide)}</a>
          <a href="${u(P.reviews)}">${esc(L.t.tabs.reviews)}</a>
        </div>
        <div><h2>${esc(L.t.ux.foot.site)}</h2>
          <a href="${u(P.app)}">${I(uiIcon.install)} App</a>
          <a href="${u(P.saved)}">${I(bookmarkSvg)} ${esc(L.t.save.title)}</a>
          <a href="${u(P.about)}">${esc(L.t.footerLinks.about)}</a>
          <a href="${u(P.privacy)}">${esc(L.t.footerLinks.privacy)}</a>
          <a href="${u(P.legal)}">${esc(L.t.footerLinks.legal)}</a>
          <button class="footer-install" type="button" data-install hidden>${I(uiIcon.install)}${esc(L.t.app.install)}</button>
          ${soc.map(([k, v]) => `<a href="${esc(v)}" rel="me noopener" target="_blank">${esc(k === "x" ? "X" : k.charAt(0).toUpperCase() + k.slice(1))}</a>`).join("")}
        </div>
      </nav>
    </div>
  </footer>`;
};

const ROOT_KEYS = new Set(["home", "news", "rumors", "cheats", "finds", "clips", "guides"]);
const visibleCrumbs = (L, jsonLd, body) => {
  const bc = jsonLd.find((j) => j && j["@type"] === "BreadcrumbList");
  if (!bc || bc.itemListElement.length < 3) return body;
  const items = bc.itemListElement;
  const html = `<nav class="crumbs" aria-label="${esc(L.t.ux.crumbs)}"><ol>${items
    .map((it, i) => {
      const href = new URL(it.item).pathname;
      return i === items.length - 1 ? `<li aria-current="page"><span>${esc(it.name)}</span></li>` : `<li><a href="${esc(href)}">${esc(it.name)}</a></li>`;
    })
    .join("")}</ol></nav>`;
  return body.replace(/(<section class="page-head[^"]*"><div class="wrap[^"]*">)/, `$1${html}`);
};
const layout = (L, { title, description, key, body, active, type = "website", jsonLd = [], published, noindex = false }) => {
  body = visibleCrumbs(L, jsonLd, body);
  const alts = counterparts(key);
  const pathName = alts[L.code];
  const canonical = abs(pathName);
  const fullTitle = title === cfg.name ? `${cfg.name} · ${L.t.tagline}` : `${title} · ${cfg.name}`;
  const hreflang = Object.entries(alts)
    .map(([c, p]) => `<link rel="alternate" hreflang="${c}" href="${abs(p)}">`)
    .concat(alts.es ? [`<link rel="alternate" hreflang="x-default" href="${abs(alts.es)}">`] : [])
    .join("\n");
  const image = L.code === "es" ? "/assets/og.png" : `/assets/og-${L.code}.png`;
  return `<!doctype html>
<html lang="${L.code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="build-id" content="${BUILD_ID}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${esc(cfg.name)}">
<meta name="application-name" content="${esc(cfg.name)}">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${hreflang}
<meta name="robots" content="${noindex ? "noindex" : "index, follow, max-image-preview:large, max-snippet:-1"}">
<meta name="theme-color" content="#0b0618" data-theme-color>
<meta name="referrer" content="strict-origin-when-cross-origin">
${cfg.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">` : ""}
<meta name="color-scheme" content="dark light">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:locale" content="${L.ogLocale}">
${ACTIVE.filter((c) => c !== L.code && alts[c]).map((c) => `<meta property="og:locale:alternate" content="${LOCALES[c].ogLocale}">`).join("\n")}
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${abs(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
${published ? `<meta property="article:published_time" content="${published}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${abs(image)}">
<link rel="icon" href="${u("/assets/favicon.svg")}" type="image/svg+xml">
<link rel="icon" href="${u("/assets/icon-192.png")}" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="${u("/assets/apple-touch-icon.png")}">
<link rel="manifest" href="${u(L.code === "es" ? "/manifest.webmanifest" : `/manifest-${L.code}.webmanifest`)}">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.name)} (${L.label})" href="${u(L.paths.feed)}">
<link rel="preload" href="${u("/assets/fonts/inter-latin.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${u("/assets/fonts/anton-latin.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${u("/assets/fonts.css")}?v=${FONTS_V}">
<script>(function(){var r=document.documentElement,t=null;r.className+=" js";try{var d=sessionStorage.getItem("lh-vt");if(d){r.className+=" vt-"+d;sessionStorage.removeItem("lh-vt")}}catch(e){}try{if(Date.now()>=new Date("${esc(cfg.launchDate)}").getTime())r.className+=" launched"}catch(e){}try{if(localStorage.getItem("lh-aud")==="nuevos")r.setAttribute("data-reader","nuevos");localStorage.removeItem("lh-theme");t=localStorage.getItem("lh-tema")}catch(e){}var y=window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";if(t!=="light"&&t!=="dark"||t===y){if(t)try{localStorage.removeItem("lh-tema")}catch(e){}t=null}if(t)r.setAttribute("data-theme",t);var n=t||y;r.setAttribute("data-theme-now",n);var m=document.querySelector("[data-theme-color]");if(m)m.setAttribute("content",n==="light"?"#fff6fb":"#0b0618");try{if(sessionStorage.getItem("lh-seen"))r.className+=" warm";sessionStorage.setItem("lh-seen","1")}catch(e){}addEventListener("pagereveal",function(e){var v=e.viewTransition;if(!v)return;try{var a=window.navigation&&navigation.activation;if(a&&a.navigationType==="traverse"&&a.from&&a.entry&&!/vt-/.test(r.className))r.classList.add(a.from.index>a.entry.index?"vt-prev":"vt-next")}catch(x){}var f=function(){r.classList.remove("vt-next","vt-prev")};v.ready.catch(f);v.finished.then(f,f)})})()</script>
<link rel="stylesheet" href="${u("/assets/styles.css")}?v=${CSS_V}">
${ADS ? `<meta name="google-adsense-account" content="${esc(ADS)}">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(ADS)}" crossorigin="anonymous"></script>` : ""}
${GA ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(GA)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(GA)}');</script>` : ""}
${CF ? `<script>(function(){function go(){var s=document.createElement("script");s.defer=true;s.src="https://static.cloudflareinsights.com/beacon.min.js";s.setAttribute("data-cf-beacon",'{"token":"${esc(CF)}"}');document.head.appendChild(s)}if(document.prerendering)document.addEventListener("prerenderingchange",go,{once:true});else go()})()</script>` : ""}
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body data-base="${BASE}" data-search="${u(`/search-${L.code}.json`)}"${ROOT_KEYS.has(key) ? " data-root" : ""} data-app='${esc(JSON.stringify({ ...L.t.app, swipe: L.t.inst.swipe, saveAdd: L.t.save.add, saveRemove: L.t.save.remove, newDot: L.t.newDot, search: { savedTitle: L.t.save.title, savedAll: L.t.save.seeAll, savedUrl: u(L.paths.saved), savedKinds: L.t.save.kinds, label: L.t.ux.search.label, ph: L.t.ux.search.ph, close: L.t.ux.search.close, loading: L.t.ux.search.loading, try: L.t.ux.search.try, tryWords: L.t.ux.search.tryWords, none: L.t.ux.search.none("{q}"), one: L.t.ux.search.results(1), many: L.t.ux.search.results(7).replace("7", "{n}") } }))}'>
<a class="skip" href="#main">${esc(L.t.skip)}</a>
${header(L, active, alts)}
${langHint(L, alts)}
<div class="launch-bar" data-launch-bar data-launch="${esc(cfg.launchDate)}">
  <div class="wrap launch-bar__inner">
    <span data-lb="pre">${I(uiIcon.calendar)} ${esc(L.t.launchBarPre(""))} <a href="${u(L.paths.release)}">${esc(L.t.launchBarPreCta)}</a></span>
    <span data-lb="out" hidden>${I(PATCHES.status.level === "ok" ? uiIcon.spark : PATCHES.status.level === "bad" ? uiIcon.warn : findIcon.shield)} ${esc(L.t.ux.lb[PATCHES.status.level] || L.t.ux.lb.ok)} <a href="${u(PATCHES.status.level === "ok" ? L.paths.guides : L.paths.patches)}">${esc(L.t.ux.lbCta[PATCHES.status.level] || L.t.ux.lbCta.ok)}</a></span>
  </div>
</div>
<main id="main">
${body}
</main>
${tabbar(L, active)}
${installSheet(L)}
<button class="to-top" type="button" aria-label="${esc(L.t.toTop)}" data-to-top><svg class="to-top__ring" viewBox="0 0 48 48" aria-hidden="true"><circle class="track" cx="24" cy="24" r="22.5" pathLength="100"/><circle class="bar" cx="24" cy="24" r="22.5" pathLength="100" data-progress-ring/></svg><svg class="to-top__arrow" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg></button>
${footer(L)}
<script src="${u("/assets/app.js")}?v=${JS_V}" defer></script>
<script type="speculationrules">{"prerender":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/*.(xml|json|txt|png|svg|webmanifest)"}},{"not":{"selector_matches":"[target],[download],[rel~=nofollow]"}}]},"eagerness":"moderate"}],"prefetch":[{"where":{"selector_matches":".tabbar a:not([aria-current]),.nav a:not([aria-current])"},"eagerness":"eager"}]}</script>
</body>
</html>
`;
};

const publisher = {
  "@type": "Organization",
  name: cfg.name,
  url: abs("/"),
  logo: { "@type": "ImageObject", url: abs("/assets/icon-512.png"), width: 512, height: 512 },
};

const sourcesHtml = (L, sources) =>
  `<div class="sources"><span>${esc(L.t.source(sources.length))}</span> ${sources
    .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.name)}${icon.ext}</a>`)
    .join(" ")}</div>`;

// ---------- tarjetas, portada, listados y páginas de detalle ----------
const relLevel = { alta: 3, media: 2, baja: 1 };
const isFresh = (iso, days = 7) => !!iso && Date.now() - new Date(iso + "T12:00:00Z").getTime() < days * 864e5;
const relMeter = (L, r) =>
  `<span class="rel rel--${r}"><span class="rel__bars" aria-hidden="true">${[1, 2, 3].map((n) => `<i${n <= relLevel[r] ? ' class="on"' : ""}></i>`).join("")}</span>${esc(L.t.reliability[r])}</span>`;
const via = (L, sources) =>
  `<span class="via">${esc(L.t.via)} ${sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.name)}</a>`).join(", ")}</span>`;
const metaTags = (L, it) =>
  it.kind === "rumor"
    ? `<span class="tag tag--rumor">${esc(L.t.rumor)}</span>${relMeter(L, it.reliability)}`
    : `<span class="tag">${esc(it.tag || L.t.news)}</span>${it.big ? `<span class="tag tag--hot">${esc(L.t.biggest)}</span>` : ""}`;
const readerHtml = (L) => `
          <div class="reader">
            <span class="reader__label" id="reader-label">${esc(L.t.readerQ)}</span>
            <div class="aud-toggle" role="group" aria-labelledby="reader-label">
              <button type="button" data-aud-btn="fans" aria-pressed="true">${I(tabIcon.cheats)}${esc(L.t.fans)}</button>
              <button type="button" data-aud-btn="nuevos" aria-pressed="false">${I(uiIcon.spark)}${esc(L.t.nuevos)}</button>
            </div>
          </div>`;

// Tarjeta de noticia o rumor: toda la tarjeta lleva a su página de detalle
const itemCard = (L, it, { num, variant = "mini" } = {}) => {
  const rumor = it.kind === "rumor";
  const story = variant === "story";
  return `
      <article class="${story ? "story" : "mini-story"} item item--${it.kind}${it.big && story ? " story--big" : ""}${rumor ? ` rumor rumor--${it.reliability}` : ""}"${rumor ? ` data-rel="${it.reliability}"` : ""}>
        ${num ? `<div class="story__num">${num}</div>` : ""}
        <div class="story__body">
          <div class="story__meta">${metaTags(L, it)}</div>
          <h3 class="story__title"><a href="${u(it.path)}">${esc(it.title)}</a></h3>
          <p class="story__text aud" data-aud="fans">${story ? `<strong>${esc(L.t.whatChanged)}</strong> ` : ""}${esc(it.change)}</p>
          <p class="story__text aud" data-aud="nuevos">${story ? `<strong>${esc(L.t.inShort)}</strong> ` : ""}${esc(it.plain || it.change)}</p>
          ${rumor && it.who ? `<p class="rumor__who small"><strong>${esc(L.t.who)}</strong> ${esc(it.who)}</p>` : ""}
          <div class="item__foot"><span class="more-link">${esc(L.t.readMore)}</span>${via(L, it.sources)}</div>
        </div>
      </article>`;
};

const guidesCard = (L) => {
  const P = L.paths;
  const link = (href, ic, name, sub) => `<li><a href="${u(href)}"><span class="gl__ic" aria-hidden="true">${ic}</span><span><b>${esc(name)}</b><small>${esc(sub)}</small></span></a></li>`;
  const g = (id) => GUIAS.find((x) => x.id === id);
  const tip = g("consejos"), money = g("dinero");
  return `<div class="card"><h2 class="card__title">${esc(L.t.ux.play)}</h2><ul class="guide-links">
    ${link(P.cheats, tabIcon.cheats, L.t.tabs.cheats, L.t.cheats.tileSub(TRUCOS.cheats.filter((c) => c.seq).length))}
    ${link(P.finds, tabIcon.finds, L.t.tabs.finds, L.t.finds.tileSub(FINDS.items.length))}
    ${link(P.patches, findIcon.update, L.t.patch.tile, L.t.patch.level[PATCHES.status.level] || L.t.patch.tileSub)}
    ${tip ? link(P.guideItem(tip.slug[L.code]), gIcon.tips, tip.h1[L.code], tip.short[L.code]) : ""}
    ${money ? link(P.guideItem(money.slug[L.code]), cheatIcon.money, money.h1[L.code], money.short[L.code]) : ""}
  </ul><a class="card__more" href="${u(P.guides)}">${esc(L.t.ux.allGuides)}</a></div>`;
};
const sideCards = (L, { facts = true } = {}) => {
  const { guide } = DATA[L.code];
  const P = L.paths;
  return `
      ${guidesCard(L)}
      <div class="card pre-only">${countdown(L, "sm")}</div>
      ${adUnit(L, "sidebar", "ad--sticky")}
      ${
        facts
          ? `<div class="card">
        <h2 class="card__title">${esc(L.t.tenSec)}</h2>
        <ul class="facts">${guide.facts.slice(0, 4).map((f) => `<li><span>${esc(f.label)}</span><b>${esc(f.value)}</b></li>`).join("")}</ul>
        <a class="btn btn--primary btn--block" href="${u(P.guide)}">${esc(L.t.guideCta)}</a>
      </div>`
          : ""
      }`;
};

// ---------- portada / resumen de un día ----------
const briefBody = (L, b) => {
  const { briefs, guide, items } = DATA[L.code];
  const P = L.paths;
  const pageUrl = abs(P.brief(b.date));
  const today = items.filter((i) => i.date === b.date);
  const top = today.filter((i) => i.kind === "news" && i.top);
  const more = today.filter((i) => i.kind === "news" && !i.top);
  const rumors = today.filter((i) => i.kind === "rumor");
  const big = top.find((i) => i.big) || top[0];
  const idx = briefs.indexOf(b);
  const newer = briefs[idx - 1];
  const older = briefs[idx + 1];
  const dShort = (d) => fmtDate(L, d, { day: "numeric", month: "short" });

  const posts = (b.posts || [])
    .map(
      (p, i) => `
      <figure class="post">
        <figcaption class="post__head"><span class="post__n">Post ${i + 1}</span><span class="post__chars">${[...p].length} ${esc(L.t.chars)}</span></figcaption>
        <blockquote class="post__text" id="post-${b.date}-${i}">${esc(p)}</blockquote>
        <div class="post__actions">
          <button class="btn btn--ghost" type="button" data-copy="#post-${b.date}-${i}" data-copied="${esc(L.t.copied)}">${icon.copy}<span>${esc(L.t.copy)}</span></button>
          ${shareLinks(L, p, pageUrl)}
        </div>
      </figure>`
    )
    .join("");

  const context = (b.context || [])
    .map(
      (c) => `
      <li class="ctx">
        <time datetime="${c.date}">${esc(dShort(c.date))}</time>
        <div><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p>${sourcesHtml(L, c.sources)}</div>
      </li>`
    )
    .join("");

  const archive = briefs
    .slice(0, 6)
    .map(
      (x) =>
        `<li><a href="${u(P.brief(x.date))}"${x === b ? ' aria-current="page"' : ""}><time datetime="${x.date}">${esc(dShort(x.date))}</time><span>${esc(x.title)}</span></a></li>`
    )
    .join("");

  const tile = (cls, href, emoji, name, sub) =>
    `<a class="hub__tile hub__tile--${cls}" href="${u(href)}"><span class="hub__icon" aria-hidden="true">${emoji}</span><span class="hub__txt"><b>${esc(name)}</b><small>${esc(sub)}</small></span></a>`;

  return `
  <section class="hero">
    <div class="hero__sky" aria-hidden="true"><div class="hero__sun"></div><div class="hero__sea"></div>${palmSvg("hero__palm--l")}${palmSvg("hero__palm--r")}<div class="hero__veil"></div></div>
    <div class="wrap hero__inner">
      <div class="hero__copy">
        <p class="eyebrow"><time datetime="${b.date}">${esc(fmtDate(L, b.date))}</time><span class="eyebrow__extra"> · ${esc(L.t.morning)}</span></p>
        <h1 class="hero__title">${esc(b.title)}</h1>
        <p class="hero__lead">${esc(b.lead || b.summary)}</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="#top5">${esc(L.t.seeFive)}</a>
          ${shareLinks(L, L.t.shareText(b.title), pageUrl)}
          <button class="btn btn--ghost" type="button" data-native-share data-title="${esc(b.title)}" data-url="${pageUrl}">${esc(L.t.share)}</button>
        </div>
      </div>
      ${countdown(L, "lg")}
    </div>
  </section>

  <div class="wrap">
    <nav class="hub" aria-label="${esc(L.t.jumpsLabel)}">
      <a class="hub__tile hub__tile--cheats" href="${u(P.cheats)}"><span class="hub__icon" aria-hidden="true">${tabIcon.cheats}</span><span class="hub__txt"><b>${esc(L.t.cheats.tile)}</b><small>${esc(L.t.cheats.tileSub(TRUCOS.cheats.filter((c) => c.seq).length))}</small></span>${TRUCOS.cheats.some((c) => isFresh(c.added)) ? `<span class="hub__new">${esc(L.t.cheats.isNew)}</span>` : ""}<span class="hub__go" aria-hidden="true">→</span></a>
      ${tile("clips", P.clips, tabIcon.community, L.t.clips.tile, L.t.clips.tileSub(CLIPS.items.length))}
      ${tile("finds", P.finds, tabIcon.finds, L.t.tabs.finds, L.t.finds.tileSub(FINDS.items.length))}
      ${tile("guide", P.guides, tabIcon.guide, L.t.gd.tile, L.t.gd.tileSub)}
      ${tile("news", P.news, tabIcon.news, L.t.nav.news, L.t.hubNewsSub(top.length + more.length))}
      ${tile("rumors", P.rumors, tabIcon.rumors, L.t.nav.rumors, L.t.hubRumorsSub(rumors.length))}
      ${tile("patches", P.patches, findIcon.update, L.t.patch.tile, L.t.patch.level[PATCHES.status.level] || L.t.patch.tileSub)}
    </nav>
    <div class="cta-row"><a class="quiz-cta" href="${u(P.progress)}"><span class="quiz-cta__ic quiz-cta__ic--prog" aria-hidden="true">${gIcon.trophy}</span><span class="quiz-cta__txt"><b>${esc(L.t.prog.h1)}</b><small>${esc(L.t.prog.tileSub)}</small></span><span class="quiz-cta__go">${esc(L.t.prog.cta)} →</span></a>
    <a class="quiz-cta" href="${u(P.quiz)}"><span class="quiz-cta__ic" aria-hidden="true">${uiIcon.spark}</span><span class="quiz-cta__txt"><b>${esc(L.t.quiz.h1)}</b><small>${esc(L.t.quiz.tileSub)}</small></span><span class="quiz-cta__go">${esc(L.t.quiz.cta)} →</span></a></div>
    ${adUnit(L, "top")}
  </div>
  ${
    FINDS.items.length
      ? `<div class="wrap"><section class="block latest-game" aria-labelledby="ultimo">
      <div class="block__head"><h2 id="ultimo">${esc(L.t.finds.latest)}</h2><a class="latest-game__status latest-game__status--${esc(PATCHES.status.level)}" href="${u(P.patches)}">${findIcon.shield}<span>${esc(L.t.patch.level[PATCHES.status.level] || "")}</span></a></div>
      <div class="finds finds--home">${FINDS.items.slice(0, 3).map((f) => `<a class="find-link" href="${u(P.finds)}#${esc(f.id)}">${findCard(L, f, { compact: true })}</a>`).join("")}</div>
      <a class="more-btn" href="${u(P.finds)}">${esc(L.t.finds.seeAll)}</a>
    </section></div>`
      : ""
  }
  ${
    CLIPS.items.length
      ? `<div class="wrap"><section class="block home-clips" aria-labelledby="clips-h">
      <div class="block__head"><h2 id="clips-h">${esc(L.t.clips.home)}</h2><a class="more-btn" href="${u(P.clips)}">${esc(L.t.clips.seeAll)}</a></div>
      <div class="clip-row" data-clip-row>${CLIPS.items.slice(0, 6).map((c) => clipCard(L, c, { compact: true })).join("")}</div>
      <p class="muted small clips-privacy">${esc(L.t.clips.privacy)}</p>
    </section></div>`
      : ""
  }

  <div class="wrap layout">
    <div class="col-main">
      <section class="block zone zone--news" aria-labelledby="top5">
        <span class="kicker kicker--news">✔︎ ${esc(L.t.kickerNews)}</span>
        <div class="block__head">
          <h2 id="top5">${esc(L.t.top5)}</h2>
          ${readerHtml(L)}
        </div>
        <p class="rules muted small"><span class="aud" data-aud="fans">${esc(L.t.showingFans)}</span><span class="aud" data-aud="nuevos">${esc(L.t.showingNew)}</span> ${esc(L.t.rules)}</p>
        <div class="stories">${top.map((it, i) => itemCard(L, it, { num: String(i + 1).padStart(2, "0"), variant: "story" }) + (i === 1 ? adUnit(L, "inFeed") : "")).join("")}</div>
        ${more.length ? `<h3 class="sub" id="more">${esc(L.t.moreTitle)}</h3><div class="briefs-grid">${more.map((it) => itemCard(L, it)).join("")}</div>` : ""}
        <p class="zone__more"><a class="btn btn--ghost" href="${u(P.news)}">${esc(L.t.allNews)}</a></p>
      </section>

      ${
        rumors.length
          ? `<section class="block zone zone--rumor" aria-labelledby="rumors">
        <span class="kicker kicker--rumor">⚠︎ ${esc(L.t.kickerRumor)}</span>
        <div class="block__head"><h2 id="rumors">${esc(L.t.rumorsTitle)}</h2></div>
        <p class="rumor-note small">${esc(L.t.rumorsIntro)}</p>
        <div class="briefs-grid">${rumors.map((it) => itemCard(L, it)).join("")}</div>
        <p class="zone__more"><a class="btn btn--ghost" href="${u(P.rumors)}">${esc(L.t.allRumors)}</a></p>
      </section>`
          : ""
      }

      ${
        posts && SHOW_POSTS
          ? `<section class="block" aria-labelledby="posts">
        <div class="block__head"><h2 id="posts">${esc(L.t.postsTitle)}</h2></div>
        <p class="muted">${L.t.postsIntro(esc(big.title))}</p>
        <div class="posts">${posts}</div>
      </section>`
          : ""
      }
      ${adUnit(L, "bottom")}
      ${
        context
          ? `<section class="block" aria-labelledby="ctx">
        <div class="block__head"><h2 id="ctx">${esc(L.t.ctxTitle)}</h2></div>
        <p class="muted small">${esc(L.t.ctxIntro)}</p>
        <ul class="ctx-list">${context}</ul>
      </section>`
          : ""
      }

      <nav class="pager" aria-label="${esc(L.t.otherDays)}">
        ${older ? `<a href="${u(P.brief(older.date))}">← ${esc(fmtDate(L, older.date, { day: "numeric", month: "long" }))}</a>` : "<span></span>"}
        ${newer ? `<a href="${u(P.brief(newer.date))}">${esc(fmtDate(L, newer.date, { day: "numeric", month: "long" }))} →</a>` : ""}
      </nav>
    </div>

    <aside class="col-side">
      <div class="card">
        <h2 class="card__title">${esc(L.t.tenSec)}</h2>
        <ul class="facts">${guide.facts.slice(0, 4).map((f) => `<li><span>${esc(f.label)}</span><b>${esc(f.value)}</b></li>`).join("")}</ul>
        <a class="btn btn--primary btn--block" href="${u(P.guide)}">${esc(L.t.guideCta)}</a>
      </div>
      ${adUnit(L, "sidebar", "ad--sticky")}
      <div class="card">
        <h2 class="card__title">${esc(L.t.prev)}</h2>
        <ul class="mini-archive">${archive}</ul>
        <a class="link" href="${u(P.archive)}">${esc(L.t.fullArchive)}</a>
      </div>
      <div class="card card--cta">
        <h2 class="card__title">${esc(L.t.ctaTitle)}</h2>
        <p class="small">${esc(L.t.ctaText)}</p>
        <a class="btn btn--ghost btn--block" href="${u(P.feed)}">${icon.rss} ${esc(L.t.rss)}</a>
        <button class="btn btn--primary btn--block" type="button" data-install hidden>${I(uiIcon.install)}${esc(L.t.app.install)}</button>
        <p class="ios-tip small" data-ios-tip hidden><b>${esc(L.t.app.iosTitle)}</b><br>${esc(L.t.app.iosSteps)}</p>
      </div>
    </aside>
  </div>`;
};

// ---------- listado de noticias o de rumores ----------
const listBody = (L, kind) => {
  const { items } = DATA[L.code];
  const P = L.paths;
  const rumor = kind === "rumor";
  const list = items.filter((i) => i.kind === kind);
  const days = new Map();
  list.forEach((i) => days.set(i.date, [...(days.get(i.date) || []), i]));
  return `
  <section class="page-head page-head--${kind}"><div class="wrap">
    <nav class="seg" aria-label="${esc(L.t.ux.segLabel)}"><a href="${u(P.news)}"${rumor ? "" : ' aria-current="page"'}>${I(uiIcon.check)}${esc(L.t.ux.seg.news)} <span>${items.filter((i) => i.kind === "news").length}</span></a><a href="${u(P.rumors)}"${rumor ? ' aria-current="page"' : ""}>${I(uiIcon.warn)}${esc(L.t.ux.seg.rumors)} <span>${items.filter((i) => i.kind === "rumor").length}</span></a></nav>
    <span class="kicker kicker--${kind}">${rumor ? "⚠\uFE0E " + esc(L.t.kickerRumor) : "✔\uFE0E " + esc(L.t.kickerNews)}</span>
    <h1>${esc(rumor ? L.t.rumorsH1 : L.t.newsH1)}</h1><p class="muted">${esc(rumor ? L.t.rumorsIntro : L.t.newsIntro)}</p></div></section>
  <div class="wrap layout">
    <div class="col-main">
      ${
        rumor
          ? `<div class="legend"><b>${esc(L.t.legendTitle)}</b><ul>${["alta", "media", "baja"].map((r) => `<li>${relMeter(L, r)}<span>${esc(L.t.legend[r])}</span></li>`).join("")}</ul></div>`
          : ""
      }
      <div class="toolbar">
        ${
          rumor
            ? `<div class="reader"><span class="reader__label">${esc(L.t.filterLabel)}</span><div class="filter" role="group" aria-label="${esc(L.t.filterLabel)}">
          <button type="button" data-rel-filter="all" aria-pressed="true">${esc(L.t.filterAll)}</button>
          ${["alta", "media", "baja"].map((r) => `<button type="button" data-rel-filter="${r}" aria-pressed="false">${esc(L.t.reliabilityShort[r])}</button>`).join("")}
        </div></div>`
            : ""
        }
        ${readerHtml(L)}
      </div>
      ${list.length ? "" : `<p class="muted">${esc(L.t.emptyList)}</p>`}
      ${[...days]
        .map(
          ([d, arr]) => `
      <section class="day" data-day>
        <h2 class="day__title"><time datetime="${d}">${esc(fmtDate(L, d))}</time></h2>
        <div class="briefs-grid">${arr.map((it) => itemCard(L, it)).join("")}</div>
      </section>`
        )
        .join("")}
      ${adUnit(L, "bottom")}
    </div>
    <aside class="col-side">
      <a class="hub__tile hub__tile--${rumor ? "news" : "rumors"}" href="${u(rumor ? P.news : P.rumors)}"><span class="hub__icon" aria-hidden="true">${rumor ? tabIcon.news : tabIcon.rumors}</span><span class="hub__txt"><b>${esc(rumor ? L.t.nav.news : L.t.nav.rumors)}</b><small>${esc(rumor ? L.t.kickerNews : L.t.kickerRumor)}</small></span></a>
      ${sideCards(L)}
    </aside>
  </div>`;
};

// ---------- página de detalle de una noticia o un rumor ----------
const itemBody = (L, it) => {
  const { items } = DATA[L.code];
  const P = L.paths;
  const rumor = it.kind === "rumor";
  const pageUrl = abs(it.path);
  const listPath = rumor ? P.rumors : P.news;
  const same = items.filter((i) => i.kind === it.kind);
  const idx = same.indexOf(it);
  const newer = same[idx - 1];
  const older = same[idx + 1];
  const related = items
    .filter((i) => i.date === it.date && i !== it)
    .sort((a, b) => (a.kind === it.kind ? 0 : 1) - (b.kind === it.kind ? 0 : 1))
    .slice(0, 4);
  const paras = (x) => (Array.isArray(x) ? x : String(x).split(/\n\s*\n/)).map((p) => `<p>${esc(p)}</p>`).join("");
  return `
  <section class="page-head page-head--${it.kind}"><div class="wrap">
    <nav class="crumbs" aria-label="${esc(L.t.crumbs)}"><a href="${u(P.home)}">${esc(L.t.nav.home)}</a><span aria-hidden="true">›</span><a href="${u(listPath)}">${esc(rumor ? L.t.nav.rumors : L.t.nav.news)}</a></nav>
    <div class="story__meta">${metaTags(L, it)}</div>
    <h1 class="article__title">${esc(it.title)}</h1>
    <div class="article__tools"><p class="muted small"><time datetime="${it.date}">${esc(fmtDate(L, it.date))}</time></p>${saveBtn(L, { u: u(it.path), t: it.title, k: rumor ? "rumor" : "news" }, { label: true })}</div>
  </div></section>
  <div class="wrap layout">
    <div class="col-main">
      <article class="article">
        ${
          rumor
            ? `<div class="rumor-banner"><b>⚠︎ ${esc(L.t.rumorBannerTitle)}</b><p>${esc(L.t.rumorBanner)}</p>
          ${it.who ? `<p><strong>${esc(L.t.who)}</strong> ${esc(it.who)}</p>` : ""}
          <p class="rumor-banner__rel">${relMeter(L, it.reliability)}<span>${esc(L.t.legend[it.reliability])}</span></p></div>`
            : ""
        }
        <p class="article__lead">${esc(it.change)}</p>
        <div class="plainbox"><b>${esc(L.t.plainTitle)}</b><p>${esc(it.plain || it.change)}</p></div>
        ${it.detail ? `<h2>${esc(L.t.details)}</h2>${paras(it.detail)}` : ""}
        ${it.why ? `<h2>${esc(L.t.why)}</h2>${paras(it.why)}` : ""}
        <h2>${esc(L.t.originals)}</h2>
        <p class="muted small">${esc(L.t.originalsNote)}</p>
        ${sourcesHtml(L, it.sources)}
        <div class="article__share">${shareLinks(L, it.title, pageUrl)}
          <button class="btn btn--ghost" type="button" data-native-share data-title="${esc(it.title)}" data-url="${pageUrl}">${esc(L.t.share)}</button></div>
      </article>
      ${adUnit(L, "bottom")}
      ${
        related.length
          ? `<section class="block block--related" aria-labelledby="rel"><div class="block__head"><h2 id="rel">${esc(L.t.moreToday)}</h2></div>
        <div class="briefs-grid">${related.map((r) => itemCard(L, r)).join("")}</div></section>`
          : ""
      }
      <nav class="pager pager--items" aria-label="${esc(rumor ? L.t.nav.rumors : L.t.nav.news)}">
        ${older ? `<a href="${u(older.path)}">← ${esc(older.title)}</a>` : "<span></span>"}
        ${newer ? `<a href="${u(newer.path)}">${esc(newer.title)} →</a>` : ""}
      </nav>
      <p><a class="btn btn--ghost" href="${u(listPath)}">${esc(rumor ? L.t.allRumors : L.t.allNews)}</a></p>
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`;
};

const briefJsonLd = (L, b) => ({
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline: b.title,
  description: b.summary,
  inLanguage: L.code,
  datePublished: `${b.date}T07:00:00+01:00`,
  dateModified: BUILD_TIME,
  mainEntityOfPage: abs(L.paths.brief(b.date)),
  image: [abs(L.code === "es" ? "/assets/og.png" : `/assets/og-${L.code}.png`)],
  author: { "@type": "Organization", name: cfg.name, url: abs(L.paths.about) },
  publisher,
  about: { "@type": "VideoGame", name: "Grand Theft Auto VI" },
  citation: b.stories.flatMap((s) => s.sources.map((x) => x.url)),
});

// ---------- construir ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, "assets"), path.join(OUT, "assets"), { recursive: true });

const sitemap = []; // [clave, ruta, lastmod, changefreq, priority]

// Firmas de contenido por sección (para el punto de «novedades» en las pestañas)
for (const code of ACTIVE) {
  SECTION_SIG[code] = {
    news: sig(DATA[code].items.slice(0, 80).map((i) => i.key)),
    cheats: sig(TRUCOS.cheats.map((c) => `${c.id}:${c.status}`)),
    community: sig([...CLIPS.items.map((c) => c.id), ...FINDS.items.map((f) => f.id)]),
    guide: sig([...GUIAS.map((g) => `${g.id}:${g.updated}`), ...PATCHES.entries.map((e) => `${e.id}:${e.state}`), QUIZ.updated]),
  };
}

for (const code of ACTIVE) {
  const L = LOCALES[code];
  const P = L.paths;
  const { briefs, guide } = DATA[code];
  const latest = briefs[0];
  const dLong = (d) => fmtDate(L, d, { day: "numeric", month: "long", year: "numeric" });

  // Inicio
  write(
    P.home,
    layout(L, {
      title: L.t.homeTitle,
      description: L.t.homeDesc,
      key: "home",
      active: "home",
      body: briefBody(L, latest),
      jsonLd: [
        { "@context": "https://schema.org", "@type": "WebSite", name: cfg.name, url: abs(P.home), inLanguage: code, description: L.t.description, publisher },
        briefJsonLd(L, latest),
      ],
    })
  );
  sitemap.push(["home", P.home, latest.date, "daily", "1.0"]);

  // Un resumen por día
  for (const b of briefs) {
    write(
      P.brief(b.date),
      layout(L, {
        title: b.title,
        description: b.summary,
        key: `brief:${b.date}`,
        active: "archive",
        type: "article",
        published: `${b.date}T07:00:00+01:00`,
        body: briefBody(L, b),
        jsonLd: [briefJsonLd(L, b)],
      })
    );
    sitemap.push([`brief:${b.date}`, P.brief(b.date), b.date, "monthly", "0.8"]);
  }

  // Noticias y rumores: listados y una página de detalle por elemento
  for (const [kind, key] of [["news", "news"], ["rumor", "rumors"]]) {
    write(P[key], layout(L, { title: kind === "rumor" ? L.t.rumorsPageTitle : L.t.newsTitle, description: kind === "rumor" ? L.t.rumorsDesc : L.t.newsDesc, key, active: key, body: listBody(L, kind) }));
    sitemap.push([key, P[key], latest.date, "daily", "0.9"]);
  }
  for (const it of DATA[code].items) {
    const rumor = it.kind === "rumor";
    const title = rumor ? `${L.t.rumor}: ${it.title}` : it.title;
    write(
      it.path,
      layout(L, {
        title,
        description: it.plain || it.change,
        key: it.key,
        active: rumor ? "rumors" : "news",
        type: "article",
        published: `${it.date}T07:00:00+01:00`,
        body: itemBody(L, it),
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: title.slice(0, 110),
            description: it.change,
            inLanguage: code,
            datePublished: `${it.date}T07:00:00+01:00`,
            dateModified: BUILD_TIME,
            mainEntityOfPage: abs(it.path),
            image: [abs(code === "es" ? "/assets/og.png" : `/assets/og-${code}.png`)],
            author: { "@type": "Organization", name: cfg.name, url: abs(P.about) },
            publisher,
            citation: it.sources.map((x) => x.url),
          },
          crumbsLd([[L.t.crumbHome, P.home], [rumor ? L.t.nav.rumors : L.t.nav.news, rumor ? P.rumors : P.news], [it.title, it.path]]),
        ],
      })
    );
    sitemap.push([it.key, it.path, it.date, "monthly", "0.7"]);
  }

  // ¿A qué hora sale? (búsqueda clave de la semana de lanzamiento)
  {
    const zones = code === "es"
      ? [["España (peninsular)", "Europe/Madrid"], ["Canarias", "Atlantic/Canary"], ["México (centro)", "America/Mexico_City"], ["Colombia", "America/Bogota"], ["Perú", "America/Lima"], ["Venezuela", "America/Caracas"], ["Chile", "America/Santiago"], ["Argentina", "America/Argentina/Buenos_Aires"], ["EE. UU. (Este)", "America/New_York"], ["EE. UU. (Pacífico)", "America/Los_Angeles"]]
      : [["US (Eastern)", "America/New_York"], ["US (Central)", "America/Chicago"], ["US (Mountain)", "America/Denver"], ["US (Pacific)", "America/Los_Angeles"], ["Canada (Toronto)", "America/Toronto"], ["UK", "Europe/London"], ["Spain", "Europe/Madrid"], ["Mexico (Central)", "America/Mexico_City"], ["Australia (Sydney)", "Australia/Sydney"]];
    const cloudFmt = (tz) => new Intl.DateTimeFormat(L.intl, { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(LAUNCH_UTC_CLOUD));
    write(
      P.release,
      layout(L, {
        title: L.t.releaseTitle,
        description: L.t.releaseDesc,
        key: "release",
        active: "guide",
        type: "article",
        jsonLd: [
          { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: code, mainEntity: L.t.releaseFaq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
          crumbsLd([[L.t.crumbHome, P.home], [L.t.gd.indexH1, P.guides], [L.t.releaseH1, P.release]]),
        ],
        body: `
  <section class="page-head page-head--release"><div class="wrap">
    <p class="eyebrow">${esc(L.t.releaseEyebrow)}</p><h1>${esc(L.t.releaseH1)}</h1><p class="lead-text">${esc(L.t.releaseLead)}</p>
    <p class="post-only release-out">${esc(L.t.releaseOut)}</p>
    <div class="release-cd">${countdown(L, "lg")}</div>
    <p class="your-tz muted small" data-your-tz="${esc(L.t.releaseYourTz("{tz}"))}"></p>
  </div></section>
  <div class="wrap layout">
    <div class="col-main">
      <section class="block" aria-labelledby="by-country"><div class="block__head"><h2 id="by-country">${esc(L.t.releaseTable)}</h2></div>
        <div class="table-wrap"><table class="tz-table">
          <thead><tr><th scope="col">${esc(L.t.releaseCountry)}</th><th scope="col">${esc(L.t.releaseConsole)}</th><th scope="col">${esc(L.t.releaseCloud)}</th></tr></thead>
          <tbody>${zones.map(([n, tz]) => `<tr><th scope="row">${esc(n)}</th><td>${esc(L.t.releaseMidnight)}</td><td>${esc(cloudFmt(tz))}</td></tr>`).join("")}</tbody>
        </table></div>
        <p class="muted small">${esc(L.t.releaseCloudNote)}</p>
      </section>
      ${adUnit(L, "top")}
      <section class="block" aria-labelledby="before"><div class="block__head"><h2 id="before">${esc(L.t.releaseBefore)}</h2></div>
        <ul class="checklist">${L.t.releaseChecklist.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      </section>
      <section class="block" aria-labelledby="faq"><div class="block__head"><h2 id="faq">${esc(L.t.faq)}</h2></div>
        <div class="faq">${L.t.releaseFaq.map(([q, a], i) => `<details${i < 2 ? " open" : ""}><summary>${esc(q)}</summary><div class="faq__a"><p>${esc(a)}</p></div></details>`).join("")}</div>
        ${sourcesHtml(L, [
          { name: "Variety", url: "https://variety.com/2026/gaming/news/gta-6-preorders-expectations-launch-1236943278/" },
          { name: "Windows Central", url: "https://www.windowscentral.com/gaming/xbox/grand-theft-auto-6-will-be-playable-on-xbox-cloud-gaming-but-there-are-a-few-catches" },
          { name: "tbreak", url: "https://tbreak.com/gta-6-update-1-002-000/" },
        ])}
      </section>
      ${adUnit(L, "bottom")}
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
      })
    );
    sitemap.push(["release", P.release, latest.date, "daily", "0.9"]);
  }

  // Leonida: mapa y personajes (búsquedas «Leonida», «mapa GTA 6», «personajes GTA 6»)
  write(
    P.leonida,
    layout(L, {
      title: L.t.leonidaTitle,
      description: L.t.leonidaDesc,
      key: "leonida",
      active: "guide",
      type: "article",
      jsonLd: [
        { "@context": "https://schema.org", "@type": "Article", headline: L.t.leonidaTitle, description: L.t.leonidaDesc, inLanguage: code, dateModified: LEONIDA.updated, mainEntityOfPage: abs(P.leonida), author: { "@type": "Organization", name: cfg.name }, publisher, about: { "@type": "VideoGame", name: "Grand Theft Auto VI" }, image: [abs(code === "es" ? "/assets/og.png" : `/assets/og-${code}.png`)] },
        crumbsLd([[L.t.crumbHome, P.home], [L.t.gd.indexH1, P.guides], [L.t.leonidaH1, P.leonida]]),
      ],
      body: `
  <section class="page-head page-head--leonida"><div class="wrap"><p class="eyebrow">${esc(L.t.leonidaEyebrow)}</p><h1>${esc(L.t.leonidaH1)}</h1><p class="lead-text">${esc(L.t.leonidaLead)}</p></div></section>
  <div class="wrap layout">
    <div class="col-main">
      <section class="block" aria-labelledby="regions"><div class="block__head"><h2 id="regions">${esc(L.t.leonidaRegions)}</h2></div>
        <div class="region-grid">${LEONIDA.regions.map((r, i) => `<article class="region"><span class="region__n">${String(i + 1).padStart(2, "0")}</span><span class="region__icon" aria-hidden="true">${r.icon}</span><h3>${esc(r.name)}</h3><p>${esc(r[code] || r.es)}</p></article>`).join("")}</div>
      </section>
      ${adUnit(L, "top")}
      <section class="block" aria-labelledby="chars"><div class="block__head"><h2 id="chars">${esc(L.t.leonidaCharacters)}</h2></div>
        <div class="char-grid">${LEONIDA.characters.map((c) => `<article class="char"><span class="char__av" aria-hidden="true">${esc(c.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2))}</span><div><h3>${esc(c.name)}</h3><span class="tag">${esc(c["role_" + code] || c.role_es)}</span><p>${esc(c[code] || c.es)}</p></div></article>`).join("")}</div>
      </section>
      <p class="callout"><span>⚠︎ ${esc(L.t.leonidaRumor)}</span> <a href="${u(P.rumors)}">${esc(L.t.leonidaRumorCta)}</a></p>
      ${sourcesHtml(L, LEONIDA.sources)}
      ${adUnit(L, "bottom")}
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
    })
  );
  sitemap.push(["leonida", P.leonida, LEONIDA.updated, "weekly", "0.9"]);

  // Notas de la prensa
  write(
    P.reviews,
    layout(L, {
      title: L.t.reviewsTitle,
      description: L.t.reviewsDesc,
      key: "reviews",
      active: "reviews",
      type: "article",
      jsonLd: [crumbsLd([[L.t.crumbHome, P.home], [L.t.gd.indexH1, P.guides], [L.t.reviewsH1, P.reviews]])],
      body: `
  <section class="page-head page-head--reviews"><div class="wrap"><p class="eyebrow">${esc(L.t.reviewsEyebrow)}</p><h1>${esc(L.t.reviewsH1)}</h1><p class="lead-text">${esc(L.t.reviewsLead)}</p></div></section>
  <div class="wrap layout">
    <div class="col-main">
      ${
        reviewList.length
          ? `${(REVIEWS.aggregates || []).length ? `<h2 class="sub-title">${esc(L.t.reviewsAggTitle)}</h2><div class="agg-grid">${REVIEWS.aggregates.map((a) => `<div class="score-hero score-hero--agg"><div class="score-ring" style="--p:${Math.round((a.score / (a.max || 100)) * 100)}"><b>${esc(String(a.score))}</b><small>/${esc(String(a.max || 100))}</small></div><div><h3>${esc(a.name)}</h3><p class="muted small">${esc(L.t.reviewsAggNote(a.source))} <a href="${esc(a.url)}" target="_blank" rel="noopener nofollow">${esc(a.source)} ↗</a></p></div></div>`).join("")}</div>` : ""}
      <div class="score-hero"><div class="score-ring" style="--p:${reviewAvg}"><b>${reviewAvg}</b><small>/100</small></div><div><h2>${esc(L.t.reviewsListAvg)}</h2><p class="muted">${esc(L.t.reviewsCount(reviewList.length))}</p></div></div>
      <div class="table-wrap"><table class="tz-table score-table"><thead><tr><th scope="col">${esc(L.t.reviewsOutlet)}</th><th scope="col">${esc(L.t.reviewsScore)}</th><th scope="col"></th></tr></thead>
        <tbody>${reviewList.map((r) => `<tr><th scope="row">${esc(r.outlet)}</th><td><span class="score score--${r.pct >= 90 ? "hi" : r.pct >= 75 ? "mid" : "lo"}">${esc(String(r.score))}${r.max !== 100 ? `/${esc(String(r.max))}` : ""}</span></td><td><a href="${esc(r.url)}" target="_blank" rel="noopener nofollow">${esc(r.via ? L.t.reviewsVia(r.via) : L.t.reviewsRead)} ↗</a></td></tr>`).join("")}</tbody></table></div>`
          : `<div class="empty-state"><span aria-hidden="true">${gIcon.clock}</span><p>${esc(L.t.reviewsEmpty)}</p><div class="release-cd">${countdown(L, "sm")}</div></div>`
      }
      <p class="muted small">${esc(L.t.reviewsNote)}</p>
      ${adUnit(L, "bottom")}
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
    })
  );
  sitemap.push(["reviews", P.reviews, REVIEWS.updated, "daily", "0.9"]);

  // Trucos: códigos dibujados paso a paso, con su requisito y su estado
  {
    const T = L.t.cheats;
    const withCode = TRUCOS.cheats.filter((c) => c.seq);
    const pending = TRUCOS.cheats.filter((c) => !c.seq);
    const holdL = '<span class="btn-ps">L1</span><span class="btn-xb">LB</span>';
    const holdR = '<span class="btn-ps">R1</span><span class="btn-xb">RB</span>';
    const steps = TRUCOS.howTo[code] || TRUCOS.howTo.es;
    const stepIc = [cheatIcon.phone, cheatIcon.hold, cheatIcon.dpad];
    const card = (c) => `
      <article class="cheat cheat--${c.cat}${c.seq ? "" : " cheat--pending"}" id="${esc(c.id)}">
        <div class="cheat__head">
          <span class="cheat__ic" aria-hidden="true">${cheatIcon[c.cat] || cheatIcon.world}</span>
          <div class="cheat__ttl"><span class="cheat__cat">${esc(T.cats[c.cat] || "")}${isFresh(c.added) && c.seq ? ` <span class="cheat__new">${esc(T.isNew)}</span>` : ""}</span><h3>${esc(c.name[code] || c.name.es)}</h3></div>
          ${saveBtn(L, { u: `${u(P.cheats)}#${c.id}`, t: `${L.t.cheats.tile}: ${c.name[code] || c.name.es}`, k: "cheat" })}
        </div>
        <p class="cheat__fx">${esc(c.effect[code] || c.effect.es)}</p>
        ${
          c.seq
            ? `<div class="cheat__seq"><span class="cheat__hold" aria-hidden="true">${cheatIcon.phone}<b>+</b><span class="cbtn">${holdL}</span><span class="cbtn">${holdR}</span><b>+</b></span>
          <ol class="pads" aria-label="${esc(T.seqLabel(c.seq.length))}">${c.seq.map((d) => dirKey(L, d)).join("")}</ol></div>
        ${c.unlock ? `<p class="cheat__unlock">${cheatIcon.lock}<span><b>${esc(T.unlock)}</b> ${esc(c.unlock[code] || c.unlock.es)}</span></p>` : ""}
        <p class="cheat__status cheat__status--ok">${tabIcon.check}${esc(T.status.coincide)}</p>`
            : `<p class="cheat__status cheat__status--wait">${I(gIcon.clock)}${esc(T.status.pendiente)}</p><p class="muted small">${esc(T.pending)}</p>`
        }
      </article>`;
    write(
      P.cheats,
      layout(L, {
        title: T.title,
        description: T.desc,
        key: "cheats",
        active: "cheats",
        type: "article",
        jsonLd: [
          { "@context": "https://schema.org", "@type": "Article", inLanguage: code, headline: T.title, description: T.desc, dateModified: TRUCOS.updated, author: { "@type": "Organization", name: cfg.name }, publisher: { "@type": "Organization", name: cfg.name } },
          { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: code, mainEntity: T.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
          crumbsLd([[L.t.crumbHome, P.home], [L.t.gd.indexH1, P.guides], [T.h1, P.cheats]]),
        ],
        body: `
  <section class="page-head page-head--cheats"><div class="wrap"><p class="eyebrow">${esc(T.eyebrow)}</p><h1>${esc(T.h1)}</h1><p class="lead-text">${esc(T.lead)}</p></div></section>
  <div class="wrap layout" data-cheats>
    <div class="col-main">
      <div class="plat" role="group" aria-label="${esc(T.platLabel)}">
        <span class="plat__label">${esc(T.platLabel)}</span>
        <button type="button" data-plat="ps" aria-pressed="true">PS5</button><button type="button" data-plat="xb" aria-pressed="false">Xbox Series</button>
      </div>
      <section class="block cheat-how" aria-labelledby="como"><div class="block__head"><h2 id="como">${esc(T.howTitle)}</h2></div>
        <ol class="steps steps--how">${steps.map((t, i) => `<li><span class="steps__n">${i + 1}</span><span class="steps__ic">${stepIc[i] || cheatIcon.dpad}</span><span class="steps__t">${t.replace("{L}", holdL).replace("{R}", holdR)}</span></li>`).join("")}</ol>
      </section>
      <section class="block" aria-labelledby="lista"><div class="block__head"><h2 id="lista">${esc(T.listTitle)}</h2><span class="muted small">${esc(T.count(withCode.length, pending.length))}</span></div>
        <div class="cheat-grid">${withCode.map(card).join("")}${pending.map(card).join("")}</div>
      </section>
      <aside class="callout callout--warn"><h2>⚠︎ ${esc(T.warnTitle)}</h2><ul>${T.warn.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></aside>
      ${adUnit(L, "bottom")}
      <section class="block" aria-labelledby="faq"><div class="block__head"><h2 id="faq">${esc(L.t.faq)}</h2></div>
        <div class="faq">${T.faq.map(([q, a], i) => `<details${i < 1 ? " open" : ""}><summary>${esc(q)}</summary><div class="faq__a"><p>${esc(a)}</p></div></details>`).join("")}</div>
      </section>
      <p class="muted small">${esc(T.updated(fmtDate(L, TRUCOS.updated, { day: "numeric", month: "long", year: "numeric" })))}</p>
      ${sourcesHtml(L, TRUCOS.sources)}
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
      })
    );
    sitemap.push(["cheats", P.cheats, TRUCOS.updated, "weekly", "0.9"]);
  }

  // Clips de la comunidad (se renueva cada día)
  {
    const T = L.t.clips;
    const langs = [...new Set(CLIPS.items.map((c) => c.lang))];
    write(
      P.clips,
      layout(L, {
        title: T.title,
        description: T.desc,
        key: "clips",
        active: "clips",
        jsonLd: [
          { "@context": "https://schema.org", "@type": "CollectionPage", inLanguage: code, name: T.h1, description: T.desc, dateModified: CLIPS.updated },
          ...(CLIPS.items.length
            ? [{ "@context": "https://schema.org", "@type": "ItemList", itemListElement: CLIPS.items.slice(0, 30).map((c, i) => ({ "@type": "ListItem", position: i + 1, url: c.url, name: c.title })) }]
            : []),
          { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: code, mainEntity: T.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
        ],
        body: `
  <section class="page-head page-head--clips"><div class="wrap">${seg2(L, "clips")}<p class="eyebrow">${esc(T.eyebrow)}</p><h1>${esc(T.h1)}</h1><p class="lead-text">${esc(T.lead)}</p></div></section>
  <div class="wrap layout">
    <div class="col-main">
      <div class="clips-bar">
        ${langs.length > 1 ? `<div class="filter" role="group" data-clip-filter><button type="button" data-cl="all" aria-pressed="true">${esc(T.all)}</button>${["es", "en"].filter((x) => langs.includes(x)).map((x) => `<button type="button" data-cl="${x}" aria-pressed="false">${esc(T.langs[x])}</button>`).join("")}</div>` : ""}
        <button type="button" class="clips-thumbs" data-thumbs-toggle data-on="${esc(T.thumbsOn)}" data-off="${esc(T.thumbsOff)}">${esc(T.thumbsOn)}</button>
      </div>
      <p class="muted small clips-privacy">${esc(T.privacy)}</p>
      <div class="clips" data-clips>${CLIPS.items.map((c) => clipCard(L, c)).join("")}</div>
      <p class="muted small" data-clips-none hidden>${esc(T.empty)}</p>
      <p class="callout clips-credit">${I(tabIcon.community)} ${esc(T.credit)}</p>
      ${adUnit(L, "bottom")}
      <section class="block"><div class="block__head"><h2>${esc(L.t.gd.faqTitle)}</h2></div><div class="faq">${T.faq.map(([q, a], i) => `<details${i < 1 ? " open" : ""}><summary>${esc(q)}</summary><div class="faq__a"><p>${esc(a)}</p></div></details>`).join("")}</div></section>
      <p class="muted small">${esc(T.updated(fmtDate(L, CLIPS.updated, { day: "numeric", month: "long", year: "numeric" })))}</p>
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
      })
    );
    sitemap.push(["clips", P.clips, CLIPS.updated, "daily", "0.9"]);
  }

  // Secretos y descubrimientos (se renueva cada día)
  {
    const T = L.t.finds;
    const cats = [...new Set(FINDS.items.map((f) => f.cat))];
    write(
      P.finds,
      layout(L, {
        title: T.title,
        description: T.desc,
        key: "finds",
        active: "finds",
        type: "article",
        jsonLd: [
          { "@context": "https://schema.org", "@type": "Article", inLanguage: code, headline: T.title, description: T.desc, dateModified: FINDS.updated, author: { "@type": "Organization", name: cfg.name }, publisher: { "@type": "Organization", name: cfg.name } },
          { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: code, mainEntity: T.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
          crumbsLd([[L.t.crumbHome, P.home], [L.t.gd.indexH1, P.guides], [T.h1, P.finds]]),
        ],
        body: `
  <section class="page-head page-head--finds"><div class="wrap">${seg2(L, "finds")}<p class="eyebrow">${esc(T.eyebrow)}</p><h1>${esc(T.h1)}</h1><p class="lead-text">${esc(T.lead)}</p></div></section>
  <div class="wrap layout">
    <div class="col-main">
      ${cats.length > 1 ? `<div class="filter" role="group" data-find-filter><button type="button" data-fcat="all" aria-pressed="true">${esc(T.all)}</button>${cats.map((c) => `<button type="button" data-fcat="${esc(c)}" aria-pressed="false">${esc(T.cats[c] || c)}</button>`).join("")}</div>` : ""}
      <p class="muted small">${esc(T.count(FINDS.items.length))}</p>
      <div class="finds" data-finds>${FINDS.items.map((f) => findCard(L, f)).join("")}</div>
      <p class="muted small" data-finds-none hidden>${esc(T.none)}</p>
      ${adUnit(L, "bottom")}
      <section class="block"><div class="block__head"><h2>${esc(L.t.gd.faqTitle)}</h2></div><div class="faq">${T.faq.map(([q, a], i) => `<details${i < 1 ? " open" : ""}><summary>${esc(q)}</summary><div class="faq__a"><p>${esc(a)}</p></div></details>`).join("")}</div></section>
      <p class="muted small">${esc(T.updated(fmtDate(L, FINDS.updated, { day: "numeric", month: "long", year: "numeric" })))}</p>
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
      })
    );
    sitemap.push(["finds", P.finds, FINDS.updated, "daily", "0.9"]);
  }

  // Parches y problemas (estado del juego)
  {
    const T = L.t.patch;
    const st = PATCHES.status;
    const plat = { ps5: "PS5", xbox: "Xbox Series" };
    write(
      P.patches,
      layout(L, {
        title: T.title,
        description: T.desc,
        key: "patches",
        active: "",
        type: "article",
        jsonLd: [
          { "@context": "https://schema.org", "@type": "Article", inLanguage: code, headline: T.title, description: T.desc, dateModified: PATCHES.updated, author: { "@type": "Organization", name: cfg.name }, publisher: { "@type": "Organization", name: cfg.name } },
          { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: code, mainEntity: T.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
          crumbsLd([[L.t.crumbHome, P.home], [L.t.gd.indexH1, P.guides], [T.h1, P.patches]]),
        ],
        body: `
  <section class="page-head page-head--patches"><div class="wrap"><p class="eyebrow">${esc(T.eyebrow)}</p><h1>${esc(T.h1)}</h1><p class="lead-text">${esc(T.lead)}</p></div></section>
  <div class="wrap layout">
    <div class="col-main">
      <div class="pstatus pstatus--${esc(st.level)}"><span class="pstatus__ic" aria-hidden="true">${findIcon.shield}</span><div><b>${esc(T.now)} · ${esc(T.level[st.level] || "")}</b><p>${esc(st[code] || st.es)}</p></div></div>
      <section class="block"><div class="block__head"><h2>${esc(T.timeline)}</h2></div>
        <ol class="ptl">${PATCHES.entries
          .map(
            (e) => `<li class="ptl__item ptl__item--${esc(e.type)} ptl__item--${esc(e.state)}" id="${esc(e.id)}">
          <span class="ptl__dot" aria-hidden="true">${findIcon[e.type] || findIcon.update}</span>
          <div class="ptl__body">
            <div class="ptl__meta"><time datetime="${e.date}">${esc(fmtDate(L, e.date, { day: "numeric", month: "long" }))}</time><span class="ptl__type">${esc(T.type[e.type] || "")}</span><span class="ptl__state">${esc(T.state[e.state] || "")}</span>${(e.platforms || []).map((p) => `<span class="ptl__plat">${esc(plat[p] || p)}</span>`).join("")}</div>
            <h3>${esc(e.title[code] || e.title.es)}${e.version ? ` <small>${esc(T.version)} ${esc(e.version)}</small>` : ""}</h3>
            <p>${esc(e.text[code] || e.text.es)}</p>
            ${sourcesHtml(L, e.sources)}
          </div></li>`
          )
          .join("")}</ol>
      </section>
      <section class="block phelp"><div class="block__head"><h2>${esc(T.helpTitle)}</h2></div>
        <ol class="steps">${T.help.map(([h, t], i) => `<li><span class="steps__n">${i + 1}</span><span class="steps__ic">${[findIcon.shield, gIcon.phone, findIcon.issue, gIcon.save][i] || findIcon.tip}</span><span class="steps__t"><b>${esc(h)}.</b> ${t}</span></li>`).join("")}</ol>
      </section>
      ${adUnit(L, "bottom")}
      <section class="block"><div class="block__head"><h2>${esc(L.t.gd.faqTitle)}</h2></div><div class="faq">${T.faq.map(([q, a], i) => `<details${i < 1 ? " open" : ""}><summary>${esc(q)}</summary><div class="faq__a"><p>${esc(a)}</p></div></details>`).join("")}</div></section>
      <p class="muted small">${esc(T.updated(fmtDate(L, PATCHES.updated, { day: "numeric", month: "long", year: "numeric" })))}</p>
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
      })
    );
    sitemap.push(["patches", P.patches, PATCHES.updated, "daily", "0.9"]);
  }

  // Guías útiles (no caducan): consejos, dinero, radio, duración…
  {
    const G = L.t.gd;
    const others = (id) => [
      ...GUIAS.filter((x) => x.id !== id).map((x) => ({ href: P.guideItem(x.slug[code]), ic: gIcon[x.icon] || gIcon.book, t: x.h1[code], d: x.short[code] })),
      { href: P.cheats, ic: gIcon.cheat, t: L.t.cheats.h1, d: L.t.cheats.tileSub(TRUCOS.cheats.filter((c) => c.seq).length) },
      { href: P.guide, ic: gIcon.book, t: G.basics, d: G.basicsSub },
    ];
    const gcard = (x) => `<a class="gcard" href="${u(x.href)}"><span class="gcard__ic" aria-hidden="true">${x.ic}</span><span class="gcard__txt"><b>${esc(x.t)}</b><small>${esc(x.d)}</small></span><span class="gcard__go" aria-hidden="true">→</span></a>`;
    const section = (sec) => {
      const title = `<div class="block__head"><h2>${esc(sec.title[code])}</h2></div>`;
      if (sec.type === "tips")
        return `<section class="block">${title}<ol class="tips">${sec.items.map((it) => `<li class="tip"><span class="tip__ic" aria-hidden="true">${gIcon[it.ic] || gIcon.tips}</span><div><h3>${esc(it.t[code])}</h3><p>${esc(it.d[code])}</p>${it.link === "cheats" ? `<a class="tip__more" href="${u(P.cheats)}">${esc(G.seeCheats)}</a>` : it.link === "progress" ? `<a class="tip__more" href="${u(P.progress)}">${esc(G.seeProgress)}</a>` : ""}</div></li>`).join("")}</ol></section>`;
      if (sec.type === "methods")
        return `<section class="block">${title}<ol class="methods">${sec.items.map((it) => `<li class="method method--s${it.stage}"><span class="method__dot" aria-hidden="true">${gIcon[it.ic] || gIcon.money}</span><div class="method__body"><div class="method__top"><h3>${esc(it.t[code])}</h3><span class="method__pay">${esc(it.pay[code])}</span></div><p class="method__when"><span class="method__stage">${esc(G.stage[it.stage] || "")}</span> ${esc(it.when[code])}</p><p>${esc(it.d[code])}</p>${it.link === "cheats" ? `<a class="tip__more" href="${u(P.cheats)}">${esc(G.seeCheats)}</a>` : it.link === "progress" ? `<a class="tip__more" href="${u(P.progress)}">${esc(G.seeProgress)}</a>` : ""}</div></li>`).join("")}</ol></section>`;
      if (sec.type === "stations")
        return `<section class="block">${title}<div class="stations">${sec.items.map((it) => `<article class="station" style="--h:${Number(it.hue) || 0}"><span class="station__ic" aria-hidden="true">${gIcon.radio}</span><div><h3>${esc(it.name)}</h3><span class="station__genre">${esc(it.genre[code])}</span><p><b>${esc(G.hosts)}:</b> ${esc(it.hosts)}</p></div></article>`).join("")}</div></section>`;
      if (sec.type === "facts")
        return `<section class="block">${title}<ul class="facts-st">${sec.items.map((it) => `<li class="fst fst--${esc(it.s)}"><span class="fst__chip">${it.s === "ok" ? I(uiIcon.check) : it.s === "rumor" ? I(uiIcon.warn) : I(gIcon.clock)}${esc(G.facts[it.s] || "")}</span><div><h3>${esc(it.t[code])}</h3><p>${esc(it.d[code])}</p></div></li>`).join("")}</ul></section>`;
      if (sec.type === "bars")
        return `<section class="block">${title}<ul class="hbars">${sec.items.map((it) => `<li class="${it.hl ? "is-hl" : ""}"><span class="hbars__t">${esc(it.t[code])}</span><span class="hbars__track"><span class="hbars__fill" style="--w:${Math.min(100, Math.round((it.v / (sec.max || 100)) * 100))}%"></span></span><b class="hbars__v">${esc(it.label[code])}</b></li>`).join("")}</ul></section>`;
      return "";
    };
    for (const g of GUIAS) {
      const href = P.guideItem(g.slug[code]);
      const faq = g.faq?.[code] || [];
      write(
        href,
        layout(L, {
          title: g.title[code],
          description: g.desc[code],
          key: `g:${g.id}`,
          active: "guide",
          type: "article",
          jsonLd: [
            { "@context": "https://schema.org", "@type": "Article", inLanguage: code, headline: g.title[code], description: g.desc[code], dateModified: g.updated, author: { "@type": "Organization", name: cfg.name }, publisher: { "@type": "Organization", name: cfg.name } },
            ...(faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: code, mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }] : []),
            crumbsLd([[L.t.crumbHome, P.home], [G.indexH1, P.guides], [g.h1[code], href]]),
          ],
          body: `
  <section class="page-head page-head--guide"><div class="wrap"><p class="eyebrow">${esc(G.indexEyebrow)}</p><h1>${esc(g.h1[code])}</h1><p class="lead-text">${esc(g.lead[code])}</p>${saveBtn(L, { u: u(href), t: g.h1[code], k: "guide" }, { label: true })}</div></section>
  <div class="wrap layout">
    <div class="col-main">
      <div class="quick"><span class="quick__ic" aria-hidden="true">${gIcon[g.icon] || gIcon.tips}</span><div><b>${esc(G.quick)}</b><p>${esc(g.quick[code])}</p></div></div>
      ${g.sections.map(section).join("")}
      ${g.note ? `<aside class="callout callout--warn"><p>⚠︎ ${esc(g.note[code])}</p></aside>` : ""}
      ${adUnit(L, "bottom")}
      ${faq.length ? `<section class="block"><div class="block__head"><h2>${esc(G.faqTitle)}</h2></div><div class="faq">${faq.map(([q, a], i) => `<details${i < 1 ? " open" : ""}><summary>${esc(q)}</summary><div class="faq__a"><p>${esc(a)}</p></div></details>`).join("")}</div></section>` : ""}
      <p class="muted small">${esc(G.updated(fmtDate(L, g.updated, { day: "numeric", month: "long", year: "numeric" })))}</p>
      ${sourcesHtml(L, g.sources)}
      <section class="block"><div class="block__head"><h2>${esc(G.related)}</h2></div><div class="gcards">${others(g.id).map(gcard).join("")}</div></section>
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
        })
      );
      sitemap.push([`g:${g.id}`, href, g.updated, "weekly", "0.9"]);
    }
    // Índice de guías, agrupado por lo que busca la gente
    const gi = (id) => GUIAS.find((x) => x.id === id);
    const gItem = (x) => x && { href: P.guideItem(x.slug[code]), ic: gIcon[x.icon] || gIcon.book, t: x.h1[code], d: x.short[code] };
    const groups = [
      [L.t.ux.groups.play, [
        { href: P.cheats, ic: gIcon.cheat, t: L.t.cheats.h1, d: L.t.cheats.tileSub(TRUCOS.cheats.filter((c) => c.seq).length) },
        { href: P.finds, ic: findIcon.easter, t: L.t.finds.h1, d: L.t.finds.tileSub(FINDS.items.length) },
        { href: P.clips, ic: tabIcon.community, t: L.t.clips.h1, d: L.t.clips.tileSub(CLIPS.items.length) },
        { href: P.progress, ic: gIcon.trophy, t: L.t.prog.h1, d: L.t.prog.tileSub },
        { href: P.quiz, ic: uiIcon.spark, t: L.t.quiz.tile, d: L.t.quiz.tileSub },
        gItem(gi("consejos")), gItem(gi("dinero")), gItem(gi("duracion")), gItem(gi("radio")),
        ...GUIAS.filter((x) => !["consejos", "dinero", "duracion", "radio"].includes(x.id)).map(gItem),
      ]],
      [L.t.ux.groups.status, [
        { href: P.patches, ic: findIcon.update, t: L.t.patch.h1, d: L.t.patch.level[PATCHES.status.level] || L.t.patch.tileSub },
        { href: P.reviews, ic: gIcon.trophy, t: L.t.tiles.reviews[0], d: L.t.tiles.reviews[1] },
        { href: P.release, ic: gIcon.clock, t: L.t.tiles.release[0], d: L.t.tiles.release[1] },
      ]],
      [L.t.ux.groups.world, [
        { href: P.leonida, ic: gIcon.map, t: L.t.tiles.leonida[0], d: L.t.tiles.leonida[1] },
        { href: P.guide, ic: gIcon.book, t: G.basics, d: G.basicsSub },
      ]],
    ].map(([h, list]) => [h, list.filter(Boolean)]);
    const all = groups.flatMap(([, list]) => list);
    write(
      P.guides,
      layout(L, {
        title: G.indexTitle,
        description: G.indexDesc,
        key: "guides",
        active: "guide",
        jsonLd: [
          { "@context": "https://schema.org", "@type": "ItemList", itemListElement: all.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: abs(x.href), name: x.t })) },
          crumbsLd([[L.t.crumbHome, P.home], [G.indexH1, P.guides]]),
        ],
        body: `
  <section class="page-head page-head--guide"><div class="wrap"><p class="eyebrow">${esc(G.indexEyebrow)}</p><h1>${esc(G.indexH1)}</h1><p class="lead-text">${esc(G.indexLead)}</p></div></section>
  <div class="wrap gindex">${groups.map(([h, list]) => `<section class="block"><div class="block__head"><h2>${esc(h)}</h2></div><div class="gcards gcards--index">${list.map(gcard).join("")}</div></section>`).join("")}</div>`,
      })
    );
    sitemap.push(["guides", P.guides, GUIAS.map((g) => g.updated).sort().pop(), "weekly", "0.8"]);
  }

  // Índice de búsqueda (ligero: título, resumen corto, ruta y tipo)
  {
    const S = L.t.ux.search.kinds;
    const cut = (x, n = 120) => {
      const t = String(x || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, "") + "…" : t;
    };
    const idx = [];
    // «x»: texto extra solo para encontrar (no se muestra)
    const add = (k, t, d, href, dt, x) => idx.push({ k, t: cut(t, 110), d: cut(d), u: u(href), ...(dt ? { dt } : {}), ...(x ? { x: cut(x, 400) } : {}) });
    add("page", L.t.cheats.h1, L.t.cheats.desc, P.cheats, null, L.t.cheats.lead);
    add("page", L.t.finds.h1, L.t.finds.desc, P.finds, null, `easter eggs ${L.t.finds.lead}`);
    add("page", L.t.patch.h1, L.t.patch.desc, P.patches, null, `${L.t.patch.lead} PSN PlayStation Xbox`);
    add("page", L.t.gd.indexH1, L.t.gd.indexDesc, P.guides);
    add("page", L.t.reviewsH1, L.t.reviewsDesc, P.reviews);
    add("page", L.t.releaseH1, L.t.releaseDesc || "", P.release, null, L.t.releaseDesc);
    add("page", L.t.leonidaH1, L.t.leonidaDesc || "", P.leonida, null, `${L.t.leonidaDesc} Jason Lucía Lucia Vice City`);
    add("page", L.t.gd.basics, L.t.gd.basicsSub, P.guide, null, (DATA[code].guide.faq || []).map((f) => f.q).join(" "));
    add("page", L.t.appH1, L.t.appDesc, P.app);
    add("page", L.t.newsH1, L.t.newsDesc, P.news);
    add("page", L.t.rumorsH1, L.t.rumorsDesc, P.rumors);
    for (const g of GUIAS) add("guide", g.h1[code], `${g.quick[code]}`, P.guideItem(g.slug[code]), g.updated, `${g.desc[code]} ${(g.faq?.[code] || []).map(([q]) => q).join(" ")}`);
    for (const c of TRUCOS.cheats) add("cheat", c.name[code] || c.name.es, `${c.effect[code] || c.effect.es}${c.unlock ? " " + (c.unlock[code] || c.unlock.es) : ""}`, `${P.cheats}#${c.id}`, c.added, `${L.t.cheats.cats[c.cat] || ""} ${L.t.cheats.tile}`);
    add("page", L.t.clips.h1, L.t.clips.desc, P.clips, null, "videos youtube tiktok shorts");
    add("page", L.t.quiz.h1, L.t.quiz.desc, P.quiz, null, "test quiz trivial preguntas");
    add("page", L.t.prog.h1, L.t.prog.desc, P.progress, null, "100 % completar progreso contador trofeos cartas escaneos carreras drones platino");
    for (const c of CLIPS.items) add("clip", c.title, `${c.author} · ${PLATFORM[c.platform]} · ${c.note?.[code] || c.note?.es || ""}`, `${P.clips}#clip-${c.id}`, c.date, L.t.clips.cats[c.cat] || "");
    for (const f of FINDS.items) add("find", f.title[code] || f.title.es, f.text[code] || f.text.es, `${P.finds}#${f.id}`, f.date, L.t.finds.cats[f.cat] || "");
    for (const e of PATCHES.entries) add("patch", e.title[code] || e.title.es, e.text[code] || e.text.es, `${P.patches}#${e.id}`, e.date);
    for (const it of DATA[code].items.slice(0, 600)) add(it.kind === "rumor" ? "rumor" : "news", it.title, it.plain || it.change, it.path, it.date);
    write(`/search-${code}.json`, JSON.stringify({ kinds: S, items: idx }));
  }

  // Guardados (solo en el dispositivo; no se indexa)
  write(
    P.saved,
    layout(L, {
      title: L.t.save.pageTitle,
      description: L.t.save.pageDesc,
      key: "saved",
      active: "",
      noindex: true,
      body: `
  <section class="page-head page-head--saved"><div class="wrap"><p class="eyebrow">${esc(L.t.save.title)}</p><h1>${esc(L.t.save.pageTitle)}</h1><p class="lead-text">${esc(L.t.save.lead)}</p></div></section>
  <div class="wrap saved-page" data-saved-page data-kinds='${esc(JSON.stringify(L.t.save.kinds))}' data-ask="${esc(L.t.save.clearAsk)}">
    <ul class="saved-list" data-saved-list></ul>
    <div class="empty-state" data-saved-empty hidden><span aria-hidden="true">${bookmarkSvg}</span><p>${esc(L.t.save.empty)}</p><a class="btn btn--primary" href="${u(P.guides)}">${esc(L.t.ux.allGuides)}</a></div>
    <button type="button" class="btn btn--ghost saved-clear" data-saved-clear hidden>${esc(L.t.save.clear)}</button>
  </div>`,
    })
  );

  // Mi 100 %: contador de progreso personal (se guarda en el dispositivo)
  {
    const T = L.t.prog;
    const linkOf = (k) => (k && k.startsWith("g:") ? (GUIAS.find((g) => g.id === k.slice(2)) ? P.guideItem(GUIAS.find((g) => g.id === k.slice(2)).slug[code]) : "") : "");
    const row = (it) => {
      const max = it.goal || it.max || 1;
      const lk = linkOf(it.link);
      return `<li class="pg" data-pg="${esc(it.id)}" data-kind="${it.kind}" data-max="${it.max || 1}" data-goal="${max}">
        <span class="pg__ic" aria-hidden="true">${gIcon[it.ic] || gIcon.map}</span>
        <div class="pg__body">
          <div class="pg__top"><h3>${esc(it.t[code])}</h3>${lk ? `<a class="pg__guide" href="${u(lk)}">${esc(T.guide)}</a>` : ""}</div>
          <p class="pg__d">${esc(it.d[code])}</p>
          ${
            it.kind === "check"
              ? `<button type="button" class="pg__check" data-pg-check aria-pressed="false" data-on="${esc(T.done)}" data-off="${esc(T.todo)}">${I(uiIcon.check)}<span>${esc(T.todo)}</span></button>`
              : `<div class="pg__ctl"><button type="button" class="pg__btn" data-pg-step="-1" aria-label="${esc(T.minus)}">−</button><label class="pg__val"><input type="number" inputmode="numeric" min="0" max="${it.max}" value="0" data-pg-input aria-label="${esc(T.edit)}: ${esc(it.t[code])}"><span>/ ${it.goal ? `${it.goal} (${it.max})` : it.max}</span></label><button type="button" class="pg__btn" data-pg-step="1" aria-label="${esc(T.plus)}">+</button></div>
          <div class="pg__bar"><span style="width:0%"></span></div>`
          }
        </div>
      </li>`;
    };
    write(
      P.progress,
      layout(L, {
        title: T.title,
        description: T.desc,
        key: "progress",
        active: "guide",
        jsonLd: [crumbsLd([[L.t.crumbHome, P.home], [L.t.gd.indexH1, P.guides], [T.h1, P.progress]])],
        body: `
  <section class="page-head page-head--progress"><div class="wrap"><p class="eyebrow">${esc(T.eyebrow)}</p><h1>${esc(T.h1)}</h1><p class="lead-text">${esc(T.lead)}</p></div></section>
  <div class="wrap layout">
    <div class="col-main">
      <div class="progress-app" data-progress-app data-ask="${esc(T.resetAsk)}">
        <div class="pg-total"><div class="score-ring pg-total__ring" style="--p:0"><b data-pg-total>0</b><small>%</small></div><div><h2>${esc(T.total)}</h2><p class="muted small">${I(bookmarkSvg)} ${esc(T.saved)}</p></div></div>
        <ul class="pg-list">${PROG.items.map(row).join("")}</ul>
        <button type="button" class="btn btn--ghost pg-reset" data-pg-reset>${esc(T.reset)}</button>
      </div>
      <p class="muted small">${esc(T.note)}</p>
      ${sourcesHtml(L, PROG.sources)}
      ${adUnit(L, "bottom")}
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
      })
    );
    sitemap.push(["progress", P.progress, PROG.updated, "weekly", "0.7"]);
  }

  // Test: ¿cuánto sabes de GTA 6?
  {
    const T = L.t.quiz;
    const linkOf = (k) => (k.startsWith("g:") ? (GUIAS.find((g) => g.id === k.slice(2)) ? P.guideItem(GUIAS.find((g) => g.id === k.slice(2)).slug[code]) : P.guides) : P[k] || P.guides);
    const bank = QUIZ.items.map((q) => ({ id: q.id, q: q.q[code], o: q.o[code], a: q.a, x: q.x[code], l: u(linkOf(q.link)) }));
    const data = { n: Math.min(QUIZ.count || 10, bank.length), bank, t: { q: T.q(1, 9).replace("1", "{i}").replace("9", "{n}"), right: T.right, wrong: T.wrong, more: T.more, next: T.next, finish: T.finish, score: T.score(1, 9).replace("1", "{n}").replace("9", "{t}"), best: T.best(1, 9).replace("1", "{n}").replace("9", "{t}"), tiers: T.tiers, again: T.again, share: T.share(1, 9).replace("1", "{n}").replace("9", "{t}"), shareBtn: T.shareBtn } };
    write(
      P.quiz,
      layout(L, {
        title: T.title,
        description: T.desc,
        key: "quiz",
        active: "guide",
        jsonLd: [
          { "@context": "https://schema.org", "@type": "Quiz", inLanguage: code, name: T.h1, about: "Grand Theft Auto VI", educationalLevel: "beginner", hasPart: bank.slice(0, 10).map((b) => ({ "@type": "Question", name: b.q, acceptedAnswer: { "@type": "Answer", text: b.o[b.a] } })) },
          crumbsLd([[L.t.crumbHome, P.home], [L.t.gd.indexH1, P.guides], [T.h1, P.quiz]]),
        ],
        body: `
  <section class="page-head page-head--quiz"><div class="wrap"><p class="eyebrow">${esc(T.eyebrow)}</p><h1>${esc(T.h1)}</h1><p class="lead-text">${esc(T.lead)}</p></div></section>
  <div class="wrap layout">
    <div class="col-main">
      <div class="quiz" data-quiz data-url="${abs(P.quiz)}">
        <div class="quiz__intro"><span class="quiz__badge" aria-hidden="true">${uiIcon.spark}</span><p class="quiz__best" data-quiz-best hidden></p><button type="button" class="btn btn--primary btn--big" data-quiz-start>${esc(T.start)}</button></div>
      </div>
      <script type="application/json" id="quiz-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
      <noscript><p>${esc(T.noscript)}</p><ol>${bank.map((b) => `<li>${esc(b.q)} <b>${esc(b.o[b.a])}</b></li>`).join("")}</ol></noscript>
      ${adUnit(L, "bottom")}
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
      })
    );
    sitemap.push(["quiz", P.quiz, QUIZ.updated, "weekly", "0.8"]);
  }

  // App: cómo instalar en cada dispositivo (y qué se puede hacer)
  write(
    P.app,
    layout(L, {
      title: L.t.appTitle,
      description: L.t.appDesc,
      key: "app",
      active: "",
      type: "article",
      jsonLd: [
        { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: code, mainEntity: L.t.appFaq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
        crumbsLd([[L.t.crumbHome, P.home], [L.t.appH1, P.app]]),
      ],
      body: `
  <section class="page-head page-head--app"><div class="wrap app-head">
    <img class="app-head__icon" src="${u("/assets/icon-maskable-192.png")}" alt="" width="96" height="96">
    <div><p class="eyebrow">${esc(L.t.appEyebrow)}</p><h1>${esc(L.t.appH1)}</h1><p class="lead-text">${esc(L.t.appLead)}</p>
    <button type="button" class="btn btn--primary btn--big" data-install hidden>${I(uiIcon.install)}${esc(L.t.appCta)}</button></div>
  </div></section>
  <div class="wrap layout">
    <div class="col-main">
      <div class="app-guides" data-app-guides>
        ${L.t.appGuides.map(([id, title, variant]) => `<section class="app-guide" data-guide="${id}" data-yours="${esc(L.t.inst.yours)}"><h2>${esc(title)}</h2>${stepsHtml(L, variant)}</section>`).join("")}
        <section class="app-guide" data-guide="desktop" data-yours="${esc(L.t.inst.yours)}"><h2>${esc(L.t.appDesktop[0])}</h2><p>${esc(L.t.appDesktop[1])}</p></section>
      </div>
      <section class="block" aria-labelledby="feat"><div class="block__head"><h2 id="feat">${esc(L.t.appFeatures)}</h2></div>
        <ul class="feat-grid">${L.t.appFeatureList.map(([ic, t, d]) => `<li><span class="feat__ic" aria-hidden="true">${uiIcon[ic] || uiIcon.spark}</span><div><b>${esc(t)}</b> ${esc(d)}</div></li>`).join("")}</ul>
      </section>
      <section class="block" aria-labelledby="faq"><div class="block__head"><h2 id="faq">${esc(L.t.faq)}</h2></div>
        <div class="faq">${L.t.appFaq.map(([q, a], i) => `<details${i < 1 ? " open" : ""}><summary>${esc(q)}</summary><div class="faq__a"><p>${esc(a)}</p></div></details>`).join("")}</div>
      </section>
    </div>
    <aside class="col-side">${sideCards(L)}</aside>
  </div>`,
    })
  );
  sitemap.push(["app", P.app, latest.date, "monthly", "0.6"]);

  // Archivo
  write(
    P.archive,
    layout(L, {
      title: L.t.archiveTitle,
      description: L.t.archiveDesc,
      key: "archive",
      active: "archive",
      body: `
  <section class="page-head"><div class="wrap"><p class="eyebrow">${esc(L.t.archiveEyebrow)}</p><h1>${esc(L.t.archiveH1)}</h1><p class="muted">${esc(L.t.archiveIntro)}</p></div></section>
  <div class="wrap narrow">
    <ol class="archive">
      ${briefs
        .map(
          (b) => `<li><a href="${u(P.brief(b.date))}">
        <time datetime="${b.date}">${esc(fmtDate(L, b.date))}</time>
        <h2>${esc(b.title)}</h2><p>${esc(b.summary)}</p></a></li>`
        )
        .join("")}
    </ol>
    ${adUnit(L, "bottom")}
  </div>`,
    })
  );
  sitemap.push(["archive", P.archive, latest.date, "daily", "0.6"]);

  // Guía (búsquedas evergreen: fecha, precio, PC, tamaño…)
  write(
    P.guide,
    layout(L, {
      title: guide.title,
      description: guide.description,
      key: "guide",
      active: "guide",
      type: "article",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: code,
          mainEntity: guide.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        },
      ],
      body: `
  <section class="page-head"><div class="wrap"><p class="eyebrow">${esc(L.t.guideUpdated(dLong(guide.updated)))}</p><h1>${esc(guide.title)}</h1><p class="muted">${esc(guide.description)}</p></div></section>
  <div class="wrap layout">
    <div class="col-main">
      <ul class="fact-grid">${guide.facts.map((f) => `<li><span>${esc(f.label)}</span><b>${esc(f.value)}</b></li>`).join("")}</ul>
      ${adUnit(L, "top")}
      <section class="block" aria-labelledby="faq"><div class="block__head"><h2 id="faq">${esc(L.t.faq)}</h2></div>
        <div class="faq">
        ${guide.faq.map((f, i) => `<details${i < 2 ? " open" : ""}><summary>${esc(f.q)}</summary><div class="faq__a"><p>${esc(f.a)}</p>${sourcesHtml(L, f.sources)}</div></details>`).join("")}
        </div>
      </section>
      ${adUnit(L, "bottom")}
    </div>
    <aside class="col-side">
      <div class="card">${countdown(L, "sm")}</div>
      ${guidesCard(L)}
      ${adUnit(L, "sidebar", "ad--sticky")}
      <div class="card card--cta"><h2 class="card__title">${esc(L.t.latest)}</h2><p class="small">${esc(latest.title)}</p><a class="btn btn--primary btn--block" href="${u(P.home)}">${esc(L.t.readToday)}</a></div>
    </aside>
  </div>`,
    })
  );
  sitemap.push(["guide", P.guide, guide.updated, "weekly", "0.9"]);

  // Acerca
  write(
    P.about,
    layout(L, {
      title: L.t.aboutTitle,
      description: L.t.aboutDesc,
      key: "about",
      active: "about",
      body: `
  <section class="page-head"><div class="wrap"><p class="eyebrow">${esc(L.t.aboutEyebrow)}</p><h1>Leónida Hoy</h1><p class="muted">${esc(L.t.description)}</p></div></section>
  <div class="wrap narrow prose">${L.t.aboutBody(ISSUES_URL)}
  </div>`,
    })
  );
  sitemap.push(["about", P.about, latest.date, "yearly", "0.3"]);

  // Privacidad (necesaria para AdSense)
  write(
    P.privacy,
    layout(L, {
      title: L.t.privacyTitle,
      description: L.t.privacyDesc,
      key: "privacy",
      active: "",
      body: `
  <section class="page-head"><div class="wrap"><p class="eyebrow">${esc(L.t.privacyEyebrow)}</p><h1>${esc(L.t.privacyH1)}</h1><p class="muted">${esc(L.t.privacyUpdated(dLong(BUILD_TIME.slice(0, 10))))}</p></div></section>
  <div class="wrap narrow prose">${L.t.privacyBody(GA, CF)}
  </div>`,
    })
  );
  sitemap.push(["privacy", P.privacy, latest.date, "yearly", "0.2"]);

  // Aviso legal
  write(
    P.legal,
    layout(L, {
      title: L.t.legalTitle,
      description: L.t.legalDesc,
      key: "legal",
      active: "",
      body: `
  <section class="page-head"><div class="wrap"><p class="eyebrow">${esc(L.t.privacyEyebrow)}</p><h1>${esc(L.t.legalTitle)}</h1><p class="muted">${esc(L.t.privacyUpdated(dLong(BUILD_TIME.slice(0, 10))))}</p></div></section>
  <div class="wrap narrow prose">${L.t.legalBody({ owner: esc(cfg.legal?.owner || ""), email: esc(cfg.legal?.email || ""), issues: ISSUES_URL })}
  </div>`,
    })
  );
  sitemap.push(["legal", P.legal, latest.date, "yearly", "0.2"]);

  // RSS por idioma
  const rfc822 = (d) => new Date(d + "T06:00:00Z").toUTCString();
  write(
    P.feed,
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(cfg.name)} — ${esc(L.t.tagline)}</title>
  <link>${abs(P.home)}</link>
  <description>${esc(L.t.description)}</description>
  <language>${code}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${abs(P.feed)}" rel="self" type="application/rss+xml"/>
${briefs
  .slice(0, 30)
  .map(
    (b) => `  <item>
    <title>${esc(b.title)}</title>
    <link>${abs(P.brief(b.date))}</link>
    <guid isPermaLink="true">${abs(P.brief(b.date))}</guid>
    <pubDate>${rfc822(b.date)}</pubDate>
    <description>${esc(
      `<p>${b.summary}</p><ol>${b.stories.map((s) => `<li><strong>${s.title}.</strong> ${s.change} <a href="${s.sources[0].url}">${s.sources[0].name}</a></li>`).join("")}</ol>`
    )}</description>
  </item>`
  )
  .join("\n")}
</channel>
</rss>
`
  );
}

// 404 bilingüe (GitHub Pages solo admite uno)
{
  const L = LOCALES.es;
  const html = layout(L, {
    title: "Página no encontrada · Page not found",
    description: "Esta página no existe. This page doesn't exist.",
    key: "home",
    active: "",
    noindex: true,
    body: `<section class="page-head"><div class="wrap narrow"><p class="eyebrow">Error 404</p><h1>Te has salido del mapa</h1><p class="muted">Esta página no existe en Leónida. <span lang="en">· You've left the map: this page doesn't exist.</span></p><p class="hero__actions"><a class="btn btn--primary" href="${u("/")}">Volver al resumen de hoy</a> <a class="btn btn--ghost" href="${u(LOCALES.en.paths.home)}" lang="en">Today's briefing in English</a></p></div></section>`,
  }).replace(/<link rel="canonical"[^>]*>\n/, "").replace(/<link rel="alternate" hreflang[^>]*>\n/g, "");
  write("404.html", html);
}

// Sitemap con alternativas de idioma
const altLinks = (key) => {
  const alts = counterparts(key);
  if (Object.keys(alts).length < 2) return "";
  return Object.entries(alts)
    .map(([c, p]) => `<xhtml:link rel="alternate" hreflang="${c}" href="${abs(p)}"/>`)
    .concat(alts.es ? [`<xhtml:link rel="alternate" hreflang="x-default" href="${abs(alts.es)}"/>`] : [])
    .join("");
};
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap
  .map(([key, p, d, f, pr]) => `  <url><loc>${abs(p)}</loc>${altLinks(key)}<lastmod>${d}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`)
  .join("\n")}
</urlset>
`
);

// Sitemap de Google Noticias: artículos de los últimos 2 días
{
  const newest = rawBriefs[0].date;
  const cutoff = new Date(new Date(newest + "T12:00:00Z").getTime() - 2 * 864e5).toISOString().slice(0, 10);
  const entries = [];
  for (const code of ACTIVE) for (const it of DATA[code].items) if (it.date >= cutoff) entries.push([code, it]);
  write(
    "news-sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries
  .map(([code, it]) => `  <url><loc>${abs(it.path)}</loc><news:news><news:publication><news:name>${esc(cfg.name)}</news:name><news:language>${code}</news:language></news:publication><news:publication_date>${it.date}T07:00:00+01:00</news:publication_date><news:title>${esc(it.title)}</news:title></news:news></url>`)
  .join("\n")}
</urlset>
`
  );
}
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\nSitemap: ${abs("/news-sitemap.xml")}\n`);
if (ADS) write("ads.txt", `google.com, ${ADS.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`);
// ---------- app instalable (PWA) ----------
for (const code of ACTIVE) {
  const L = LOCALES[code];
  const P = L.paths;
  const sc = (name, short, url) => ({ name, short_name: short, url: u(url), icons: [{ src: u("/assets/icon-192.png"), sizes: "192x192", type: "image/png" }] });
  write(
    code === "es" ? "manifest.webmanifest" : `manifest-${code}.webmanifest`,
    JSON.stringify(
      {
        id: u(P.home),
        name: `${cfg.name} · ${L.t.tagline}`,
        short_name: cfg.name,
        description: L.t.description,
        lang: code,
        dir: "ltr",
        start_url: u(P.home),
        scope: u("/"),
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        background_color: "#0b0618",
        theme_color: "#0b0618",
        categories: ["news", "entertainment", "games"],
        icons: [
          { src: u("/assets/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
          { src: u("/assets/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
          { src: u("/assets/icon-maskable-192.png"), sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: u("/assets/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          sc(L.t.nav.news, L.t.nav.news, P.news),
          sc(L.t.nav.rumors, L.t.nav.rumors, P.rumors),
          sc(L.t.tiles.reviews[0], L.t.tiles.reviews[0], P.reviews),
          sc(L.t.tiles.leonida[0], L.t.tiles.leonida[0], P.leonida),
        ],
      },
      null,
      2
    )
  );
}

// Página «Sin conexión» (bilingüe) para cuando no hay red y la página no está guardada
write(
  "offline.html",
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex"><meta name="theme-color" content="#0b0618"><title>${esc(LOCALES.es.t.offlineTitle)} · ${esc(cfg.name)}</title><link rel="icon" href="${u("/assets/favicon.svg")}" type="image/svg+xml">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#3a0b55,#0b0618 70%);color:#fbf6ff;font:16px/1.6 system-ui,-apple-system,sans-serif;padding:24px;text-align:center}main{max-width:440px}img{width:96px;height:96px;border-radius:22px}h1{font-size:1.6rem;margin:16px 0 6px}p{color:#bfb0e0;margin:0 0 10px}button{margin-top:14px;font:700 1rem system-ui;padding:12px 22px;border:0;border-radius:12px;color:#1a0730;background:linear-gradient(100deg,#ffe066,#ff9a3c 35%,#ff2fa3 72%,#b026ff);cursor:pointer}a{color:#26f0f1}</style></head>
<body><main><img src="${u("/assets/icon-maskable-192.png")}" alt=""><h1>${esc(LOCALES.es.t.offlineTitle)}</h1><p>${esc(LOCALES.es.t.offlineText)}</p><p lang="en">${esc(LOCALES.en.t.offlineText)}</p><button onclick="location.reload()">${esc(LOCALES.es.t.offlineRetry)} · ${esc(LOCALES.en.t.offlineRetry)}</button><p><a href="${u("/")}">${esc(cfg.name)}</a></p></main></body></html>
`
);

// Versión publicada: la app la consulta para avisar de que hay noticias nuevas
write("version.json", JSON.stringify({ build: BUILD_ID, time: BUILD_TIME }) + "\n");

// Service worker: páginas «red primero» (siempre frescas, y guardadas para leer sin conexión);
// CSS, JS, fuentes e imágenes desde caché (llevan versión en la URL). No toca nada de otros dominios (AdSense).
{
  const core = [
    u("/"), ...ACTIVE.filter((c) => c !== "es").map((c) => u(LOCALES[c].paths.home)), u("/offline.html"),
    `${u("/assets/styles.css")}?v=${CSS_V}`, `${u("/assets/app.js")}?v=${JS_V}`, `${u("/assets/fonts.css")}?v=${FONTS_V}`,
    u("/assets/fonts/inter-latin.woff2"), u("/assets/fonts/anton-latin.woff2"), u("/assets/fonts/yellowtail-latin.woff2"),
    u("/assets/favicon.svg"), u("/assets/icon-192.png"), u("/assets/icon-maskable-192.png"),
  ];
  write(
    "sw.js",
    `/* Leónida Hoy · service worker ${BUILD_ID} */
const STATIC = "lh-static-${BUILD_ID}";
const PAGES = "lh-pages";
const CORE = ${JSON.stringify(core)};
const OFFLINE = ${JSON.stringify(u("/offline.html"))};
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lh-static-") && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => (self.registration.navigationPreload ? self.registration.navigationPreload.enable() : null))
      .then(() => self.clients.claim())
  );
});
const trim = async (name, max) => {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
};
// Páginas precargadas al tocar un enlace (Safari/Firefox): se sirven al instante si tienen menos de 90 s
const WARM = "lh-warm";
const warmPut = async (req) => {
  const res = await fetch(new Request(req.url, { cache: "no-cache", credentials: "same-origin" }));
  if (res && res.ok && res.type === "basic") {
    const h = new Headers(res.headers); h.set("x-lh-at", String(Date.now()));
    const body = await res.clone().blob();
    const c = await caches.open(WARM);
    await c.put(req.url, new Response(body, { status: res.status, statusText: res.statusText, headers: h }));
    caches.open(PAGES).then((p) => p.put(req.url, res)).then(() => trim(PAGES, 60));
    trim(WARM, 12);
  }
  return new Response(null, { status: 204 });
};
const warmTake = async (url) => {
  const c = await caches.open(WARM);
  const hit = await c.match(url);
  if (!hit) return null;
  c.delete(url);
  return Date.now() - Number(hit.headers.get("x-lh-at") || 0) < 90000 ? hit : null;
};
const pageFirst = async (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    const w = await warmTake(req.url);
    if (w) { if (event.preloadResponse) event.waitUntil(event.preloadResponse.catch(() => {})); return w; }
  }
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const res = preload || (await fetch(new Request(req.url, { cache: "no-cache", credentials: "same-origin" })));
    if (res && res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(PAGES).then((c) => c.put(req.url, copy)).then(() => trim(PAGES, 60));
    }
    return res;
  } catch (err) {
    const cached = (await caches.match(req.url, { ignoreSearch: true })) || (await caches.match(OFFLINE));
    return cached || Response.error();
  }
};
const assetCache = async (req) => {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(STATIC).then((c) => c.put(req, copy));
  }
  return res;
};
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("/sw.js")) return;
  if (req.headers.get("x-lh-warm") === "1") { e.respondWith(warmPut(req).catch(() => new Response(null, { status: 204 }))); return; }
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(pageFirst(e));
    return;
  }
  if (/\\.(css|js|woff2|png|svg|webmanifest)$/.test(url.pathname)) e.respondWith(assetCache(req));
});
`
  );
}
write(".nojekyll", "");
if (cfg.indexNowKey) write(`${cfg.indexNowKey}.txt`, cfg.indexNowKey);

const missing = rawBriefs.filter((b) => !b.en).map((b) => b.date);
console.log(
  `✓ ${rawBriefs.length} resumen(es) · idiomas: ${ACTIVE.join(", ")}${missing.length ? ` · sin inglés: ${missing.join(", ")}` : ""} · ${ADS ? "AdSense ON" : "AdSense OFF"} → ${path.relative(ROOT, OUT)}/`
);
