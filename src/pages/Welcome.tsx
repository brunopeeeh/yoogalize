import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

// Tipos locais para este componente
type SuggestionAddress = {
  road?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  [key: string]: string | undefined;
};

type Suggestion = {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address: SuggestionAddress;
};

// Tipo mínimo para a feature do Mapbox, contendo apenas o que usamos
type MapboxFeature = {
  id: string;
  place_name: string;
  center: [number, number];
  address?: { road?: string };
  properties?: { address?: string };
  context?: {
    place?: { name: string };
    region?: { name: string };
    postcode?: { name: string };
  };
};

const Welcome = () => {
  const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

  const isCEP = (text: string): boolean => {
    return /^(\d{5}-\d{3}|\d{8})$/.test(text);
  };

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
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&language=pt&limit=1`
          );

          if (!response.ok) {
            throw new Error("Erro na geocodificação reversa do Mapbox.");
          }
          
          const data = await response.json();

          if (data && data.features && data.features.length > 0) {
            const result = data.features[0];
            const formatted = result.place_name; // O place_name do Mapbox já é o endereço formatado
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
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(manualAddress)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&language=pt&limit=5`
        );
        if (!response.ok) {
          throw new Error("Erro ao buscar sugestões no Mapbox.");
        }
        const mapboxData = await response.json();

        if (!mapboxData || !mapboxData.features || mapboxData.features.length === 0) {
          setSuggestions([]);
          return;
        }

        const adaptedSuggestions: Suggestion[] = mapboxData.features.map((feature: MapboxFeature) => ({
          place_id: feature.id,
          display_name: feature.place_name,
          lat: feature.center[1].toString(), // latitude
          lon: feature.center[0].toString(), // longitude
          address: {
            road: feature.address?.road || feature.properties?.address || '',
            city: feature.context?.place?.name || '',
            state: feature.context?.region?.name || '',
            postcode: feature.context?.postcode?.name || '',
            country: 'Brasil',
          },
        }));
        setSuggestions(adaptedSuggestions);
      } catch (error) {
        console.error("Erro ao buscar sugestões:", error);
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [manualAddress, MAPBOX_ACCESS_TOKEN]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setManualAddress(suggestion.display_name);
    setCurrentCoords({
      lat: parseFloat(suggestion.lat),
      lon: parseFloat(suggestion.lon),
    });
    setSuggestions([]);
  };

  const handleManualAddress = async () => {
    const trimmedAddress = manualAddress.trim();
    if (!trimmedAddress) {
      toast.error("Por favor, digite um endereço ou CEP.");
      return;
    }

    setIsLoadingLocation(true);

    try {
      let lat, lon, finalAddress, newCity;
      const isInputCEP = isCEP(trimmedAddress);

      if (currentCoords) {
        lat = currentCoords.lat;
        lon = currentCoords.lon;
        finalAddress = trimmedAddress;
        newCity = "";
      } else if (isInputCEP) {
        const cepResponse = await fetch(`https://viacep.com.br/ws/${trimmedAddress.replace(/\D/g, '')}/json/`);
        if (!cepResponse.ok) {
          throw new Error("Erro ao buscar CEP na ViaCEP.");
        }
        const cepData = await cepResponse.json();

        if (cepData.erro) {
          throw new Error("CEP não encontrado ou inválido.");
        }

        const fullAddressFromCEP = `${cepData.logradouro}, ${cepData.bairro}, ${cepData.localidade} - ${cepData.uf}`;
        
        const mapboxResponse = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullAddressFromCEP)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&language=pt&limit=1`);
        if (!mapboxResponse.ok) {
          throw new Error("Erro ao geocodificar endereço do CEP no Mapbox.");
        }
        const mapboxData = await mapboxResponse.json();

        if (!mapboxData || !mapboxData.features || mapboxData.features.length === 0) {
          throw new Error("Não foi possível geocodificar o endereço do CEP.");
        }

        const result = mapboxData.features[0];
        lat = result.center[1];
        lon = result.center[0];
        finalAddress = fullAddressFromCEP;
        newCity = cepData.localidade;

      } else {
        const mapboxResponse = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmedAddress)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&language=pt&limit=1`
        );
        if (!mapboxResponse.ok) {
          throw new Error("Erro ao buscar endereço no Mapbox.");
        }
        const mapboxData = await mapboxResponse.json();

        if (!mapboxData || !mapboxData.features || mapboxData.features.length === 0) {
          throw new Error("Endereço não encontrado.");
        }

        const result = mapboxData.features[0];
        lat = result.center[1];
        lon = result.center[0];
        
        const road = result.address?.road || result.properties?.address || '';
        const neighborhood = result.context?.neighborhood?.name || result.context?.place?.name || '';
        const city = result.context?.place?.name || '';
        const state = result.context?.region?.name || '';
        const postcode = result.context?.postcode?.name || '';
        const country = 'Brasil';

        const addressParts = [road, neighborhood, city, state, postcode, country].filter(Boolean);
        finalAddress = addressParts.join(', ');
        newCity = city;
      }

      const userLocation = { lat: lat, lon: lon, address: finalAddress, city: newCity };

      toast.success("Localização confirmada! 📍");
      navigate("/busca", { state: { userLocation } });
    } catch (error: unknown) {
      console.error("Erro no geocoding:", error);
      const message = error instanceof Error ? error.message : "Não foi possível encontrar esta localização. Tente ser mais específico.";
      toast.error(message);
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
              placeholder="Ex: Rua Augusta, 1234 - São Paulo ou CEP 01305-000"
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
                    <div className="font-medium">{s.display_name}</div>
                    {formatAddress(s.address) && formatAddress(s.address) !== s.display_name && (
                      <div className="text-xs text-muted-foreground">{formatAddress(s.address)}</div>
                    )}
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
