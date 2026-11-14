import { BadgeCheck, ShieldCheck, Zap, Tag, UtensilsCrossed } from "lucide-react";

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
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60 shrink-0 ${className}`}
        title="Parceiro Verificado Yooga: Cardápio Oficial e pedidos sem comissão abusiva"
        aria-label="Parceiro Verificado Yooga"
      >
        <BadgeCheck className="h-3 w-3 text-sky-600 dark:text-sky-400 shrink-0" />
        <span>Yooga</span>
      </span>
    );
  }

  if (variant === "pill") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/70 shadow-2xs shrink-0 ${className}`}
        title="Parceiro Verificado Yooga: Cardápio Oficial com sincronização direta no PDV"
        aria-label="Parceiro Verificado Yooga"
      >
        <BadgeCheck className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span>Parceiro Verificado Yooga</span>
      </span>
    );
  }

  // variant === "trust-card"
  return (
    <div
      className={`rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-50/80 to-sky-100/30 dark:from-sky-950/30 dark:to-sky-900/10 p-3.5 sm:p-4 space-y-3 shadow-2xs ${className}`}
      aria-label="Informações de garantia do Parceiro Verificado Yooga"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500 text-white shadow-xs shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-sky-950 dark:text-sky-100">
                Parceiro Verificado Yooga
              </h4>
            </div>
            <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80">
              Cardápio oficial com sincronização em tempo real
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60 shrink-0">
          0% comissão
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-sky-500/15 text-[11px]">
        <div className="flex flex-col">
          <span className="font-semibold text-sky-950 dark:text-sky-200 flex items-center gap-1">
            <Zap className="h-3 w-3 text-sky-600 dark:text-sky-400 shrink-0" />
            No PDV
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Horário do caixa
          </span>
        </div>

        <div className="flex flex-col">
          <span className="font-semibold text-sky-950 dark:text-sky-200 flex items-center gap-1">
            <Tag className="h-3 w-3 text-sky-600 dark:text-sky-400 shrink-0" />
            Preço Justo
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Sem taxa de app
          </span>
        </div>

        <div className="flex flex-col">
          <span className="font-semibold text-sky-950 dark:text-sky-200 flex items-center gap-1">
            <UtensilsCrossed className="h-3 w-3 text-sky-600 dark:text-sky-400 shrink-0" />
            Direto
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Com a cozinha
          </span>
        </div>
      </div>
    </div>
  );
}
