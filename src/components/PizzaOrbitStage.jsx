import { useEffect, useRef, useState } from "react";
import { CRUSTS, SIZES, TOPPINGS, money, priceFor } from "../data/pizzas";
import { usePizzaApp } from "../context/PizzaContext";

const TOPPING_EMOJI = {
  mozzarella: "🧀",
  basil: "🌿",
  mushroom: "🍄",
  pepperoni: "🌶️",
  olive: "🫒",
  jalapeno: "🫑",
  onion: "🧅",
  sausage: "🌭",
};

function labelFor(list, id) {
  return list.find((item) => item.id === id)?.label || id;
}

/**
 * Voice-first pizza stage: circular hero + floating option orbs.
 * mode: "detail" | "customize"
 */
export function PizzaOrbitStage({
  pizza,
  draft,
  mode = "detail",
  onToggleTopping,
  onSelectSize,
  onSelectCrust,
  prompt,
}) {
  const { actionFlash } = usePizzaApp();
  const unit = priceFor(pizza, draft);
  const selected = new Set(draft?.toppings || []);
  const [pulse, setPulse] = useState(null);
  const prevDraft = useRef(draft);

  function bump(key, label) {
    if (!key) return;
    setPulse({ key, label, id: Date.now() });
  }

  useEffect(() => {
    if (!pulse) return undefined;
    const timer = window.setTimeout(() => setPulse(null), 700);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  useEffect(() => {
    const prev = prevDraft.current;
    prevDraft.current = draft;
    if (!prev || !draft || mode !== "customize") return;

    if (prev.size !== draft.size) {
      bump(`size:${draft.size}`, labelFor(SIZES, draft.size));
      return;
    }
    if (prev.crust !== draft.crust) {
      bump(`crust:${draft.crust}`, labelFor(CRUSTS, draft.crust));
      return;
    }

    const before = new Set(prev.toppings || []);
    const after = new Set(draft.toppings || []);
    for (const id of after) {
      if (!before.has(id)) {
        bump(`topping:${id}`, labelFor(TOPPINGS, id));
        return;
      }
    }
    for (const id of before) {
      if (!after.has(id)) {
        bump(`topping:${id}`, `Removed ${labelFor(TOPPINGS, id)}`);
        return;
      }
    }
  }, [draft, mode]);

  useEffect(() => {
    if (mode !== "customize") return;
    if (!actionFlash || actionFlash.pizzaId !== pizza.id) return;
    if (actionFlash.type !== "customize" && actionFlash.type !== "focus") return;

    if (actionFlash.crust) {
      bump(`crust:${actionFlash.crust}`, labelFor(CRUSTS, actionFlash.crust));
    } else if (actionFlash.size) {
      bump(`size:${actionFlash.size}`, labelFor(SIZES, actionFlash.size));
    } else if (actionFlash.toppingId) {
      bump(`topping:${actionFlash.toppingId}`, labelFor(TOPPINGS, actionFlash.toppingId));
    } else if (Array.isArray(actionFlash.addToppings) && actionFlash.addToppings[0]) {
      bump(
        `topping:${actionFlash.addToppings[0]}`,
        labelFor(TOPPINGS, actionFlash.addToppings[0])
      );
    } else if (Array.isArray(actionFlash.toppings) && actionFlash.toppings[0]) {
      bump(`topping:${actionFlash.toppings[0]}`, labelFor(TOPPINGS, actionFlash.toppings[0]));
    }
  }, [actionFlash, mode, pizza.id]);

  const floating =
    mode === "customize"
      ? TOPPINGS.slice(0, 6).map((topping, index) => ({
          id: topping.id,
          key: `topping:${topping.id}`,
          label: topping.label,
          emoji: TOPPING_EMOJI[topping.id] || "•",
          active: selected.has(topping.id),
          slot: index,
          onClick: () => onToggleTopping?.(topping.id),
        }))
      : [];

  const detailFacts = [
    { id: "size", label: labelFor(SIZES, draft?.size) },
    { id: "crust", label: labelFor(CRUSTS, draft?.crust) },
    pizza.vegetarian ? { id: "veg", label: "Vegetarian" } : null,
    pizza.spicy ? { id: "spicy", label: "Spicy" } : null,
  ].filter(Boolean);

  return (
    <main className={`voice-stage${pulse ? " is-pulsing" : ""}`}>
      {prompt ? <p className="voice-stage__prompt">{prompt}</p> : null}

      <div className="pizza-orbit" data-webmcp-item="true" data-webmcp-item-id={pizza.id}>
        <div className={`pizza-orbit__hero${pulse ? " is-feedback" : ""}`}>
          <img src={pizza.image} alt={pizza.name} data-webmcp-field="image" />
          {pulse ? (
            <span className="pizza-orbit__toast" key={pulse.id}>
              {pulse.label}
            </span>
          ) : null}
        </div>

        {floating.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`pizza-orbit__float pizza-orbit__float--${item.slot}${
              item.active ? " is-active" : ""
            }${pulse?.key === item.key ? " is-pulse" : ""}`}
            onClick={item.onClick}
            disabled={!item.onClick}
            aria-pressed={item.onClick ? item.active : undefined}
          >
            <span className="pizza-orbit__emoji" aria-hidden="true">
              {item.emoji}
            </span>
            <span className="pizza-orbit__float-label">{item.label}</span>
            {item.active ? (
              <span className="pizza-orbit__check" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="voice-stage__meta">
        <p className={`voice-stage__price${pulse ? " is-pulse" : ""}`} data-webmcp-field="price">
          {money(unit)}
        </p>
        <p className="voice-stage__cat" data-webmcp-field="category">
          {pizza.category}
        </p>
        <h1 className="voice-stage__title" data-webmcp-field="name">
          {pizza.name}
        </h1>
        <p className="voice-stage__copy" data-webmcp-field="description">
          {mode === "detail" ? pizza.description : pizza.blurb}
        </p>

        {mode === "detail" ? (
          <div className="voice-stage__facts" aria-label="Pizza details">
            {detailFacts.map((fact) => (
              <span key={fact.id} className="voice-stage__fact">
                {fact.label}
              </span>
            ))}
          </div>
        ) : null}

        {mode === "customize" ? (
          <>
            <div className="voice-stage__sizes" role="group" aria-label="Size">
              {SIZES.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  className={`voice-stage__chip${draft?.size === size.id ? " is-active" : ""}${
                    pulse?.key === `size:${size.id}` ? " is-pulse" : ""
                  }`}
                  onClick={() => onSelectSize?.(size.id)}
                >
                  {size.label.replace(/ \(.*\)/, "")}
                </button>
              ))}
            </div>
            <div className="voice-stage__sizes" role="group" aria-label="Crust">
              {CRUSTS.map((crust) => (
                <button
                  key={crust.id}
                  type="button"
                  className={`voice-stage__chip${draft?.crust === crust.id ? " is-active" : ""}${
                    pulse?.key === `crust:${crust.id}` ? " is-pulse" : ""
                  }`}
                  onClick={() => onSelectCrust?.(crust.id)}
                >
                  {crust.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
