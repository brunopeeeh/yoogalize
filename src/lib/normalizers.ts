
import { Establishment as LojaRaw, NormalizedEstablishment, OperatingHour } from "@/lib/types";

const slug = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const normalizeEstablishments = (lojas: LojaRaw[]): NormalizedEstablishment[] =>
  lojas.map((l) => ({
    id: `${slug(l.nome_empresa)}-${l.Latitude}-${l.Longitude}`,
    name: l.nome_empresa,
    category: l.modelo_negocio.trim(),
    address: l["endereco completo"],
    city: l.cidade.trim(),
    latitude: l.Latitude,
    longitude: l.Longitude,
    description: l.tipo_atendimento ?? undefined,
    linkDelivery: l["link delivery"],
    operatingHours: l.horario_funcionamento as OperatingHour[],
    serviceType: l.tipo_atendimento?.trim() ?? undefined,
  }));
