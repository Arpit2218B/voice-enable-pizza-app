import { CRUSTS, SIZES, TOPPINGS, money, priceFor } from "../data/pizzas";
import { usePizzaApp } from "../context/PizzaContext";

function labelFor(list, id) {
  return list.find((item) => item.id === id)?.label || id;
}

export function CartLine({ item }) {
  const { pizzas, editCartItem, removeFromCart } = usePizzaApp();
  const pizza = pizzas.find((p) => p.id === item.pizzaId);
  if (!pizza) return null;

  const unit = priceFor(pizza, item.customization);
  const toppingNames = (item.customization.toppings || [])
    .map((id) => labelFor(TOPPINGS, id))
    .join(", ");

  return (
    <li className="voice-cart__line" data-webmcp-item="true" data-webmcp-item-id={item.id}>
      <img className="voice-cart__thumb" src={pizza.image} alt="" width="72" height="72" />
      <div className="voice-cart__body">
        <div className="voice-cart__top">
          <h2>{pizza.name}</h2>
          <strong>{money(unit * item.quantity)}</strong>
        </div>
        <p className="voice-cart__meta">
          {labelFor(SIZES, item.customization.size)} ·{" "}
          {labelFor(CRUSTS, item.customization.crust)}
          {toppingNames ? ` · ${toppingNames}` : ""}
        </p>
        {item.customization.notes ? (
          <p className="voice-cart__note">Note: {item.customization.notes}</p>
        ) : null}
        <div className="voice-cart__controls">
          <label className="voice-cart__qty">
            Qty
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(event) =>
                editCartItem({
                  cartItemId: item.id,
                  quantity: Number(event.target.value),
                })
              }
            />
          </label>
          <button
            className="voice-stage__chip"
            type="button"
            onClick={() => removeFromCart(item.id)}
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
