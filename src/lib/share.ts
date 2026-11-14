import { cleanEstablishmentName } from "@/lib/normalizers";
import { getOpeningHoursInfo } from "@/lib/utils";
import { OperatingHour } from "@/lib/types";

export interface ShareableStore {
  id?: string;
  name: string;
  category?: string;
  address?: string;
  linkDelivery?: string | null;
  operatingHours?: OperatingHour[];
}

export interface WhatsAppInviteOptions {
  currentUrl?: string;
}

/**
 * Monta a mensagem formatada "Bora comer aqui?" pronta para envio no WhatsApp.
 * Utiliza negritos e emojis compativeis com a formatacao do WhatsApp.
 */
export function buildWhatsAppInvite(
  store: ShareableStore,
  options?: WhatsAppInviteOptions
): string {
  const cleanName = cleanEstablishmentName(store.name);
  const hoursInfo = getOpeningHoursInfo(store.operatingHours);

  let statusLine = "";
  if (hoursInfo.status === "open") {
    statusLine = `🟢 *${hoursInfo.message}*`;
  } else if (hoursInfo.status === "closed") {
    statusLine = `🔴 *${hoursInfo.message}*`;
  }

  const deliveryUrl = store.linkDelivery
    ? store.linkDelivery.startsWith("http")
      ? store.linkDelivery
      : `https://delivery.yooga.app/${store.linkDelivery}`
    : null;

  let storeUrl = options?.currentUrl;
  if (!storeUrl && typeof window !== "undefined") {
    if (store.id) {
      storeUrl = `${window.location.origin}/loja/${store.id}`;
    } else {
      storeUrl = window.location.href;
    }
  }

  const lines: string[] = [
    "🍽️ *Bora comer aqui?*",
    "",
    `*${cleanName}*${store.category ? ` • _${store.category}_` : ""}`,
  ];

  if (statusLine) {
    lines.push(statusLine);
  }

  if (store.address) {
    lines.push(`📍 ${store.address}`);
  }

  if (deliveryUrl) {
    lines.push(`🛵 *Cardápio & Pedidos:* ${deliveryUrl}`);
  }

  if (storeUrl) {
    lines.push(`👀 *Ver no Yoogalize:* ${storeUrl}`);
  }

  return lines.join("\n");
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Abre o WhatsApp diretamente com a mensagem formatada de convite.
 */
export function shareToWhatsApp(
  store: ShareableStore,
  options?: WhatsAppInviteOptions
): boolean {
  const text = buildWhatsAppInvite(store, options);
  const url = getWhatsAppShareUrl(text);

  if (typeof window !== "undefined") {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return !!opened;
  }
  return false;
}

/**
 * Copia o texto do convite formatado para a area de transferencia.
 */
export async function copyWhatsAppInvite(
  store: ShareableStore,
  options?: WhatsAppInviteOptions
): Promise<boolean> {
  const text = buildWhatsAppInvite(store, options);
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
