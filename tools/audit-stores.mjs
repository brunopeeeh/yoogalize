#!/usr/bin/env node
/**
 * tools/audit-stores.mjs
 *
 * Auditoria das lojas do Descubra Yooga contra a API publica da Yooga.
 *
 *   GET https://delivery2.yooga.com.br/v2/stores/{slug}
 *     -> 200  loja existe
 *     -> 400  {"message":"Erro ao buscar loja"}  => saiu da base
 *
 * LIMITACAO DA API: ~18 requisicoes por janela de 60s (retorna 429 + Retry-After).
 * 817 lojas => ~46 minutos. O resultado e cacheado em reports/.audit-cache.json
 * para permitir retomar sem repetir requisicoes.
 *
 * NAO modifica public/lojas.json.
 *
 * Uso:
 *   node tools/audit-stores.mjs                    # completa (usa cache)
 *   node tools/audit-stores.mjs --limit 30         # primeiras N
 *   node tools/audit-stores.mjs --reset            # ignora cache
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ---------- config ----------
const API = "https://delivery2.yooga.com.br";
const REQ_PER_MIN = 16;              // folga sobre os 18 reais
const MIN_INTERVAL_MS = Math.ceil(60000 / REQ_PER_MIN);
const ETA_MIN = Math.ceil(60000 / MIN_INTERVAL_MS);

// ---------- args ----------
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const inputPath = resolve(arg("input", "public/lojas.json"));
const outPath = resolve(arg("out", "reports/audit-stores.json"));
const cachePath = resolve(arg("cache", "reports/.audit-cache.json"));
const limit = Number(arg("limit", "0")) || 0;
const reset = args.includes("--reset");

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) => String(s ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Classifica o resultado da API.
 *
 * A API faz match fuzzy e os nomes divergem legitimamente (o `company_name`
 * do Databricks traz o installation_id anexado: "Van Pizzaria - 148557"
 * vs "Van Pizzaria" na API). Portanto o criterion CONFIAVEL e o `api.url`:
 *   - url != slug  => o slug mudou no admin (link do cardapio esta errado)
 *   - url == slug  => o link funciona (mesmo que o nome tenha sido editado)
 */
function classificar(slug, nomeJson, r) {
  if (r.state !== "ativa" || !r.api) return r;
  const apiUrl = r.api.url ?? "";
  const apiNome = r.api.name ?? "";

  if (apiUrl && norm(apiUrl) !== norm(slug)) {
    return { ...r, state: "desatualizada", motivo: `url da API difere (api.url=${apiUrl})`, api: r.api };
  }
  return r;
}

let ultimaReq = 0;
async function throttle() {
  const agora = Date.now();
  const espera = ultimaReq + MIN_INTERVAL_MS - agora;
  if (espera > 0) await sleep(espera);
  ultimaReq = Date.now();
}

async function fetchStore(slug) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await throttle();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(`${API}/v2/stores/${encodeURIComponent(slug)}`, {
        headers: { accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);

      if (res.status === 200) {
        const txt = await res.text();
        try { return { state: "ativa", api: JSON.parse(txt) }; }
        catch { return { state: "ativa", api: null }; }
      }
      if (res.status === 400 || res.status === 404) return { state: "removida", http: res.status };
      if (res.status === 429) {
        const ra = Number(res.headers.get("retry-after")) || 60;
        process.stdout.write(`\r  [429] aguardando ${ra}s (${slug})          `);
        await sleep(ra * 1000 + 500);
        continue;
      }
      return { state: "erro", http: res.status, erro: `HTTP ${res.status}` };
    } catch (e) {
      if (attempt === 3) return { state: "erro", erro: String(e.message ?? e) };
      await sleep(1500 * (attempt + 1));
    }
  }
  return { state: "erro", erro: "max retries" };
}

// ---------- cache ----------
let cache = {};
if (!reset && existsSync(cachePath)) {
  try { cache = JSON.parse(readFileSync(cachePath, "utf8")); } catch { cache = {}; }
}
const salvarCache = () => {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
};

