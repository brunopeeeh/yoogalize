import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

type FilterSidebarProps = {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  dynamicCities: string[];
  isLoadingData: boolean;
  dynamicCategories: string[];
  selectedCategories: Set<string>;
  setSelectedCategories: (categories: Set<string>) => void;
  radiusKm: number;
  setRadiusKm: (radius: number) => void;
};

export const FilterSidebar = ({
  selectedCity,
  setSelectedCity,
  dynamicCities,
  isLoadingData,
  dynamicCategories,
  selectedCategories,
  setSelectedCategories,
  radiusKm,
  setRadiusKm,
}: FilterSidebarProps) => {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
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
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
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
    </ScrollArea>
  );
};
