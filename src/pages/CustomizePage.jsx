import { Link, useParams } from "react-router-dom";
import { PizzaOrbitStage } from "../components/PizzaOrbitStage";
import { TOPPINGS } from "../data/pizzas";
import { usePizzaApp } from "../context/PizzaContext";

export function CustomizePage() {
  const { pizzaId } = useParams();
  const { findPizza, getDraft, setDraft } = usePizzaApp();
  const pizza = findPizza(pizzaId);

  if (!pizza) {
    return (
      <main className="voice-stage">
        <p className="voice-stage__copy">Pizza not found.</p>
        <Link className="voice-stage__prompt" to="/">
          Back to menu
        </Link>
      </main>
    );
  }

  const draft = getDraft(pizza.id);
  const selected = new Set(draft.toppings || []);
  const suggestion =
    TOPPINGS.find((topping) => !selected.has(topping.id)) || TOPPINGS[0];

  function toggleTopping(id) {
    const next = new Set(draft.toppings || []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDraft(pizza.id, { toppings: [...next] });
  }

  return (
    <PizzaOrbitStage
      pizza={pizza}
      draft={draft}
      mode="customize"
      prompt={`Say “Add ${suggestion.label}”`}
      onToggleTopping={toggleTopping}
      onSelectSize={(size) => setDraft(pizza.id, { size })}
      onSelectCrust={(crust) => setDraft(pizza.id, { crust })}
    />
  );
}
