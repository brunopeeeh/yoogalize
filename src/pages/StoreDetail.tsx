import { useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Heart,
  Share2,
  BookMarked,
  Navigation,
  ExternalLink,
  Copy,
  Check,
  Store,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useEstablishments } from "@/hooks/useEstablishments";
import { OpeningHoursStatus } from "@/components/opening-hours-status";
import { getBrasiliaTimeInfo } from "@/lib/utils";
import { calculateDistance, formatDistance } from "@/lib/distance";
import { getFavoriteIds, addFavoriteId, removeFavoriteId } from "@/lib/favorites";
import { NormalizedEstablishment } from "@/lib/types";

type StoreWithDistance = NormalizedEstablishment & {
  distance?: number;
};

const DAYS_ORDER = [
  { day_of_week: 1, label: "Segunda-feira" },
  { day_of_week: 2, label: "Terça-feira" },
  { day_of_week: 3, label: "Quarta-feira" },
  { day_of_week: 4, label: "Quinta-feira" },
  { day_of_week: 5, label: "Sexta-feira" },
  { day_of_week: 6, label: "Sábado" },
  { day_of_week: 0, label: "Domingo" },
];

function formatTimeSlot(start: string, end: string): string | null {
  if (!start || !end) return null;
  const s = start.slice(0, 5);
  const e = end.slice(0, 5);
  if (s === e) return null; // Slot degenerado
  return `${s} às ${e}`;
}

const StoreDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { allEstablishments, isLoadingData } = useEstablishments();
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Recupera o estabelecimento passado pelo state ou busca no catálogo em memória
  const passedStore = location.state?.store as StoreWithDistance | undefined;

  const store = useMemo<StoreWithDistance | undefined>(() => {
    if (passedStore && passedStore.id === id) {
      return passedStore;
    }
    const found = allEstablishments.find((e) => e.id === id);
    if (!found) return undefined;

    // Se temos busca salva na sessão, recupera a distância do usuário
    try {
      const rawSession = sessionStorage.getItem("searchState");
      if (rawSession) {
        const saved = JSON.parse(rawSession);
        if (saved?.effectiveLocation?.lat && saved?.effectiveLocation?.lon) {
          const dist = calculateDistance(
            saved.effectiveLocation.lat,
            saved.effectiveLocation.lon,
            found.latitude,
            found.longitude
          );
          return { ...found, distance: dist };
        }
      }
    } catch {
      // Ignora erro no parse do storage
    }

    return found;
  }, [passedStore, id, allEstablishments]);

  const isFavorite = id ? favoriteIds.includes(id) : false;

  const handleToggleFavorite = () => {
    if (!id) return;
    if (isFavorite) {
      removeFavoriteId(id);
      setFavoriteIds((prev) => prev.filter((item) => item !== id));
      toast("Removido dos favoritos.");
    } else {
      addFavoriteId(id);
      setFavoriteIds((prev) => [...prev, id]);
      toast.success("Adicionado aos favoritos!");
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const isMobile = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: store?.name || "Yoogalize",
          text: `Confira ${store?.name || "esta loja"} no Yoogalize!`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleCopyAddress = async () => {
    if (!store?.address) return;
    try {
      await navigator.clipboard.writeText(store.address);
      setCopiedAddress(true);
      toast.success("Endereço copiado!");
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      toast.error("Erro ao copiar endereço.");
    }
  };

  const currentDayOfWeek = getBrasiliaTimeInfo().dayOfWeek;

  if (isLoadingData && !store) {
    return (
      <div className="container mx-auto p-4 max-w-3xl min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Carregando detalhes do estabelecimento...</p>
      </div>
    );
  }

  if (!store && !isLoadingData) {
    return (
      <div className="container mx-auto p-4 max-w-xl min-h-screen flex flex-col items-center justify-center text-center">
        <Store className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Estabelecimento não encontrado</h1>
        <p className="text-muted-foreground mb-6">
          O estabelecimento procurado não consta no catálogo ou o link está incorreto.
        </p>
        <Button onClick={() => navigate("/busca")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a busca
        </Button>
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${store?.latitude},${store?.longitude}`;
  const wazeUrl = `https://waze.com/ul?ll=${store?.latitude},${store?.longitude}&navigate=yes`;
  const deliveryUrl = store?.linkDelivery
    ? `https://delivery.yooga.app/${store.linkDelivery}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/15 pb-12">
      <div className="container mx-auto p-4 max-w-3xl">
        {/* Barra superior de navegação e ações */}
        <header className="flex items-center justify-between py-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Voltar</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              title="Compartilhar"
              className="rounded-full"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleFavorite}
              title={isFavorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
              className="rounded-full"
            >
              <Heart
                className={`h-4 w-4 ${
                  isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                }`}
              />
            </Button>
          </div>
        </header>

        {/* Card Principal de Apresentação */}
        <Card className="p-6 md:p-8 shadow-sm mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
              {store?.category}
            </span>
            {store?.serviceType && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                {store.serviceType}
              </span>
            )}
            {store?.distance !== undefined && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {formatDistance(store.distance)} de você
              </span>
            )}
          </div>

          <h1 className="text-3xl font-extrabold text-foreground mb-3">{store?.name}</h1>

          <div className="mb-6">
            <OpeningHoursStatus operatingHours={store?.operatingHours} />
          </div>

          {/* Botão de Destaque do Delivery Yooga */}
          {deliveryUrl ? (
            <div className="mb-6">
              <Button asChild size="lg" className="w-full text-base font-semibold shadow-md">
                <a href={deliveryUrl} target="_blank" rel="noopener noreferrer">
                  <BookMarked className="mr-2 h-5 w-5" /> Ver Cardápio & Fazer Pedido
                  <ExternalLink className="ml-2 h-4 w-4 opacity-75" />
                </a>
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Cardápio digital oficial via Yooga Delivery
              </p>
            </div>
          ) : (
            <div className="mb-6 p-3 rounded-lg bg-muted/60 text-center text-sm text-muted-foreground">
              Atendimento exclusivo no local físico (sem delivery cadastrado).
            </div>
          )}

          {/* Endereço e Como Chegar */}
          <div className="pt-6 border-t border-border space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Endereço
                </span>
                <button
                  onClick={handleCopyAddress}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {copiedAddress ? (
                    <>
                      <Check className="h-3 w-3" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copiar
                    </>
                  )}
                </button>
              </div>
              <p className="text-base text-foreground font-medium">{store?.address}</p>
              <p className="text-sm text-muted-foreground">{store?.city} - ES</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button asChild variant="outline" className="w-full">
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <Navigation className="mr-2 h-4 w-4 text-primary" /> Google Maps
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
                  <Compass className="mr-2 h-4 w-4 text-blue-500" /> Waze
                </a>
              </Button>
            </div>
          </div>
        </Card>

        {/* Quadro Completo de Horários Semanais */}
        <Card className="p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Horário de Funcionamento</h2>
          </div>

          {store?.operatingHours && store.operatingHours.length > 0 ? (
            <div className="divide-y divide-border">
              {DAYS_ORDER.map((day) => {
                const daySchedule = store.operatingHours?.find(
                  (oh) => oh.day_of_week === day.day_of_week
                );

                const validSlots = (daySchedule?.hours || [])
                  .map((h) => formatTimeSlot(h.start, h.end))
                  .filter((v): v is string => Boolean(v));

                const isToday = currentDayOfWeek === day.day_of_week;

                return (
                  <div
                    key={day.day_of_week}
                    className={`flex items-center justify-between py-3 px-2 rounded-md transition-colors ${
                      isToday ? "bg-primary/10 font-semibold" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{day.label}</span>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-primary text-primary-foreground">
                          Hoje
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-right">
                      {validSlots.length > 0 ? (
                        <span className="text-foreground">{validSlots.join(" | ")}</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">Fechado</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4 text-center">
              Este estabelecimento não possui horários detalhados cadastrados.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StoreDetail;
