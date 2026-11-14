import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  MapPin,
  Heart,
  Search as SearchIcon,
  X,
  Map as MapIcon,
  List,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FilterSidebar } from "@/components/filter-sidebar";
import { StoreCard } from "@/components/store-card";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { toast } from "sonner";
import { calculateDistance } from "@/lib/distance";
import { ResultCardSkeleton } from "@/components/result-card-skeleton";
import { isEstablishmentOpen } from "@/lib/utils";
import { formatAddress, getCity } from "@/lib/address";
import { getFavoriteIds, addFavoriteId, removeFavoriteId } from "@/lib/favorites";
import { sortEstablishmentsSmart } from "@/lib/store-presentation";
import { NominatimSuggestion, NormalizedEstablishment } from "@/lib/types";
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

const key = (value: string): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const QUICK_SEGMENTS = [
  { id: "all", label: "Todos", emoji: "🍽️" },
  { id: "Açaiteria", label: "Açaí", emoji: "🍇" },
  { id: "Pizzaria", label: "Pizza", emoji: "🍕" },
  { id: "Cafeteria", label: "Café", emoji: "☕" },
  { id: "Bar / Petiscaria", label: "Bar", emoji: "🍺" },
  { id: "Hamburgueria", label: "Hambúrguer", emoji: "🍔" },
  { id: "Sorveteria", label: "Sorvetes", emoji: "🍦" },
  { id: "Comida Japonesa", label: "Japonesa", emoji: "🍣" },
  { id: "Restaurante", label: "Restaurante", emoji: "🥗" },
];

