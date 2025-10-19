import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpeningHoursStatus } from './opening-hours-status';
import { OperatingHour } from '../lib/types';

// Mock da data atual para garantir que os testes sejam consistentes
// Quinta-feira, 16 de Outubro de 2025, 11:00:00 (America/Sao_Paulo time)
// que corresponde a 14:00:00 UTC
vi.setSystemTime(new Date('2025-10-16T14:00:00.000Z'));

describe('OpeningHoursStatus', () => {
  it('deve exibir \'Horário não informado\' quando não há horários de funcionamento', () => {
    render(<OpeningHoursStatus operatingHours={[]} />);
    expect(screen.getByText('Horário não informado')).toBeInTheDocument();
  });

  it('deve exibir como aberto quando a hora atual está dentro do horário de funcionamento', () => {
    const operatingHours: OperatingHour[] = [
      {
        day_of_week: 4, // Quinta-feira
        day: 'Quinta-feira',
        hours: [{ start: '10:00:00', end: '18:00:00', type: 'Presencial' }],
      },
    ];
    render(<OpeningHoursStatus operatingHours={operatingHours} />);
    // A hora atual é 11:00, então está aberto. Fecha às 18:00.
    expect(screen.getByText('Aberto (fecha às 18:00)')).toBeInTheDocument();
  });

  it('deve exibir como fechado e mostrar o próximo dia de abertura', () => {
    const operatingHours: OperatingHour[] = [
      {
        day_of_week: 4,
        day: 'Quinta-feira',
        hours: [{ start: '08:00:00', end: '10:00:00', type: 'Presencial' }],
      },
      {
        day_of_week: 5, // Sexta-feira
        day: 'Sexta-feira',
        hours: [{ start: '09:00:00', end: '17:00:00', type: 'Presencial' }],
      },
    ];
    render(<OpeningHoursStatus operatingHours={operatingHours} />);
    // A hora atual é Quinta-feira 11:00. A próxima abertura é Sexta-feira às 09:00.
    expect(screen.getByText('Fechado (abre Sex às 09:00)')).toBeInTheDocument();
  });

  it('deve exibir a próxima hora de abertura se estiver fechado mas abrir mais tarde no mesmo dia', () => {
    const operatingHours: OperatingHour[] = [
      {
        day_of_week: 4, // Quinta-feira
        day: 'Quinta-feira',
        hours: [{ start: '16:00:00', end: '22:00:00', type: 'Presencial' }],
      },
    ];
    render(<OpeningHoursStatus operatingHours={operatingHours} />);
    // A hora atual é 11:00. Abre às 16:00.
    expect(screen.getByText('Fechado (abre às 16:00)')).toBeInTheDocument();
  });

  it('deve exibir como fechado e mostrar o próximo dia de abertura se não houver expediente hoje', () => {
    const operatingHours: OperatingHour[] = [
      {
        day_of_week: 5, // Sexta-feira
        day: 'Sexta-feira',
        hours: [{ start: '10:00:00', end: '18:00:00', type: 'Presencial' }],
      },
    ];
    render(<OpeningHoursStatus operatingHours={operatingHours} />);
    // O dia atual é Quinta-feira. A próxima abertura é na Sexta-feira.
    expect(screen.getByText('Fechado (abre Sex às 10:00)')).toBeInTheDocument();
  });
});