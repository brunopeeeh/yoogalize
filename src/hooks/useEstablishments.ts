import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Establishment as LojaRaw, NormalizedEstablishment } from '@/lib/types';
import { normalizeEstablishments } from '@/lib/normalizers';

export type EstablishmentsData = {
  allEstablishments: NormalizedEstablishment[];
  dynamicCategories: string[];
  dynamicCities: string[];
  dynamicServiceTypes: string[];
};

let cachedData: EstablishmentsData | null = null;
let cachedPromise: Promise<EstablishmentsData> | null = null;

/**
 * Carrega e processa public/lojas.json garantindo que ocorra apenas
 * uma única requisição por sessão em memória.
 */
export const fetchEstablishmentsData = async (): Promise<EstablishmentsData> => {
  if (cachedData) {
    return cachedData;
  }

  if (cachedPromise) {
    return cachedPromise;
  }

  cachedPromise = (async () => {
    try {
      const response = await fetch('/lojas.json');
      if (!response.ok) {
        throw new Error('Failed to fetch lojas.json');
      }
      const data: { result: LojaRaw[] } = await response.json();
      const allLojasRaw = data.result;
      const normalized = normalizeEstablishments(allLojasRaw);

      const uniqueCategories = [...new Set(normalized.map(e => e.category))].sort();
      const uniqueCities = [...new Set(normalized.map(e => e.city.trim()))].sort();
      const uniqueServiceTypes = [
        ...new Set(
          normalized
            .map(e => e.description?.trim())
            .filter((v): v is string => !!v)
        )
      ].sort();

      cachedData = {
        allEstablishments: normalized,
        dynamicCategories: uniqueCategories,
        dynamicCities: uniqueCities,
        dynamicServiceTypes: uniqueServiceTypes,
      };

      return cachedData;
    } catch (error) {
      cachedPromise = null;
      throw error;
    }
  })();

  return cachedPromise;
};

/**
 * Dispara o pré-carregamento dos estabelecimentos em background
 * (por exemplo, ao abrir a página inicial Welcome).
 */
export const prefetchEstablishments = (): void => {
  if (!cachedData && !cachedPromise) {
    fetchEstablishmentsData().catch((err) => {
      console.warn('Falha no pré-carregamento de lojas.json:', err);
    });
  }
};

export const useEstablishments = () => {
  const [data, setData] = useState<EstablishmentsData>(() => {
    return (
      cachedData || {
        allEstablishments: [],
        dynamicCategories: [],
        dynamicCities: [],
        dynamicServiceTypes: [],
      }
    );
  });
  const [isLoadingData, setIsLoadingData] = useState<boolean>(() => !cachedData);

  useEffect(() => {
    let isMounted = true;

    if (cachedData) {
      setData(cachedData);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    fetchEstablishmentsData()
      .then((result) => {
        if (isMounted) {
          setData(result);
          setIsLoadingData(false);
        }
      })
      .catch((error) => {
        if (isMounted) {
          console.error('Erro ao carregar lojas.json:', error);
          toast.error('Não foi possível carregar os estabelecimentos.');
          setIsLoadingData(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    allEstablishments: data.allEstablishments,
    dynamicCategories: data.dynamicCategories,
    dynamicCities: data.dynamicCities,
    dynamicServiceTypes: data.dynamicServiceTypes,
    isLoadingData,
  };
};
