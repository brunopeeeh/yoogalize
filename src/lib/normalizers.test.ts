import { describe, it, expect } from 'vitest';
import { normalizeEstablishments } from './normalizers';
import { Establishment as LojaRaw } from './types';

const loja = (over: Partial<LojaRaw>): LojaRaw => ({
  nome_empresa: 'Loja Teste',
  modelo_negocio: 'Restaurante',
  tipo_atendimento: 'Presencial e Delivery',
  logradouro: 'Rua A',
  'número': '10',
  bairro: 'Centro',
  cidade: 'Vitória',
  estado: 'ES',
  cep: '29000-000',
  'link delivery': 'loja-teste',
  'endereco completo': 'Rua A, 10 - Centro, Vitória - ES, 29000-000',
  horario_funcionamento: [],
  Latitude: -20.3,
  Longitude: -40.3,
  ...over,
});

describe('normalizeEstablishments — link de delivery corrompido', () => {
  it('mantém o cardápio quando o slug é único', () => {
    const [r] = normalizeEstablishments([loja({ 'link delivery': 'loja-unica' })]);
    expect(r.linkDelivery).toBe('loja-unica');
  });

  it('remove o cardápio quando várias lojas dividem o mesmo slug e nenhuma tem o nome correspondente', () => {
    const lojas = [
      loja({ nome_empresa: '40 Sabores - Campo Grande', 'link delivery': 'copied' }),
      loja({ nome_empresa: 'Vila Sucos', 'link delivery': 'copied' }),
    ];
    const r = normalizeEstablishments(lojas);
    expect(r.every((l) => l.linkDelivery === null)).toBe(true);
  });

  it('mantém o cardápio da loja cujo nome corresponde ao slug compartilhado', () => {
    const lojas = [
      loja({ nome_empresa: 'Estação Beer', 'link delivery': 'estacao-beer' }),
      loja({ nome_empresa: 'Outra Loja', 'link delivery': 'estacao-beer' }),
    ];
    const r = normalizeEstablishments(lojas);
    const estacao = r.find((l) => l.name === 'Estação Beer');
    const outra = r.find((l) => l.name === 'Outra Loja');
    expect(estacao?.linkDelivery).toBe('estacao-beer');
    expect(outra?.linkDelivery).toBeNull();
  });

  it('mantém o cardápio mesmo com o installation_id anexado ao nome', () => {
    const lojas = [
      loja({
        nome_empresa: 'Rk Conveniencia E Distribuicao - 148139',
        'link delivery': 'rk-conveniencia-e-distribuicao',
      }),
      loja({ nome_empresa: 'Empresa Sem Nada A Ver', 'link delivery': 'rk-conveniencia-e-distribuicao' }),
    ];
    const r = normalizeEstablishments(lojas);
    expect(r[0].linkDelivery).toBe('rk-conveniencia-e-distribuicao');
    expect(r[1].linkDelivery).toBeNull();
  });

  it('remove o cardápio de lojas somente presenciais', () => {
    const [r] = normalizeEstablishments([
      loja({ tipo_atendimento: 'Somente Presencial', 'link delivery': 'loja-teste' }),
    ]);
    expect(r.linkDelivery).toBeNull();
  });

  it('mantém o cardápio de loja com delivery', () => {
    const [r] = normalizeEstablishments([
      loja({ tipo_atendimento: 'Somente Delivery', 'link delivery': 'loja-teste' }),
    ]);
    expect(r.linkDelivery).toBe('loja-teste');
  });
});

describe('normalizeEstablishments — id estável', () => {
  it('gera o id no mesmo formato usado para os favoritos', () => {
    const [r] = normalizeEstablishments([
      loja({ nome_empresa: 'Deck\'s Gastro Beer - 148104', Latitude: -20.0830558, Longitude: -41.1201904 }),
    ]);
    expect(r.id).toBe('deck-s-gastro-beer-148104--20.0830558--41.1201904');
  });
});
