import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Store, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "@/lib/distance";

type Establishment = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance: number;
};

type LocationState = {
  establishments: Establishment[];
  category: string;
  distance: number;
  location: string;
};

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  // Redirecionar para home se não houver dados
  if (!state || !state.establishments) {
    return <Navigate to="/" replace />;
  }

  const { establishments, category, distance: searchDistance, location: userLocation } = state;

  const getCategoryDisplay = () => {
    if (category === "todos") return "Todos os Segmentos";
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border py-4 px-6 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-semibold text-primary">Yoogalize</h2>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <Card className="p-5 bg-primary/5 border-primary/20">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{userLocation}</span>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Badge variant="secondary" className="text-sm">
                {getCategoryDisplay()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Raio de <span className="font-semibold text-primary">{searchDistance} km</span>
              </span>
              <span className="text-sm font-semibold text-primary ml-auto">
                {establishments.length} {establishments.length === 1 ? "resultado" : "resultados"}
              </span>
            </div>
          </div>
        </Card>

        {establishments.length === 0 ? (
          <Card className="p-8 text-center">
            <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum estabelecimento encontrado
            </h3>
            <p className="text-muted-foreground mb-6">
              Tente aumentar o raio de busca ou selecionar outro segmento
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              Voltar para busca
            </Button>
          </Card>
        ) : (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Estabelecimentos Ordenados por Distância
            </h2>
            {establishments.map((est, index) => (
              <Card 
                key={est.id} 
                className="p-5 bg-card border-border shadow-sm hover:shadow-md transition-shadow animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-sm">#{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start gap-2">
                      <Store className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground text-lg leading-tight">
                          {est.name}
                        </h3>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {est.category}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{est.address}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Navigation className="w-4 h-4 text-primary" />
                      <span className="text-primary font-semibold">
                        {formatDistance(est.distance)} de distância
                      </span>
                      {index === 0 && (
                        <Badge className="ml-2 bg-primary text-primary-foreground text-xs">
                          Mais próximo
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default Results;
