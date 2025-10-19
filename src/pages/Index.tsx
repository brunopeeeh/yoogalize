import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type UserLocation = {
  lat: number;
  lon: number;
  address: string;
  city: string;
};

const Index = () => {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [distance, setDistance] = useState([10]);
  const [category, setCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [geolocationStatus, setGeolocationStatus] = useState<"prompt" | "granted" | "denied">("prompt");

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
      const data = await response.json();
      if (data && data.display_name) {
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.city_district || "";
        const location: UserLocation = {
          lat,
          lon,
          address: data.display_name,
          city,
        };
        setUserLocation(location);
        setGeolocationStatus("granted");
      } else {
        throw new Error("Endereço não encontrado");
      }
    } catch (error) {
      console.error("Erro no reverse geocoding:", error);
      toast.error("Não foi possível obter o nome do seu endereço. Usando localização padrão.");
      setUserLocation({ lat: -23.5505, lon: -46.6333, address: "São Paulo, SP", city: "São Paulo" }); // Fallback
      setGeolocationStatus("denied");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          reverseGeocode(latitude, longitude);
        },
        (error) => {
          console.error("Erro ao obter localização:", error);
          toast.warning("Não foi possível obter sua localização. Por favor, digite seu endereço ou use a localização padrão.");
          setUserLocation({ lat: -23.5505, lon: -46.6333, address: "São Paulo, SP", city: "São Paulo" }); // Fallback
          setGeolocationStatus("denied");
          setIsLoading(false);
        }
      );
    } else {
      toast.error("Geolocalização não é suportada neste navegador.");
      setUserLocation({ lat: -23.5505, lon: -46.6333, address: "São Paulo, SP", city: "São Paulo" }); // Fallback
      setGeolocationStatus("denied");
      setIsLoading(false);
    }
  }, [reverseGeocode]);

  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  const handleSearch = () => {
    if (!category) {
      toast.error("Por favor, selecione um segmento");
      return;
    }
    if (!userLocation) {
      toast.error("Localização não definida. Por favor, aguarde ou digite seu endereço.");
      return;
    }
    
    navigate("/search", {
      state: {
        userLocation,
        distance: distance[0],
        category,
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border py-4 px-6 shadow-sm">
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-primary">Yoogalize</h2>
        </div>
      </header>

      <main className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-6 md:px-8 lg:px-10 py-8 space-y-8">
        <section className="text-center">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            Descubra os melhores lugares
          </h1>
          <p className="text-lg md:text-xl text-primary font-medium">para comer e beber perto de você</p>
        </section>

        {geolocationStatus === "prompt" && (
          <Card className="p-5 bg-card border-border shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Sua Localização
                </p>
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </Card>
        )}

        {geolocationStatus === "granted" && (
          <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
            <DialogTrigger asChild>
              <Card className="p-5 bg-card border-border shadow-sm cursor-pointer hover:bg-accent">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Sua Localização
                    </p>
                    <p className="text-sm text-foreground font-medium break-words">
                      {userLocation?.address}
                    </p>
                  </div>
                  <button
                    className="text-primary text-sm font-medium hover:underline whitespace-nowrap"
                  >
                    Trocar
                  </button>
                </div>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar sua localização</DialogTitle>
              </DialogHeader>
              <AddressAutocomplete 
                initialAddress={userLocation?.address || ""}
                onAddressSelect={(newLocation) => {
                  setUserLocation(newLocation);
                  setIsLocationDialogOpen(false);
                }}
                onCancel={() => setIsLocationDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}

        {geolocationStatus === "denied" && (
          <Card className="p-5 bg-card border-border shadow-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Digite sua localização
                  </p>
                </div>
              </div>
              <AddressAutocomplete 
                initialAddress={userLocation?.address || ""}
                onAddressSelect={(newLocation) => {
                  setUserLocation(newLocation);
                  setGeolocationStatus("granted");
                }}
                onCancel={() => {}}
              />
            </div>
          </Card>
        )}

        <section className="space-y-2">
          <label htmlFor="category-select" className="text-sm font-medium text-foreground">
            Segmento
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category-select" className="h-14 text-base">
              <SelectValue placeholder="Selecione um segmento" />
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
