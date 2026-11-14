import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YoogaPartnerBadge } from "./yooga-partner-badge";

describe("YoogaPartnerBadge (Clube de Cupons) component", () => {
  it("deve renderizar a variante pill com o texto do clube", () => {
    render(<YoogaPartnerBadge variant="pill" />);
    expect(screen.getByText(/Clube de Cupons/i)).toBeInTheDocument();
  });

  it("deve renderizar a variante compact para listagens e cards", () => {
    render(<YoogaPartnerBadge variant="compact" />);
    expect(screen.getByText("Clube de Cupons")).toBeInTheDocument();
  });

  it("deve renderizar o trust-card com os pilares de vantagens do clube", () => {
    render(<YoogaPartnerBadge variant="trust-card" />);
    expect(screen.getByText(/Clube de Cupons Ativo/i)).toBeInTheDocument();
    expect(screen.getByText("Descontos")).toBeInTheDocument();
    expect(screen.getByText(/Mais Vantagem/i)).toBeInTheDocument();
    expect(screen.getByText(/Direto na Loja/i)).toBeInTheDocument();
    expect(screen.getByText(/Economia Real/i)).toBeInTheDocument();
  });
});
