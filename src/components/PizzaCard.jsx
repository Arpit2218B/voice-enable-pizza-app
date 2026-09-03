import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { money } from "../data/pizzas";
import { usePizzaApp } from "../context/PizzaContext";

export function PizzaCard({ pizza }) {
  const { addToCart, getDraft, actionFlash } = usePizzaApp();
  const draft = getDraft(pizza.id);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (actionFlash?.type === "add" && actionFlash.pizzaId === pizza.id) {
      setBump(true);
      const timer = window.setTimeout(() => setBump(false), 700);
      return () => window.clearTimeout(timer);
    }
  }, [actionFlash, pizza.id]);

  function handleAdd() {
    setBump(true);
    addToCart({ pizzaId: pizza.id, useDraft: true, quantity: 1 });
    window.setTimeout(() => setBump(false), 700);
  }

  return (
    <article
      className={`pizza-card${bump ? " is-adding" : ""}`}
      data-webmcp-item="true"
      data-webmcp-item-id={pizza.id}
    >
      <Link className="pizza-media" to={`/pizza/${pizza.id}`}>
        <img src={pizza.image} alt={pizza.name} loading="lazy" width="600" height="450" />
        <div className="pizza-flags">
          {pizza.spicy ? <span className="flag spicy">Spicy</span> : null}
          {pizza.vegetarian ? <span className="flag veg">Veg</span> : null}
        </div>
        {bump ? <span className="add-burst" aria-hidden="true" /> : null}
      </Link>
      <div className="pizza-body">
        <div className="pizza-meta">
          <span data-webmcp-field="category">{pizza.category}</span>
          <span data-webmcp-field="price">{money(pizza.price)}</span>
        </div>
        <h2 className="pizza-title" data-webmcp-field="name">
          <Link to={`/pizza/${pizza.id}`}>{pizza.name}</Link>
        </h2>
        <p className="pizza-copy" data-webmcp-field="description">
          {pizza.blurb}
        </p>
        <div className="pizza-actions">
          <Link className="btn secondary" to={`/customize/${pizza.id}`}>
            Customize
          </Link>
          <button className="btn btn-add" type="button" onClick={handleAdd}>
            Add · {money(pizza.price)}
          </button>
        </div>
        <p className="draft-hint">
          Draft: {draft.size} · {draft.crust}
          {draft.toppings?.length ? ` · +${draft.toppings.length}` : ""}
        </p>
      </div>
    </article>
  );
}
