import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type StoreMiniMapProps = {
  latitude: number;
  longitude: number;
  storeName: string;
  categoryVisualBg?: string;
  userLocation?: { lat: number; lon: number };
};

export const StoreMiniMap = ({
  latitude,
  longitude,
  storeName,
  userLocation,
}: StoreMiniMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Inicializa o mini-mapa com scroll zoom desativado (UX 8)
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // TileLayer do OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Ícone customizado do pino da loja
    const storePinIcon = L.divIcon({
      className: "custom-store-pin",
      html: `
        <div style="
          width: 34px;
          height: 34px;
          background: #7c3aed;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: #ffffff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -30],
    });

    const storeMarker = L.marker([latitude, longitude], { icon: storePinIcon }).addTo(map);
    storeMarker.bindPopup(`<b>${storeName}</b>`);

    // Se temos a localização do usuário, plota o marcador azul do usuário
    if (userLocation && userLocation.lat && userLocation.lon) {
      const userPinIcon = L.divIcon({
        className: "custom-user-pin",
        html: `
          <div style="
            width: 18px;
            height: 18px;
            background: #2563eb;
            border-radius: 50%;
            border: 3px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker([userLocation.lat, userLocation.lon], { icon: userPinIcon })
        .addTo(map)
        .bindPopup("Sua localização");

      // Ajusta o enquadramento se a distância for razoável (< 15 km)
      const group = L.featureGroup([
        storeMarker,
        L.marker([userLocation.lat, userLocation.lon]),
      ]);
      map.fitBounds(group.getBounds().pad(0.3));
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, storeName, userLocation]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-border shadow-inner z-0"
      aria-label={`Mini-mapa da localização de ${storeName}`}
    />
  );
};

export default StoreMiniMap;
