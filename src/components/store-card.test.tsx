import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreCard } from "./store-card";
import { NormalizedEstablishment } from "@/lib/types";

const mockStore: NormalizedEstablishment & { distance?: number } = {
  id: "vibowls-acai",
  name: "Vibowls Açaí - 150275",
  category: "Açaiteria",
  address: "Rua Celso Calmon, 267 - Praia do Canto, Vitória - ES",
  city: "Vitória",
  latitude: -20.3,
  longitude: -40.29,
  distance: 120,
  linkDelivery: "vibowls-acai",
};

describe("StoreCard component", () => {
  it("deve renderizar botões de WhatsApp para compartilhamento", () => {
    render(
      <MemoryRouter>
        <StoreCard store={mockStore} isFavorite={false} onToggleFavorite={vi.fn()} />
      </MemoryRouter>
    );

    const whatsappButtons = screen.getAllByRole("button", {
      name: /Bora comer em Vibowls Açaí\? Convidar no WhatsApp/i,
    });
    expect(whatsappButtons.length).toBeGreaterThan(0);
  });

  it("deve abrir o WhatsApp ao clicar no botão do card", () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    render(
      <MemoryRouter>
        <StoreCard store={mockStore} isFavorite={false} onToggleFavorite={vi.fn()} />
      </MemoryRouter>
    );

    const whatsappButtons = screen.getAllByRole("button", {
      name: /Bora comer em Vibowls Açaí\? Convidar no WhatsApp/i,
    });
    whatsappButtons[0]!.click();

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock.mock.calls[0][0]).toContain("https://api.whatsapp.com/send?text=");
    expect(openMock.mock.calls[0][0]).toContain(encodeURIComponent("Vibowls Açaí"));
  });

  it("deve exibir o badge compacto de parceiro Yooga quando houver link de delivery", () => {
    render(
      <MemoryRouter>
        <StoreCard store={mockStore} isFavorite={false} onToggleFavorite={vi.fn()} />
      </MemoryRouter>
    );

    const badges = screen.getAllByLabelText("Parceiro Verificado Yooga");
    expect(badges.length).toBeGreaterThan(0);
  });
});
