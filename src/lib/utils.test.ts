import { describe, it, expect, vi } from 'vitest';
import {
  getOpeningHoursInfo,
  isEstablishmentOpen,
  isEstablishmentClosed,
} from './utils';
import { OperatingHour } from './types';

// Quinta-feira, 16 de Outubro de 2025, 11:00 (America/Sao_Paulo)
vi.setSystemTime(new Date('2025-10-16T14:00:00.000Z'));

const dia = (day_of_week: number, day: string, horas: OperatingHour['hours']): OperatingHour => ({
  day_of_week,
  day,
  hours: horas,
});

describe('getOpeningHoursInfo — status desconhecido', () => {
  it('retorna "unknown" quando não há horário informado', () => {
    const info = getOpeningHoursInfo([]);
    expect(info.status).toBe('unknown');
    expect(info.message).toBe('Horário não informado');
  });

  it('retorna "unknown" quando o array é indefinido', () => {
    expect(getOpeningHoursInfo(undefined).status).toBe('unknown');
  });

  it('retorna "unknown" quando todos os dias têm faixas vazias', () => {
    const horarios: OperatingHour[] = [
      dia(4, 'Quinta-feira', []),
      dia(5, 'Sexta-feira', []),
    ];
    expect(getOpeningHoursInfo(horarios).status).toBe('unknown');
  });

  it('ignora faixas degeneradas (start === end), que são placeholders da fonte', () => {
    // 00:00 -> 00:00 e 10:00 -> 10:00 não são faixas válidas
    const horarios: OperatingHour[] = [
      dia(4, 'Quinta-feira', [
        { start: '00:00:00', end: '00:00:00', type: 'Delivery' },
        { start: '10:00:00', end: '10:00:00', type: 'Delivery' },
      ]),
    ];
    const info = getOpeningHoursInfo(horarios);
    expect(info.status).toBe('unknown');
    // e não deve sugerir "abre às 00:00"
    expect(info.message).not.toContain('00:00');
  });
});

describe('isEstablishmentClosed — distingue fechado de desconhecido', () => {
  it('loja sem horário NÃO é considerada fechada (filtro "Abertas Agora" deve manter)', () => {
    expect(isEstablishmentClosed([])).toBe(false);
    expect(isEstablishmentClosed(undefined)).toBe(false);
  });

  it('loja com horário que não inclui agora É considerada fechada', () => {
    const horarios: OperatingHour[] = [
      dia(4, 'Quinta-feira', [{ start: '08:00:00', end: '10:00:00', type: 'Presencial' }]),
    ];
    expect(isEstablishmentClosed(horarios)).toBe(true);
  });

  it('loja com horário que inclui agora NÃO é considerada fechada', () => {
    const horarios: OperatingHour[] = [
      dia(4, 'Quinta-feira', [{ start: '10:00:00', end: '18:00:00', type: 'Presencial' }]),
    ];
    expect(isEstablishmentClosed(horarios)).toBe(false);
  });
});

describe('isEstablishmentOpen', () => {
  it('é falso quando o horário é desconhecido', () => {
    expect(isEstablishmentOpen([])).toBe(false);
  });

  it('é verdadeiro dentro da faixa de horário', () => {
    const horarios: OperatingHour[] = [
      dia(4, 'Quinta-feira', [{ start: '10:00:00', end: '18:00:00', type: 'Presencial' }]),
    ];
    expect(isEstablishmentOpen(horarios)).toBe(true);
  });
});
