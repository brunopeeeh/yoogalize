import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation, Search, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatAddress, getCity } from "@/lib/address";
import { prefetchEstablishments } from "@/hooks/useEstablishments";
import { NominatimAddress } from "@/lib/types";

// Tipos locais para sugestões
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

// Limites aproximados do Espírito Santo para validação defensiva (Bug 3)
const isInsideES = (lat: number, lon: number): boolean => {
  return lat >= -21.4 && lat <= -17.8 && lon >= -41.9 && lon <= -39.5;
};

// Sugestões rápidas de bairros da Grande Vitória (Mockup 4 - Item 3)
const QUICK_SUGGESTIONS = [
  {
    name: "Praia do Canto, Vitória – ES",
    city: "Vitória",
    lat: -20.3013,
    lon: -40.2954,
  },
  {
    name: "Jardim Camburi, Vitória – ES",
    city: "Vitória",
    lat: -20.2642,
    lon: -40.2831,
  },
  {
    name: "Praia da Costa, Vila Velha – ES",
    city: "Vila Velha",
    lat: -20.3444,
    lon: -40.2882,
  },
  {
    name: "Itapuã, Vila Velha – ES",
    city: "Vila Velha",
    lat: -20.3541,
    lon: -40.2913,
  },
];

const geocodeWithNominatim = async (
  query: string
): Promise<{ lat: number; lon: number; address: string; city: string } | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=1&addressdetails=1&countrycodes=br`
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
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=5&addressdetails=1&countrycodes=br`
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
  const navigate = useNavigate();

  const [manualAddress, setManualAddress] = useState("");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [currentCity, setCurrentCity] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Pré-carrega o catálogo de estabelecimentos em segundo plano
  useEffect(() => {
    prefetchEstablishments();
  }, []);

  const isCEP = (text: string): boolean => {
    return /^(\d{5}-?\d{3})$/.test(text.trim());
  };

  const handleUseCurrentLocation = () => {
    setIsLoadingLocation(true);
    setValidationError(null);
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

          // 1. Tenta Mapbox se token estiver configurado
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
              console.warn("Mapbox reverse geocode falhou:", err);
            }
          }

          // 2. Fallback Nominatim
          if (!formatted) {
            const nomResult = await reverseGeocodeWithNominatim(latitude, longitude);
            if (nomResult) {
              formatted = nomResult.address;
              city = nomResult.city;
            }
          }

          const finalAddress = formatted || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setManualAddress(finalAddress);
          setCurrentCity(city);

          // Navega diretamente com a localização detectada
          const userLocation = {
            lat: latitude,
            lon: longitude,
            address: finalAddress,
            city,
          };

          toast.success("Localização encontrada com sucesso!");
          navigate("/busca", { state: { userLocation } });
        } catch (error) {
          console.error("Erro no reverse geocoding:", error);
          const fallbackAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setManualAddress(fallbackAddress);
          navigate("/busca", {
            state: {
              userLocation: {
                lat: latitude,
                lon: longitude,
                address: fallbackAddress,
                city: "",
              },
            },
          });
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (error) => {
        let errorMessage = "Não foi possível obter sua localização.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Permissão de localização negada. Digite seu endereço abaixo.";
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

  // Autocomplete com debounce
  useEffect(() => {
    if (!manualAddress.trim() || currentCoords) {
      setSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        let adaptedSuggestions: Suggestion[] = [];

        if (MAPBOX_ACCESS_TOKEN) {
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                manualAddress
              )}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&language=pt&limit=5`
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
            console.warn("Mapbox autocomplete falhou:", err);
          }
        }

        if (adaptedSuggestions.length === 0) {
          adaptedSuggestions = await searchSuggestionsWithNominatim(manualAddress);
        }

        setSuggestions(adaptedSuggestions);
      } catch (error) {
        console.error("Erro ao buscar sugestões:", error);
        setSuggestions([]);
      }
    }, 400);

    return () => clearTimeout(debounceTimer);
  }, [manualAddress, currentCoords, MAPBOX_ACCESS_TOKEN]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setValidationError(null);
    setManualAddress(suggestion.display_name);
    setCurrentCoords({
      lat: parseFloat(suggestion.lat),
      lon: parseFloat(suggestion.lon),
    });
    setCurrentCity(suggestion.address.city || "");
    setSuggestions([]);
  };

  const handleSelectQuickLocation = (loc: typeof QUICK_SUGGESTIONS[0]) => {
    setValidationError(null);
    setManualAddress(loc.name);
    setCurrentCoords({
      lat: loc.lat,
      lon: loc.lon,
    });
    setCurrentCity(loc.city);
    setSuggestions([]);
  };

  const handleManualAddress = async () => {
    const trimmed = manualAddress.trim();
    if (!trimmed) {
      setValidationError("Por favor, digite um endereço, bairro ou CEP.");
      return;
    }

    setIsLoadingLocation(true);
    setValidationError(null);

    try {
      let lat: number;
      let lon: number;
      let finalAddress: string;
      let newCity: string;

      if (currentCoords) {
        lat = currentCoords.lat;
        lon = currentCoords.lon;
        finalAddress = trimmed;
        newCity = currentCity;
      } else if (isCEP(trimmed)) {
        const cepRaw = trimmed.replace(/\D/g, "");
        const cepResponse = await fetch(`https://viacep.com.br/ws/${cepRaw}/json/`);
        if (!cepResponse.ok) throw new Error("Erro ao consultar CEP.");
        const cepData = await cepResponse.json();

        if (cepData.erro) {
          throw new Error("CEP não encontrado. Verifique os dígitos e tente novamente.");
        }

        finalAddress = `${cepData.logradouro}, ${cepData.bairro}, ${cepData.localidade} - ${cepData.uf}`;
        newCity = cepData.localidade;

        const nomResult = await geocodeWithNominatim(finalAddress);
        if (!nomResult) {
          throw new Error("Não foi possível localizar o endereço correspondente a este CEP.");
        }
        lat = nomResult.lat;
        lon = nomResult.lon;
      } else {
        // Geocodificação manual com tolerância defensiva
        let geoResult: { lat: number; lon: number; address: string; city: string } | null = null;

        if (MAPBOX_ACCESS_TOKEN) {
          try {
            const mapboxResponse = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                trimmed
              )}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&language=pt&limit=1`
            );
            if (mapboxResponse.ok) {
              const data = await mapboxResponse.json();
              if (data?.features?.length > 0) {
                const result = data.features[0] as MapboxFeature;
                geoResult = {
                  lat: result.center[1],
                  lon: result.center[0],
                  address: result.place_name,
                  city: result.context?.find((c) => c.id?.startsWith("place"))?.text || "",
                };
              }
            }
          } catch (err) {
            console.warn("Mapbox geocode falhou:", err);
          }
        }

        if (!geoResult) {
          geoResult = await geocodeWithNominatim(trimmed);
        }

        if (!geoResult) {
          throw new Error("Não encontramos esse endereço. Tente rua + número + cidade, ou um CEP.");
        }

        lat = geoResult.lat;
        lon = geoResult.lon;
        finalAddress = geoResult.address;
        newCity = geoResult.city;
      }

      // Validação defensiva de área atendida (Bug 3)
      if (!isInsideES(lat, lon)) {
        setValidationError(
          "O endereço digitado fica fora do Espírito Santo. Atendemos a Grande Vitória e municípios do ES."
        );
        setIsLoadingLocation(false);
        return;
      }

      const userLocation = { lat, lon, address: finalAddress, city: newCity };
      toast.success("Localização confirmada! 📍");
      navigate("/busca", { state: { userLocation } });
    } catch (error) {
      console.error("Erro na busca de endereço:", error);
      const msg =
        error instanceof Error
          ? error.message
          : "Não encontramos esse endereço. Tente rua + número + cidade, ou um CEP.";
      setValidationError(msg);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleClearInput = () => {
    setManualAddress("");
    setCurrentCoords(null);
    setCurrentCity("");
    setSuggestions([]);
    setValidationError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/15 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 py-8">
        {/* ========================================================
            HEADER / LOGO (Mockup 4)
            ======================================================== */}
        <header className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl">🍔</span>
            <h1 className="text-4xl sm:text-5xl font-black text-primary tracking-tight">
              Yoogalize
            </h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base font-medium">
            Onde comer e beber perto de você
          </p>
        </header>

        {/* ========================================================
            CARD PRINCIPAL DE ENTRADA
            ======================================================== */}
        <Card className="p-6 sm:p-8 space-y-6 shadow-xl border bg-card rounded-3xl">
          {/* CTA Principal de Localização (Item 1 no Mockup 4) */}
          <div>
            <Button
              onClick={handleUseCurrentLocation}
              disabled={isLoadingLocation}
              className="w-full h-13 text-sm sm:text-base font-bold shadow-md rounded-2xl bg-[#2ba4d8] hover:bg-[#238bb8] text-white flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              size="lg"
            >
              <Navigation className="h-4 w-4 shrink-0" />
              <span>
                {isLoadingLocation && !manualAddress
                  ? "Detectando localização..."
                  : "Usar minha localização"}
              </span>
            </Button>
          </div>

          {/* Divisor Visual */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-card text-muted-foreground font-medium">
                ou digite um endereço ou CEP
              </span>
            </div>
          </div>

          {/* Campo de Entrada de Endereço */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="manual-address"
                type="text"
                placeholder="Ex: Praia do Canto, Vitória ou CEP..."
                value={manualAddress}
                onChange={(e) => {
                  setManualAddress(e.target.value);
                  if (currentCoords) {
                    setCurrentCoords(null);
                    setCurrentCity("");
                  }
                  if (validationError) setValidationError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleManualAddress()}
                className="pl-10 pr-9 h-12 text-sm rounded-2xl bg-muted/40 border focus-visible:ring-primary"
                autoComplete="off"
              />
              {manualAddress && (
                <button
                  type="button"
                  onClick={handleClearInput}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full"
                  aria-label="Limpar campo"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Lista flutuante de sugestões de autocomplete */}
              {suggestions.length > 0 && (
                <ul className="absolute top-full mt-2 w-full bg-popover border rounded-2xl shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-border/60">
                  {suggestions.map((s) => (
                    <li
                      key={s.place_id}
                      className="p-3 text-xs cursor-pointer hover:bg-accent transition-colors flex items-start gap-2"
                      onClick={() => handleSelectSuggestion(s)}
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">{s.display_name}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Alerta de Validação Defensiva (Item 2 no Mockup 4 - Bug 3) */}
            {validationError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2 animate-in fade-in-50 duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Endereço não encontrado</p>
                  <p className="mt-0.5 font-medium">{validationError}</p>
                </div>
              </div>
            )}

            {/* Sugestões Rápidas de Bairros (Item 3 no Mockup 4 - UX 10) */}
            {!manualAddress && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground px-1">
                  Sugestões
                </p>
                <div className="space-y-1.5">
                  {QUICK_SUGGESTIONS.map((loc) => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => handleSelectQuickLocation(loc)}
                      className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-muted/60 text-left transition-all text-xs font-semibold text-foreground"
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{loc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Botão Confirmar Endereço */}
            <Button
              onClick={handleManualAddress}
              disabled={!manualAddress.trim() || isLoadingLocation}
              className="w-full h-12 text-sm sm:text-base font-semibold rounded-2xl"
              size="lg"
            >
              {isLoadingLocation && manualAddress ? "Confirmando..." : "Confirmar endereço"}
            </Button>
          </div>
        </Card>

        {/* Rodapé Informativo (Item 4 no Mockup 4) */}
        <p className="text-center text-xs font-medium text-muted-foreground">
          Atendemos hoje: Grande Vitória e região – ES
        </p>
      </div>
    </div>
  );
};

export default Welcome;
