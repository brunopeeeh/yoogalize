
export interface Hour {
  start: string;
  end: string;
  type: string;
}

export interface OperatingHour {
  day_of_week: number;
  day: string;
  hours: Hour[];
}

export interface Establishment {
  nome_empresa: string;
  modelo_negocio: string;
  tipo_atendimento: string;
  logradouro: string;
  número: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  "link delivery": string | null;
  "endereco completo": string;
  horario_funcionamento: OperatingHour[];
  Latitude: number;
  Longitude: number;
  distance?: number;
}

export interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  city_district?: string;
  road?: string;
  quarter?: string;
  borough?: string;
  state?: string;
  postcode?: string;
  country?: string;
  [key: string]: string | undefined;
}

export interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
}

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
