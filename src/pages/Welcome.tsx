import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const Welcome = () => {
  const navigate = useNavigate();
  const [manualAddress, setManualAddress] = useState("");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number } | null>(null);

  const DEFAULT_COORDS = { lat: -23.550520, lon: -46.633308 };

  const handleUseCurrentLocation = () => {
    setIsLoadingLocation(true);
    setCurrentCoords(null);

    if (!navigator.geolocation) {
      toast.error("Ops! Seu navegador não suporta geolocalização.");
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentCoords({ lat: latitude, lon: longitude });

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );

          if (!response.ok) {
            throw new Error("A resposta da rede não foi bem-sucedida.");
          }
          
          const data = await response.json();

          if (data && data.address) {
            const { road, quarter, borough, city, state, postcode, country } = data.address;
            const addressParts = [
              road,
              quarter,
              borough,
              city,
              state,
              postcode,
              country
            ];
            const formattedAddress = addressParts.filter(p => p).join(', ');
            
            setManualAddress(formattedAddress);
            toast.success("Localização encontrada!");
          } else {
            throw new Error("Endereço não encontrado para estas coordenadas.");
          }
        } catch (error) {
          console.error("Erro no reverse geocoding:", error);
          const formattedAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setManualAddress(formattedAddress);
          toast.warn("Não foi possível obter o nome do endereço, mas as coordenadas foram salvas.");
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (error) => {
        let errorMessage = "Não foi possível obter sua localização.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Você precisa permitir o acesso à localização.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Localização indisponível no momento.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "A solicitação de localização expirou.";
        }
        toast.error(errorMessage);
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleManualAddress = () => {
    if (!manualAddress.trim()) {
      toast.error("Por favor, digite um endereço ou coordenadas.");
      return;
    }

    let userLocation;

    if (currentCoords) {
      userLocation = {
        ...currentCoords,
        address: manualAddress,
      };
    } else {
      const coordsMatch = manualAddress.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
      if (coordsMatch) {
        userLocation = {
          lat: parseFloat(coordsMatch[1]),
          lon: parseFloat(coordsMatch[2]),
          address: manualAddress,
        };
      } else {
        toast.info("Usando endereço manual. A busca será baseada no texto.");
        userLocation = {
          ...DEFAULT_COORDS,
          address: manualAddress,
        };
      }
    }

    toast.success("Endereço confirmado! 📍");
    
    navigate("/busca", {
      state: { userLocation },
    });
  };
  
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualAddress(e.target.value);
    if (currentCoords) {
      setCurrentCoords(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-primary">Yoogalize</h1>
          <p className="text-muted-foreground text-lg">
            Descubra os melhores lugares perto de você
          </p>
        </header>

        <Card className="p-8 space-y-6 shadow-lg">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
              <MapPin className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground">
              Olá! Bem-vindo! 👋
            </h2>
            <p className="text-muted-foreground">
              Para encontrar os melhores lugares pertinho de você, 
              precisamos saber onde você está.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleUseCurrentLocation}
              disabled={isLoadingLocation}
              className="w-full h-14 text-base font-semibold shadow-md hover:shadow-lg transition-all"
              size="lg"
            >
              <Navigation className="mr-2 h-5 w-5" />
              {isLoadingLocation ? "Detectando localização..." : "Usar Minha Localização Atual"}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card text-muted-foreground font-medium">
                ou, se preferir
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <label htmlFor="manual-address" className="text-sm font-medium text-foreground block">
              Digite seu endereço
            </label>
            <Input
              id="manual-address"
              type="text"
              placeholder="Ex: Rua Augusta, 1234 - São Paulo"
              value={manualAddress}
              onChange={handleAddressChange}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleManualAddress();
                }
              }}
              className="h-12 text-base"
            />
            <Button
              onClick={handleManualAddress}
              variant="outline"
              disabled={!manualAddress.trim()}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              Confirmar Localização
            </Button>
          </div>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          🔒 Sua privacidade é importante! Usamos sua localização apenas 
          para encontrar os melhores lugares perto de você.
        </p>
      </div>
    </div>
  );
};

export default Welcome;
