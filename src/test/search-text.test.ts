import { describe, it, expect } from 'vitest';
import { NormalizedEstablishment } from '../lib/types';

const key = (value: string): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

describe('Busca textual por nome e categoria da loja', () => {
  const stores: NormalizedEstablishment[] = [
    {
      id: '1',
      name: 'Sorveteria Miguelu - Praia da Costa',
      category: 'Sorveteria',
      address: 'Avenida Champagnat, 100',
      city: 'Vila Velha',
      latitude: -20.33,
      longitude: -40.29,
    },
    {
      id: '2',
      name: 'Pizzaria D\'Itália',
      category: 'Pizzaria',
      address: 'Rua das Flores, 20',
      city: 'Vitória',
      latitude: -20.31,
      longitude: -40.30,
    },
    {
      id: '3',
      name: 'Deck\'s Gastro Beer',
      category: 'Bar / Petiscaria',
      address: 'Avenida Beira Mar, 50',
      city: 'Afonso Cláudio',
      latitude: -20.08,
      longitude: -41.12,
    },
  ];

  it('encontra estabelecimento por substring no nome', () => {
    const query = key('miguelu');
    const matched = stores.filter((s) => key(s.name).includes(query));
    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('Sorveteria Miguelu - Praia da Costa');
  });

  it('encontra estabelecimento ignorando acentos e maiúsculas', () => {
    const query = key('d\'italia');
    const matched = stores.filter((s) => key(s.name).includes(query));
    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('Pizzaria D\'Itália');
  });

  it('encontra estabelecimento por categoria', () => {
    const query = key('petiscaria');
    const matched = stores.filter(
      (s) => key(s.name).includes(query) || key(s.category).includes(query)
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('Deck\'s Gastro Beer');
  });

  it('retorna vazio quando não houver correspondência', () => {
    const query = key('hamburguer inexistente');
    const matched = stores.filter(
      (s) => key(s.name).includes(query) || key(s.category).includes(query)
    );
    expect(matched).toHaveLength(0);
  });
});
