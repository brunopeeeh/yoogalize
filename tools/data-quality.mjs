import { readFileSync } from "node:fs";
const path = process.argv[2] || "public/lojas.json";
const raw = JSON.parse(readFileSync(path, "utf8"));
const lojas = Array.isArray(raw) ? raw : raw.result;

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const cont = (arr) => { const m = new Map(); for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1); return m; };
const top = (m, n = 15) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const topDup = (arr, n = 20) => [...cont(arr).entries()].filter(([, k]) => k > 1).sort((a, b) => b[1] - a[1]).slice(0, n);

console.log(`ARQUIVO: ${path}`);
console.log(`TOTAL:   ${lojas.length}\n`);

// ---- 1. cidades ----
const cidades = cont(lojas.map((l) => (l.cidade ?? "").trim()));
console.log(`=== CIDADES (${cidades.size} distintas) ===`);
top(cidades, 200).forEach(([c, n]) => console.log(`  ${String(n).padStart(4)}  ${c}`));

// ---- 2. slugs ----
const comSlug = lojas.filter((l) => l["link delivery"]);
const semSlug = lojas.filter((l) => !l["link delivery"]);
console.log(`\n=== SLUGS ===`);
console.log(`  com slug: ${comSlug.length} | sem slug: ${semSlug.length}`);
const slugsDup = topDup(comSlug.map((l) => l["link delivery"]), 20);
console.log(`  slugs duplicados (apontando p/ mesma loja): ${slugsDup.length}`);
slugsDup.forEach(([s, n]) => console.log(`    x${n}  ${s}`));
const marcador = comSlug.filter((l) => /DESATIV|CANCEL|INTERROMP/i.test(l["link delivery"]));
console.log(`  slugs com marcador de desativação: ${marcador.length}`);
marcador.forEach((l) => console.log(`    ${l["link delivery"]}  |  ${l.nome_empresa}`));
const literais = comSlug.filter((l) => ["null", "copied", "undefined", "none"].includes(norm(l["link delivery"])));
console.log(`  slugs literais quebrados: ${literais.length}`);
literais.forEach((l) => console.log(`    ${l["link delivery"]}  |  ${l.nome_empresa}`));

// ---- 3. coordenadas ----
const semCoord = lojas.filter((l) => typeof l.Latitude !== "number" || typeof l.Longitude !== "number");
const foraES = lojas.filter((l) => typeof l.Latitude === "number" && !(-21.4 < l.Latitude && l.Latitude < -17.8));
const zeroCoord = lojas.filter((l) => l.Latitude === 0 && l.Longitude === 0);
console.log(`\n=== COORDENADAS ===`);
console.log(`  sem coordenada: ${semCoord.length} | fora do ES: ${foraES.length} | (0,0): ${zeroCoord.length}`);

// ---- 4. horarios ----
let semHoras = 0, comSegundos = 0, totalSlots = 0, diasVazios = 0;
for (const l of lojas) {
  const h = l.horario_funcionamento;
  if (!Array.isArray(h) || h.length === 0) { semHoras++; continue; }
  let algum = false;
  for (const d of h) {
    if (!d.hours?.length) { diasVazios++; continue; }
    algum = true;
    for (const s of d.hours) {
      totalSlots++;
      if (typeof s.start === "string" && !s.start.endsWith(":00")) comSegundos++;
    }
  }
  if (!algum) semHoras++;
}
console.log(`\n=== HORARIOS ===`);
console.log(`  lojas sem horario utilizavel: ${semHoras}`);
console.log(`  dias sem faixa: ${diasVazios}`);
console.log(`  slots totais: ${totalSlots} | com segundos != 00: ${comSegundos} (${((comSegundos / totalSlots) * 100 || 0).toFixed(1)}%)`);

// ---- 5. segmentos / atendimento ----
console.log(`\n=== SEGMENTOS (${cont(lojas.map((l) => (l.modelo_negocio ?? "").trim())).size}) ===`);
top(cont(lojas.map((l) => (l.modelo_negocio ?? "").trim())), 40).forEach(([c, n]) => console.log(`  ${String(n).padStart(4)}  ${c}`));

console.log(`\n=== TIPO DE ATENDIMENTO ===`);
top(cont(lojas.map((l) => l.tipo_atendimento ?? "(null)"))).forEach(([c, n]) => console.log(`  ${String(n).padStart(4)}  ${c}`));

// ---- 6. campos obrigatorios ----
console.log(`\n=== CAMPOS VAZIOS ===`);
for (const campo of ["nome_empresa", "modelo_negocio", "logradouro", "bairro", "cidade", "cep", "endereco completo"]) {
  const vazios = lojas.filter((l) => !String(l[campo] ?? "").trim()).length;
  console.log(`  ${String(vazios).padStart(5)}  ${campo}`);
}

// ---- 7. nomes duplicados ----
const dupNome = topDup(lojas.map((l) => norm(l.nome_empresa)), 15);
console.log(`\n=== NOMES DUPLICADOS (${dupNome.length} grupos) ===`);
dupNome.forEach(([n, c]) => console.log(`  x${c}  ${n}`));

// ---- 8. endereco completo coerente? ----
const endIncoerente = lojas.filter((l) => {
  const e = String(l["endereco completo"] ?? "");
  return e.includes("- ,") || e.includes(",, ") || e.includes("  ") || /,\s*,\s*/.test(e);
});
console.log(`\n=== 'endereco completo' com formatacao suspeita: ${endIncoerente.length} ===`);
endIncoerente.slice(0, 5).forEach((l) => console.log(`  "${l["endereco completo"]}"`));
