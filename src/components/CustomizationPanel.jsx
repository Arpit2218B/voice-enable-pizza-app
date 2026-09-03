import { CRUSTS, SIZES, TOPPINGS, money, priceFor } from "../data/pizzas";

export function CustomizationPanel({ pizza, value, onChange }) {
  const total = priceFor(pizza, value);

  function toggleTopping(id) {
    const set = new Set(value.toppings || []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ toppings: [...set] });
  }

  return (
    <div className="customize-panel">
      <fieldset>
        <legend>Size</legend>
        <div className="option-row">
          {SIZES.map((size) => (
            <label key={size.id} className={`option-chip${value.size === size.id ? " active" : ""}`}>
              <input
                type="radio"
                name="size"
                checked={value.size === size.id}
                onChange={() => onChange({ size: size.id })}
              />
              <span>
                {size.label}
                {size.priceDelta ? ` (+${money(size.priceDelta)})` : ""}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Crust</legend>
        <div className="option-row">
          {CRUSTS.map((crust) => (
            <label
              key={crust.id}
              className={`option-chip${value.crust === crust.id ? " active" : ""}`}
            >
              <input
                type="radio"
                name="crust"
                checked={value.crust === crust.id}
                onChange={() => onChange({ crust: crust.id })}
              />
              <span>
                {crust.label}
                {crust.priceDelta ? ` (+${money(crust.priceDelta)})` : ""}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Extra toppings</legend>
        <div className="option-grid">
          {TOPPINGS.map((topping) => {
            const checked = (value.toppings || []).includes(topping.id);
            return (
              <label
                key={topping.id}
                className={`option-chip${checked ? " active" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTopping(topping.id)}
                />
                <span>
                  {topping.label} · {money(topping.price)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="notes-field">
        Kitchen notes
        <textarea
          rows={3}
          value={value.notes || ""}
          placeholder="Light sauce, well done…"
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </label>

      <p className="customize-total">
        Unit price <strong>{money(total)}</strong>
      </p>
    </div>
  );
}
