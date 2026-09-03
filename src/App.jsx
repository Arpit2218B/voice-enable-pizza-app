import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Header, Toast } from "./components/Header";
import { VoiceAgent } from "./components/VoiceAgent";
import { PizzaProvider } from "./context/PizzaContext";
import { CartPage } from "./pages/CartPage";
import { CustomizePage } from "./pages/CustomizePage";
import { DetailPage } from "./pages/DetailPage";
import { MenuPage } from "./pages/MenuPage";

function Shell() {
  const location = useLocation();
  const isVoiceStage =
    location.pathname === "/" ||
    location.pathname === "/cart" ||
    location.pathname.startsWith("/pizza/") ||
    location.pathname.startsWith("/customize/");

  return (
    <PizzaProvider>
      <div className={`app-shell${isVoiceStage ? " is-listing" : ""}`}>
        <div className="app-stage">
          {isVoiceStage ? null : <Header />}
          <Routes>
            <Route path="/" element={<MenuPage />} />
            <Route path="/pizza/:pizzaId" element={<DetailPage />} />
            <Route path="/customize/:pizzaId" element={<CustomizePage />} />
            <Route path="/cart" element={<CartPage />} />
          </Routes>
          {isVoiceStage ? null : (
            <footer className="site-footer">Forno · Wood-fired pizza · WebMCP demo</footer>
          )}
        </div>
        <Toast />
        <VoiceAgent listingMode={isVoiceStage} />
      </div>
    </PizzaProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
