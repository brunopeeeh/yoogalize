
import { Establishment as LojaRaw, NormalizedEstablishment, OperatingHour } from "./types";

const slug = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * Remove codigos internos ou IDs numericos que a Yooga anexa ao nome da empresa,
 * por exemplo: "Vibowls Acai - 150275" -> "Vibowls Acai".
 */
export const cleanEstablishmentName = (name: string): string => {
  if (!name) return "";
  return name.replace(/\s*-\s*\d{3,}\s*$/, "").trim();
};

/**
 * Chave de comparacao tolerante a acento e pontuacao: "Estação Beer" -> "estacao beer".
 * Remove tambem o installation_id que a fonte anexa ao nome ("Loja - 148139"),
 * senao a comparacao com o slug falharia.
 */
const key = (value: string): string =>
  cleanEstablishmentName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * O link de delivery ("link delivery") vem do admin da Yooga e pode estar
 * corrompido: a mesma URL pode estar gravada em varias lojas (ex.: "yooga",
 * "copied"). Nesses casos o cardapio que o usuario ve NAO e o da loja listada.
 *
 * Como nao existe endpoint de listagem na API para saber o dono correto de cada
 * slug, usamos o proprio catalogo: se um slug aparece em mais de uma loja,
 * ele e suspeito. A loja cujo NOME corresponde ao slug e a dona legitima
 * (ex.: "Estacao Beer" <-> "estacao-beer"); as demais perdem o cardapio.
 *
 * Nao depende de nenhuma lista fixa: se a base for corrigida, o comportamento
 * se ajusta sozinho.
 *
 * @returns array alinhado a `lojas`, com o link confiavel (ou null) de cada loja.
 */
export const resolveLinkDelivery = (lojas: LojaRaw[]): (string | null)[] => {
  const totalPorSlug = new Map<string, number>();
  for (const l of lojas) {
    const s = l["link delivery"];
    if (!s) continue;
    totalPorSlug.set(s, (totalPorSlug.get(s) ?? 0) + 1);
  }

  return lojas.map((l) => {
    const slug = l["link delivery"];
    if (!slug) return null;

    const total = totalPorSlug.get(slug) ?? 1;
    if (total === 1) return slug;

    // Slug compartilhado: so a loja cujo nome corresponde ao slug e a dona dele.
    return key(l.nome_empresa) === key(slug) ? slug : null;
  });
};

export const normalizeEstablishments = (lojas: LojaRaw[]): NormalizedEstablishment[] => {
  const linksConfiaveis = resolveLinkDelivery(lojas);

  return lojas.map((l, index) => {
    const linkDelivery = l["link delivery"] ?? null;
    // "Somente Presencial" nao vende no delivery, entao nao exibe cardapio.
    const somentePresencial =
      l.tipo_atendimento?.trim().toLowerCase() === "somente presencial";
    // Slug compartilhado por varias lojas aponta para o cardapio de outra loja.
    const linkCorrompido = linkDelivery !== null && linksConfiaveis[index] === null;

    return {
      id: `${slug(l.nome_empresa)}-${l.Latitude}-${l.Longitude}`,
      name: cleanEstablishmentName(l.nome_empresa),
      category: l.modelo_negocio.trim(),
      address: l["endereco completo"],
      city: l.cidade.trim(),
      latitude: l.Latitude,
      longitude: l.Longitude,
      description: l.tipo_atendimento ?? undefined,
      linkDelivery:
        somentePresencial || linkCorrompido ? null : linkDelivery,
      banner: l.banner ?? null,
      operatingHours: l.horario_funcionamento as OperatingHour[],
      serviceType: l.tipo_atendimento?.trim() ?? undefined,
    };
  });
};