// ---------- main ----------
const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const lojas = Array.isArray(raw) ? raw : raw.result;
const comSlug = lojas.filter((l) => l["link delivery"]);
const semSlug = lojas.filter((l) => !l["link delivery"]);

// prioridade: slugs obviamente mortos primeiro (resultado rapido)
const MARCADOR = /DESATIV|CANCEL|INTERROMP|cancelado|desativado/i;
const prioridade = (l) => {
  const s = String(l["link delivery"] ?? "");
  const n = s.trim().toLowerCase();
  if (n === "null" || n === "copied") return 0;      // slugs literalmente quebrados
  if (n === "yooga") return 0;                       // slug default do admin
  if (MARCADOR.test(s)) return 1;                    // marcados como desativados
  return 2;
};
const ordenadas = [...comSlug].sort((a, b) => prioridade(a) - prioridade(b));
const alvo = limit ? ordenadas.slice(0, limit) : ordenadas;

console.log(`Entrada        ${inputPath}`);
console.log(`Lojas          ${lojas.length} (com slug: ${comSlug.length}, sem slug: ${semSlug.length})`);
console.log(`A auditar      ${alvo.length}${limit ? ` (limit ${limit})` : ""}`);
console.log(`Ritmo          ~${ETA_MIN} req/min -> ~${Math.ceil(alvo.length / ETA_MIN)} min estimados`);
console.log(`Cache          ${cachePath} (${Object.keys(cache).length} entradas)\n`);

const t0 = Date.now();
let n = 0;
const resultados = [];

for (const loja of alvo) {
  const slug = loja["link delivery"];
  let r = cache[slug];
  if (!r) {
    r = await fetchStore(slug);
    cache[slug] = r;
    if (n % 10 === 0) salvarCache();
  }
  r = classificar(slug, loja.nome_empresa, r);
  n++;
  resultados.push({
    slug,
    nome: loja.nome_empresa,
    cidade: loja.cidade,
    estado: loja.estado,
    modelo_negocio: loja.modelo_negocio,
    tipo_atendimento: loja.tipo_atendimento,
    lat_json: loja.Latitude,
    lon_json: loja.Longitude,
    ...r,
  });
  if (n % 10 === 0 || n === alvo.length) {
    const pct = ((n / alvo.length) * 100).toFixed(0);
    const resta = Math.ceil((alvo.length - n) / ETA_MIN);
    process.stdout.write(`\r  ${n}/${alvo.length} (${pct}%)  ~${resta}min restantes          `);
  }
}
salvarCache();
console.log("\n");

// ---------- analise ----------
const rem = resultados.filter((r) => r.state === "removida");
const desat = resultados.filter((r) => r.state === "desatualizada");
const ativas = resultados.filter((r) => r.state === "ativa");
const erro = resultados.filter((r) => r.state === "erro");

// divergencias de coordenadas (ignorando lojas sem coordenada na API)
const divergentes = [];
let apiSemCoordenada = 0;
for (const r of ativas) {
  if (!r.api) continue;
  const aLat = r.api.latitude, aLon = r.api.longitude;
  // a API devolve null/0 para lojas sem geolocalizacao -> nao e divergencia
  if (typeof aLat !== "number" || typeof aLon !== "number" || aLat === 0 || aLon === 0) {
    apiSemCoordenada++;
    continue;
  }
  const dLat = Math.abs(aLat - (r.lat_json ?? 0));
  const dLon = Math.abs(aLon - (r.lon_json ?? 0));
  if (dLat > 0.0005 || dLon > 0.0005) {
    divergentes.push({
      slug: r.slug, nome: r.nome,
      lat_json: r.lat_json, lat_api: aLat,
      lon_json: r.lon_json, lon_api: aLon,
      delta_metros: Math.round(Math.hypot(dLat * 111320, dLon * 111320 * Math.cos((-20 * Math.PI) / 180))),
    });
  }
}

