import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getFavoriteIds, removeFavoriteId } from '@/lib/favorites';
import { OpeningHoursStatus } from '@/components/opening-hours-status';
import { ArrowLeft, BookMarked, Heart, Frown } from 'lucide-react';
import { toast } from 'sonner';

// Reutilizando os tipos de Search.tsx para consistência
type DailyHours = {
  day_of_week: number;
  day: string;
  hours: { start: string; end: string; type: string }[];
};

type LojaRaw = {
  nome_empresa: string;
  modelo_negocio: string;
  tipo_atendimento: string | null;
  logradouro: string;
  número: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  'link delivery': string | null;
  'endereco completo': string;
  Latitude: number;
  Longitude: number;
  horario_funcionamento?: DailyHours[];
};

type NormalizedEstablishment = {
  id: string;
  name: string;
  category: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  description?: string;
  linkDelivery?: string | null;
  operatingHours?: DailyHours[];
};

const Favorites = () => {
  const navigate = useNavigate();
  const [favoriteStores, setFavoriteStores] = useState<NormalizedEstablishment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const normalizeEstablishments = (lojas: LojaRaw[]): NormalizedEstablishment[] =>
    lojas.map((l) => ({
      id: `${slug(l.nome_empresa)}-${l.Latitude}-${l.Longitude}`,
      name: l.nome_empresa,
      category: l.modelo_negocio.trim(),
      address: l['endereco completo'],
      city: l.cidade.trim(),
      latitude: l.Latitude,
      longitude: l.Longitude,
      description: l.tipo_atendimento ?? undefined,
      linkDelivery: l['link delivery'],
      operatingHours: l.horario_funcionamento,
    }));

  const loadFavorites = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/lojas.json');
      const data: { result: LojaRaw[] } = await response.json();
      const allLojasRaw = data.result;
      const normalized = normalizeEstablishments(allLojasRaw);
      
      const favoriteIds = getFavoriteIds();
      const favorites = normalized.filter(store => favoriteIds.includes(store.id));
      setFavoriteStores(favorites);

    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
      toast.error('Não foi possível carregar os favoritos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const handleRemoveFavorite = (id: string) => {
    removeFavoriteId(id);
    setFavoriteStores(prev => prev.filter(store => store.id !== id));
    toast('Removido dos favoritos.');
  };

  return (
    <div className="container mx-auto p-4">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Meus Favoritos</h1>
      </header>

      {isLoading ? (
        <p>Carregando...</p>
      ) : favoriteStores.length === 0 ? (
        <div className="text-center p-8 border-dashed border-2 rounded-lg">
            <Frown className="mx-auto h-12 w-12 text-gray-400" />
            <h2 className="mt-4 text-xl font-semibold">Nenhuma loja favorita</h2>
            <p className="mt-2 text-gray-500">Você ainda não adicionou nenhuma loja aos seus favoritos.</p>
            <Button className="mt-6" onClick={() => navigate('/busca')}>Buscar Lojas</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoriteStores.map(item => (
            <Card key={item.id} className="p-4 flex flex-col">
              <div className="flex justify-between items-start">
                <h3 className="font-bold pr-2">{item.name}</h3>
                <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={() => handleRemoveFavorite(item.id)}>
                  <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                </Button>
              </div>
              <p className="text-sm text-primary font-semibold">{item.category}</p>
              <p className="text-sm mt-2 text-muted-foreground">{item.address}</p>
              <div className="flex-grow mt-2">
                <OpeningHoursStatus operatingHours={item.operatingHours} />
              </div>
              <div className="flex justify-between items-center mt-4">
                {item.linkDelivery ? (
                  <Button asChild size="sm">
                    <a href={`https://delivery.yooga.app/${item.linkDelivery}`} target="_blank" rel="noopener noreferrer">
                      <BookMarked className="mr-2 h-4 w-4" /> Cardápio
                    </a>
                  </Button>
                ) : <div />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
