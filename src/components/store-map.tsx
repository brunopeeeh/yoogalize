import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { LocateFixed, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NormalizedEstablishment } from "@/lib/types";
import { formatDistance } from "@/lib/distance";
import { getOpeningHoursInfo } from "@/lib/utils";

type StoreWithDistance = NormalizedEstablishment & {
  distance?: number;
};

interface StoreMapProps {
  stores: StoreWithDistance[];
  userLocation?: { lat: number; lon: number; address?: string };
  radiusKm: number;
  onSelectStore?: (store: StoreWithDistance) => void;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const StoreMap = ({
  stores,
  userLocation,
  radiusKm,
  onSelectStore,
}: StoreMapProps) => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const hasFittedInitialBounds = useRef(false);

  // Mantém referências atualizadas para os callbacks dentro dos eventos do Leaflet
  const storesRef = useRef(stores);
  storesRef.current = stores;
  const onSelectStoreRef = useRef(onSelectStore);
  onSelectStoreRef.current = onSelectStore;

  // 1. Inicializa o Mapa UMA VEZ
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const defaultCenter: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lon]
      : storesRef.current.length > 0
      ? [storesRef.current[0].latitude, storesRef.current[0].longitude]
      : [-20.3155, -40.3128]; // Vitória/ES

    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: 13,
      scrollWheelZoom: true, // Permite zoom suave com a rodinha do mouse
      wheelDebounceTime: 40,
      wheelPxPerZoomLevel: 60,
      zoomControl: false, // Adicionaremos com posição customizada
    });

    // Controle de zoom no canto inferior direito
    L.control
      .zoom({
        position: "bottomright",
      })
      .addTo(map);

    const markersGroup = L.featureGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapRef.current = map;

    // Delegação de clique do botão "Ver detalhes" dentro do popup
    map.on("popupopen", (e) => {
      const popupEl = e.popup.getElement();
      if (!popupEl) return;

      const detailBtn = popupEl.querySelector<HTMLButtonElement>(".leaflet-detail-btn");
      if (detailBtn) {
        detailBtn.onclick = (ev) => {
          ev.preventDefault();
          const storeId = detailBtn.getAttribute("data-store-id");
          if (!storeId) return;

          const targetStore = storesRef.current.find((s) => s.id === storeId);
          if (targetStore && onSelectStoreRef.current) {
            onSelectStoreRef.current(targetStore);
          } else {
            navigate(`/loja/${storeId}`, { state: { store: targetStore } });
          }
        };
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersGroupRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [navigate]);

  // 2. Atualiza a camada de Tiles quando o tema mudar (Claro / Escuro)
  useEffect(() => {
    if (!mapRef.current) return;

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const tileUrl = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    const newTileLayer = L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(mapRef.current);

    tileLayerRef.current = newTileLayer;
  }, [isDark]);

  // 3. Atualiza os Marcadores sem destruir o mapa (preserva posição e navegação suave)
  useEffect(() => {
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // Marcador e Círculo do Usuário
    if (userLocation) {
      // Círculo de raio de busca
      L.circle([userLocation.lat, userLocation.lon], {
        radius: radiusKm * 1000,
        color: "#0284c7",
        fillColor: "#0284c7",
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: "4, 6",
      }).addTo(markersGroup);

      // Ícone do Usuário com pulso
      const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: `
          <div style="position: relative; width: 22px; height: 22px;">
            <div style="position: absolute; inset: -4px; background: rgba(2,132,199,0.35); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 22px; height: 22px; background: #0284c7; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lon], {
        icon: userIcon,
        title: "Sua localização",
      });

      userMarker.bindPopup(`
        <div style="padding: 10px 14px; font-family: system-ui, sans-serif; line-height: 1.4;">
          <strong style="color: #0284c7; font-size: 13px;">📍 Sua Localização</strong>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 11px;">
            ${escapeHtml(userLocation.address || "Ponto de referência informado")}
          </p>
        </div>
      `);

      markersGroup.addLayer(userMarker);
    }

    // Ícone moderno para as lojas
    const createStoreIcon = (isOpen: boolean) =>
      L.divIcon({
        className: "custom-store-pin",
        html: `
          <div style="
            background: ${isOpen ? "#059669" : "#64748b"};
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            border: 2px solid white;
            cursor: pointer;
          ">
            <svg style="transform: rotate(45deg); width: 14px; height: 14px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
              <path d="M2 7h20"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30],
      });

    // Adiciona cada loja ao mapa
    stores.forEach((store) => {
      const { status, message } = getOpeningHoursInfo(store.operatingHours);
      const isOpen = status === "open";
      const icon = createStoreIcon(isOpen);

      const marker = L.marker([store.latitude, store.longitude], {
        icon,
        title: store.name,
      });

      const distanceText = store.distance !== undefined ? formatDistance(store.distance) : "";

      const deliveryHref = store.linkDelivery
        ? store.linkDelivery.startsWith("http")
          ? store.linkDelivery
          : `https://delivery.yooga.app/${store.linkDelivery}`
        : null;

      const popupHtml = `
        <div style="padding: 12px 14px; font-family: system-ui, sans-serif; min-width: 220px; max-width: 270px; line-height: 1.4;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">
            ${escapeHtml(store.name)}
          </div>
          <div style="font-size: 11px; font-weight: 600; color: #0284c7; margin-bottom: 6px;">
            ${escapeHtml(store.category)}${store.serviceType ? ` • ${escapeHtml(store.serviceType)}` : ""}
          </div>
          
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
            <span style="font-weight: 600; color: ${isOpen ? "#059669" : status === "closed" ? "#dc2626" : "#64748b"};">
              ● ${escapeHtml(message)}
            </span>
            ${distanceText ? `<span style="font-weight: 700; opacity: 0.8;">${distanceText}</span>` : ""}
          </div>

          ${
            store.address
              ? `<div style="font-size: 11px; opacity: 0.75; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                  ${escapeHtml(store.address)}
                </div>`
              : ""
          }

          <div style="display: flex; align-items: center; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(125,125,125,0.2);">
            <button
              type="button"
              data-store-id="${store.id}"
              class="leaflet-detail-btn"
              style="flex: 1; height: 32px; border-radius: 8px; background: #0284c7; color: white; font-size: 12px; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);"
            >
              <span>Ver detalhes</span>
              <span style="font-size: 13px;">&rarr;</span>
            </button>
            ${
              deliveryHref
                ? `<a
                    href="${deliveryHref}"
                    target="_blank"
                    rel="noopener noreferrer"
                    style="height: 32px; padding: 0 10px; border-radius: 8px; border: 1px solid rgba(125,125,125,0.25); background: transparent; color: inherit; font-size: 11px; font-weight: 600; text-decoration: none; display: flex; align-items: center; justify-content: center;"
                  >
                    Cardápio
                  </a>`
                : ""
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      // Centraliza suavemente ao clicar no pino sem navegar embora
      marker.on("click", () => {
        map.panTo([store.latitude, store.longitude], { animate: true, duration: 0.4 });
      });

      markersGroup.addLayer(marker);
    });

    // Ajusta o zoom inicial para englobar os marcadores apenas uma vez ou se mudou muito
    if (!hasFittedInitialBounds.current && (stores.length > 0 || userLocation)) {
      const bounds = markersGroup.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [45, 45],
          maxZoom: 15,
        });
        hasFittedInitialBounds.current = true;
      }
    }
  }, [stores, userLocation, radiusKm]);

  // Ação: Centralizar no usuário
  const handleCenterOnUser = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.flyTo([userLocation.lat, userLocation.lon], 15, {
      animate: true,
      duration: 0.8,
    });
  }, [userLocation]);

  // Ação: Enquadrar todas as lojas
  const handleFitAll = useCallback(() => {
    if (!mapRef.current || !markersGroupRef.current) return;
    const bounds = markersGroupRef.current.getBounds();
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, {
        padding: [45, 45],
        maxZoom: 15,
        animate: true,
      });
    }
  }, []);

  return (
    <div className="relative w-full h-[550px] md:h-[650px] rounded-2xl overflow-hidden border border-border shadow-sm bg-muted/20">
      <div ref={containerRef} className="w-full h-full z-0" />

      {/* Botões de Ação Rápida Flutuantes (Canto Superior Direito) */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        {userLocation && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleCenterOnUser}
            className="h-9 w-9 rounded-xl bg-background/90 backdrop-blur-md shadow-md border border-border/80 hover:bg-background text-foreground transition-all hover:scale-105 active:scale-95"
            title="Centralizar na minha localização"
            aria-label="Centralizar na minha localização"
          >
            <LocateFixed className="h-4 w-4 text-primary" />
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={handleFitAll}
          className="h-9 w-9 rounded-xl bg-background/90 backdrop-blur-md shadow-md border border-border/80 hover:bg-background text-foreground transition-all hover:scale-105 active:scale-95"
          title="Enquadrar todas as lojas"
          aria-label="Enquadrar todas as lojas"
        >
          <Maximize2 className="h-4 w-4 text-foreground/80" />
        </Button>
      </div>

      {/* Legenda Dinâmica (Canto Inferior Esquerdo) */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-border/80 shadow-md text-xs flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-500/20"></span>
          <span className="text-foreground/80 font-medium">Aberto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500 inline-block"></span>
          <span className="text-foreground/80 font-medium">Fechado</span>
        </div>
        {userLocation && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block ring-2 ring-sky-600/20"></span>
            <span className="text-foreground/80 font-medium">Você</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreMap;
