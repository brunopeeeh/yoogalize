import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, Search as SearchIcon, Sparkles, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { calculateDistance } from "@/lib/distance";

type UserLocation = {
  lat: number;
  lon: number;
  address: string;
};

type EstablishmentWithDistance = {
  id: string;
  name: string;
  category: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  description?: string;
  rating?: number;
  distance: number;
};

type LojaRaw = {
  nome_empresa: string;
  modelo_negocio: string;
  tipo_atendimento: string | null;
  logradouro: string;
  número: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  "link delivery": string | null;
  "endereço completo": string;
  Latitude: number;
  Longitude: number;
};

type NormalizedEstablishment = {
  id: string;
  name: string;
  category: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  description?: string;
  rating?: number;
};

const Search = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const initialLocation = location.state?.userLocation as UserLocation | undefined;

  const [effectiveLocation, setEffectiveLocation] = useState<UserLocation | undefined>(initialLocation);
  
  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const normalizeEstablishments = (lojas: LojaRaw[]): NormalizedEstablishment[] =>
    lojas.map((l) => ({
      id: `${slug(l.nome_empresa)}-${l.Latitude}-${l.Longitude}`,
      name: l.nome_empresa,
      category: l.modelo_negocio.trim(),
      address: l["endereço completo"],
      city: l.cidade.trim(),
      latitude: l.Latitude,
      longitude: l.Longitude,
      description: l.tipo_atendimento ?? undefined,
    }));

  // Estados
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [allEstablishments, setAllEstablishments] = useState<NormalizedEstablishment[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [dynamicCities, setDynamicCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(true);
  const [radiusKm, setRadiusKm] = useState(5);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editedAddress, setEditedAddress] = useState(effectiveLocation?.address || "");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [filteredResults, setFilteredResults] = useState<EstablishmentWithDistance[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Efeito para carregar e normalizar os dados das lojas
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const response = await fetch('/lojas.json');
        const dataByCity: Record<string, LojaRaw[]> = await response.json();
        
        const allLojasRaw = Object.values(dataByCity).flat();
        const normalized = normalizeEstablishments(allLojasRaw);
        setAllEstablishments(normalized);

        const uniqueCategories = [...new Set(normalized.map(e => e.category))];
        setDynamicCategories(uniqueCategories.sort());

        const uniqueCities = Object.keys(dataByCity);
        setDynamicCities(uniqueCities.sort());

      } catch (error) {
        console.error("Erro ao carregar lojas.json:", error);
        toast.error("Não foi possível carregar os estabelecimentos.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  // Efeito para filtrar os resultados quando as seleções mudam
  useEffect(() => {
    if (!effectiveLocation || isLoadingData) return;

    setIsSearching(true);

    const results = allEstablishments
      .map(establishment => {
        const distance = calculateDistance(
          effectiveLocation.lat,
          effectiveLocation.lon,
          establishment.latitude,
          establishment.longitude
        );
        return { ...establishment, distance };
      })
      .filter(establishment => {
        const isInRadius = establishment.distance <= radiusKm;
        const isCategoryMatch = selectedCategories.size === 0 || selectedCategories.has(establishment.category);
        const isCityMatch = selectedCity === 'all' || establishment.city === selectedCity;
        return isInRadius && isCategoryMatch && isCityMatch;
      })
      .sort((a, b) => a.distance - b.distance);

    setFilteredResults(results);
    setIsSearching(false);

  }, [selectedCategories, selectedCity, radiusKm, allEstablishments, effectiveLocation, isLoadingData]);


  // Redirect if user location is not available
  useEffect(() => {
    if (!initialLocation) {
      toast.error("Localização do usuário não encontrada. Redirecionando...");
      navigate("/");
    }
  }, [initialLocation, navigate]);

  // Efeito para buscar sugestões de endereço (autocomplete)
  useEffect(() => {
    if (!editedAddress || !isEditingLocation) {
      setSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(editedAddress)}&format=json&limit=5&addressdetails=1`);
        const data = await response.json();
        setSuggestions(data || []);
      } catch (error) {
        console.error("Erro ao buscar sugestões:", error);
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [editedAddress, isEditingLocation]);

  const handleUpdateAddress = async (suggestion: any = null) => {
    const addressToSearch = suggestion ? suggestion.display_name : editedAddress;
    if (!addressToSearch.trim()) {
      toast.error("O endereço não pode estar vazio.");
      return;
    }
  
    setIsSearching(true);
    setSuggestions([]);
    
    try {
      let lat, lon, finalAddress;

      if (suggestion && suggestion.address) {
        lat = suggestion.lat;
        lon = suggestion.lon;
        const { road, quarter, borough, city, state, postcode, country } = suggestion.address;
        const addressParts = [road, quarter, borough, city, state, postcode, country];
        finalAddress = addressParts.filter(p => p).join(', ');
      } else {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressToSearch)}&format=json&limit=1&addressdetails=1`);
        const data = await response.json();
        if (!data || data.length === 0) throw new Error("Endereço não encontrado");
        
        const result = data[0];
        lat = result.lat;
        lon = result.lon;

        if (result.address) {
            const { road, quarter, borough, city, state, postcode, country } = result.address;
            const addressParts = [road, quarter, borough, city, state, postcode, country];
            finalAddress = addressParts.filter(p => p).join(', ');
        } else {
            finalAddress = result.display_name;
        }
      }

      setEffectiveLocation({
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        address: finalAddress,
      });
      setEditedAddress(finalAddress);
      toast.success("Endereço atualizado!");

    } catch (error) {
      console.error("Erro no geocoding:", error);
      toast.error("Não foi possível encontrar coordenadas para este endereço.");
    } finally {
      setIsEditingLocation(false);
      setIsSearching(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <header className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <MapPin className="text-primary flex-shrink-0" />
          {isEditingLocation ? (
            <div className="relative flex-grow flex gap-2 items-center">
              <Input
                value={editedAddress}
                onChange={(e) => setEditedAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUpdateAddress()}
                className="h-9"
              />
              <Button size="sm" onClick={() => handleUpdateAddress()}>Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingLocation(false)}>Cancelar</Button>
              {suggestions.length > 0 && (
                <ul className="absolute top-full mt-1 w-full bg-card border rounded-md shadow-lg z-10">
                  {suggestions.map((s) => (
                    <li 
                      key={s.place_id} 
                      className="p-2 text-sm cursor-pointer hover:bg-accent"
                      onClick={() => handleUpdateAddress(s)} >
                      {s.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold truncate" title={effectiveLocation?.address}>{effectiveLocation?.address}</span>
              <Button variant="ghost" size="icon" onClick={() => {
                setIsEditingLocation(true);
                setEditedAddress(effectiveLocation?.address || '');
              }}>
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        <Button onClick={() => navigate("/")} className="flex-shrink-0">Início</Button>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="md:col-span-1 h-fit sticky top-4">
          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Cidades</h3>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as cidades</SelectItem>
                    {dynamicCities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Categorias</h3>
                {isLoadingData ? (
                    <p>Carregando...</p>
                ) : (
                    <div className="space-y-2">
                    {dynamicCategories.map(category => (
                        <div key={category} className="flex items-center space-x-2">
                        <Checkbox 
                            id={category}
                            onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedCategories);
                            if (checked) {
                                newSelected.add(category);
                            } else {
                                newSelected.delete(category);
                            }
                            setSelectedCategories(newSelected);
                            }}
                        />
                        <label htmlFor={category} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {category}
                        </label>
                        </div>
                    ))}
                    </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mt-4 mb-2">Raio (km)</h3>
                <Slider
                  defaultValue={[radiusKm]}
                  max={25}
                  min={1}
                  step={0.5}
                  onValueChange={(value) => setRadiusKm(value[0])}
                />
                <div className="text-center text-sm mt-1">{radiusKm.toFixed(1)} km</div>
              </div>
            </div>
          </Card>
        </aside>

        <main className="md:col-span-3">
          {(isSearching || isLoadingData) && <p className="text-center">Buscando...</p>}
          {!isSearching && !isLoadingData && filteredResults.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center h-full">
              <Sparkles className="w-16 h-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold">Nenhum resultado encontrado</h2>
              <p className="text-gray-500">Tente ajustar os filtros ou aumentar o raio de busca.</p>
            </div>
          )}
          {!isSearching && filteredResults.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredResults.map(item => (
                <Card key={item.id} className="p-4 flex flex-col">
                    <h3 className="font-bold">{item.name}</h3>
                    <p className="text-sm text-primary font-semibold">{item.category}</p>
                    <p className="text-sm mt-2 text-muted-foreground flex-grow">{item.address}</p>
                    <p className="text-sm font-bold mt-2 text-right">{item.distance.toFixed(2)} km de distância</p>
                </Card>
                ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Search;