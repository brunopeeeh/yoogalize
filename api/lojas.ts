import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { normalizeEstablishments } from '../src/lib/normalizers';
import { calculateDistance } from '../src/lib/distance';
import { isEstablishmentOpen } from '../src/lib/utils';
import type { Establishment as LojaRaw, NormalizedEstablishment } from '../src/lib/types';

export type StoreWithDistance = NormalizedEstablishment & {
  distance?: number;
};

let cachedStores: NormalizedEstablishment[] | null = null;
let cachedCategories: string[] = [];
let cachedCities: string[] = [];
let cachedServiceTypes: string[] = [];

const key = (value: string): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function loadStores(): NormalizedEstablishment[] {
  if (cachedStores) return cachedStores;

  const jsonPath = path.join(process.cwd(), 'public', 'lojas.json');
  const rawContent = fs.readFileSync(jsonPath, 'utf-8');
  const data: { result: LojaRaw[] } = JSON.parse(rawContent);
  const normalized = normalizeEstablishments(data.result || []);

  cachedStores = normalized;
  cachedCategories = [...new Set(normalized.map((e) => e.category))].sort();
  cachedCities = [...new Set(normalized.map((e) => e.city.trim()))].sort();
  cachedServiceTypes = [
    ...new Set(
      normalized
        .map((e) => e.description?.trim())
        .filter((v): v is string => !!v)
    ),
  ].sort();

  return cachedStores;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const stores = loadStores();

    const {
      lat,
      lon,
      raio,
      cidade,
      categoria,
      tipo,
      abertas,
      q,
    } = req.query;

    const userLat = lat ? parseFloat(String(lat)) : null;
    const userLon = lon ? parseFloat(String(lon)) : null;
    const radiusKm = raio ? parseFloat(String(raio)) : 5;
    const targetCity = !cidade || cidade === 'all' ? null : key(String(cidade));
    const targetCategory = !categoria || categoria === 'all' ? null : key(String(categoria));
    const targetServiceType = !tipo || tipo === 'all' ? null : key(String(tipo));
    const onlyOpen = abertas === 'true';
    const searchQuery = q ? key(String(q)) : null;

    let filtered: StoreWithDistance[] = stores;

    // Se coordenadas forem passadas, calcula distância e filtra por raio
    if (userLat !== null && !isNaN(userLat) && userLon !== null && !isNaN(userLon)) {
      filtered = filtered
        .map((store) => ({
          ...store,
          distance: calculateDistance(userLat, userLon, store.latitude, store.longitude),
        }))
        .filter((store) => store.distance !== undefined && store.distance <= radiusKm)
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }

    // Filtros de atributos
    filtered = filtered.filter((store) => {
      if (targetCity && key(store.city) !== targetCity) return false;
      if (targetCategory && key(store.category) !== targetCategory) return false;
      if (targetServiceType && key(store.serviceType ?? '') !== targetServiceType) return false;
      if (onlyOpen && !isEstablishmentOpen(store.operatingHours)) return false;
      if (searchQuery) {
        const nameMatch = key(store.name).includes(searchQuery);
        const catMatch = key(store.category).includes(searchQuery);
        if (!nameMatch && !catMatch) return false;
      }
      return true;
    });

    return res.status(200).json({
      total: filtered.length,
      results: filtered,
      dynamicCategories: cachedCategories,
      dynamicCities: cachedCities,
      dynamicServiceTypes: cachedServiceTypes,
    });
  } catch (error) {
    console.error('Erro ao processar /api/lojas:', error);
    return res.status(500).json({ error: 'Erro interno ao consultar estabelecimentos' });
  }
}