// nomes realmente alterados (ignorando o installation_id anexado pelo Databricks)
const renomeadas = [];
for (const r of ativas) {
  if (!r.api?.name) continue;
  const semId = (s) => String(s ?? "").replace(/\s*-\s*\d{3,}\s*$/, "").trim();
  const a = norm(semId(r.nome)), b = norm(r.api.name);
  if (a && b && a !== b) {
    renomeadas.push({ slug: r.slug, nome_json: r.nome, nome_api: r.api.name });
  }
}

const bloqueadas = ativas.filter((r) => r.api && (r.api.opened === 0 || r.api.blocked === 1));
const semSegmento = ativas.filter((r) => r.api && !r.modelo_negocio);

const relatorio = {
  gerado_em: new Date().toISOString(),
  api: API,
  input: inputPath,
  nota: "Auditoria NAO modifica public/lojas.json. Reporta apenas.",
  resumo: {
    lojas_no_json: lojas.length,
    com_slug: comSlug.length,
    sem_slug: semSlug.length,
    auditadas: resultados.length,
    ativas: ativas.length,
    removidas: rem.length,
    desatualizadas: desat.length,
    erros: erro.length,
    coordenadas_divergentes: divergentes.length,
    api_sem_coordenada: apiSemCoordenada,
    nomes_alterados: renomeadas.length,
    bloqueadas_ou_fechadas: bloqueadas.length,
  },
  sem_slug: semSlug.map((l) => ({ nome: l.nome_empresa, cidade: l.cidade, modelo_negocio: l.modelo_negocio })),
  removidas: rem.map((r) => ({ slug: r.slug, nome: r.nome, cidade: r.cidade, modelo_negocio: r.modelo_negocio })),
  desatualizadas: desat.map((r) => ({
    slug: r.slug, nome: r.nome, cidade: r.cidade, modelo_negocio: r.modelo_negocio,
    motivo: r.motivo,
    api_url: r.api?.url, api_nome: r.api?.name, api_opened: r.api?.opened, api_blocked: r.api?.blocked,
  })),
  erros: erro.map((r) => ({ slug: r.slug, nome: r.nome, erro: r.erro })),
  coordenadas_divergentes: divergentes,
  nomes_alterados: renomeadas,
  bloqueadas_ou_fechadas: bloqueadas.map((r) => ({ slug: r.slug, nome: r.nome, opened: r.api.opened, blocked: r.api.blocked })),
  ativas: ativas.map((r) => ({
    slug: r.slug, nome: r.nome,
    lat_api: r.api?.latitude, lon_api: r.api?.longitude,
    address: r.api?.address,
    fullAddress: r.api?.delivery_fee_json ? JSON.parse(r.api.delivery_fee_json).fullAddress : null,
    schedule_json: r.api?.schedule_json,
    opened: r.api?.opened, blocked: r.api?.blocked,
  })),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(relatorio, null, 2), "utf8");

const min = ((Date.now() - t0) / 60000).toFixed(1);
console.log("=".repeat(60));
console.log(`  ATIVAS .................... ${ativas.length}`);
console.log(`  REMOVIDAS (saíram da Yooga) ${rem.length}`);
console.log(`  DESATUALIZADAS (slug obsoleto) ${desat.length}`);
console.log(`  BLOQUEADAS/FECHADAS ....... ${bloqueadas.length}`);
console.log(`  COORDENADAS DIVERGENTES ... ${divergentes.length}`);
console.log(`  NOMES ALTERADOS ........... ${renomeadas.length}`);
console.log(`  ERROS ..................... ${erro.length}`);
console.log("=".repeat(60));
console.log(`  Relatório: ${outPath}  (${min} min)`);

if (rem.length) {
  console.log("\n=== REMOVIDAS ===");
  for (const r of rem) console.log(`  ${(r.nome ?? "").padEnd(44)} ${r.slug}`);
}
if (desat.length) {
  console.log("\n=== DESATUALIZADAS (slug não corresponde mais) ===");
  for (const r of desat) console.log(`  ${(r.nome ?? "").padEnd(44)} ${r.slug}  -> ${r.motivo}`);
}
