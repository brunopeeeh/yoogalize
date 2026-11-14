import { describe, it, expect } from 'vitest';
import { getCity, formatAddress } from './address';
import { NominatimAddress } from './types';

describe('address utilities', () => {
  describe('getCity', () => {
    it('retorna string vazia quando endereco e undefined', () => {
      expect(getCity(undefined)).toBe('');
    });

    it('prioriza o campo city quando presente', () => {
      const addr: NominatimAddress = {
        city: 'Vila Velha',
        town: 'Outra Cidade',
        state: 'Espírito Santo',
      };
      expect(getCity(addr)).toBe('Vila Velha');
    });

    it('faz fallback para town, municipality, village, etc', () => {
      expect(getCity({ town: 'Domingos Martins' })).toBe('Domingos Martins');
      expect(getCity({ municipality: 'Viana' })).toBe('Viana');
      expect(getCity({ village: 'Pedra Azul' })).toBe('Pedra Azul');
      expect(getCity({ suburb: 'Praia da Costa' })).toBe('Praia da Costa');
      expect(getCity({ city_district: 'Distrito Central' })).toBe('Distrito Central');
    });
  });

  describe('formatAddress', () => {
    it('retorna string vazia se addr for undefined', () => {
      expect(formatAddress(undefined)).toBe('');
    });

    it('formata endereco completo combinando rua, bairro, cidade, estado e cep', () => {
      const addr: NominatimAddress = {
        road: 'Avenida Champagnat',
        neighbourhood: 'Praia da Costa',
        city: 'Vila Velha',
        state: 'Espírito Santo',
        postcode: '29101-010',
        country: 'Brasil',
      };

      const formatted = formatAddress(addr);
      expect(formatted).toContain('Avenida Champagnat');
      expect(formatted).toContain('Praia da Costa');
      expect(formatted).toContain('Vila Velha');
      expect(formatted).toContain('Espírito Santo');
      expect(formatted).toContain('29101-010');
      expect(formatted).toContain('Brasil');
    });

    it('ignora campos ausentes ou vazios', () => {
      const addr: NominatimAddress = {
        city: 'Vitória',
        state: 'Espírito Santo',
      };

      const formatted = formatAddress(addr);
      expect(formatted).toBe('Vitória, Espírito Santo');
    });
  });
});
