import { NominatimAddress } from "@/lib/types";

/**
 * Helpers de endereco compartilhados entre a tela inicial (Welcome) e a de
 * busca (Search).
 *
 * Antes cada tela formatava o endereco do Nominatim por conta propria, e de
 * jeitos diferentes: a tela de busca descartava `town`, `village`, `suburb` e
 * `city_district`, o que deixava o endereco incompleto em cidades menores.
 */

/** Extrai a cidade de um endereco do Nominatim, do mais especifico ao mais geral. */
export const getCity = (addr?: NominatimAddress): string => {
  if (!addr) return "";
  return (
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.village ||
    addr.city_district ||
    addr.suburb ||
    addr.district ||
    addr.county ||
    ""
  );
};

/** Monta o endereco completo, preservando bairro e cidade. */
export const formatAddress = (addr?: NominatimAddress): string => {
  if (!addr) return "";
  const {
    road,
    quarter,
    borough,
    neighbourhood,
    residential,
    city,
    town,
    village,
    municipality,
    suburb,
    city_district,
    state,
    postcode,
    country,
  } = addr;

  const cidade = city || town || municipality || village || suburb || city_district;

  return [
    road,
    quarter,
    borough,
    neighbourhood,
    residential,
    cidade,
    state,
    postcode,
    country,
  ]
    .filter(Boolean)
    .join(", ");
};
