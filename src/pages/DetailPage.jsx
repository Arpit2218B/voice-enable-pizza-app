import { Link, useParams } from "react-router-dom";
import { PizzaOrbitStage } from "../components/PizzaOrbitStage";
import { usePizzaApp } from "../context/PizzaContext";

export function DetailPage() {
  const { pizzaId } = useParams();
  const { findPizza, getDraft } = usePizzaApp();
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

  return (
    <PizzaOrbitStage
      pizza={pizza}
      draft={draft}
      mode="detail"
      prompt={`Say “Customize the ${pizza.name}”`}
    />
  );
}
