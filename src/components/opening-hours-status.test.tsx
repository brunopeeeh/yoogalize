import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpeningHoursStatus } from './opening-hours-status';

// Mock da data atual para garantir que os testes sejam consistentes
// Quinta-feira, 16 de Outubro de 2025, 14:00:00 (UTC)
const MOCK_DATE = new Date('2025-10-16T14:00:00.000Z');

describe('OpeningHoursStatus', () => {

  vi.setSystemTime(MOCK_DATE);

  it('should display "Horário não informado" when no operating hours are provided', () => {
    render(<OpeningHoursStatus operatingHours={[]} />);
    expect(screen.getByText('Horário não informado')).toBeInTheDocument();
  });

  it('should display as open when the current time is within operating hours', () => {
    const operatingHours = [
      {
        day_of_week: 4, // Quinta-feira
        hours: [{ start: '2025-10-16T10:00:00Z', end: '2025-10-16T18:00:00Z' }],
      },
    ];
    render(<OpeningHoursStatus operatingHours={operatingHours as any} />);
    // O componente deve mostrar que fecha às 15:00 no horário de São Paulo (UTC-3)
    expect(screen.getByText('Aberto (fecha às 15:00)')).toBeInTheDocument();
  });

  it('should display as closed when the current time is outside operating hours', () => {
    const operatingHours = [
      {
        day_of_week: 4, // Quinta-feira
        hours: [{ start: '2025-10-16T08:00:00Z', end: '2025-10-16T12:00:00Z' }],
      },
    ];
    render(<OpeningHoursStatus operatingHours={operatingHours as any} />);
    // O componente deve mostrar que está fechado
    expect(screen.getByText('Fechado hoje')).toBeInTheDocument();
  });

  it('should display the next opening time if closed but opens later today', () => {
    const operatingHours = [
      {
        day_of_week: 4, // Quinta-feira
        hours: [{ start: '2025-10-16T16:00:00Z', end: '2025-10-16T22:00:00Z' }],
      },
    ];
    render(<OpeningHoursStatus operatingHours={operatingHours as any} />);
    // O componente deve mostrar que abre às 13:00 no horário de São Paulo (UTC-3)
    expect(screen.getByText('Fechado (abre às 13:00)')).toBeInTheDocument();
  });

  it('should display as closed today if there are no hours for the current day', () => {
    const operatingHours = [
      {
        day_of_week: 5, // Sexta-feira
        hours: [{ start: '2025-10-17T10:00:00Z', end: '2025-10-17T18:00:00Z' }],
      },
    ];
    render(<OpeningHoursStatus operatingHours={operatingHours as any} />);
    expect(screen.getByText('Fechado hoje')).toBeInTheDocument();
  });

});
