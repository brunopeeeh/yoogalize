import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Establishment = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance: number;
};

const mockEstablishments: Establishment[] = [
  { id: "1", name: "Restaurante Sabor da Terra", category: "Restaurante", address: "Rua das Flores, 45", distance: 1.2 },
  { id: "2", name: "Bar do João", category: "Bar", address: "Av. Central, 123", distance: 2.5 },
  { id: "3", name: "Pizzaria Bella Napoli", category: "Pizzaria", address: "Rua Roma, 78", distance: 3.1 },
  { id: "4", name: "Café Aroma", category: "Cafeteria", address: "Praça da Liberdade, 12", distance: 0.8 },
  { id: "5", name: "Lanchonete Point", category: "Lanchonete", address: "Rua 7 de Setembro, 234", distance: 1.9 },
  { id: "6", name: "Sushi House", category: "Restaurante", address: "Av. Paulista, 567", distance: 4.2 },
  { id: "7", name: "Pub The Lion", category: "Bar", address: "Rua Augusta, 890", distance: 2.8 },
  { id: "8", name: "Padaria Pão Quente", category: "Padaria", address: "Rua das Acácias, 34", distance: 0.5 },
];

const Index = () => {
  const navigate = useNavigate();
  const [location, setLocation] = useState("Detectando sua localização...");
  const [distance, setDistance] = useState([10]);
  const [category, setCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate location detection
    const timer = setTimeout(() => {
      setLocation("Rua Example, 123 - São Paulo, SP");
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleLocationChange = () => {
    toast.info("Funcionalidade de trocar localização em desenvolvimento");
  };

  const handleSearch = () => {
    if (!category) {
      toast.error("Por favor, selecione uma categoria");
      return;
    }
    
    // Filtrar por distância
    let filtered = mockEstablishments.filter(
      (est) => est.distance <= distance[0]
    );
    
    // Filtrar por categoria (se não for "todos")
    if (category !== "todos") {
      filtered = filtered.filter(
        (est) => est.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Ordenar por distância (menor para maior)
    const sorted = filtered.sort((a, b) => a.distance - b.distance);
    
    // Navegar para página de resultados
    navigate("/resultados", {
      state: {
        establishments: sorted,
        category,
        distance: distance[0],
        location
      }
    });
    
    toast.success(`${sorted.length} estabelecimentos encontrados!`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border py-4 px-6 shadow-sm">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-primary">Yoogalize</h2>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8 space-y-8">
        <section className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Descubra os melhores lugares
          </h1>
          <p className="text-lg text-primary font-medium">para comer e beber perto de você</p>
        </section>

        <Card className="p-5 bg-card border-border shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Sua Localização
              </p>
              {isLoading ? (
                <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
              ) : (
                <p className="text-sm text-foreground font-medium break-words">
                  {location}
                </p>
              )}
            </div>
            <button
              onClick={handleLocationChange}
              className="text-primary text-sm font-medium hover:underline whitespace-nowrap"
            >
              Trocar
            </button>
          </div>
        </Card>

        <section className="space-y-2">
          <label htmlFor="category-select" className="text-sm font-medium text-foreground">
            Categoria
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category-select" className="h-14 text-base">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Segmentos</SelectItem>
              <SelectItem value="restaurante">Restaurante</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="pizzaria">Pizzaria</SelectItem>
              <SelectItem value="cafeteria">Cafeteria</SelectItem>
              <SelectItem value="lanchonete">Lanchonete</SelectItem>
              <SelectItem value="padaria">Padaria</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="space-y-4">
          <div className="text-center">
            <p className="text-foreground text-base">
              Até{" "}
              <span className="font-bold text-primary text-lg">
                {distance[0]} km
              </span>{" "}
              de distância
            </p>
          </div>
          <div className="px-2">
            <Slider
              value={distance}
              onValueChange={setDistance}
              min={1}
              max={50}
              step={1}
              className="w-full"
              aria-label="Seletor de distância"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>1 km</span>
              <span>50 km</span>
            </div>
          </div>
        </section>

        <Button
          onClick={handleSearch}
          disabled={isLoading}
          className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all"
        >
          BUSCAR ESTABELECIMENTOS
        </Button>
      </main>
    </div>
  );
};

export default Index;
