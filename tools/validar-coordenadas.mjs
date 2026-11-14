#!/usr/bin/env node
/**
 * tools/validar-coordenadas.mjs
 *
 * Decide qual coordenada e a correta para as lojas onde o `public/lojas.json`
 * (Databricks) e a API de delivery da Yooga divergem.
 *
 * REGRA (validada com geocoding contra o endereco de cada fonte):
 *
 *   1. Se o slug e compartilhado por varias lojas, a coordenada da API pertence
 *      a OUTRA loja -> a API e descartada nessa analise.
 *   2. Se a coordenada da API e um "ponto default" do sistema Yooga (varias
 *      lojas com exatamente a mesma coordenada), a API nao tem geolocalizacao
 *      real -> descartada.
 *   3. Geocodifica o endereco do JSON e compara com a coordenada do JSON.
 *      Se batem (<= TOLERANCIA_KM), o JSON esta coerente -> MANTER.
 *   4. Se o JSON esta incoerente e a API tem endereco + coordenada coerentes
 *      entre si -> ADOTAR API (endereco e coordenada).
 *   5. Caso contrario -> REVISAR (nao mexe sozinho).
 *
 * O script so REPORTA e grava um patch em reports/patch-coordenadas.json.
 * NAO modifica public/lojas.json.
 *
 * Uso:
 *   node tools/validar-coordenadas.mjs
 *   node tools/validar-coordenadas.mjs --min-km 5
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "YoogalizeValidador/1.0 (catalogo de lojas; contato via repositorio)";

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const inputPath = resolve(arg("input", "public/lojas.json"));
const auditPath = resolve(arg("audit", "reports/audit-stores.json"));
const cachePath = resolve(arg("cache", "reports/.geocode-cache.json"));
const outPath = resolve(arg("out", "reports/patch-coordenadas.json"));
const MIN_KM = Number(arg("min-km", "5"));
const TOLERANCIA_KM = Number(arg("tolerancia-km", "1.5"));

// ---------- helpers ----------
const norm = (s) => String(s ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+\d{3,}\s*$/, "").trim();

const distKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- cache do geocoder ----------
let cache = {};
if (existsSync(cachePath)) {
  try { cache = JSON.parse(readFileSync(cachePath, "utf8")); } catch { cache = {}; }
}
const salvarCache = () => {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
};

/** Normaliza "R. Das, Hortências, 45 - Canaã, Viana - ES" -> texto buscavel. */
const limpa = (s) => String(s ?? "").replace(/\s+/g, " ").replace(/,\s*,/g, ",").trim();

/** So aceita resultado dentro do ES (evita "Rua X" homonima em outro estado). */
const dentroDoES = (lat, lon) => lat > -21.4 && lat < -17.8 && lon > -41.9 && lon < -39.6;

// invalida entradas de geocode DIRETO fora do ES (rua homonima em outro estado).
// Entradas de reverse ("reverse|lat,lon" = {road,suburb,city}) nao tem lat/lon e nao sao tocadas.
for (const [k, v] of Object.entries(cache)) {
  if (v && typeof v.lat === "number" && !dentroDoES(v.lat, v.lon)) cache[k] = null;
}

async function geocode1(query) {
  const q = limpa(query);
  if (!q) return null;
  if (q in cache) return cache[q];
  await sleep(1100); // politica do Nominatim: 1 req/s
  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const r = data && data.length ? { lat: +data[0].lat, lon: +data[0].lon } : null;
    cache[q] = r && dentroDoES(r.lat, r.lon) ? r : null;
    return cache[q];
  } catch (e) {
    console.error(`  ! geocode falhou (${q}): ${e.message}`);
    cache[q] = null;
    return null;
  }
}

/** Geocodifica reversa: qual endereco existe no ponto informado. */
async function reverseGeocode(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const key = `reverse|${lat},${lon}`;
  if (key in cache && cache[key] !== null) return cache[key];
  await sleep(1100);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const a = data?.address ?? {};
    const r = {
      road: a.road ?? a.pedestrian ?? a.footway ?? null,
      suburb: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? null,
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
    };
    cache[key] = r;
    return r;
  } catch (e) {
    console.error(`  ! reverse falhou (${lat},${lon}): ${e.message}`);
    cache[key] = null;
    return null;
  }
}

// comparacao por tokens-significativos ("Av. Luiz Manoel Vellozo" ~ "Avenida Luiz Manoel Veloso")
const STOP = new Set(["rua", "av", "avenida", "r", "travessa", "tv", "alameda", "rodovia", "rod", "estrada", "sit", "s", "n", "de", "da", "do", "das", "dos"]);
const tokens = (s) => norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t));
const mesmaRua = (a, b) => {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return false;
  const hits = B.filter((t) => A.some((x) => x.startsWith(t.slice(0, 4)) || t.startsWith(x.slice(0, 4)))).length;
  return hits >= 2;
};

