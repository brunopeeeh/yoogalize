// 🪄 A Mágica dos Pombos-Correio! 
// (ou: Como calculamos distâncias usando a Fórmula de Haversine)

/**
 * Calcula a distância em linha reta entre dois pontos na Terra
 * usando suas coordenadas de latitude e longitude.
 * 
 * Esta é a famosa "Fórmula de Haversine" - ela considera que a Terra
 * é uma esfera (quase!) e calcula a menor distância entre dois pontos
 * seguindo a curvatura do planeta. 🌍
 * 
 * @param lat1 Latitude do ponto 1 (em graus)
 * @param lon1 Longitude do ponto 1 (em graus)
 * @param lat2 Latitude do ponto 2 (em graus)
 * @param lon2 Longitude do ponto 2 (em graus)
 * @returns Distância em quilômetros
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Raio médio da Terra em quilômetros
  const R = 6371;

  // Convertendo graus para radianos (a matemática adora radianos! 🤓)
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  // A fórmula mágica de Haversine ✨
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(radLat1) *
      Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // A distância final! 🎉
  const distance = R * c;

  // Arredondando para uma casa decimal para ficar bonitinho
  return Math.round(distance * 10) / 10;
}

/**
 * Converte graus em radianos
 * (Porque a matemática trigonométrica trabalha com radianos)
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Formata a distância para exibição amigável
 * @param km Distância em quilômetros
 * @returns String formatada (ex: "1,2 km" ou "850 m")
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    // Para distâncias menores que 1km, mostramos em metros
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  // Para distâncias maiores, mostramos em km com uma casa decimal
  return `${km.toFixed(1)} km`;
}
