import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Welcome from "./pages/Welcome";
import Search from "./pages/Search";
import Favorites from "./pages/Favorites";
import StoreDetail from "./pages/StoreDetail";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/error-boundary";
import { ThemeProvider } from "next-themes";

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system">
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/busca" element={<Search />} />
            <Route path="/favoritos" element={<Favorites />} />
            <Route path="/loja/:id" element={<StoreDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
