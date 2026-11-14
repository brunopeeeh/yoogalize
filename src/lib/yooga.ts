export interface BuildYoogaUrlOptions {
  medium?: "card_button" | "detail_cta" | "whatsapp_invite" | "quick_action" | string;
  campaign?: string;
  content?: string;
}

export const YOOGA_BRAND = {
  name: "Descubra Yooga",
  companyName: "Yooga",
  portalUrl: "https://yooga.com.br",
  deliveryBaseUrl: "https://delivery.yooga.app",
  defaultUtmSource: "descubra-yooga",
  defaultCampaign: "marketplace",
};

export const YOOGA_TRUST_PILLARS = [
  {
    title: "Sincronizado no PDV",
    subtitle: "Status e horários direto do caixa da loja",
    icon: "zap",
  },
  {
    title: "Preço Justo",
    subtitle: "Sem as taxas de 12% a 27% dos grandes apps",
    icon: "tag",
  },
  {
    title: "Pedido Direto",
    subtitle: "Seu pedido vai direto para a cozinha do restaurante",
    icon: "utensils",
  },
];

/**
 * Constrói a URL do cardápio digital Yooga com parâmetros de rastreamento UTM.
 * Permite ao restaurante e à Yooga mensurarem o tráfego e pedidos gerados pelo Descubra Yooga.
 */
export function buildYoogaDeliveryUrl(
  slugOrUrl: string | null | undefined,
  options?: BuildYoogaUrlOptions
): string | null {
  if (!slugOrUrl) return null;

  const trimmed = slugOrUrl.trim();
  if (!trimmed) return null;

  const medium = options?.medium || "marketplace";
  const campaign = options?.campaign || YOOGA_BRAND.defaultCampaign;
  const content = options?.content;

  let baseUrl = trimmed;
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `${YOOGA_BRAND.deliveryBaseUrl}/${trimmed}`;
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("utm_source", YOOGA_BRAND.defaultUtmSource);
    url.searchParams.set("utm_medium", medium);
    url.searchParams.set("utm_campaign", campaign);
    if (content) {
      url.searchParams.set("utm_content", content);
    }
    return url.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const params = new URLSearchParams({
      utm_source: YOOGA_BRAND.defaultUtmSource,
      utm_medium: medium,
      utm_campaign: campaign,
      ...(content ? { utm_content: content } : {}),
    });
    return `${baseUrl}${separator}${params.toString()}`;
  }
}

/**
 * Retorna se o estabelecimento possui canal oficial ativo no ecossistema Yooga Delivery.
 */
export function isYoogaPartner(store?: { linkDelivery?: string | null }): boolean {
  return Boolean(store?.linkDelivery && store.linkDelivery.trim().length > 0);
}