const Search = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 1. O estado salvo da sessao (sessionStorage) e a fonte de verdade para F5 e Voltar
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

  const incomingLocation = location.state?.userLocation as UserLocation | undefined;

  const {
    allEstablishments,
    dynamicCategories,
    dynamicCities,
    dynamicServiceTypes,
    isLoadingData,
  } = useEstablishments();

  // Se veio da tela inicial com um novo endereco, ele tem precedencia imediata.
  // Caso contrario, recupera o endereco salvo no sessionStorage.
  const [effectiveLocation, setEffectiveLocation] = useState<UserLocation | undefined>(
    incomingLocation || savedState?.effectiveLocation
  );

  // Estados de Filtro: se veio da tela inicial, inicia 'all', senao herda da sessao
  const [selectedCategory, setSelectedCategory] = useState<string>(
    incomingLocation ? "all" : savedState?.selectedCategory || "all"
  );
  const [selectedServiceType, setSelectedServiceType] = useState<string>(
    incomingLocation ? "all" : savedState?.selectedServiceType || "all"
  );
  const [selectedCity, setSelectedCity] = useState<string>(
    incomingLocation ? "all" : savedState?.selectedCity || "all"
  );
  const [radiusKm, setRadiusKm] = useState<number>(
    incomingLocation ? 5 : savedState?.radiusKm || 5
  );
  const [openNow, setOpenNow] = useState<boolean>(
    incomingLocation ? false : savedState?.openNow || false
  );

  // Estados de UI
  const [searchTerm, setSearchTerm] = useState<string>(
    incomingLocation ? "" : savedState?.searchTerm || ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState<string>(
    incomingLocation ? "" : savedState?.searchTerm || ""
  );
  const [viewMode, setViewMode] = useState<"list" | "map">(savedState?.viewMode || "list");
  const [isSearching, setIsSearching] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editedAddress, setEditedAddress] = useState(
    incomingLocation?.address || savedState?.effectiveLocation?.address || ""
  );
  const [filteredResults, setFilteredResults] = useState<EstablishmentWithDistance[]>(
    incomingLocation ? [] : savedState?.filteredResults || []
  );
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [hasSearched, setHasSearched] = useState<boolean>(
    incomingLocation ? false : savedState?.hasSearched || false
  );
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "all") count++;
    if (selectedServiceType !== "all") count++;
    if (selectedCity !== "all") count++;
    if (radiusKm !== 5) count++;
    if (openNow) count++;
    return count;
  }, [selectedCategory, selectedServiceType, selectedCity, radiusKm, openNow]);

  const handleToggleFavorite = (id: string) => {
    if (favoriteIds.includes(id)) {
      removeFavoriteId(id);
      setFavoriteIds((prev) => prev.filter((favId) => favId !== id));
      toast("Removido dos favoritos.");
    } else {
      addFavoriteId(id);
      setFavoriteIds((prev) => [...prev, id]);
      toast.success("Adicionado aos favoritos!");
    }
  };

  const executeSearch = useCallback(async () => {
    if (!effectiveLocation) return;

    setHasSearched(true);
    setIsSearching(true);
    setVisibleCount(12);

    const cidadeAlvo = selectedCity === "all" ? null : key(selectedCity);
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
          setFilteredResults(sortEstablishmentsSmart(data.results));
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
      .map((establishment) => {
        const distance = calculateDistance(
          effectiveLocation.lat,
          effectiveLocation.lon,
          establishment.latitude,
          establishment.longitude
        );
        return { ...establishment, distance };
      })
      .filter((establishment) => {
        if (establishment.distance > radiusKm) return false;
        if (cidadeAlvo && key(establishment.city) !== cidadeAlvo) return false;
        if (segmentoAlvo && key(establishment.category) !== segmentoAlvo) return false;
        if (tipoAlvo && key(establishment.serviceType ?? "") !== tipoAlvo) return false;
        // "Abertas Agora": exibe apenas lojas que estao comprovadamente abertas
        if (openNow && !isEstablishmentOpen(establishment.operatingHours)) return false;
        if (searchTarget) {
          const matchName = key(establishment.name).includes(searchTarget);
          const matchCategory = key(establishment.category).includes(searchTarget);
          if (!matchName && !matchCategory) return false;
        }
        return true;
      });

    setFilteredResults(sortEstablishmentsSmart(results));
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
    // Quando chega uma nova localizacao vinda da tela inicial (Welcome),
    // limpamos o state do historico do navegador para que F5 e Voltar
    // da tela de detalhes leiam exclusivamente do sessionStorage.
    if (incomingLocation) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [incomingLocation, location.pathname, navigate]);

  useEffect(() => {
    // Redireciona para / apenas se nao houver localizacao nem da navegacao nem da sessao
    if (!incomingLocation && !savedState?.effectiveLocation) {
      toast.error("Localização do usuário não encontrada. Redirecionando...");
      navigate("/");
    }
  }, [incomingLocation, savedState, navigate]);

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
      sessionStorage.setItem("searchState", JSON.stringify(searchState));
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

  // Reaplica a busca quando qualquer filtro ou a localizacao muda
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
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            editedAddress
          )}&format=json&limit=5&addressdetails=1`
        );
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
      let lat: string;
      let lon: string;
      let finalAddress: string;
      let newCity: string;

      if (suggestion && suggestion.address) {
        lat = suggestion.lat;
        lon = suggestion.lon;
        finalAddress = formatAddress(suggestion.address);
        newCity = getCity(suggestion.address);
      } else {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            addressToSearch
          )}&format=json&limit=1&addressdetails=1`
        );
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:py-6">
        {/* ========================================================
            HEADER DESKTOP (Mockup 1)
            ======================================================== */}
        <header className="hidden md:flex items-center justify-between mb-6 pb-4 border-b gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-2xl font-black tracking-tight text-primary flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <span className="text-3xl">🍔</span> Descubra Yooga
            </Link>

            {/* Chip de Endereço Desktop */}
            <div className="flex items-center gap-2 bg-muted/60 hover:bg-muted px-3.5 py-1.5 rounded-full text-xs transition-colors border shadow-sm">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold max-w-sm truncate text-foreground" title={effectiveLocation?.address}>
                {effectiveLocation?.address || "Informe seu endereço"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsEditingLocation(true);
                  setEditedAddress(effectiveLocation?.address || "");
                }}
                className="text-primary hover:underline font-bold ml-1"
              >
                Alterar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs font-semibold rounded-full"
            >
              <Link to="/favoritos" className="flex items-center gap-1.5">
                <Heart
                  className={`h-4 w-4 ${favoriteIds.length > 0 ? "fill-red-500 text-red-500" : ""}`}
                />
                <span>Favoritos</span>
                {favoriteIds.length > 0 && (
                  <span className="ml-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px] font-bold px-1.5 py-0.2">
                    {favoriteIds.length}
                  </span>
                )}
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-xs rounded-full"
            >
              <Link to="/">Início</Link>
            </Button>
          </div>
        </header>

        {/* ========================================================
            HEADER MOBILE (Mockup 2)
            ======================================================== */}
        <div className="md:hidden mb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Entregar / buscar perto de
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsEditingLocation(true);
                  setEditedAddress(effectiveLocation?.address || "");
                }}
                className="flex items-center gap-1.5 text-left font-bold text-sm text-foreground hover:text-primary transition-colors max-w-full"
              >
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{effectiveLocation?.address || "Escolher endereço"}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </div>

            <Link
              to="/"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0"
              title="Voltar ao início"
            >
              YG
            </Link>
          </div>
        </div>

        {/* ========================================================
            CARD DE EDIÇÃO DE ENDEREÇO
            ======================================================== */}
        {isEditingLocation && (
          <Card className="mb-6 p-4 border-2 border-primary/40 shadow-lg bg-card rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                Definir novo endereço de busca
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingLocation(false)}
                className="h-7 px-2 text-xs"
              >
                Cancelar
              </Button>
            </div>
            <div className="relative flex gap-2">
              <Input
                value={editedAddress}
                onChange={(e) => setEditedAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdateAddress()}
                placeholder="Digite rua, número, bairro ou CEP..."
                className="h-10 text-sm flex-1 rounded-xl"
                autoFocus
              />
              <Button size="sm" onClick={() => handleUpdateAddress()} disabled={isSearching} className="rounded-xl">
                {isSearching ? "Buscando..." : "Salvar"}
              </Button>
            </div>
            {suggestions.length > 0 && (
              <ul className="mt-2 border rounded-xl shadow-lg divide-y bg-popover max-h-48 overflow-y-auto">
                {suggestions.map((s) => (
                  <li
                    key={s.place_id}
                    className="p-2.5 text-xs cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleUpdateAddress(s)}
                  >
                    <p className="font-medium text-foreground">{s.display_name}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* ========================================================
            GRID PRINCIPAL (SIDEBAR + CONTEÚDO)
            ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Desktop */}
          <aside className="hidden md:block md:col-span-1 sticky top-6 h-[calc(100vh-6rem)]">
            <Card className="h-full rounded-2xl shadow-sm border overflow-hidden">
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
                onClearFilters={handleClearFilters}
              />
            </Card>
          </aside>

          {/* Feed de Conteúdo */}
          <main className="md:col-span-3 space-y-4">
            {/* Barra de Busca Textual e Alternador de Visão (Lista / Mapa) */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar pizza, açaí, bar, cafeteria, restaurante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-9 h-11 text-sm rounded-2xl bg-card shadow-sm border focus-visible:ring-primary"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full"
                    title="Limpar busca"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Botão de Filtros Mobile */}
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 px-3.5 rounded-2xl border flex items-center gap-1.5 shadow-sm"
                      aria-label="Abrir filtros"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {activeFiltersCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                          {activeFiltersCount}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
                    <SheetHeader>
                      <SheetTitle>Filtros de busca</SheetTitle>
                    </SheetHeader>
                    <div className="h-full pt-2">
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
                        onClearFilters={handleClearFilters}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Alternador Lista/Mapa Desktop */}
              <div className="hidden sm:flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border shadow-sm">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="flex items-center gap-1.5 h-9 text-xs font-semibold rounded-xl"
                >
                  <List className="h-3.5 w-3.5" />
                  <span>Lista</span>
                </Button>
                <Button
                  variant={viewMode === "map" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("map")}
                  className="flex items-center gap-1.5 h-9 text-xs font-semibold rounded-xl"
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  <span>Mapa ({filteredResults.length})</span>
                </Button>
              </div>
            </div>

            {/* Chips Rápidos de Categoria e Filtros (Scroll Horizontal - UX 4) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {QUICK_SEGMENTS.map((chip) => {
                const isSelected =
                  chip.id === "all"
                    ? selectedCategory === "all"
                    : selectedCategory === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategory(
                        chip.id === "all"
                          ? "all"
                          : selectedCategory === chip.id
                            ? "all"
                            : chip.id
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${isSelected
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary"
                        : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <span>{chip.emoji}</span>
                    <span>{chip.label}</span>
                  </button>
                );
              })}

              <div className="h-4 w-px bg-border shrink-0" />

              {/* Toggle rápido de Abertas Agora */}
              <button
                type="button"
                onClick={() => setOpenNow(!openNow)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${openNow
                    ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
              >
                <span className={`h-2 w-2 rounded-full ${openNow ? "bg-white" : "bg-emerald-500"}`} />
                <span>Abertas agora</span>
                {openNow && <X className="h-3 w-3" />}
              </button>

              {/* Toggle rápido de Delivery */}
              <button
                type="button"
                onClick={() =>
                  setSelectedServiceType(
                    selectedServiceType.includes("Delivery") ? "all" : "Somente Delivery"
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${selectedServiceType.includes("Delivery")
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
              >
                <span>🛵 Delivery</span>
                {selectedServiceType.includes("Delivery") && <X className="h-3 w-3" />}
              </button>

              {/* Seletor rápido de Raio */}
              <button
                type="button"
                onClick={() => {
                  const next = radiusKm === 3 ? 5 : radiusKm === 5 ? 10 : radiusKm === 15 ? 25 : 3;
                  setRadiusKm(next);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-muted/70 hover:bg-muted text-muted-foreground shrink-0 transition-all"
              >
                <span>Até {radiusKm} km</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            {/* Contador de Lugares e Ordenação (UX 6) */}
            <div className="flex items-center justify-between text-sm pt-1">
              <div className="flex items-baseline gap-2">
                <h2 className="font-bold text-foreground text-sm md:text-base">
                  {filteredResults.length}{" "}
                  {openNow ? "lugares abertos perto de você" : "lugares encontrados"}
                </h2>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  • ordenado por abertas e distância
                </span>
              </div>
            </div>

            {!hasSearched ? (
              <div className="flex flex-col items-center justify-center text-center h-full p-8">
                <img src="/descubra-yooga.png" alt="Mascote Descubra Yooga" className="h-32 w-auto mb-6" />
                <h2 className="text-2xl font-semibold mb-2">Bem-vindo ao Painel de Descoberta!</h2>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  Utilize os filtros na lateral ou a busca rápida para encontrar estabelecimentos perto de você.
                </p>
              </div>
            ) : isSearching || isLoadingData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                {Array.from({ length: 9 }).map((_, index) => (
                  <ResultCardSkeleton key={index} />
                ))}
              </div>
            ) : (
              <>
                {filteredResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center h-full p-8 border border-dashed rounded-2xl bg-card">
                    <img src="/descubra-yooga-triste.png" alt="Mascote Descubra Yooga triste" className="h-32 w-auto mb-6" />
                    <h2 className="text-2xl font-semibold mb-2">Nenhum resultado encontrado</h2>
                    <p className="text-gray-500 max-w-sm mx-auto mb-6 text-sm">
                      {searchTerm
                        ? `Nenhuma loja encontrada para "${searchTerm}". Tente outro termo ou ajuste os filtros.`
                        : "Tente ajustar os filtros, selecionar outro segmento ou aumentar o raio de busca."}
                    </p>
                    <Button onClick={handleClearFilters} variant="outline" className="rounded-xl">
                      Limpar Filtros
                    </Button>
                  </div>
                ) : viewMode === "map" ? (
                  <Suspense
                    fallback={
                      <div className="w-full h-[550px] md:h-[650px] rounded-2xl border border-border flex flex-col items-center justify-center bg-muted/20 gap-2">
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
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 pb-24 md:pb-8">
                      {filteredResults.slice(0, visibleCount).map((item) => (
                        <StoreCard
                          key={item.id}
                          store={item}
                          isFavorite={favoriteIds.includes(item.id)}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>

                    {visibleCount < filteredResults.length && (
                      <div className="flex justify-center pb-24 md:pb-8">
                        <Button
                          variant="outline"
                          onClick={() => setVisibleCount((prevCount) => prevCount + 12)}
                          className="rounded-full px-6 shadow-sm"
                        >
                          Ver mais ({filteredResults.length - visibleCount} restantes)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>

        {/* ========================================================
            BOTÃO FLUTUANTE MOBILE: VER NO MAPA / VER LISTA
            ======================================================== */}
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 md:hidden">
          <Button
            size="sm"
            onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
            className="rounded-full shadow-2xl font-bold px-5 py-2 flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-primary dark:text-primary-foreground border border-white/20"
          >
            {viewMode === "list" ? (
              <>
                <MapIcon className="h-4 w-4" />
                <span>Ver no mapa ({filteredResults.length})</span>
              </>
            ) : (
              <>
                <List className="h-4 w-4" />
                <span>Ver lista</span>
              </>
            )}
          </Button>
        </div>

        {/* ========================================================
            BARRA DE NAVEGAÇÃO INFERIOR MOBILE (Mockup 2)
            ======================================================== */}
        <MobileBottomNav onOpenAddressModal={() => setIsEditingLocation(true)} />
      </div>
    </div>
  );
};

export default Search;
