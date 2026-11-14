import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MapPin,
  Edit2,
  BookMarked,
  Heart,
  Search as SearchIcon,
  X,
  Map as MapIcon,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FilterSidebar } from "@/components/filter-sidebar";
import { toast } from "sonner";
import { calculateDistance, formatDistance } from "@/lib/distance";
import { ResultCardSkeleton } from "@/components/result-card-skeleton";
import { OpeningHoursStatus } from "@/components/opening-hours-status";
import { isEstablishmentClosed } from "@/lib/utils";
import { formatAddress, getCity } from "@/lib/address";
import { getFavoriteIds, addFavoriteId, removeFavoriteId } from "@/lib/favorites";
import { NominatimSuggestion, NominatimAddress, NormalizedEstablishment } from "@/lib/types";
import { useEstablishments } from "@/hooks/useEstablishments";
const StoreMap = lazy(() => import("@/components/store-map"));

// Tipos
type UserLocation = {
  lat: number;
  lon: number;
  address: string;
  city: string;
};

type EstablishmentWithDistance = NormalizedEstablishment & {
  distance: number;
};

type SearchState = {
  effectiveLocation?: UserLocation;
  selectedCategory?: string;
  selectedServiceType?: string;
  selectedCity?: string;
  radiusKm?: number;
  openNow?: boolean;
  searchTerm?: string;
  viewMode?: "list" | "map";
  filteredResults?: EstablishmentWithDistance[];
  hasSearched?: boolean;
};

