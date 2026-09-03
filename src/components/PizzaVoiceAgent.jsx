import { Link, useLocation } from "react-router-dom";
import { VoiceAgent, useVoiceAgent } from "@webmcp/voice-agent";
import "@webmcp/voice-agent/style.css";
import { pizzaAgent } from "../agent/pizzaAgent";
import { usePizzaApp } from "../context/PizzaContext";

const PIZZA_BODY_CLASSES = {
  live: "forno-voice-live",
  listing: "forno-listing",
};

export function PizzaVoiceAgent({ listingMode = false }) {
  const location = useLocation();
  const { showToast, itemCount, actionFlash } = usePizzaApp();
  const agent = useVoiceAgent(pizzaAgent);

  return (
    <VoiceAgent
      agent={agent}
      title="Forno"
      listingMode={listingMode}
      onNotify={showToast}
      scrollKey={location.pathname}
      actionSignal={actionFlash}
      bodyClassNames={PIZZA_BODY_CLASSES}
      renderBadge={() => (itemCount > 0 ? `${itemCount} in cart` : null)}
      renderListingSide={() =>
        location.pathname === "/cart" ? (
          <Link className="wva-voice-cart-link" to="/">
            Menu
          </Link>
        ) : (
          <Link className="wva-voice-cart-link" to="/cart">
            Cart{itemCount > 0 ? ` · ${itemCount}` : ""}
          </Link>
        )
      }
    />
  );
}