/** O ponto reverso-geocodificado corresponde ao endereco cadastrado? */
const casaCom = (rev, endereco) => {
  if (!rev || !endereco) return false;
  if (mesmaRua(rev.road, endereco.logradouro)) return true;
  const sub = norm(rev.suburb ?? ""), bai = norm(endereco.bairro ?? "");
  return Boolean(sub) && sub === bai;
};

/**
 * Geocodifica com variantes: o endereco completo pode nao existir no OSM
 * (bairro divergente, numero inexistente, CEP de outra rua). Se a consulta
 * completa falhar, tenta-forms mais simples.
 */
async function geocode(endereco, partes = {}) {
  if (!endereco) return null;
  const variantes = [
    endereco,
    [partes.logradouro, partes.numero, partes.cidade, partes.uf, partes.cep].filter(Boolean).join(", "),
    [partes.logradouro, partes.cidade, partes.uf].filter(Boolean).join(", "),
    [partes.logradouro, partes.bairro, partes.cidade, partes.uf].filter(Boolean).join(", "),
    [partes.logradouro].filter(Boolean).join(", "),
  ].map(limpa).filter(Boolean);

  for (let vi = 0; vi < variantes.length; vi++) {
    const r = await geocode1(variantes[vi]);
    if (r) return { ...r, _via: vi };
  }
  return null;
}

// ---------- parsing do endereco da API ----------
/** "Av. Vale do Rio Doce, 56 - Porto de Santana, Cariacica - ES, 29152-280, Brasil" */
function parseEnderecoApi(full) {
  if (!full) return null;
  const partes = String(full).split(",").map((p) => p.trim());
  const pais = partes[partes.length - 1];
  const cep = partes.length >= 2 && /^\d{5}-?\d{3}$/.test(partes[partes.length - 2]) ? partes[partes.length - 2] : null;
  const cidUf = cep ? partes[partes.length - 3] : partes[partes.length - 2];
  const m = cidUf ? cidUf.match(/^(.*?)\s*-\s*([A-Z]{2})$/) : null;
  const cidade = m ? m[1].trim() : cidUf;
  const uf = m ? m[2] : null;
  const rest = cep ? partes.slice(0, partes.length - 3) : partes.slice(0, partes.length - 2);
  const logradouroNum = rest[0] ?? "";
  const bairro = rest[1] ?? "";
  const [logradouro, ...num] = logradouroNum.split(/\s*-\s*/);
  return {
    logradouro: (logradouro || "").trim(),
    numero: num.join(" - ").trim(),
    bairro: (bairro || "").trim(),
    cidade: (cidade || "").trim(),
    uf, cep, pais,
  };
}

// ---------- main ----------
const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const lojas = raw.result ?? raw;
const audit = JSON.parse(readFileSync(auditPath, "utf8"));
const apiPorSlug = new Map((audit.ativas ?? []).map((a) => [a.slug, a]));

// coordenadas da API repetidas em varias lojas = ponto default do sistema Yooga
const contadorCoordsApi = new Map();
for (const a of audit.ativas ?? []) {
  if (typeof a.lat_api !== "number" || typeof a.lon_api !== "number") continue;
  const k = `${a.lat_api},${a.lon_api}`;
  contadorCoordsApi.set(k, (contadorCoordsApi.get(k) ?? 0) + 1);
}
const ehDefault = (lat, lon) => (contadorCoordsApi.get(`${lat},${lon}`) ?? 0) >= 2;

// slug -> quantas lojas do JSON usam
const porSlug = new Map();
for (const l of lojas) {
  const s = l["link delivery"];
  if (!s) continue;
  porSlug.set(s, (porSlug.get(s) ?? 0) + 1);
}

// monta a lista de divergentes > MIN_KM
const candidatos = [];
for (const d of audit.coordenadas_divergentes ?? []) {
  const km = d.delta_metros / 1000;
  if (km <= MIN_KM) continue;
  const slugUnico = (porSlug.get(d.slug) ?? 0) === 1;
  const json = lojas.find((l) => l["link delivery"] === d.slug && norm(l.nome_empresa) === norm(d.nome));
  const api = apiPorSlug.get(d.slug);
  const apiCoordsOk = typeof d.lat_api === "number" && typeof d.lon_api === "number" && !ehDefault(d.lat_api, d.lon_api);
  const nomeBate = api && norm(api.nome) === norm(d.nome);
  candidatos.push({ d, km, slugUnico, json, api, apiCoordsOk, nomeBate });
}

console.log(`Candidatos com divergencia > ${MIN_KM} km: ${candidatos.length}`);
console.log(`  slug unico no JSON : ${candidatos.filter((c) => c.slugUnico).length}`);
console.log(`  coord da API e default do Yooga: ${candidatos.filter((c) => !c.apiCoordsOk).length}`);
console.log(`  nome da API != nome do JSON: ${candidatos.filter((c) => !c.nomeBate).length}\n`);

