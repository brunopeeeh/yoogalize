import { Ticket, Sparkles, Tag, Zap, BadgePercent } from "lucide-react";

export type YoogaBadgeVariant = "pill" | "trust-card" | "compact";

export interface YoogaPartnerBadgeProps {
  variant?: YoogaBadgeVariant;
  className?: string;
}

export function YoogaPartnerBadge({
  variant = "pill",
  className = "",
}: YoogaPartnerBadgeProps) {
  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 dark:border-amber-500/40 shrink-0 shadow-2xs ${className}`}
        title="Loja participante do Clube de Cupons Yooga"
        aria-label="Clube de Cupons"
      >
        <Ticket className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Clube de Cupons</span>
      </span>
    );
  }

  if (variant === "pill") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-400/50 dark:border-amber-600/50 shadow-2xs shrink-0 ${className}`}
        title="Esta loja possui Clube de Cupons ativo com pacotes de desconto"
        aria-label="Clube de Cupons Verificado"
      >
        <Ticket className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>🎟️ Clube de Cupons</span>
      </span>
    );
  }

  // variant === "trust-card"
  return (
    <div
      className={`rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-amber-100/30 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-amber-900/10 p-3.5 sm:p-4 space-y-3 shadow-2xs ${className}`}
      aria-label="Informações do Clube de Cupons"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-xs shrink-0">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100">
                Clube de Cupons Ativo
              </h4>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/50 px-1.5 py-0.2 rounded">
                <Sparkles className="h-2.5 w-2.5" /> Oficial
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
              Esta loja oferece pacotes de cupons com desconto para você economizar
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300/70 dark:border-amber-700/70 shrink-0">
          Descontos
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-500/20 text-[11px]">
        <div className="flex flex-col">
          <span className="font-semibold text-amber-950 dark:text-amber-200 flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
            Mais Vantagem
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Pacotes com desconto
          </span>
        </div>

        <div className="flex flex-col">
          <span className="font-semibold text-amber-950 dark:text-amber-200 flex items-center gap-1">
            <Tag className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
            Direto na Loja
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Sem intermediários
          </span>
        </div>

        <div className="flex flex-col">
          <span className="font-semibold text-amber-950 dark:text-amber-200 flex items-center gap-1">
            <BadgePercent className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
            Economia Real
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            No delivery e mesa
          </span>
        </div>
      </div>
    </div>
  );
}

export const CouponClubBadge = YoogaPartnerBadge;
