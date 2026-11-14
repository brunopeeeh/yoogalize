import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

export const StoreMap = ({
  stores,
  userLocation,
  radiusKm,
  onSelectStore,
}: StoreMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Destrói instância anterior para evitar "Map container is already initialized"
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      const defaultCenter: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lon]
        : stores.length > 0
        ? [stores[0].latitude, stores[0].longitude]
        : [-20.3155, -40.3128]; // Vitória/ES

      const map = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: 13,
        scrollWheelZoom: false,
      });

      mapRef.current = map;

      // Camada de Mapa OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.featureGroup();

      // Marcador e Círculo do Usuário (se localização estiver disponível)
      if (userLocation) {
        // Círculo de raio
        L.circle([userLocation.lat, userLocation.lon], {
          radius: radiusKm * 1000,
          color: "#0f766e",
          fillColor: "#0f766e",
          fillOpacity: 0.1,
          weight: 2,
          dashArray: "4, 6",
        }).addTo(markersGroup);

        // Ícone do Usuário
        const userIcon = L.divIcon({
          className: "custom-user-marker",
          html: `
            <div style="position: relative; width: 22px; height: 22px;">
              <div style="position: absolute; inset: -4px; background: rgba(37,99,235,0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
              <div style="position: relative; width: 22px; height: 22px; background: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
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
          <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4;">
            <strong style="color: #2563eb;">📍 Sua Localização</strong>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 11px;">
              ${userLocation.address || "Ponto de referência informado"}
            </p>
          </div>
        `);

        markersGroup.addLayer(userMarker);
      }

      // Ícone padrão das Lojas
      const createStoreIcon = (isOpen: boolean) =>
        L.divIcon({
          className: "custom-store-pin",
          html: `
            <div style="
              background: ${isOpen ? "#0f766e" : "#64748b"};
              color: white;
              width: 32px;
              height: 32px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 3px 8px rgba(0,0,0,0.3);
              border: 2px solid white;
              cursor: pointer;
            ">
              <svg style="transform: rotate(45deg); width: 14px; height: 14px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

      // Adiciona cada estabelecimento
      stores.forEach((store) => {
        const { status, message } = getOpeningHoursInfo(store.operatingHours);
        const isOpen = status === "open";
        const icon = createStoreIcon(isOpen);

        const marker = L.marker([store.latitude, store.longitude], {
          icon,
          title: store.name,
        });

        const statusColor = isOpen ? "#0f766e" : status === "closed" ? "#dc2626" : "#64748b";
        const distanceText = store.distance !== undefined ? formatDistance(store.distance) : "";

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; min-width: 200px; max-width: 260px; line-height: 1.4;">
            <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 2px;">
              ${store.name}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: #0f766e; margin-bottom: 6px;">
              ${store.category} ${store.serviceType ? `• ${store.serviceType}` : ""}
            </div>
            <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
              ${store.address}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: ${statusColor}; margin-bottom: 8px;">
              ${message}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px; border-top: 1px solid #e2e8f0;">
              ${distanceText ? `<span style="font-size: 11px; font-weight: 600; color: #64748b;">${distanceText}</span>` : "<span></span>"}
              <a href="/loja/${store.id}" style="display: inline-block; background: #0f766e; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-decoration: none;">
                Ver Detalhes &rarr;
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on("click", () => {
          if (onSelectStore) {
            onSelectStore(store);
          }
        });

        markersGroup.addLayer(marker);
      });

      markersGroup.addTo(map);

      // Ajusta zoom para englobar os marcadores
      if (stores.length > 0 || userLocation) {
        const bounds = markersGroup.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 15,
          });
        }
      }
    } catch (err) {
      console.warn("Não foi possível inicializar o mapa interativo Leaflet:", err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stores, userLocation, radiusKm, onSelectStore]);

  return (
    <div className="relative w-full h-[550px] md:h-[650px] rounded-xl overflow-hidden border border-border shadow-sm">
      <div ref={containerRef} className="w-full h-full z-0" />
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
          <span className="text-muted-foreground font-medium">Aberto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span>
          <span className="text-muted-foreground font-medium">Fechado / Outro</span>
        </div>
        {userLocation && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            <span className="text-muted-foreground font-medium">Você</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreMap;