/** Chave de comparacao tolerante a acento e pontuacao (cidade/segmento) */
const key = (value: string): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const Search = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // O estado salvo era lido em CADA render. Agora e lido uma unica vez.
  const [savedState] = useState<SearchState | null>(() => {
    const raw = sessionStorage.getItem("searchState");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SearchState;
    } catch (e) {
      console.error("Failed to parse search state from session storage", e);
      return null;
    }
  });

  const initialLocation = location.state?.userLocation as UserLocation | undefined;

  const {
    allEstablishments,
    dynamicCategories,
    dynamicCities,
    dynamicServiceTypes,
    isLoadingData
  } = useEstablishments();

  const [effectiveLocation, setEffectiveLocation] = useState<UserLocation | undefined>(
    initialLocation || savedState?.effectiveLocation
  );

  // Estados de Filtro
  const [selectedCategory, setSelectedCategory] = useState<string>(
    savedState?.selectedCategory || "all"
  );
  const [selectedServiceType, setSelectedServiceType] = useState<string>(
    savedState?.selectedServiceType || "all"
  );
  // A cidade NAO e herdada da localizacao detectada: em regioes nao atendidas
  // (ou quando o geocoder devolve um bairro) o filtro zerava os resultados.
  const [selectedCity, setSelectedCity] = useState<string>(
    savedState?.selectedCity || "all"
  );
  const [radiusKm, setRadiusKm] = useState<number>(savedState?.radiusKm || 5);
  const [openNow, setOpenNow] = useState<boolean>(savedState?.openNow || false);

  // Estados de UI
  const [searchTerm, setSearchTerm] = useState<string>(savedState?.searchTerm || "");
  const [debouncedSearch, setDebouncedSearch] = useState<string>(savedState?.searchTerm || "");
  const [viewMode, setViewMode] = useState<"list" | "map">(savedState?.viewMode || "list");
  const [isSearching, setIsSearching] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editedAddress, setEditedAddress] = useState(effectiveLocation?.address || "");
  const [filteredResults, setFilteredResults] = useState<EstablishmentWithDistance[]>(
    savedState?.filteredResults || []
  );
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [hasSearched, setHasSearched] = useState<boolean>(savedState?.hasSearched || false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleToggleFavorite = (id: string) => {
    if (favoriteIds.includes(id)) {
      removeFavoriteId(id);
      setFavoriteIds(prev => prev.filter(favId => favId !== id));
      toast("Removido dos favoritos.");
    } else {
      addFavoriteId(id);
      setFavoriteIds(prev => [...prev, id]);
      toast.success("Adicionado aos favoritos!");
    }
  };

  const executeSearch = useCallback(async () => {
    if (!effectiveLocation) return;

    setHasSearched(true);
    setIsSearching(true);
    setVisibleCount(10);

    const cityAlvo = selectedCity === "all" ? null : key(selectedCity);
    const segmentoAlvo = selectedCategory === "all" ? null : key(selectedCategory);
    const tipoAlvo = selectedServiceType === "all" ? null : key(selectedServiceType);
    const searchTarget = debouncedSearch.trim() ? key(debouncedSearch) : null;

    // 1. Tenta buscar via API serverless (com Edge caching da Vercel)
    try {
      const params = new URLSearchParams({
        lat: String(effectiveLocation.lat),
        lon: String(effectiveLocation.lon),
        raio: String(radiusKm),
        cidade: selectedCity,
        categoria: selectedCategory,
        tipo: selectedServiceType,
        abertas: String(openNow),
      });

      if (debouncedSearch.trim()) {
        params.set("q", debouncedSearch.trim());
      }

      const response = await fetch(`/api/lojas?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.results)) {
          setFilteredResults(data.results);
          setIsSearching(false);
          return;
        }
      }
    } catch {
      // Ignora erro de rede e cai no fallback local
    }

    // 2. Fallback para cálculo local em memória (usado no dev com Vite ou offline)
    if (isLoadingData) return;

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
        if (establishment.distance > radiusKm) return false;
        if (cidadeAlvo && key(establishment.city) !== cidadeAlvo) return false;
        if (segmentoAlvo && key(establishment.category) !== segmentoAlvo) return false;
        if (tipoAlvo && key(establishment.serviceType ?? "") !== tipoAlvo) return false;
        // "Abertas Agora": remove apenas quem esta COM CERTEZA fechado.
        // Loja sem horario informado nao pode ser descartada.
        if (openNow && isEstablishmentClosed(establishment.operatingHours)) return false;
        if (searchTarget) {
          const matchName = key(establishment.name).includes(searchTarget);
          const matchCategory = key(establishment.category).includes(searchTarget);
          if (!matchName && !matchCategory) return false;
        }
        return true;
      })
      .sort((a, b) => a.distance - b.distance);

    setFilteredResults(results);
    setIsSearching(false);
  }, [
    effectiveLocation,
    isLoadingData,
    allEstablishments,
    selectedCategory,
    selectedServiceType,
    selectedCity,
    radiusKm,
    openNow,
    debouncedSearch,
  ]);

  // Efeitos
  useEffect(() => {
    // Clear saved state if this is a new search from the welcome page
    if (initialLocation) {
      sessionStorage.removeItem('searchState');
    }
  }, [initialLocation]);

  useEffect(() => {
    // Only redirect if we have no location from navigation AND no saved location.
    if (!initialLocation && !savedState?.effectiveLocation) {
      toast.error("Localização do usuário não encontrada. Redirecionando...");
      navigate("/");
    }
  }, [initialLocation, savedState, navigate]);

  // Save state to session storage whenever it changes
  useEffect(() => {
    if (hasSearched) {
      const searchState: SearchState = {
        effectiveLocation,
        selectedCategory,
        selectedServiceType,
        selectedCity,
        radiusKm,
        openNow,
        searchTerm,
        viewMode,
        filteredResults,
        hasSearched,
      };
      sessionStorage.setItem('searchState', JSON.stringify(searchState));
    }
  }, [
    effectiveLocation,
    selectedCategory,
    selectedServiceType,
    selectedCity,
    radiusKm,
    openNow,
    searchTerm,
    viewMode,
    filteredResults,
    hasSearched,
  ]);

  // Reaplica a busca quando qualquer filtro ou a localizacao muda.
  // Antes isso so acontecia ao mexer no switch "Abertas Agora", com uma
  // closure desatualizada dos demais filtros.
  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

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

  const handleUpdateAddress = async (suggestion: NominatimSuggestion | null = null) => {
    const addressToSearch = suggestion ? suggestion.display_name : editedAddress;
    if (!addressToSearch.trim()) {
      toast.error("O endereço não pode estar vazio.");
      return;
    }

    setIsSearching(true);
    setSuggestions([]);

    try {
      let lat, lon, finalAddress, newCity;

      if (suggestion && suggestion.address) {
        lat = suggestion.lat;
        lon = suggestion.lon;
        finalAddress = formatAddress(suggestion.address);
        newCity = getCity(suggestion.address);
      } else {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressToSearch)}&format=json&limit=1&addressdetails=1`);
        const data: NominatimSuggestion[] = await response.json();
        if (!data || data.length === 0) throw new Error("Endereço não encontrado");

        const result = data[0];
        lat = result.lat;
        lon = result.lon;

        if (result.address) {
            finalAddress = formatAddress(result.address);
            newCity = getCity(result.address);
        } else {
            finalAddress = result.display_name;
            newCity = "";
        }
      }

      setEffectiveLocation({
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        address: finalAddress,
        city: newCity,
      });
      // A cidade detectada nao restringe o filtro: o raio ja define a area.
      setSelectedCity("all");
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

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSelectedServiceType("all");
    setSelectedCity("all");
    setRadiusKm(5);
    setOpenNow(false);
    setSearchTerm("");
    toast.info("Filtros limpos!");
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
                      onClick={() => handleUpdateAddress(s)}>
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
        <Button onClick={() => navigate("/favoritos")} variant="outline" className="flex-shrink-0">Meus Favoritos</Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:hidden mb-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full">Filtros</Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="h-full">
                <FilterSidebar
                  selectedCity={selectedCity}
                  setSelectedCity={setSelectedCity}
                  dynamicCities={dynamicCities}
                  isLoadingData={isLoadingData}
                  dynamicCategories={dynamicCategories}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  dynamicServiceTypes={dynamicServiceTypes}
                  selectedServiceType={selectedServiceType}
                  setSelectedServiceType={setSelectedServiceType}
                  radiusKm={radiusKm}
                  setRadiusKm={setRadiusKm}
                  openNow={openNow}
                  setOpenNow={setOpenNow}
                  onSearchClick={executeSearch}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <aside className="hidden md:block md:col-span-1 sticky top-4 h-[calc(100vh-5rem)]">
          <Card className="h-full">
            <FilterSidebar
              selectedCity={selectedCity}
              setSelectedCity={setSelectedCity}
              dynamicCities={dynamicCities}
              isLoadingData={isLoadingData}
              dynamicCategories={dynamicCategories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              dynamicServiceTypes={dynamicServiceTypes}
              selectedServiceType={selectedServiceType}
              setSelectedServiceType={setSelectedServiceType}
              radiusKm={radiusKm}
              setRadiusKm={setRadiusKm}
              openNow={openNow}
              setOpenNow={setOpenNow}
              onSearchClick={executeSearch}
            />
          </Card>
        </aside>

        <main className="md:col-span-3 space-y-4">
          {/* Barra de Busca Textual por Nome e Alternador de Visão (Lista / Mapa) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome da loja ou categoria (ex: Pizza, Sorveteria, Bar)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9 h-10 text-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full"
                  title="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-end sm:self-auto border border-border">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex items-center gap-1.5 h-8 text-xs font-semibold"
              >
                <List className="h-3.5 w-3.5" />
                <span>Lista</span>
              </Button>
              <Button
                variant={viewMode === "map" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("map")}
                className="flex items-center gap-1.5 h-8 text-xs font-semibold"
              >
                <MapIcon className="h-3.5 w-3.5" />
                <span>Mapa ({filteredResults.length})</span>
              </Button>
            </div>
          </div>

          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center text-center h-full p-8">
              <img src="/yoogalize.png" alt="Mascote Yoogalize" className="h-32 w-auto mb-6" />
              <h2 className="text-2xl font-semibold mb-2">Bem-vindo ao Painel de Descoberta!</h2>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Utilize os filtros na lateral para buscar as lojas pelos segmentos, cidades e raio de distância.
              </p>
            </div>
          ) : (isSearching || isLoadingData) ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 10 }).map((_, index) => (
                <ResultCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <>
              {filteredResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center h-full p-8 border border-dashed rounded-xl">
                  <img src="/yoogalize_triste.png" alt="Mascote Yoogalize triste" className="h-32 w-auto mb-6" />
                  <h2 className="text-2xl font-semibold mb-2">Nenhum resultado encontrado</h2>
                  <p className="text-gray-500 max-w-sm mx-auto mb-6">
                    {searchTerm
                      ? `Nenhuma loja encontrada para "${searchTerm}". Tente outro termo ou ajuste os filtros.`
                      : "Tente ajustar os filtros, selecionar um segmento diferente ou aumentar o raio de busca para encontrar mais opções."}
                  </p>
                  <Button onClick={handleClearFilters} variant="outline">Limpar Filtros</Button>
                </div>
              ) : viewMode === "map" ? (
                <Suspense
                  fallback={
                    <div className="w-full h-[550px] md:h-[650px] rounded-xl border border-border flex flex-col items-center justify-center bg-muted/20 gap-2">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-muted-foreground text-sm font-medium">Carregando mapa interativo...</p>
                    </div>
                  }
                >
                  <StoreMap
                    stores={filteredResults}
                    userLocation={effectiveLocation}
                    radiusKm={radiusKm}
                    onSelectStore={(store) => navigate(`/loja/${store.id}`, { state: { store } })}
                  />
                </Suspense>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredResults.slice(0, visibleCount).map(item => (
                    <Card key={item.id} className="p-4 flex flex-col">
                        <div className="flex justify-between items-start">
                          <h3
                            className="font-bold pr-2 cursor-pointer hover:text-primary transition-colors hover:underline"
                            onClick={() => navigate(`/loja/${item.id}`, { state: { store: item } })}
                          >
                            {item.name}
                          </h3>
                          <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={() => handleToggleFavorite(item.id)}>
                            <Heart className={`w-5 h-5 ${favoriteIds.includes(item.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                          </Button>
                        </div>
                        <p className="text-sm text-primary font-semibold">
                          {item.category} {item.serviceType ? `- ${item.serviceType}` : ''}
                        </p>
                        <p className="text-sm mt-2 text-muted-foreground">{item.address}</p>
                        <div className="flex-grow mt-2">
                          <OpeningHoursStatus operatingHours={item.operatingHours} />
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/50">
                            <p className="text-sm font-bold text-muted-foreground">{formatDistance(item.distance)}</p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/loja/${item.id}`, { state: { store: item } })}
                              >
                                Detalhes
                              </Button>
                              {item.linkDelivery && (
                                  <Button asChild size="sm">
                                      <a href={`https://delivery.yooga.app/${item.linkDelivery}`} target="_blank" rel="noopener noreferrer">
                                          <BookMarked className="mr-1.5 h-3.5 w-3.5" /> Cardápio
                                      </a>
                                  </Button>
                              )}
                            </div>
                        </div>
                    </Card>
                    ))}
                     {visibleCount < filteredResults.length && (
                        <div className="col-span-1 lg:col-span-2 flex justify-center mt-4">
                            <Button onClick={() => setVisibleCount(prevCount => prevCount + 10)}>
                                Ver mais
                            </Button>
                        </div>
                    )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Search;
