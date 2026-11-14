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

  it("deve exibir o badge compacto de Clube de Cupons quando temClubeCupons for true", () => {
    const storeWithClube = {
      ...mockStore,
      temClubeCupons: true,
    };
    render(
      <MemoryRouter>
        <StoreCard store={storeWithClube} isFavorite={false} onToggleFavorite={vi.fn()} />
      </MemoryRouter>
    );

    const badges = screen.getAllByLabelText("Clube de Cupons");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("deve renderizar a imagem do banner da loja quando informada", () => {
    const storeWithBanner = {
      ...mockStore,
      banner: "https://cdn-production.yooga.com.br/banner-test.png",
    };

    render(
      <MemoryRouter>
        <StoreCard store={storeWithBanner} isFavorite={false} onToggleFavorite={vi.fn()} />
      </MemoryRouter>
    );

    const bannerImg = screen.getByAltText(/Banner de Vibowls Açaí/i);
    expect(bannerImg).toBeInTheDocument();
    expect(bannerImg).toHaveAttribute("src", "https://cdn-production.yooga.com.br/banner-test.png");
  });
});
