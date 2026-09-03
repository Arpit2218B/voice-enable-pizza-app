import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_CUSTOMIZATION,
  INITIAL_PIZZAS,
  slugify,
} from "../data/pizzas";

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function mergeCustomization(base, patch = {}) {
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );
  const next = {
    ...DEFAULT_CUSTOMIZATION,
    ...base,
    ...clean,
    toppings: Array.isArray(clean.toppings)
      ? [...clean.toppings]
      : [...(base?.toppings || DEFAULT_CUSTOMIZATION.toppings)],
  };

  if (Array.isArray(clean.addToppings)) {
    next.toppings = [...new Set([...next.toppings, ...clean.addToppings])];
  }
  if (Array.isArray(clean.removeToppings)) {
    const remove = new Set(clean.removeToppings);
    next.toppings = next.toppings.filter((id) => !remove.has(id));
  }
  if (clean.notes !== undefined) next.notes = String(clean.notes || "");
  if (clean.size) next.size = clean.size;
  if (clean.crust) next.crust = clean.crust;
  delete next.addToppings;
  delete next.removeToppings;
  return next;
}

export function usePizzaCatalog(initial = INITIAL_PIZZAS) {
  const [pizzas, setPizzas] = useState(() => initial.map((p) => ({ ...p })));

  const findPizza = useCallback(
    (idOrName) => {
      const needle = String(idOrName || "").toLowerCase();
      return (
        pizzas.find(
          (p) =>
            p.id.toLowerCase() === needle ||
            p.name.toLowerCase() === needle ||
            p.name.toLowerCase().includes(needle)
        ) || null
      );
    },
    [pizzas]
  );

  const addPizza = useCallback((input) => {
    const name = String(input.name || "").trim();
    if (!name) return { error: "name is required" };
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) return { error: "price must be a number" };

    let id = slugify(input.id || name) || uid("pizza");
    const pizza = {
      id,
      name,
      category: input.category || "House",
      blurb: input.blurb || input.description || `${name} from the oven.`,
      description: input.description || input.blurb || `${name} from the oven.`,
      price,
      spicy: Boolean(input.spicy),
      vegetarian: input.vegetarian !== false,
      image:
        input.image ||
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&h=900&q=80",
      defaults: {
        ...DEFAULT_CUSTOMIZATION,
        ...(input.defaults || {}),
      },
    };

    setPizzas((prev) => {
      if (prev.some((p) => p.id === pizza.id)) {
        pizza.id = `${pizza.id}-${uid("x")}`;
      }
      return [...prev, { ...pizza }];
    });
    return pizza;
  }, []);

  const editPizza = useCallback((id, patch) => {
    let updated = null;
    setPizzas((prev) =>
      prev.map((pizza) => {
        if (pizza.id !== id && pizza.name.toLowerCase() !== String(id).toLowerCase()) {
          return pizza;
        }
        updated = {
          ...pizza,
          ...Object.fromEntries(
            Object.entries(patch || {}).filter(
              ([key, value]) =>
                value !== undefined &&
                !["id", "defaults"].includes(key) &&
                key !== "pending"
            )
          ),
        };
        if (patch.price !== undefined) updated.price = Number(patch.price);
        return updated;
      })
    );
    return updated;
  }, []);

  const removePizza = useCallback((id) => {
    const needle = String(id || "").toLowerCase();
    let removed = null;
    setPizzas((prev) => {
      const next = prev.filter((pizza) => {
        const match =
          pizza.id.toLowerCase() === needle || pizza.name.toLowerCase() === needle;
        if (match) removed = pizza;
        return !match;
      });
      return next;
    });
    if (!removed) return { error: `No pizza matched "${id}".` };
    return { ok: true, removed: removed.id, name: removed.name };
  }, []);

  return {
    pizzas,
    getPizzas: () => pizzas,
    findPizza,
    addPizza,
    editPizza,
    removePizza,
  };
}

export function useCart() {
  const [cart, setCart] = useState([]);

  const addItem = useCallback((pizzaId, customization, quantity = 1) => {
    const qty = Math.max(1, Number(quantity) || 1);
    const custom = mergeCustomization(DEFAULT_CUSTOMIZATION, customization);
    const id = uid("cart");
    setCart((prev) => [
      ...prev,
      { id, pizzaId, quantity: qty, customization: custom },
    ]);
    return id;
  }, []);

  const editItem = useCallback((cartItemId, patch = {}) => {
    let found = null;
    const {
      quantity,
      size,
      crust,
      toppings,
      addToppings,
      removeToppings,
      notes,
    } = patch;
    const customPatch = { size, crust, toppings, addToppings, removeToppings, notes };
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;
        found = {
          ...item,
          quantity:
            quantity !== undefined ? Math.max(1, Number(quantity) || 1) : item.quantity,
          customization: mergeCustomization(item.customization, customPatch),
        };
        return found;
      })
    );
    return found;
  }, []);

  const removeItem = useCallback((cartItemId) => {
    let removed = false;
    setCart((prev) => {
      const next = prev.filter((item) => item.id !== cartItemId);
      removed = next.length !== prev.length;
      return next;
    });
    return removed;
  }, []);

  const clear = useCallback(() => setCart([]), []);

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  return {
    cart,
    getCart: () => cart,
    addItem,
    editItem,
    removeItem,
    clear,
    itemCount,
  };
}

export function useCustomizations(pizzas) {
  const [drafts, setDrafts] = useState({});

  const getDraft = useCallback(
    (pizzaId) => {
      if (drafts[pizzaId]) return drafts[pizzaId];
      const pizza = pizzas.find((p) => p.id === pizzaId);
      return mergeCustomization(DEFAULT_CUSTOMIZATION, pizza?.defaults || {});
    },
    [drafts, pizzas]
  );

  const setDraft = useCallback((pizzaId, patch) => {
    let next = null;
    setDrafts((prev) => {
      const pizza = pizzas.find((p) => p.id === pizzaId);
      const base =
        prev[pizzaId] ||
        mergeCustomization(DEFAULT_CUSTOMIZATION, pizza?.defaults || {});
      next = mergeCustomization(base, patch);
      return { ...prev, [pizzaId]: next };
    });
    return next;
  }, [pizzas]);

  const resetDraft = useCallback(
    (pizzaId) => {
      const pizza = pizzas.find((p) => p.id === pizzaId);
      const next = mergeCustomization(DEFAULT_CUSTOMIZATION, pizza?.defaults || {});
      setDrafts((prev) => ({ ...prev, [pizzaId]: next }));
      return next;
    },
    [pizzas]
  );

  const clearDraft = useCallback((pizzaId) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[pizzaId];
      return next;
    });
  }, []);

  return { drafts, getDraft, setDraft, resetDraft, clearDraft };
}
