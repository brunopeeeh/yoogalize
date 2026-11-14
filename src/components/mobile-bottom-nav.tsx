import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Heart, MapPin } from "lucide-react";

export type MobileBottomNavProps = {
  onOpenAddressModal?: () => void;
};

export const MobileBottomNav = ({ onOpenAddressModal }: MobileBottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isSearch = location.pathname === "/busca";
  const isFavorites = location.pathname === "/favoritos";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur-md px-2 md:hidden shadow-lg"
      aria-label="Navegação inferior mobile"
    >
      <button
        type="button"
        onClick={() => navigate("/busca")}
        className={`flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition-colors ${
          isSearch ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Explorar estabelecimentos"
      >
        <Compass className={`h-5 w-5 mb-1 ${isSearch ? "stroke-[2.5]" : ""}`} />
        <span>Explorar</span>
      </button>

      <button
        type="button"
        onClick={() => navigate("/favoritos")}
        className={`flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition-colors ${
          isFavorites ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Meus favoritos"
      >
        <Heart className={`h-5 w-5 mb-1 ${isFavorites ? "fill-primary stroke-[2.5]" : ""}`} />
        <span>Favoritos</span>
      </button>

      <button
        type="button"
        onClick={onOpenAddressModal || (() => navigate("/"))}
        className="flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Alterar endereço"
      >
        <MapPin className="h-5 w-5 mb-1" />
        <span>Endereço</span>
      </button>
    </nav>
  );
};
