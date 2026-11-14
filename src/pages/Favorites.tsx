import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getFavoriteIds, removeFavoriteId } from '@/lib/favorites';
import { ArrowLeft, Frown } from 'lucide-react';
import { toast } from 'sonner';
import { useEstablishments } from '@/hooks/useEstablishments';
import { StoreCard } from '@/components/store-card';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';

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

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      const savedSearchState = sessionStorage.getItem('searchState');
      navigate(savedSearchState ? '/busca' : '/');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Voltar">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20 md:pb-6">
          {favoriteStores.map((item) => (
            <StoreCard
              key={item.id}
              store={item}
              isFavorite={true}
              onToggleFavorite={handleRemoveFavorite}
            />
          ))}
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
};

export default Favorites;
