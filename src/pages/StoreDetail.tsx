import { useState, useMemo, lazy, Suspense } from "react";
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
  Phone,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useEstablishments } from "@/hooks/useEstablishments";
import { OpeningHoursStatus } from "@/components/opening-hours-status";
import { getBrasiliaTimeInfo } from "@/lib/utils";
import { calculateDistance, formatDistance } from "@/lib/distance";
import { getFavoriteIds, addFavoriteId, removeFavoriteId } from "@/lib/favorites";
import { cleanEstablishmentName } from "@/lib/normalizers";
import { getStoreInitials, getCategoryVisual } from "@/lib/store-presentation";
import { NormalizedEstablishment } from "@/lib/types";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { WhatsAppIcon } from "@/components/icons";
import { shareToWhatsApp, buildWhatsAppInvite } from "@/lib/share";

const StoreMiniMap = lazy(() => import("@/components/store-mini-map"));

type StoreWithDistance = NormalizedEstablishment & {
  distance?: number;
};

const DAYS_ORDER = [
  { day_of_week: 1, label: "Segunda-feira", shortLabel: "Segunda" },
  { day_of_week: 2, label: "Terça-feira", shortLabel: "Terça" },
  { day_of_week: 3, label: "Quarta-feira", shortLabel: "Quarta" },
  { day_of_week: 4, label: "Quinta-feira", shortLabel: "Quinta" },
  { day_of_week: 5, label: "Sexta-feira", shortLabel: "Sexta" },
  { day_of_week: 6, label: "Sábado", shortLabel: "Sábado" },
  { day_of_week: 0, label: "Domingo", shortLabel: "Domingo" },
];

function formatTimeSlot(start: string, end: string): string | null {
  if (!start || !end) return null;
  const s = start.slice(0, 5);
  const e = end.slice(0, 5);
  if (s === e) return null;
  return `${s} às ${e}`;
}

const StoreDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { allEstablishments, isLoadingData } = useEstablishments();
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showWeekHours, setShowWeekHours] = useState(false);

  // Recupera o estabelecimento passado pelo state ou busca no catálogo em memória
  const passedStore = location.state?.store as StoreWithDistance | undefined;

  const { store, userLocation } = useMemo<{
    store?: StoreWithDistance;
    userLocation?: { lat: number; lon: number };
  }>(() => {
    let userLoc: { lat: number; lon: number } | undefined;

    try {
      const rawSession = sessionStorage.getItem("searchState");
      if (rawSession) {
        const saved = JSON.parse(rawSession);
        if (saved?.effectiveLocation?.lat && saved?.effectiveLocation?.lon) {
          userLoc = {
            lat: saved.effectiveLocation.lat,
            lon: saved.effectiveLocation.lon,
          };
        }
      }
    } catch {
      // Ignora erro de parse
    }

    if (passedStore && passedStore.id === id) {
      return { store: passedStore, userLocation: userLoc };
    }

    const found = allEstablishments.find((e) => e.id === id);
    if (!found) return { store: undefined, userLocation: userLoc };

    if (userLoc) {
      const dist = calculateDistance(
        userLoc.lat,
        userLoc.lon,
        found.latitude,
        found.longitude
      );
      return { store: { ...found, distance: dist }, userLocation: userLoc };
    }

    return { store: found, userLocation: userLoc };
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

  const handleWhatsAppInvite = () => {
    if (!store) return;
    shareToWhatsApp(store);
    toast.success("Abrindo WhatsApp com o convite!");
  };

  const handleShare = async () => {
    if (!store) return;
    const shareUrl = window.location.href;
    const inviteText = buildWhatsAppInvite(store, { currentUrl: shareUrl });
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: `Bora comer no ${cleanName}?`,
          text: inviteText,
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
      await navigator.clipboard.writeText(inviteText);
      toast.success("Convite 'Bora comer aqui?' copiado para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar o convite.");
    }
  };

  const handleCopyAddress = async () => {
    if (!store?.address) return;
    try {
      await navigator.clipboard.writeText(store.address);
      setCopiedAddress(true);
      toast.success("Endereço copiado para a área de transferência!");
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      toast.error("Erro ao copiar endereço.");
    }
  };

  const currentDayOfWeek = getBrasiliaTimeInfo().dayOfWeek;
  const visual = getCategoryVisual(store?.category);
  const initials = getStoreInitials(store?.name || "");
  const cleanName = cleanEstablishmentName(store?.name || "");

  // Horário do dia atual
  const todaySchedule = store?.operatingHours?.find(
    (oh) => oh.day_of_week === currentDayOfWeek
  );
  const todaySlots = (todaySchedule?.hours || [])
    .map((h) => formatTimeSlot(h.start, h.end))
    .filter((v): v is string => Boolean(v));
  const todayDayLabel =
    DAYS_ORDER.find((d) => d.day_of_week === currentDayOfWeek)?.shortLabel.toLowerCase() ||
    "hoje";

  if (isLoadingData && !store) {
    return (
      <div className="container mx-auto p-4 max-w-2xl min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground text-sm font-medium">Carregando detalhes do estabelecimento...</p>
        </div>
      </div>
    );
  }

  if (!store && !isLoadingData) {
    return (
      <div className="container mx-auto p-4 max-w-xl min-h-screen flex flex-col items-center justify-center text-center">
        <Store className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Estabelecimento não encontrado</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          O estabelecimento procurado não consta no catálogo ou o link está incorreto.
        </p>
        <Button onClick={() => navigate("/busca")} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a busca
        </Button>
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
  const wazeUrl = `https://waze.com/ul?ll=${store.latitude},${store.longitude}&navigate=yes`;
  const deliveryUrl = store.linkDelivery
    ? `https://delivery.yooga.app/${store.linkDelivery}`
    : null;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl sm:p-4">
        {/* ========================================================
            HERO: CAPA + AVATAR FLUTUANTE + AÇÕES RÁPIDAS (Mockup 3)
            ======================================================== */}
        <div className="relative">
          {/* Banner da Capa */}
          <div
            className={`h-44 sm:h-52 w-full bg-gradient-to-r ${visual.bannerGradient} relative sm:rounded-3xl shadow-md p-4 flex items-start justify-between`}
          >
            {/* Botão Voltar redondo */}
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 text-foreground shadow-md backdrop-blur-md transition-transform active:scale-95 hover:scale-105"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {/* Ações superiores flutuantes */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 text-foreground shadow-md backdrop-blur-md transition-transform active:scale-95 hover:scale-105"
                aria-label="Compartilhar link da loja"
                title="Compartilhar"
              >
                <Share2 className="h-4 w-4" />
              </button>

              <button
                onClick={handleToggleFavorite}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 text-foreground shadow-md backdrop-blur-md transition-transform active:scale-95 hover:scale-105"
                aria-label={isFavorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
                title={isFavorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
              >
                <Heart
                  className={`h-5 w-5 ${
                    isFavorite ? "fill-red-500 text-red-500" : "text-slate-700 dark:text-slate-300"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Avatar da Loja Sobreposto */}
          <div
            className={`absolute -bottom-10 left-6 sm:left-8 flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl border-4 border-background ${visual.avatarBg} ${visual.avatarText} font-black text-2xl sm:text-3xl shadow-xl`}
          >
            {initials}
          </div>
        </div>

        {/* ========================================================
            CORPO PRINCIPAL DOS DETALHES
            ======================================================== */}
        <div className="px-5 sm:px-2 pt-14 space-y-5">
          {/* Identidade da Loja */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {cleanName}
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 font-medium">
              <span>{store.category}</span>
              {store.serviceType && <span>• {store.serviceType}</span>}
              {store.distance !== undefined && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-foreground/90">
                    {formatDistance(store.distance)}
                  </span>
                </>
              )}
            </p>

            <div className="mt-2.5">
              <OpeningHoursStatus operatingHours={store.operatingHours} />
            </div>
          </div>

          {/* ========================================================
              CTA PRINCIPAL ÚNICO (Mockup 3 - Item 2)
              ======================================================== */}
          {deliveryUrl ? (
            <div>
              <Button
                asChild
                size="lg"
                className="w-full h-12 sm:h-14 text-base font-bold rounded-2xl shadow-lg bg-[#2ba4d8] hover:bg-[#238bb8] text-white flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <a href={deliveryUrl} target="_blank" rel="noopener noreferrer">
                  <BookMarked className="h-5 w-5" />
                  <span>Ver cardápio e pedir</span>
                  <ExternalLink className="h-4 w-4 ml-1 opacity-80" />
                </a>
              </Button>
              <p className="text-[11px] text-center text-muted-foreground mt-1.5">
                Cardápio digital oficial via Yooga Delivery
              </p>
            </div>
          ) : (
            <div>
              <Button
                asChild
                size="lg"
                className="w-full h-12 sm:h-14 text-base font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2"
              >
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <Navigation className="h-5 w-5" />
                  <span>Como chegar (Ver rota)</span>
                </a>
              </Button>
              <p className="text-[11px] text-center text-muted-foreground mt-1.5">
                Atendimento presencial no estabelecimento
              </p>
            </div>
          )}

          {/* ========================================================
              BOTÃO "BORA COMER AQUI?" (WhatsApp)
              ======================================================== */}
          <button
            type="button"
            onClick={handleWhatsAppInvite}
            className="w-full h-12 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-sm sm:text-base shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2.5 group cursor-pointer"
            aria-label={`Convidar amigos para comer em ${cleanName} via WhatsApp`}
          >
            <WhatsAppIcon className="h-5 w-5 fill-white group-hover:scale-110 transition-transform" />
            <span>Bora comer aqui?</span>
            <span className="text-xs font-normal opacity-90">(WhatsApp)</span>
          </button>

          {/* ========================================================
              BARRA DE AÇÕES RÁPIDAS (Mockup 3 - Item 3)
              ======================================================== */}
          <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
            {/* 1. Rota */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-muted/60 hover:bg-muted border border-border/80 transition-all active:scale-95 group text-center"
              aria-label="Abrir rota no Google Maps"
            >
              <Navigation className="h-5 w-5 text-primary mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold text-foreground">Rota</span>
            </a>

            {/* 2. Waze */}
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-muted/60 hover:bg-muted border border-border/80 transition-all active:scale-95 group text-center"
              aria-label="Abrir rota no Waze"
            >
              <Compass className="h-5 w-5 text-blue-500 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold text-foreground">Waze</span>
            </a>

            {/* 3. Copiar Endereço */}
            <button
              type="button"
              onClick={handleCopyAddress}
              className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-muted/60 hover:bg-muted border border-border/80 transition-all active:scale-95 group text-center"
              aria-label="Copiar endereço"
            >
              {copiedAddress ? (
                <Check className="h-5 w-5 text-emerald-500 mb-1" />
              ) : (
                <Copy className="h-5 w-5 text-amber-600 dark:text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-[11px] font-semibold text-foreground">
                {copiedAddress ? "Copiado!" : "Copiar end."}
              </span>
            </button>

            {/* 4. WhatsApp / Bora comer */}
            <button
              type="button"
              onClick={handleWhatsAppInvite}
              className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40 border border-emerald-500/30 transition-all active:scale-95 group text-center cursor-pointer"
              aria-label="Convidar no WhatsApp"
            >
              <WhatsAppIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">WhatsApp</span>
            </button>
          </div>

          {/* ========================================================
              MINI-MAPA COM LOCALIZAÇÃO E ENDEREÇO (Mockup 3 - Item 4)
              ======================================================== */}
          <Card className="rounded-3xl overflow-hidden border shadow-sm p-4 space-y-3 bg-card">
            <Suspense
              fallback={
                <div className="w-full h-44 sm:h-52 rounded-2xl bg-muted/40 animate-pulse flex items-center justify-center text-xs text-muted-foreground">
                  Carregando mapa...
                </div>
              }
            >
              <StoreMiniMap
                latitude={store.latitude}
                longitude={store.longitude}
                storeName={cleanName}
                userLocation={userLocation}
              />
            </Suspense>

            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="flex items-start gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-foreground">
                  <p className="font-semibold">{store.address}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{store.city} - ES</p>
                </div>
              </div>

              <button
                onClick={handleCopyAddress}
                className="text-xs text-primary hover:underline font-semibold shrink-0 pt-0.5"
              >
                {copiedAddress ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </Card>

          {/* ========================================================
              HORÁRIO DE FUNCIONAMENTO COM ACCORDION (Mockup 3 - Item 5)
              ======================================================== */}
          <Card className="rounded-3xl border shadow-sm p-4 sm:p-5 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                  Hoje ({todayDayLabel}) ·{" "}
                  <span className="font-medium text-muted-foreground">
                    {todaySlots.length > 0 ? todaySlots.join(" | ") : "Fechado"}
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowWeekHours(!showWeekHours)}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0 ml-2"
                aria-expanded={showWeekHours}
              >
                <span>{showWeekHours ? "Ocultar semana" : "Ver semana"}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    showWeekHours ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* Tabela semanal expansível sob demanda */}
            {showWeekHours && (
              <div className="mt-4 pt-4 border-t divide-y divide-border/60 text-xs">
                {store.operatingHours && store.operatingHours.length > 0 ? (
                  DAYS_ORDER.map((day) => {
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
                        className={`flex items-center justify-between py-2.5 px-2 rounded-xl transition-colors ${
                          isToday ? "bg-primary/10 font-bold" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{day.label}</span>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-primary text-primary-foreground">
                              Hoje
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          {validSlots.length > 0 ? (
                            <span className="text-foreground">{validSlots.join(" | ")}</span>
                          ) : (
                            <span className="text-muted-foreground font-normal">Fechado</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-center py-2">
                    Nenhum horário cadastrado para esta loja.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ========================================================
            BARRA DE NAVEGAÇÃO INFERIOR MOBILE
            ======================================================== */}
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default StoreDetail;
