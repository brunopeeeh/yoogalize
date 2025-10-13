import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Suggestion = {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    quarter?: string;
    borough?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

type AddressAutocompleteProps = {
  initialAddress: string;
  onAddressSelect: (location: { lat: number; lon: number; address: string; city: string; }) => void;
  onCancel?: () => void;
};

export const AddressAutocomplete = ({ initialAddress, onAddressSelect }: AddressAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(initialAddress);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!inputValue) {
      setSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(inputValue)}&format=json&limit=5&addressdetails=1`);
        const data = await response.json();
        setSuggestions(data || []);
      } catch (error) {
        console.error("Erro ao buscar sugestões:", error);
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    const { road, quarter, borough, city, state, postcode, country } = suggestion.address;
    const addressParts = [road, quarter, borough, city, state, postcode, country];
    const finalAddress = addressParts.filter(p => p).join(', ');

    onAddressSelect({
      lat: parseFloat(suggestion.lat),
      lon: parseFloat(suggestion.lon),
      address: finalAddress,
      city: city || "",
    });
    toast.success("Endereço atualizado!");
  };
  
  return (
    <div className="relative w-full">
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Digite seu endereço..."
        className="h-10"
      />
      {suggestions.length > 0 && (
        <ul className="absolute top-full mt-1 w-full bg-card border rounded-md shadow-lg z-50">
          {suggestions.map((s) => (
            <li 
              key={s.place_id} 
              className="p-3 text-sm cursor-pointer hover:bg-accent"
              onClick={() => handleSelectSuggestion(s)}
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};