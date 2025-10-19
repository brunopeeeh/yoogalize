import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, Edit2, BookMarked, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FilterSidebar } from "@/components/filter-sidebar";
import { toast } from "sonner";
import { calculateDistance, formatDistance } from "@/lib/distance";
import { ResultCardSkeleton } from "@/components/result-card-skeleton";
import { OpeningHoursStatus } from "@/components/opening-hours-status";
import { isEstablishmentOpen } from "@/lib/utils";
import { getFavoriteIds, addFavoriteId, removeFavoriteId } from "@/lib/favorites";
import { NominatimSuggestion, NominatimAddress, NormalizedEstablishment } from "@/lib/types";
import { useEstablishments } from "@/hooks/useEstablishments";

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

const Search = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getInitialState = () => {
    const savedStateJSON = sessionStorage.getItem('searchState');
    if (savedStateJSON) {
      try {
        return JSON.parse(savedStateJSON);
      } catch (e) {
        console.error("Failed to parse search state from session storage", e);
        return null;
      }
    }
    return null;
  };

  const savedState = getInitialState();
  
  const initialLocation = location.state?.userLocation as UserLocation | undefined;

  const { 
    allEstablishments, 
    dynamicCategories, 
    dynamicCities, 
    dynamicServiceTypes, 
    isLoadingData 
  } = useEstablishments();

  const [effectiveLocation, setEffectiveLocation] = useState<UserLocation | undefined>(initialLocation || savedState?.effectiveLocation);

  // Estados de Filtro
  const [selectedCategory, setSelectedCategory] = useState<string>(savedState?.selectedCategory || "all");
  const [selectedServiceType, setSelectedServiceType] = useState<string>(savedState?.selectedServiceType || "all");
  const [selectedCity, setSelectedCity] = useState<string>(initialLocation?.city || savedState?.selectedCity || "all");
  const [radiusKm, setRadiusKm] = useState<number>(savedState?.radiusKm || 5);
  const [openNow, setOpenNow] = useState<boolean>(savedState?.openNow || false);

  // Estados de UI
  const [isSearching, setIsSearching] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editedAddress, setEditedAddress] = useState(effectiveLocation?.address || "");
  const [filteredResults, setFilteredResults] = useState<EstablishmentWithDistance[]>(savedState?.filteredResults || []);
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [hasSearched, setHasSearched] = useState<boolean>(savedState?.hasSearched || false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());

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

  const executeSearch = () => {
    if (!effectiveLocation || isLoadingData) return;

    if (!hasSearched) setHasSearched(true);
    setIsSearching(true);
    setVisibleCount(10);

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
        const isCategoryMatch = selectedCategory === 'all' || establishment.category === selectedCategory;
        const isCityMatch = selectedCity === 'all' || establishment.city === selectedCity;
        const isOpenNow = !openNow || isEstablishmentOpen(establishment.operatingHours);
        const isServiceTypeMatch =
          selectedServiceType === 'all' ||
          (establishment.description ?? '').trim() === selectedServiceType;

        return isInRadius && isCategoryMatch && isCityMatch && isOpenNow && isServiceTypeMatch;
      })
      .sort((a, b) => a.distance - b.distance);

    setFilteredResults(results);
    setIsSearching(false);
  };

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
      const searchState = {
        effectiveLocation,
        selectedCategory,
        selectedServiceType,
        selectedCity,
        radiusKm,
        openNow,
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
    filteredResults,
    hasSearched,
  ]);

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

  useEffect(() => {
    if (hasSearched) {
      executeSearch();
    }
  }, [openNow]);

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
        const { road, quarter, borough, city, town, village, suburb, city_district, state, postcode, country } = suggestion.address;
        const addressParts = [road, quarter, borough, city, state, postcode, country].filter(Boolean);
        finalAddress = addressParts.join(', ');
        
        const getCity = (addr: NominatimAddress) => addr.city || addr.town || addr.village || addr.suburb || addr.city_district || "";
        newCity = getCity(suggestion.address);
      } else {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressToSearch)}&format=json&limit=1&addressdetails=1`);
        const data: NominatimSuggestion[] = await response.json();
        if (!data || data.length === 0) throw new Error("Endereço não encontrado");
        
        const result = data[0];
        lat = result.lat;
        lon = result.lon;

        if (result.address) {
            const { road, quarter, borough, city, town, village, suburb, city_district, state, postcode, country } = result.address;
            const addressParts = [road, quarter, borough, city, state, postcode, country].filter(Boolean);
            finalAddress = addressParts.join(', ');
            const getCity = (addr: NominatimAddress) => addr.city || addr.town || addr.village || addr.suburb || addr.city_district || "";
            newCity = getCity(result.address);
        } else {
            finalAddress = result.display_name;
            newCity = "all"; // Fallback
        }
      }

      setEffectiveLocation({
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        address: finalAddress,
        city: newCity,
      });
      setSelectedCity(newCity);
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
    setSelectedCity("all");
    setRadiusKm(5);
    setOpenNow(false);
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

        <main className="md:col-span-3">
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
                <div className="flex flex-col items-center justify-center text-center h-full p-8">
                  <img src="/yoogalize_triste.png" alt="Mascote Yoogalize triste" className="h-32 w-auto mb-6" />
                  <h2 className="text-2xl font-semibold mb-2">Nenhum resultado encontrado</h2>
                  <p className="text-gray-500 max-w-sm mx-auto mb-6">
                    Tente ajustar os filtros, selecionar um segmento diferente ou aumentar o raio de busca para encontrar mais opções.
                  </p>
                  <Button onClick={handleClearFilters} variant="outline">Limpar Filtros</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredResults.slice(0, visibleCount).map(item => (
                    <Card key={item.id} className="p-4 flex flex-col">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold pr-2">{item.name}</h3>
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
                        <div className="flex justify-between items-center mt-4">
                            <p className="text-sm font-bold">{formatDistance(item.distance)} de distância</p>
                            {item.linkDelivery && (
                                <Button asChild size="sm">
                                    <a href={`https://delivery.yooga.app/${item.linkDelivery}`} target="_blank" rel="noopener noreferrer">
                                        <BookMarked className="mr-2 h-4 w-4" /> Cardápio
                                    </a>
                                </Button>
                            )}
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