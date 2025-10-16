export type LojaRaw = {
  nome_empresa: string;
  modelo_negocio: string;
  tipo_atendimento: string | null;
  logradouro: string;
  número: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  "link delivery": string | null;
  "endereco completo": string;
  latitude: number;
  longitude: number;
  horario_funcionamento?: any; // Adicionado para tipar o campo que vem do JSON
};

export type Establishment = {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
  rating?: number;
  operatingHours?: any; // Adicionado para receber os dados normalizados
};

export async function fetchLojas(): Promise<LojaRaw[]> {
  const res = await fetch("/lojas.json");
  if (!res.ok) {
    throw new Error("Falha ao carregar lojas.json");
  }
  const data = await res.json();
  return data.result; // Acessar o array dentro da propriedade 'result'
}

export function normalizeEstablishments(lojas: LojaRaw[]): Establishment[] {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  return lojas.map((l) => ({
    id: `${slug(l.nome_empresa)}-${l.latitude}-${l.longitude}`,
    name: l.nome_empresa,
    category: l.modelo_negocio.trim(),
    address: l["endereco completo"],
    latitude: l.latitude,
    longitude: l.longitude,
    description: l.tipo_atendimento ?? undefined,
    operatingHours: l.horario_funcionamento, // Mapeamento corrigido
  }));
}