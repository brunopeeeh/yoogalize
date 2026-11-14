import { describe, it, expect } from "vitest";
import {
  getStoreInitials,
  getCategoryVisual,
  sortEstablishmentsSmart,
} from "./store-presentation";
import { NormalizedEstablishment, OperatingHour } from "./types";

describe("store-presentation", () => {
  describe("getStoreInitials", () => {
    it("extrai 2 iniciais de nomes com 2 ou mais palavras", () => {
      expect(getStoreInitials("Vibowls Açaí")).toBe("VA");
      expect(getStoreInitials("Café Bamboo")).toBe("CB");
      expect(getStoreInitials("Deck's Gastro Beer")).toBe("DG");
      expect(getStoreInitials("Empório Turk Zoo")).toBe("ET");
      expect(getStoreInitials("Hells Bells Bar")).toBe("HB");
    });

    it("extrai as 2 primeiras letras de nomes com apenas 1 palavra", () => {
      expect(getStoreInitials("Mercatto")).toBe("ME");
      expect(getStoreInitials("Bixiga")).toBe("BI");
    });

    it("retorna fallback para strings vazias ou nulas", () => {
      expect(getStoreInitials("")).toBe("YG");
    });
  });

  describe("getCategoryVisual", () => {
    it("atribui tema e cores corretas para açaí", () => {
      const visual = getCategoryVisual("Açaiteria");
      expect(visual.label).toBe("Açaí");
      expect(visual.emoji).toBe("🍇");
      expect(visual.avatarBg).toBe("bg-[#7c3aed]");
    });

    it("atribui tema e cores corretas para pizza", () => {
      const visual = getCategoryVisual("Pizzaria");
      expect(visual.label).toBe("Pizza");
      expect(visual.emoji).toBe("🍕");
    });

    it("atribui tema e cores corretas para café", () => {
      const visual = getCategoryVisual("Cafeteria Gourmet");
      expect(visual.label).toBe("Café");
      expect(visual.emoji).toBe("☕");
    });
  });

  describe("sortEstablishmentsSmart (UX 5)", () => {
    // Loja aberta 24/7 em todos os dias da semana
    const mockHoursOpen: OperatingHour[] = [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
      day_of_week,
      day: "Dia",
      hours: [{ start: "00:00", end: "23:59", type: "delivery" }],
    }));

    // Loja que abre apenas na madrugada de um dia distante
    const mockHoursClosed: OperatingHour[] = [
      {
        day_of_week: 1,
        day: "Segunda",
        hours: [{ start: "03:00", end: "04:00", type: "delivery" }],
      },
    ];

    const storeA: NormalizedEstablishment & { distance: number } = {
      id: "a",
      name: "Loja Fechada Mais Perto",
      category: "Restaurante",
      address: "Rua A",
      city: "Vitória",
      latitude: -20.3,
      longitude: -40.3,
      distance: 0.2, // 200m
      operatingHours: mockHoursClosed,
    };

    const storeB: NormalizedEstablishment & { distance: number } = {
      id: "b",
      name: "Loja Aberta Mais Longe",
      category: "Restaurante",
      address: "Rua B",
      city: "Vitória",
      latitude: -20.31,
      longitude: -40.31,
      distance: 1.5, // 1.5km
      operatingHours: mockHoursOpen,
    };

    const storeC: NormalizedEstablishment & { distance: number } = {
      id: "c",
      name: "Loja Sem Horário",
      category: "Restaurante",
      address: "Rua C",
      city: "Vitória",
      latitude: -20.32,
      longitude: -40.32,
      distance: 0.5, // 500m
      operatingHours: [],
    };

    it("ordena lojas abertas primeiro, independente de distância, e mantém desempate por distância", () => {
      const sorted = sortEstablishmentsSmart([storeA, storeB, storeC]);
      // storeB está aberta, então deve ser a primeira
      expect(sorted[0].id).toBe("b");
      // storeA e storeC estão fechadas/sem horário, mas storeA está mais perto (0.2km vs 0.5km)
      expect(sorted[1].id).toBe("a");
      expect(sorted[2].id).toBe("c");
    });
  });
});
