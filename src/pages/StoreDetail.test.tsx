import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StoreDetail from './StoreDetail';
import { NormalizedEstablishment } from '../lib/types';

const mockStore: NormalizedEstablishment = {
  id: 'restaurante-capixaba-20-40',
  name: 'Restaurante Capixaba',
  category: 'Restaurante',
  address: 'Avenida Dante Michelini, 500 - Jardim da Penha, Vitória - ES',
  city: 'Vitória',
  latitude: -20.28,
  longitude: -40.29,
  serviceType: 'Presencial e Delivery',
  linkDelivery: 'restaurante-capixaba',
  operatingHours: [
    {
      day_of_week: 1,
      day: 'Segunda-feira',
      hours: [{ start: '11:00:00', end: '22:00:00', type: 'Presencial' }],
    },
    {
      day_of_week: 2,
      day: 'Terça-feira',
      hours: [{ start: '11:00:00', end: '22:00:00', type: 'Presencial' }],
    },
  ],
};

vi.mock('@/hooks/useEstablishments', () => ({
  useEstablishments: () => ({
    allEstablishments: [mockStore],
    isLoadingData: false,
  }),
}));

describe('StoreDetail page', () => {
  it('deve renderizar os detalhes da loja quando encontrada', () => {
    render(
      <MemoryRouter initialEntries={[`/loja/${mockStore.id}`]}>
        <Routes>
          <Route path="/loja/:id" element={<StoreDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Restaurante Capixaba')).toBeInTheDocument();
    expect(screen.getByText('Restaurante')).toBeInTheDocument();
    expect(screen.getByText('Presencial e Delivery')).toBeInTheDocument();
    expect(screen.getByText(/Avenida Dante Michelini/)).toBeInTheDocument();
    expect(screen.getByText('Ver Cardápio & Fazer Pedido')).toBeInTheDocument();
    expect(screen.getByText('Horário de Funcionamento')).toBeInTheDocument();
  });

  it('deve exibir mensagem de não encontrado quando o id for inválido', () => {
    render(
      <MemoryRouter initialEntries={['/loja/loja-inexistente']}>
        <Routes>
          <Route path="/loja/:id" element={<StoreDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Estabelecimento não encontrado')).toBeInTheDocument();
    expect(screen.getByText('Voltar para a busca')).toBeInTheDocument();
  });
});
