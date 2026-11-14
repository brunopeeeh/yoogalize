import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

/**
 * Impede que uma excecao em qualquer tela derrube a aplicacao inteira,
 * deixando a pagina em branco. Antes disso, um `location.state` malformado ou
 * um JSON corrompido no sessionStorage derrubava o app sem aviso.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Erro não tratado na aplicação:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full text-center space-y-4">
            <img
              src="/yoogalize_triste.png"
              alt="Mascote Yoogalize triste"
              className="h-28 w-auto mx-auto"
            />
            <h1 className="text-2xl font-semibold text-foreground">
              Algo deu errado
            </h1>
            <p className="text-muted-foreground">
              Não conseguimos carregar esta tela. Tente novamente — se o problema
              persistir, limpe os dados salvos do navegador.
            </p>
            {this.state.message && (
              <p className="text-xs text-muted-foreground/70 break-words">
                {this.state.message}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()}>
                Recarregar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  sessionStorage.clear();
                  window.location.href = "/";
                }}
              >
                Limpar e voltar ao início
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