const resultado = [];
let i = 0;
for (const c of candidatos) {
  i++;
  if (!c.json) continue;
  const decisao = { decisao: "revisar", motivo: "", loja: c.json.nome_empresa, slug: c.d.slug };

  // 1) geocodifica o endereco do JSON (com variantes de consulta)
  const endJson = c.json["endereco completo"];
  const gJson = await geocode(endJson, {
    logradouro: c.json.logradouro, numero: c.json["número"], bairro: c.json.bairro,
    cidade: c.json.cidade, uf: c.json.estado, cep: c.json.cep,
  });
  const coerenteJson = gJson
    ? distKm(gJson.lat, gJson.lon, c.json.Latitude, c.json.Longitude) <= TOLERANCIA_KM
    : null;
  const distJson = gJson ? distKm(gJson.lat, gJson.lon, c.json.Latitude, c.json.Longitude) : null;

  // 2) endereco + coords da API (so se slug unico, nome bate e coord nao e default)
  let endApi = null, gApi = null, coerenteApi = null, distApi = null;
  if (c.slugUnico && c.nomeBate && c.apiCoordsOk) {
    endApi = parseEnderecoApi(c.api.fullAddress);
    if (endApi) {
      gApi = await geocode(c.api.fullAddress, endApi);
      if (gApi) {
        distApi = distKm(gApi.lat, gApi.lon, c.api.lat_api, c.api.lon_api);
        coerenteApi = distApi <= TOLERANCIA_KM;
      }
    }
  }

  if (coerenteJson) {
    decisao.decisao = "manter";
    decisao.motivo = `endereco do JSON geocodifica a ${Math.round(distJson * 1000)} m da coordenada do JSON`;
  } else if (coerenteApi === true) {
    decisao.decisao = "adotar_api";
    decisao.motivo = `JSON incoerente (${gJson ? Math.round(distJson * 1000) : "?"} m) e API coerente (${Math.round(distApi * 1000)} m)`;
    decisao.lat = c.api.lat_api;
    decisao.lon = c.api.lon_api;
    decisao.endereco = c.api.fullAddress;
    decisao.endereco_estruturado = endApi;
  } else if (!gJson) {
    decisao.decisao = "manter";
    decisao.motivo = "endereco do JSON nao geocodificou no OSM: sem evidencia para alterar a coordenada";
  } else if (!c.slugUnico) {
    decisao.decisao = "revisar";
    decisao.motivo = "slug compartilhado (API pertence a outra loja) e coordenada do JSON incoerente com o proprio endereco";
  } else if (!c.apiCoordsOk) {
    decisao.decisao = "revisar";
    decisao.motivo = "JSON incoerente e coordenada da API e ponto default do Yooga";
  } else {
    decisao.decisao = "revisar";
    decisao.motivo = `JSON incoerente (${Math.round(distJson * 1000)} m) e API sem endereco coerente`;
  }

  resultado.push({
    ...decisao,
    cidade_json: c.json.cidade,
    lat_json: c.json.Latitude,
    lon_json: c.json.Longitude,
    lat_api: c.d.lat_api,
    lon_api: c.d.lon_api,
    delta_km: +c.km.toFixed(2),
    endereco_json: endJson,
    endereco_api: c.api?.fullAddress ?? null,
    logradouro_json: c.json.logradouro,
    bairro_json: c.json.bairro,
    geocode_json: gJson,
  });

  process.stdout.write(`\r  ${i}/${candidatos.length}  ${decisao.decisao.padEnd(12)} ${c.json.nome_empresa.slice(0, 44).padEnd(44)}   `);
  if (i % 10 === 0) salvarCache();
}
salvarCache();
console.log("\n");

