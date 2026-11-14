import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildWhatsAppInvite,
  getWhatsAppShareUrl,
  shareToWhatsApp,
  copyWhatsAppInvite,
} from "./share";

describe("share utility (Bora comer aqui?)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseStore = {
    id: "vibowls-acai",
    name: "Vibowls Açaí - 150275",
    category: "Açaiteria",
    address: "Rua Celso Calmon, 267 - Praia do Canto, Vitória - ES",
    linkDelivery: "vibowls-acai",
  };

  it("deve montar mensagem formatada com nome limpo e link do delivery", () => {
    const invite = buildWhatsAppInvite(baseStore, {
      currentUrl: "http://localhost:8080/loja/vibowls-acai",
    });

    expect(invite).toContain("🍽️ *Bora comer aqui?*");
    // Código interno 150275 deve ter sido removido
    expect(invite).toContain("*Vibowls Açaí* • _Açaiteria_");
    expect(invite).toContain("📍 Rua Celso Calmon, 267 - Praia do Canto, Vitória - ES");
    expect(invite).toContain("🛵 *Cardápio & Pedidos:* https://delivery.yooga.app/vibowls-acai");
    expect(invite).toContain("👀 *Ver no Descubra Yooga:* http://localhost:8080/loja/vibowls-acai");
  });

  it("deve incluir URL completa de delivery caso já comece com http", () => {
    const storeWithHttp = {
      ...baseStore,
      linkDelivery: "https://delivery.custom.app/loja",
    };

    const invite = buildWhatsAppInvite(storeWithHttp);
    expect(invite).toContain("🛵 *Cardápio & Pedidos:* https://delivery.custom.app/loja");
  });

  it("não deve incluir linha de delivery se a loja não tiver link", () => {
    const storeWithoutDelivery = {
      ...baseStore,
      linkDelivery: null,
    };

    const invite = buildWhatsAppInvite(storeWithoutDelivery);
    expect(invite).not.toContain("🛵 *Cardápio & Pedidos:*");
  });

  it("deve incluir status de horário quando houver horários válidos", () => {
    const storeWithHours = {
      ...baseStore,
      operatingHours: [
        {
          day_of_week: 1,
          day: "Segunda-feira",
          hours: [{ start: "10:00:00", end: "22:00:00", type: "Presencial" }],
        },
      ],
    };

    const invite = buildWhatsAppInvite(storeWithHours);
    // Deve conter emoji de status (🟢 ou 🔴)
    expect(invite).toMatch(/[🟢🔴]/u);
  });

  it("deve gerar URL do WhatsApp codificada corretamente", () => {
    const text = "🍽️ *Bora comer aqui?*\n*Restaurante*";
    const url = getWhatsAppShareUrl(text);

    expect(url.startsWith("https://api.whatsapp.com/send?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent(text));
  });

  it("deve chamar window.open ao executar shareToWhatsApp", () => {
    const openMock = vi.fn().mockReturnValue({});
    vi.stubGlobal("open", openMock);

    shareToWhatsApp(baseStore);

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock.mock.calls[0][0]).toContain("https://api.whatsapp.com/send?text=");
  });

  it("deve copiar o texto formatado para o clipboard ao executar copyWhatsAppInvite", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const success = await copyWhatsAppInvite(baseStore);
    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("🍽️ *Bora comer aqui?*"));
  });
});
