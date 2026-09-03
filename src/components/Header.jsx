import { NavLink } from "react-router-dom";
import { usePizzaApp } from "../context/PizzaContext";

export function Header() {
  const { itemCount, actionFlash } = usePizzaApp();
  const cartPulse = actionFlash?.type === "add";

  return (
    <header className="site-header">
      <nav className="nav" aria-label="Primary">
        <NavLink className="brand" to="/">
          <span className="brand-mark" aria-hidden="true" />
          Forno
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end>
            Menu
          </NavLink>
          <NavLink className={`cart-link${cartPulse ? " is-pulse" : ""}`} to="/cart">
            Cart
            {itemCount > 0 ? (
              <span key={itemCount} className={`cart-count${cartPulse ? " is-bump" : ""}`}>
                {itemCount}
              </span>
            ) : null}
          </NavLink>
        </div>
      </nav>
    </header>
  );
}

export function Toast() {
  const { toast } = usePizzaApp();
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast}>
      <span className="toast-dot" aria-hidden="true" />
      {toast}
    </div>
  );
}
