import { NormalizedEstablishment } from "./types";
import { isEstablishmentOpen } from "./utils";

/**
 * Extrai 2 iniciais maiúsculas limpas do nome do estabelecimento.
 * Exemplos:
 * - "Vibowls Açaí" -> "VA"
 * - "Café Bamboo" -> "CB"
 * - "Mercatto" -> "ME"
 * - "Deck's Gastro Beer" -> "DG"
 */
export function getStoreInitials(name: string): string {
  if (!name) return "YG";
  // Remove pontuações de posse (Deck's -> Deck) e limpa caracteres especiais
  const cleaned = name
    .trim()
    .replace(/['’]s\b/gi, "")
    .replace(/[^a-zA-Z0-9À-ÿ\s]/g, " ");

  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) {
    const single = cleaned.replace(/\s+/g, "");
    return (single.slice(0, 2) || "YG").toUpperCase();
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}

export type CategoryVisual = {
  label: string;
  emoji: string;
  badgeBg: string;
  badgeText: string;
  avatarBg: string;
  avatarText: string;
  bannerGradient: string;
};

/**
 * Paleta semântica e acessível por segmento gastronômico/comercial,
 * baseada nos mockups oficiais do relatório de UX/UI.
 */
export function getCategoryVisual(category = ""): CategoryVisual {
  const c = category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (c.includes("acai")) {
    return {
      label: "Açaí",
      emoji: "🍇",
      badgeBg: "bg-purple-100 dark:bg-purple-950/60",
      badgeText: "text-purple-700 dark:text-purple-300",
      avatarBg: "bg-[#7c3aed]",
      avatarText: "text-white",
      bannerGradient: "from-purple-500 via-purple-600 to-indigo-600",
    };
  }

  if (c.includes("pizza")) {
    return {
      label: "Pizza",
      emoji: "🍕",
      badgeBg: "bg-orange-100 dark:bg-orange-950/60",
      badgeText: "text-orange-700 dark:text-orange-300",
      avatarBg: "bg-[#ea580c]",
      avatarText: "text-white",
      bannerGradient: "from-orange-500 via-red-500 to-rose-600",
    };
  }

  if (c.includes("cafe")) {
    return {
      label: "Café",
      emoji: "☕",
      badgeBg: "bg-amber-100 dark:bg-amber-950/60",
      badgeText: "text-amber-800 dark:text-amber-300",
      avatarBg: "bg-[#d97706]",
      avatarText: "text-white",
      bannerGradient: "from-amber-500 via-amber-600 to-yellow-600",
    };
  }

  if (c.includes("hamburg") || c.includes("lanche")) {
    return {
      label: "Hambúrguer",
      emoji: "🍔",
      badgeBg: "bg-amber-100 dark:bg-amber-950/60",
      badgeText: "text-amber-700 dark:text-amber-300",
      avatarBg: "bg-[#c2410c]",
      avatarText: "text-white",
      bannerGradient: "from-orange-600 via-amber-600 to-yellow-500",
    };
  }

  if (c.includes("bar") || c.includes("petisc") || c.includes("bebida") || c.includes("churrasco")) {
    return {
      label: "Bar & Bebidas",
      emoji: "🍺",
      badgeBg: "bg-slate-100 dark:bg-slate-800",
      badgeText: "text-slate-800 dark:text-slate-200",
      avatarBg: "bg-[#334155]",
      avatarText: "text-white",
      bannerGradient: "from-slate-700 via-slate-800 to-zinc-900",
    };
  }

  if (c.includes("sorvete") || c.includes("doce") || c.includes("gelat")) {
    return {
      label: "Doces & Sorvetes",
      emoji: "🍦",
      badgeBg: "bg-pink-100 dark:bg-pink-950/60",
      badgeText: "text-pink-700 dark:text-pink-300",
      avatarBg: "bg-[#db2777]",
      avatarText: "text-white",
      bannerGradient: "from-pink-500 via-rose-500 to-purple-600",
    };
  }

  if (c.includes("japones") || c.includes("sushi") || c.includes("oriental")) {
    return {
      label: "Japonesa",
      emoji: "🍣",
      badgeBg: "bg-rose-100 dark:bg-rose-950/60",
      badgeText: "text-rose-700 dark:text-rose-300",
      avatarBg: "bg-[#e11d48]",
      avatarText: "text-white",
      bannerGradient: "from-rose-500 via-red-600 to-orange-600",
    };
  }

  if (c.includes("restaurante") || c.includes("marmit") || c.includes("salada")) {
    return {
      label: "Restaurante",
      emoji: "🍽️",
      badgeBg: "bg-emerald-100 dark:bg-emerald-950/60",
      badgeText: "text-emerald-700 dark:text-emerald-300",
      avatarBg: "bg-[#059669]",
      avatarText: "text-white",
      bannerGradient: "from-emerald-600 via-teal-600 to-cyan-600",
    };
  }

  // Fallback padrão amigável
  return {
    label: category || "Geral",
    emoji: "🍽️",
    badgeBg: "bg-blue-100 dark:bg-blue-950/60",
    badgeText: "text-blue-700 dark:text-blue-300",
    avatarBg: "bg-sky-600",
    avatarText: "text-white",
    bannerGradient: "from-sky-500 via-blue-600 to-indigo-600",
  };
}

/**
 * Ordenação inteligente de estabelecimentos (UX 5):
 * 1. Estabelecimentos abertos agora aparecem primeiro (ordenados por menor distância).
 * 2. Estabelecimentos fechados ou com horário não informado vêm depois (também ordenados por menor distância).
 */
export function sortEstablishmentsSmart<T extends NormalizedEstablishment & { distance?: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aOpen = isEstablishmentOpen(a.operatingHours);
    const bOpen = isEstablishmentOpen(b.operatingHours);

    // Se um está aberto e o outro não, o aberto tem precedência
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;

    // Se ambos estão no mesmo estado (ambos abertos ou ambos não abertos),
    // desempatamos pela menor distância
    const distA = a.distance ?? 999999;
    const distB = b.distance ?? 999999;
    return distA - distB;
  });
}
