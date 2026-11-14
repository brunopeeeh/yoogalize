import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getFavoriteIds, removeFavoriteId } from '@/lib/favorites';
import { OpeningHoursStatus } from '@/components/opening-hours-status';
import { ArrowLeft, BookMarked, Heart, Frown } from 'lucide-react';
import { toast } from 'sonner';
import { useEstablishments } from '@/hooks/useEstablishments';

const Favorites = () => {
  const navigate = useNavigate();
  const { allEstablishments, isLoadingData } = useEstablishments();
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());

  const favoriteStores = useMemo(() => {
    return allEstablishments.filter((store) => favoriteIds.includes(store.id));
  }, [allEstablishments, favoriteIds]);

  const handleRemoveFavorite = (id: string) => {
    removeFavoriteId(id);
    setFavoriteIds((prev) => prev.filter((favId) => favId !== id));
    toast('Removido dos favoritos.');
  };

  const handleSearchClick = () => {
    const savedSearchState = sessionStorage.getItem('searchState');
    if (savedSearchState) {
      navigate('/busca');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Meus Favoritos</h1>
      </header>

      {isLoadingData ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : favoriteStores.length === 0 ? (
        <div className="text-center p-8 border-dashed border-2 rounded-lg">
          <Frown className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-4 text-xl font-semibold">Nenhuma loja favorita</h2>
          <p className="mt-2 text-gray-500">
            Você ainda não adicionou nenhuma loja aos seus favoritos.
          </p>
          <Button className="mt-6" onClick={handleSearchClick}>
            Buscar Lojas
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoriteStores.map((item) => (
            <Card key={item.id} className="p-4 flex flex-col">
              <div className="flex justify-between items-start">
                <h3 className="font-bold pr-2">{item.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-8 w-8"
                  onClick={() => handleRemoveFavorite(item.id)}
                >
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
                    <a
                      href={`https://delivery.yooga.app/${item.linkDelivery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <BookMarked className="mr-2 h-4 w-4" /> Cardápio
                    </a>
                  </Button>
                ) : (
                  <div />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
