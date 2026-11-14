import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatAddress, getCity } from "@/lib/address";
import { prefetchEstablishments } from "@/hooks/useEstablishments";
import { NominatimAddress } from "@/lib/types";

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

// Contexto do Mapbox usado para montar o endereco
type MapboxContext = {
  id?: string;
  text?: string;
};

type MapboxFeature = {
  id: string;
  place_name: string;
  center: [number, number];
  address?: { road?: string };
  properties?: { address?: string };
  context?: MapboxContext[];
};

const geocodeWithNominatim = async (
  query: string
): Promise<{ lat: number; lon: number; address: string; city: string } | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1&countrycodes=br`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.length === 0) return null;
    const item = data[0];
    const addr = item.address as NominatimAddress;
    return {
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      address: formatAddress(addr) || item.display_name,
      city: getCity(addr),
    };
  } catch (err) {
    console.warn("Falha no geocode com Nominatim:", err);
    return null;
  }
};

const reverseGeocodeWithNominatim = async (
  lat: number,
  lon: number
): Promise<{ address: string; city: string } | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !data.address) return null;
    const addr = data.address as NominatimAddress;
    return {
      address: formatAddress(addr) || data.display_name,
      city: getCity(addr),
    };
  } catch (err) {
    console.warn("Falha no reverse geocode com Nominatim:", err);
    return null;
  }
};

const searchSuggestionsWithNominatim = async (query: string): Promise<Suggestion[]> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=br`
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map((item) => {
      const addr = item.address as NominatimAddress;
      return {
        place_id: String(item.place_id),
        display_name: formatAddress(addr) || item.display_name,
        lat: String(item.lat),
        lon: String(item.lon),
        address: {
          road: addr?.road || "",
          city: getCity(addr),
          state: addr?.state || "",
          postcode: addr?.postcode || "",
          country: "Brasil",
        },
      };
    });
  } catch (err) {
    console.warn("Falha na busca de sugestões do Nominatim:", err);
    return [];
  }
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
  const [currentCity, setCurrentCity] = useState<string>("");

  // Pré-carrega o catálogo de lojas em background assim que o usuário acessa a página inicial
  useEffect(() => {
    prefetchEstablishments();
  }, []);

  const formatMapboxAddress = (result: MapboxFeature): string => {
    const road = result.address?.road || result.properties?.address || "";
    const neighborhood =
      result.context?.find((c) => c.id?.startsWith("neighborhood"))?.text || "";
    const city =
      result.context?.find((c) => c.id?.startsWith("place"))?.text || "";
    const state =
      result.context?.find((c) => c.id?.startsWith("region"))?.text || "";
    const postcode =
      result.context?.find((c) => c.id?.startsWith("postcode"))?.text || "";

    return [road, neighborhood, city, state, postcode, "Brasil"]
      .filter(Boolean)
      .join(", ");
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
          let formatted = "";
          let city = "";

          // 1. Tenta Mapbox se token estiver disponível
          if (MAPBOX_ACCESS_TOKEN) {
            try {
              const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&language=pt&limit=1`
              );
              if (response.ok) {
                const data = await response.json();
                if (data?.features?.length > 0) {
                  const result = data.features[0] as MapboxFeature;
                  formatted = result.place_name;
                  city = result.context?.find((c) => c.id?.startsWith("place"))?.text || "";
                }
              }
            } catch (err) {
              console.warn("Mapbox reverse geocode falhou, tentando fallback Nominatim:", err);
            }
          }

          // 2. Fallback para Nominatim
          if (!formatted) {
            const nomResult = await reverseGeocodeWithNominatim(latitude, longitude);
            if (nomResult) {
              formatted = nomResult.address;
              city = nomResult.city;
            }
          }

          if (formatted) {
            setManualAddress(formatted);
            setCurrentCity(city);
            toast.success("Localização encontrada!");
          } else {
            const fallbackAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            setManualAddress(fallbackAddress);
            toast.warning("Não foi possível obter o nome do endereço, mas as coordenadas foram salvas.");
          }
        } catch (error) {
          console.error("Erro no reverse geocoding:", error);
          const fallbackAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setManualAddress(fallbackAddress);
          toast.warning("Não foi possível obter o nome do endereço, mas as coordenadas foram salvas.");
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
        let adaptedSuggestions: Suggestion[] = [];

        // 1. Tenta Mapbox primeiro
        if (MAPBOX_ACCESS_TOKEN) {
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(manualAddress)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&language=pt&limit=5`
            );
            if (response.ok) {
              const mapboxData = await response.json();
              if (mapboxData?.features?.length > 0) {
                adaptedSuggestions = mapboxData.features.map((feature: MapboxFeature) => ({
                  place_id: feature.id,
                  display_name: feature.place_name,
                  lat: feature.center[1].toString(),
                  lon: feature.center[0].toString(),
                  address: {
                    road: feature.address?.road || feature.properties?.address || "",
                    city: feature.context?.find((c) => c.id?.startsWith("place"))?.text || "",
                    state: feature.context?.find((c) => c.id?.startsWith("region"))?.text || "",
                    postcode: feature.context?.find((c) => c.id?.startsWith("postcode"))?.text || "",
                    country: "Brasil",
                  },
                }));
              }
            }
          } catch (err) {
            console.warn("Mapbox autocomplete falhou, tentando fallback Nominatim:", err);
          }
        }

        // 2. Fallback para Nominatim
        if (adaptedSuggestions.length === 0) {
          adaptedSuggestions = await searchSuggestionsWithNominatim(manualAddress);
        }

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
    setCurrentCity(suggestion.address.city || "");
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
      let lat: number;
      let lon: number;
      let finalAddress: string;
      let newCity: string;
      const isInputCEP = isCEP(trimmedAddress);

      if (currentCoords) {
        lat = currentCoords.lat;
        lon = currentCoords.lon;
        finalAddress = trimmedAddress;
        newCity = currentCity;
      } else if (isInputCEP) {
        const cepResponse = await fetch(`https://viacep.com.br/ws/${trimmedAddress.replace(/\D/g, "")}/json/`);
        if (!cepResponse.ok) {
          throw new Error("Erro ao buscar CEP na ViaCEP.");
        }
        const cepData = await cepResponse.json();

        if (cepData.erro) {
          throw new Error("CEP não encontrado ou inválido.");
        }

        const fullAddressFromCEP = `${cepData.logradouro}, ${cepData.bairro}, ${cepData.localidade} - ${cepData.uf}`;
        newCity = cepData.localidade;
        finalAddress = fullAddressFromCEP;

        let geoCoords: { lat: number; lon: number } | null = null;

        // 1. Tenta Mapbox para o CEP
        if (MAPBOX_ACCESS_TOKEN) {
          try {
            const mapboxResponse = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullAddressFromCEP)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&language=pt&limit=1`
            );
            if (mapboxResponse.ok) {
              const mapboxData = await mapboxResponse.json();
              if (mapboxData?.features?.length > 0) {
                const result = mapboxData.features[0] as MapboxFeature;
                geoCoords = { lat: result.center[1], lon: result.center[0] };
              }
            }
          } catch (err) {
            console.warn("Mapbox CEP geocode falhou, tentando fallback Nominatim:", err);
          }
        }

        // 2. Fallback Nominatim para o CEP
        if (!geoCoords) {
          const nomResult = await geocodeWithNominatim(fullAddressFromCEP);
          if (nomResult) {
            geoCoords = { lat: nomResult.lat, lon: nomResult.lon };
          }
        }

        if (!geoCoords) {
          throw new Error("Não foi possível geocodificar o endereço do CEP.");
        }

        lat = geoCoords.lat;
        lon = geoCoords.lon;
      } else {
        let geoResult: { lat: number; lon: number; address: string; city: string } | null = null;

        // 1. Tenta Mapbox
        if (MAPBOX_ACCESS_TOKEN) {
          try {
            const mapboxResponse = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmedAddress)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&language=pt&limit=1`
            );
            if (mapboxResponse.ok) {
              const mapboxData = await mapboxResponse.json();
              if (mapboxData?.features?.length > 0) {
                const result = mapboxData.features[0] as MapboxFeature;
                geoResult = {
                  lat: result.center[1],
                  lon: result.center[0],
                  address: formatMapboxAddress(result),
                  city: result.context?.find((c) => c.id?.startsWith("place"))?.text || "",
                };
              }
            }
          } catch (err) {
            console.warn("Mapbox busca endereço falhou, tentando fallback Nominatim:", err);
          }
        }

        // 2. Fallback Nominatim
        if (!geoResult) {
          geoResult = await geocodeWithNominatim(trimmedAddress);
        }

        if (!geoResult) {
          throw new Error("Endereço não encontrado.");
        }

        lat = geoResult.lat;
        lon = geoResult.lon;
        finalAddress = geoResult.address;
        newCity = geoResult.city;
      }

      const userLocation = { lat, lon, address: finalAddress, city: newCity };

      toast.success("Localização confirmada! 📍");
      navigate("/busca", { state: { userLocation } });
    } catch (error: unknown) {
      console.error("Erro no geocoding:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível encontrar esta localização. Tente ser mais específico.";
      toast.error(message);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualAddress(e.target.value);
    if (currentCoords) {
      setCurrentCoords(null);
      setCurrentCity("");
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
              onKeyDown={(e) => {
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
