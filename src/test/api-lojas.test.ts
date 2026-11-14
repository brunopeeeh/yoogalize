import { describe, it, expect, vi } from 'vitest';
import handler, { loadStores } from '../../api/lojas';
import type { VercelRequest, VercelResponse } from '@vercel/node';

describe('/api/lojas serverless endpoint', () => {
  it('carrega o catálogo de lojas com sucesso', () => {
    const stores = loadStores();
    expect(stores.length).toBeGreaterThan(1000);
  });

  it('filtra lojas próximas por coordenadas e raio', () => {
    let statusCode = 200;
    let responseData: { total: number; results: Array<{ distance?: number }> } | null = null;

    const req = {
      method: 'GET',
      query: {
        lat: '-20.33',
        lon: '-40.29',
        raio: '3',
      },
      headers: {},
    } as unknown as VercelRequest;

    const res = {
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn((data: { total: number; results: Array<{ distance?: number }> }) => {
        responseData = data;
        return res;
      }),
      end: vi.fn(),
    } as unknown as VercelResponse;

    handler(req, res);

    expect(statusCode).toBe(200);
    expect(responseData).toBeDefined();
    expect(responseData!.total).toBeGreaterThan(0);
    expect(responseData!.results.length).toBe(responseData!.total);

    responseData!.results.forEach((store) => {
      expect(store.distance).toBeDefined();
      expect(store.distance).toBeLessThanOrEqual(3);
    });
  });

  it('suporta busca textual por nome (parâmetro q)', () => {
    let statusCode = 200;
    let responseData: { total: number } | null = null;

    const req = {
      method: 'GET',
      query: {
        q: 'Sorvete',
      },
      headers: {},
    } as unknown as VercelRequest;

    const res = {
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn((data: { total: number }) => {
        responseData = data;
        return res;
      }),
      end: vi.fn(),
    } as unknown as VercelResponse;

    handler(req, res);

    expect(statusCode).toBe(200);
    expect(responseData!.total).toBeGreaterThan(0);
  });

  it('filtra estritamente lojas abertas quando abertas=true (excluindo sem horário)', () => {
    let statusCode = 200;
    let responseData: { total: number; results: Array<{ operatingHours?: Array<{ hours?: Array<{ start: string; end: string }> }> }> } | null = null;

    const req = {
      method: 'GET',
      query: {
        lat: '-20.33',
        lon: '-40.29',
        raio: '10',
        abertas: 'true',
      },
      headers: {},
    } as unknown as VercelRequest;

    const res = {
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn((data: typeof responseData) => {
        responseData = data;
        return res;
      }),
      end: vi.fn(),
    } as unknown as VercelResponse;

    handler(req, res);

    expect(statusCode).toBe(200);
    expect(responseData).toBeDefined();
    // Todas as lojas retornadas devem ter horários cadastrados (não podem ser desconhecidos)
    responseData!.results.forEach((store) => {
      expect(store.operatingHours).toBeDefined();
      expect(store.operatingHours!.length).toBeGreaterThan(0);
    });
  });

  it('rejeita métodos HTTP não permitidos', () => {
    let statusCode = 200;

    const req = {
      method: 'POST',
      query: {},
      headers: {},
    } as unknown as VercelRequest;

    const res = {
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn(() => res),
      end: vi.fn(),
    } as unknown as VercelResponse;

    handler(req, res);

    expect(statusCode).toBe(405);
  });
});
