import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Suggestion = {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    [key: string]: any; // Allow other properties
  };
};

const Welcome = () => {
  const navigate = useNavigate();
  const [manualAddress, setManualAddress] = useState("");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const formatAddress = (addressObj: Suggestion['address']): string => {
    if (!addressObj) return '';
    const { road, city, state, postcode, country } = addressObj;
    const addressParts = [road, city, state, postcode, country];
    return addressParts.filter(Boolean).join(', ');
  };

  const handleUseCurrentLocation = () => {
    setIsLoadingLocation(true);
    setCurrentCoords(null);
    setSuggestions([]);

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
            const formatted = formatAddress(data.address);
            setManualAddress(formatted);
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

  useEffect(() => {
    if (!manualAddress.trim()) {
      setSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(manualAddress)}&format=json&limit=5&addressdetails=1`);
        const data = await response.json();
        setSuggestions(data || []);
      } catch (error) {
        console.error("Erro ao buscar sugestões:", error);
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [manualAddress]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    const formatted = formatAddress(suggestion.address);
    setManualAddress(formatted || suggestion.display_name); // Fallback para o nome completo
    setCurrentCoords({
      lat: parseFloat(suggestion.lat),
      lon: parseFloat(suggestion.lon),
    });
    setSuggestions([]);
  };

  const handleManualAddress = async () => {
    const trimmedAddress = manualAddress.trim();
    if (!trimmedAddress) {
      toast.error("Por favor, digite um endereço ou coordenadas.");
      return;
    }

    setIsLoadingLocation(true);

    try {
      // Se já temos as coordenadas (selecionou uma sugestão), não precisamos buscar de novo.
      const coords = currentCoords ?? await (async () => {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmedAddress)}&format=json&limit=1&addressdetails=1`);
        const data = await response.json();
        if (!data || data.length === 0) {
          throw new Error("Endereço não encontrado");
        }
        const result = data[0];
        return { lat: parseFloat(result.lat), lon: parseFloat(result.lon) };
      })();

      const userLocation = { ...coords, address: trimmedAddress };

      toast.success("Endereço confirmado! 📍");
      navigate("/busca", { state: { userLocation } });
    } catch (error) {
      console.error("Erro no geocoding:", error);
      toast.error("Não foi possível encontrar este endereço. Tente ser mais específico.");
    } finally {
      setIsLoadingLocation(false);
    }
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
              {isLoadingLocation && !manualAddress ? "Detectando..." : "Usar Minha Localização Atual"}
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

          <div className="space-y-3 relative">
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
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="absolute top-full mt-1 w-full bg-card border rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                {suggestions.map((s) => (
                  <li 
                    key={s.place_id} 
                    className="p-3 text-sm cursor-pointer hover:bg-accent"
                    onClick={() => handleSelectSuggestion(s)} >
                    {formatAddress(s.address) || s.display_name}
                  </li>
                ))}
              </ul>
            )}
            <Button
              onClick={handleManualAddress}
              variant="outline"
              disabled={!manualAddress.trim() || isLoadingLocation}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {isLoadingLocation && manualAddress ? "Confirmando..." : "Confirmar Localização"}
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
