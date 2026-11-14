import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YoogaPartnerBadge } from "./yooga-partner-badge";

describe("YoogaPartnerBadge component", () => {
  it("deve renderizar a variante pill com o texto oficial", () => {
    render(<YoogaPartnerBadge variant="pill" />);
    expect(screen.getByText("Parceiro Verificado Yooga")).toBeInTheDocument();
  });

  it("deve renderizar a variante compact para listagens", () => {
    render(<YoogaPartnerBadge variant="compact" />);
    expect(screen.getByText("Yooga")).toBeInTheDocument();
  });

  it("deve renderizar o trust-card com os 3 pilares de garantia", () => {
    render(<YoogaPartnerBadge variant="trust-card" />);
    expect(screen.getByText("Parceiro Verificado Yooga")).toBeInTheDocument();
    expect(screen.getByText("0% comissão")).toBeInTheDocument();
    expect(screen.getByText(/No PDV/i)).toBeInTheDocument();
    expect(screen.getByText(/Preço Justo/i)).toBeInTheDocument();
    expect(screen.getByText(/Direto/i)).toBeInTheDocument();
  });
});
