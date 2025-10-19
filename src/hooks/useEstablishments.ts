
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Establishment as LojaRaw, NormalizedEstablishment } from '@/lib/types';
import { normalizeEstablishments } from '@/lib/normalizers';

export const useEstablishments = () => {
  const [allEstablishments, setAllEstablishments] = useState<NormalizedEstablishment[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [dynamicCities, setDynamicCities] = useState<string[]>([]);
  const [dynamicServiceTypes, setDynamicServiceTypes] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const response = await fetch('/lojas.json');
        if (!response.ok) {
          throw new Error('Failed to fetch lojas.json');
        }
        const data: { result: LojaRaw[] } = await response.json();

        const allLojasRaw = data.result;
        const normalized = normalizeEstablishments(allLojasRaw);
        setAllEstablishments(normalized);

        const uniqueCategories = [...new Set(normalized.map(e => e.category))];
        setDynamicCategories(uniqueCategories.sort());

        const uniqueCities = [...new Set(normalized.map(e => e.city.trim()))];
        setDynamicCities(uniqueCities.sort());

        const uniqueServiceTypes = [...new Set(
          normalized
            .map(e => e.description?.trim())
            .filter((v): v is string => !!v)
        )];
        setDynamicServiceTypes(uniqueServiceTypes.sort());
      } catch (error) {
        console.error("Erro ao carregar lojas.json:", error);
        toast.error("Não foi possível carregar os estabelecimentos.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  return {
    allEstablishments,
    dynamicCategories,
    dynamicCities,
    dynamicServiceTypes,
    isLoadingData,
  };
};