// ---------- 2a passada: desempate por geocoding reverso ----------
// O geocode direto falha quando existem ruas homonimas. O reverso responde
// "que endereco existe no ponto" — se o ponto do JSON esta na rua/bairro do
// endereco cadastrado, o JSON esta certo mesmo com a API divergindo.
const pendentes = resultado.filter((x) => x.decisao === "revisar");
if (pendentes.length) {
  console.log(`Desempatando ${pendentes.length} casos por geocoding reverso...\n`);
  for (const r of pendentes) {
    const revJson = await reverseGeocode(r.lat_json, r.lon_json);
    if (casaCom(revJson, { logradouro: r.logradouro_json, bairro: r.bairro_json })) {
      r.decisao = "manter";
      r.motivo += ` | reverso do ponto JSON = "${revJson.road ?? "?"}, ${revJson.suburb ?? "?"}" bate com o endereco cadastrado`;
      continue;
    }
    const endApi = r.endereco_api ? parseEnderecoApi(r.endereco_api) : null;
    const revApi = endApi ? await reverseGeocode(r.lat_api, r.lon_api) : null;
    if (endApi && casaCom(revApi, endApi)) {
      r.decisao = "adotar_api";
      r.lat = r.lat_api;
      r.lon = r.lon_api;
      r.endereco = r.endereco_api;
      r.endereco_estruturado = endApi;
      r.motivo += ` | reverso do ponto API = "${revApi.road ?? "?"}, ${revApi.suburb ?? "?"}" bate com o endereco da API`;
      continue;
    }
    // so aceita o geocode como nova coordenada se ele veio de uma consulta
    // COM numero/CEP (variantes 0-1). Variantes frouxas (so o nome da rua)
    // caem em ruas homonimas e nao sao evidencia suficiente.
    if (r.geocode_json && r.geocode_json._via <= 1) {
      r.decisao = "adotar_geocode";
      r.lat = r.geocode_json.lat;
      r.lon = r.geocode_json.lon;
      r.motivo += ` | usa o geocode do endereco cadastrado (consulta com numero/CEP; ponto do JSON esta em "${revJson?.suburb ?? "?"}")`;
    }
  }
}

// ---------- resumo ----------
const conta = resultado.reduce((acc, r) => { acc[r.decisao] = (acc[r.decisao] ?? 0) + 1; return acc; }, {});
console.log("=".repeat(90));
console.log("  DECISAO              QTD");
for (const [k, v] of Object.entries(conta)) console.log(`  ${k.padEnd(20)} ${v}`);
console.log("=".repeat(90));

for (const r of resultado.filter((x) => x.decisao === "adotar_api")) {
  console.log(`\n  ADOTAR API: ${r.loja}  [${r.slug}]  delta ${r.delta_km} km`);
  console.log(`    JSON : ${r.endereco_json}`);
  console.log(`           ${r.lat_json}, ${r.lon_json}  (${r.cidade_json})`);
  console.log(`    API  : ${r.endereco_api}`);
  console.log(`           ${r.lat}, ${r.lon}`);
  console.log(`    ${r.motivo}`);
}
console.log("\n=== REVISAR ===");
for (const r of resultado.filter((x) => x.decisao === "revisar")) {
  console.log(`  ${r.loja.padEnd(44)} [${r.slug}] ${r.delta_km} km`);
  console.log(`    JSON : ${r.endereco_json}`);
  console.log(`    API  : ${r.endereco_api ?? "(sem endereco)"}  ${r.lat_api}, ${r.lon_api}`);
  console.log(`    ${r.motivo}`);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({
  gerado_em: new Date().toISOString(),
  tolerancia_km: TOLERANCIA_KM,
  min_km: MIN_KM,
  resumo: conta,
  lojas: resultado,
}, null, 2), "utf8");
console.log(`\nPatch gravado em ${outPath}`);

// ---------- aplicacao (--apply) ----------
if (args.includes("--apply")) {
  const alteraveis = resultado.filter((r) => r.decisao === "adotar_api" || r.decisao === "adotar_geocode");
  let alteradas = 0;
  for (const r of alteraveis) {
    const loja = lojas.find((l) => l["link delivery"] === r.slug && norm(l.nome_empresa) === norm(r.loja));
    if (!loja) { console.error(`  ! loja nao encontrada: ${r.loja} [${r.slug}]`); continue; }
    loja.Latitude = +r.lat.toFixed(7);
    loja.Longitude = +r.lon.toFixed(7);
    if (r.decisao === "adotar_api" && r.endereco_estruturado) {
      const e = r.endereco_estruturado;
      if (e.logradouro) loja.logradouro = e.logradouro;
      if (e.numero) loja["número"] = e.numero;
      if (e.bairro) loja.bairro = e.bairro;
      if (e.cidade) loja.cidade = e.cidade;
      if (e.cep) loja.cep = e.cep;
      loja["endereco completo"] = `${e.logradouro ?? loja.logradouro}, ${e.numero ?? loja["número"] ?? ""} - ${e.bairro ?? loja.bairro ?? ""}, ${e.cidade ?? loja.cidade} - ${e.uf ?? "ES"}, ${e.cep ?? loja.cep ?? ""}`
        .replace(/,\s*,/g, ",").replace(/,\s*$/, "");
    }
    alteradas++;
    console.log(`  aplicado: ${r.loja} -> ${loja.Latitude}, ${loja.Longitude} (${r.decisao})`);
  }
  writeFileSync(inputPath, JSON.stringify(raw, null, 1), "utf8");
  console.log(`\n${alteradas} lojas corrigidas em ${inputPath}`);
  if (alteraveis.length !== alteradas) {
    console.error(`  ATENCAO: ${alteraveis.length - alteradas} entradas do patch nao encontradas no JSON.`);
  }
}
