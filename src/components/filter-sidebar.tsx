import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type FilterSidebarProps = {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  dynamicCities: string[];
  isLoadingData: boolean;
  dynamicCategories: string[];
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  radiusKm: number;
  setRadiusKm: (radius: number) => void;
  onSearchClick: () => void;
};

export const FilterSidebar = ({
  selectedCity,
  setSelectedCity,
  dynamicCities,
  isLoadingData,
  dynamicCategories,
  selectedCategory,
  setSelectedCategory,
  radiusKm,
  setRadiusKm,
  onSearchClick,
}: FilterSidebarProps) => {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4 flex flex-col h-full">
        <div className="flex-grow">
          <div>
            <h3 className="font-semibold mb-2">Cidades</h3>
            <Select value={selectedCity} onValueChange={setSelectedCity} disabled={isLoadingData}>
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

          <div className="mt-4">
            <h3 className="font-semibold mb-2">Segmentos</h3>
            {isLoadingData ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isLoadingData}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os segmentos</SelectItem>
                  {dynamicCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="mt-4">
            <h3 className="font-semibold mt-4 mb-2">Raio (km)</h3>
            <Slider
              defaultValue={[radiusKm]}
              max={25}
              min={1}
              step={0.5}
              onValueChange={(value) => setRadiusKm(value[0])}
              disabled={isLoadingData}
            />
            <div className="text-center text-sm mt-1">
              {radiusKm.toFixed(1)} km
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <Button onClick={onSearchClick} className="w-full" disabled={isLoadingData}>
            Buscar
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
};
