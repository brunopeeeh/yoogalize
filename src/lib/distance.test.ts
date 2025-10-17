import { describe, it, expect } from 'vitest';
import { calculateDistance } from './distance';

describe('calculateDistance', () => {
  it('should calculate the distance between two points correctly', () => {
    // Ponto A: Centro de São Paulo, SP
    const lat1 = -23.55052;
    const lon1 = -46.633308;

    // Ponto B: Centro do Rio de Janeiro, RJ
    const lat2 = -22.906847;
    const lon2 = -43.172896;

    const distance = calculateDistance(lat1, lon1, lat2, lon2);

    // A distância real calculada é de aproximadamente 360.7 km.
    // Usamos toBeCloseTo para lidar com pequenas imprecisões de ponto flutuante.
    expect(distance).toBeCloseTo(360.7, 1);
  });

  it('should return 0 for the same coordinates', () => {
    const lat = -23.55052;
    const lon = -46.633308;
    const distance = calculateDistance(lat, lon, lat, lon);
    expect(distance).toBe(0);
  });
});
