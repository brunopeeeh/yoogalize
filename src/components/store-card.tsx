import { Link } from "react-router-dom";
import { Heart, ExternalLink, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OpeningHoursStatus } from "@/components/opening-hours-status";
import { formatDistance } from "@/lib/distance";
import { cleanEstablishmentName } from "@/lib/normalizers";
import { getStoreInitials, getCategoryVisual } from "@/lib/store-presentation";
import { NormalizedEstablishment } from "@/lib/types";
import { WhatsAppIcon } from "@/components/icons";
import { shareToWhatsApp } from "@/lib/share";

export type StoreCardProps = {
  store: NormalizedEstablishment & { distance?: number };
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
};

export const StoreCard = ({ store, isFavorite, onToggleFavorite }: StoreCardProps) => {
  const visual = getCategoryVisual(store.category);
  const initials = getStoreInitials(store.name);
  const cleanName = cleanEstablishmentName(store.name);

  return (
    <Card className="group overflow-hidden border shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30">
      {/* ========================================================
          VISÃO MOBILE (< md): Card compacto em linha (Mockup 2)
          ======================================================== */}
      <div className="flex md:hidden items-center p-3.5 gap-3.5">
        {/* Avatar quadrado arredondado com iniciais e cor do segmento */}
        <Link
          to={`/loja/${store.id}`}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${visual.avatarBg} ${visual.avatarText} font-bold text-lg shadow-sm transition-transform active:scale-95`}
          aria-label={`Ver detalhes de ${cleanName}`}
        >
          {initials}
        </Link>

        {/* Informações centrais */}
        <div className="flex-1 min-w-0">
          <Link to={`/loja/${store.id}`} className="block">
            <h3 className="font-semibold text-base text-foreground truncate group-hover:text-primary transition-colors">
              {cleanName}
            </h3>
          </Link>

          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {store.category}
            {store.distance !== undefined && (
              <>
                {" "}•{" "}
                <span className="font-medium text-foreground/80">
                  {formatDistance(store.distance)}
                </span>
              </>
            )}
            {store.serviceType && ` • ${store.serviceType}`}
          </p>

          <div className="mt-1.5 flex items-center">
            <OpeningHoursStatus operatingHours={store.operatingHours} />
          </div>
        </div>

        {/* Ações Mobile: WhatsApp e Favoritar */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              shareToWhatsApp(store);
              toast.success("Abrindo WhatsApp com o convite!");
            }}
            aria-label={`Bora comer em ${cleanName}? Convidar no WhatsApp`}
            title="Bora comer aqui? (WhatsApp)"
            className="h-10 w-10 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <WhatsAppIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite(store.id)}
            aria-label={isFavorite ? `Remover ${cleanName} dos favoritos` : `Favoritar ${cleanName}`}
            className="h-10 w-10 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Heart
              className={`h-5 w-5 transition-transform active:scale-125 ${
                isFavorite ? "fill-red-500 text-red-500" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {/* ========================================================
          VISÃO DESKTOP (>= md): Card rico com capa (Mockup 1)
          ======================================================== */}
      <div className="hidden md:flex flex-col h-full">
        {/* Capa com gradiente do segmento */}
        <div className={`relative h-24 w-full bg-gradient-to-r ${visual.bannerGradient} p-3 flex items-start justify-end gap-1.5`}>
          {/* Botão Bora comer no WhatsApp sobre a capa */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              shareToWhatsApp(store);
              toast.success("Abrindo WhatsApp com o convite!");
            }}
            aria-label={`Bora comer em ${cleanName}? Convidar no WhatsApp`}
            title="Bora comer aqui? (WhatsApp)"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
          >
            <WhatsAppIcon className="h-4 w-4" />
          </button>

          {/* Botão de Favoritar sobre a capa */}
          <button
            onClick={() => onToggleFavorite(store.id)}
            aria-label={isFavorite ? `Remover ${cleanName} dos favoritos` : `Favoritar ${cleanName}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 text-slate-700 hover:text-red-500 cursor-pointer"
          >
            <Heart
              className={`h-4 w-4 ${
                isFavorite ? "fill-red-500 text-red-500" : ""
              }`}
            />
          </button>

          {/* Avatar sobreposto à capa */}
          <div
            className={`absolute -bottom-6 left-4 flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-background ${visual.avatarBg} ${visual.avatarText} font-bold text-lg shadow-md`}
          >
            {initials}
          </div>
        </div>

        {/* Conteúdo do Card */}
        <div className="flex flex-1 flex-col p-4 pt-8">
          <Link to={`/loja/${store.id}`} className="block">
            <h3 className="font-bold text-lg text-foreground truncate hover:text-primary transition-colors">
              {cleanName}
            </h3>
          </Link>

          <p className="text-xs text-muted-foreground mt-1 truncate">
            {store.category}
            {store.distance !== undefined && (
              <>
                {" "}•{" "}
                <span className="font-semibold text-foreground/90">
                  {formatDistance(store.distance)}
                </span>
              </>
            )}
            {store.serviceType && ` • ${store.serviceType}`}
          </p>

          <div className="mt-2.5">
            <OpeningHoursStatus operatingHours={store.operatingHours} />
          </div>

          <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
            {store.address}
          </p>

          {/* Ações do rodapé */}
          <div className="mt-auto pt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex-1 text-xs"
            >
              <Link to={`/loja/${store.id}`}>
                Detalhes
              </Link>
            </Button>

            {store.linkDelivery ? (
              <Button
                size="sm"
                asChild
                className="flex-1 text-xs font-semibold"
              >
                <a
                  href={`https://delivery.yooga.app/${store.linkDelivery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1"
                >
                  Ver cardápio
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                asChild
                className="flex-1 text-xs"
              >
                <Link to={`/loja/${store.id}`}>
                  Ver rota
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
