import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export type OperatingHour = {
  day_of_week: number;
  type?: string;
  hours?: Array<{
    start: string;
    end: string;
  }>;
};

export type LojaRaw = {
  nome_empresa: string;
  modelo_negocio: string;
  Latitude: number;
  Longitude: number;
  cidade: string;
  "endereco completo": string;
  "link delivery"?: string | null;
  tipo_atendimento?: string | null;
  horario_funcionamento?: OperatingHour[];
};

export type NormalizedEstablishment = {
  id: string;
  name: string;
  category: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  description?: string;
  linkDelivery?: string | null;
  operatingHours?: OperatingHour[];
  serviceType?: string;
};

export type StoreWithDistance = NormalizedEstablishment & {
  distance?: number;
};

const slug = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const cleanEstablishmentName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*-\s*\d{3,}\s*$/, '').trim();
};

const key = (value: string): string =>
  cleanEstablishmentName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const resolveLinkDelivery = (lojas: LojaRaw[]): (string | null)[] => {
  const totalPorSlug = new Map<string, number>();
  for (const l of lojas) {
    const s = l['link delivery'];
    if (!s) continue;
    totalPorSlug.set(s, (totalPorSlug.get(s) ?? 0) + 1);
  }

  return lojas.map((l) => {
    const s = l['link delivery'];
    if (!s) return null;

    const total = totalPorSlug.get(s) ?? 1;
    if (total === 1) return s;

    return key(l.nome_empresa) === key(s) ? s : null;
  });
};

export const normalizeEstablishments = (lojas: LojaRaw[]): NormalizedEstablishment[] => {
  const linksConfiaveis = resolveLinkDelivery(lojas);

  return lojas.map((l, index) => {
    const linkDelivery = l['link delivery'] ?? null;
    const somentePresencial =
      l.tipo_atendimento?.trim().toLowerCase() === 'somente presencial';
    const linkCorrompido = linkDelivery !== null && linksConfiaveis[index] === null;

    return {
      id: `${slug(l.nome_empresa)}-${l.Latitude}-${l.Longitude}`,
      name: cleanEstablishmentName(l.nome_empresa),
      category: l.modelo_negocio.trim(),
      address: l['endereco completo'],
      city: l.cidade.trim(),
      latitude: l.Latitude,
      longitude: l.Longitude,
      description: l.tipo_atendimento ?? undefined,
      linkDelivery: somentePresencial || linkCorrompido ? null : linkDelivery,
      operatingHours: l.horario_funcionamento as OperatingHour[],
      serviceType: l.tipo_atendimento?.trim() ?? undefined,
    };
  });
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2) *
    Math.cos(radLat1) *
    Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function parseTime(timeString: string): number {
  if (!timeString || typeof timeString !== 'string') return -1;
  try {
    const parts = timeString.split(':');
    if (parts.length < 2) return -1;
    const hours = parseInt(parts[0]!, 10);
    const minutes = parseInt(parts[1]!, 10);
    if (isNaN(hours) || isNaN(minutes)) return -1;
    return hours * 60 + minutes;
  } catch {
    return -1;
  }
}

function getBrasiliaTimeInfo(): { dayOfWeek: number; minutesIntoWeek: number } {
  const now = new Date();
  const timeZone = 'America/Sao_Paulo';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const getPartValue = (t: string) => parts.find((p) => p.type === t)?.value || '0';
  const dayMap: { [key: string]: number } = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  const dayOfWeek = dayMap[getPartValue('weekday')]!;
  const hour = parseInt(getPartValue('hour'), 10) % 24;
  const minute = parseInt(getPartValue('minute'), 10);

  const minutesIntoDay = hour * 60 + minute;
  const minutesIntoWeek = dayOfWeek * 24 * 60 + minutesIntoDay;

  return { dayOfWeek, minutesIntoWeek };
}

export function isEstablishmentOpen(operatingHours?: OperatingHour[]): boolean {
  if (!operatingHours || !Array.isArray(operatingHours) || operatingHours.length === 0) {
    return false;
  }

  const allSlots = operatingHours.flatMap((daySchedule) => {
    if (!daySchedule.hours || !Array.isArray(daySchedule.hours)) return [];
    return daySchedule.hours
      .map((hourRange) => {
        const startMin = parseTime(hourRange.start);
        const endMin = parseTime(hourRange.end);
        if (startMin === -1 || endMin === -1 || startMin === endMin) return null;

        const startMinutesIntoWeek = daySchedule.day_of_week * 24 * 60 + startMin;
        let endMinutesIntoWeek = daySchedule.day_of_week * 24 * 60 + endMin;
        if (endMinutesIntoWeek < startMinutesIntoWeek) {
          endMinutesIntoWeek += 24 * 60;
        }
        return { start: startMinutesIntoWeek, end: endMinutesIntoWeek };
      })
      .filter((slot): slot is { start: number; end: number } => slot !== null);
  });

  if (allSlots.length === 0) return false;

  const { minutesIntoWeek: nowMinutes } = getBrasiliaTimeInfo();
  const minutesInWeek = 7 * 24 * 60;

  for (const slot of allSlots) {
    const isCurrentlyInSlot = nowMinutes >= slot.start && nowMinutes < slot.end;
    const isCurrentlyInRolloverSlot =
      nowMinutes + minutesInWeek >= slot.start && nowMinutes + minutesInWeek < slot.end;

    if (isCurrentlyInSlot || isCurrentlyInRolloverSlot) {
      return true;
    }
  }

  return false;
}

let cachedStores: NormalizedEstablishment[] | null = null;
let cachedCategories: string[] = [];
let cachedCities: string[] = [];
let cachedServiceTypes: string[] = [];

function findLojasJsonPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'lojas.json'),
    path.join(currentDir, '..', 'public', 'lojas.json'),
    path.join(currentDir, 'public', 'lojas.json'),
    path.join(process.cwd(), 'lojas.json'),
    path.join(currentDir, 'lojas.json'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // Ignora erro de acesso
    }
  }
  return null;
}

export async function loadStores(req?: VercelRequest): Promise<NormalizedEstablishment[]> {
  if (cachedStores) return cachedStores;

  let rawList: LojaRaw[] = [];
  const localPath = findLojasJsonPath();

  if (localPath) {
    try {
      const rawContent = fs.readFileSync(localPath, 'utf-8');
      const parsed = JSON.parse(rawContent);
      rawList = parsed.result || [];
    } catch (err) {
      console.warn('Falha ao ler lojas.json do disco:', err);
    }
  }

  // Fallback caso o arquivo físico não esteja no disco na AWS Lambda / Vercel:
  if (rawList.length === 0 && req) {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'descubra-yooga.vercel.app';
      const url = `${protocol}://${host}/lojas.json`;
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.json();
        rawList = json.result || [];
      }
    } catch (fetchErr) {
      console.error('Falha no fallback HTTP para lojas.json:', fetchErr);
    }
  }

  const normalized = normalizeEstablishments(rawList);

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const stores = await loadStores(req);

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
