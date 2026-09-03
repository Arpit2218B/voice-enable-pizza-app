import { Link } from "react-router-dom";
import { CartLine } from "../components/CartLine";
import { money, priceFor } from "../data/pizzas";
import { usePizzaApp } from "../context/PizzaContext";

export function CartPage() {
  const { cart, pizzas, clearCart, showToast } = usePizzaApp();

  const subtotal = cart.reduce((sum, item) => {
    const pizza = pizzas.find((p) => p.id === item.pizzaId);
    if (!pizza) return sum;
    return sum + priceFor(pizza, item.customization) * item.quantity;
  }, 0);

  return (
    <main className="voice-stage voice-cart">
      <p className="voice-stage__prompt">Say “Checkout” or “Clear cart”</p>

      <div className="voice-cart__panel">
        <p className="voice-stage__price">{money(subtotal)}</p>
        <p className="voice-stage__cat">Your order</p>
        <h1 className="voice-stage__title">Cart</h1>

        {cart.length === 0 ? (
          <div className="voice-cart__empty">
            <p className="voice-stage__copy">Cart is empty. Grab a pie from the menu.</p>
            <Link className="voice-stage__prompt" to="/">
              Browse menu
            </Link>
          </div>
        ) : (
          <>
            <ul className="voice-cart__list">
              {cart.map((item) => (
                <CartLine key={item.id} item={item} />
              ))}
            </ul>

            <div className="voice-cart__actions">
              <button
                className="voice-stage__chip"
                type="button"
                onClick={clearCart}
              >
                Clear
              </button>
              <button
                className="voice-stage__chip is-active"
                type="button"
                onClick={() => {
                  showToast("Checkout is a demo — order noted.");
                  window.alert("Checkout is a demo — order noted.");
                }}
              >
                Checkout · {money(subtotal)}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
