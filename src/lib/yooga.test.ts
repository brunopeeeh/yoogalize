import { describe, it, expect } from "vitest";
import { buildYoogaDeliveryUrl, isYoogaPartner, YOOGA_BRAND } from "./yooga";

describe("yooga module (Ecosystem & UTMs)", () => {
  it("deve montar URL completa a partir de um slug simples com UTMs", () => {
    const url = buildYoogaDeliveryUrl("decksgastrobeer", {
      medium: "detail_cta",
      content: "deck-store-id",
    });

    expect(url).toBeDefined();
    expect(url).toContain(`${YOOGA_BRAND.deliveryBaseUrl}/decksgastrobeer`);
    expect(url).toContain(`utm_source=${YOOGA_BRAND.defaultUtmSource}`);
    expect(url).toContain("utm_medium=detail_cta");
    expect(url).toContain("utm_campaign=marketplace");
    expect(url).toContain("utm_content=deck-store-id");
  });

  it("deve preservar domínio customizado caso a URL já comece com http", () => {
    const customUrl = "https://pedido.meurestaurante.com.br/cardapio";
    const result = buildYoogaDeliveryUrl(customUrl, { medium: "card_button" });

    expect(result).toBeDefined();
    expect(result).toContain(customUrl);
    expect(result).toContain("utm_source=descubra-yooga");
    expect(result).toContain("utm_medium=card_button");
  });

  it("deve retornar null para valores nulos, vazios ou indefinidos", () => {
    expect(buildYoogaDeliveryUrl(null)).toBeNull();
    expect(buildYoogaDeliveryUrl(undefined)).toBeNull();
    expect(buildYoogaDeliveryUrl("")).toBeNull();
    expect(buildYoogaDeliveryUrl("   ")).toBeNull();
  });

  it("deve preservar parâmetros de consulta já existentes na URL original", () => {
    const url = buildYoogaDeliveryUrl("loja?mesa=10", { medium: "quick_action" });
    expect(url).toContain("mesa=10");
    expect(url).toContain("utm_source=descubra-yooga");
  });

  it("deve identificar corretamente se a loja é parceira oficial com delivery ativo", () => {
    expect(isYoogaPartner({ linkDelivery: "minha-loja" })).toBe(true);
    expect(isYoogaPartner({ linkDelivery: "   " })).toBe(false);
    expect(isYoogaPartner({ linkDelivery: null })).toBe(false);
    expect(isYoogaPartner(undefined)).toBe(false);
  });
});
