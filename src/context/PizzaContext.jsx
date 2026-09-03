import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_CUSTOMIZATION, priceFor } from "../data/pizzas";
import {
  useCart,
  useCustomizations,
  usePizzaCatalog,
} from "../hooks/usePizzaStore";
import { PizzaWebMCPTools } from "../webmcp/PizzaWebMCPTools";

const PizzaContext = createContext(null);

export function PizzaProvider({ children }) {
  const navigate = useNavigate();
  const catalog = usePizzaCatalog();
  const cartApi = useCart();
  const customs = useCustomizations(catalog.pizzas);
  const [toast, setToast] = useState("");
  const [actionFlash, setActionFlash] = useState(null);
  /** Persists until MenuPage scrolls to it — survives navigate-before-mount races. */
  const [menuFocus, setMenuFocus] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2200);
  }, []);

  const flashAction = useCallback((type, payload = {}) => {
    const flash = { type, ...payload, id: Date.now() };
    setActionFlash(flash);
    window.clearTimeout(flashAction.timer);
    const hold = type === "focus" ? 2200 : 900;
    flashAction.timer = window.setTimeout(() => setActionFlash(null), hold);
  }, []);

  const focusPizza = useCallback(
    (pizzaId, options = {}) => {
      const pizza = catalog.findPizza(pizzaId);
      if (!pizza) return null;
      const goMenu = options.menu !== false;
      if (goMenu) navigate("/");
      setMenuFocus({ pizzaId: pizza.id, token: Date.now() });
      flashAction("focus", { pizzaId: pizza.id, name: pizza.name });
      return pizza;
    },
    [catalog, flashAction, navigate]
  );

  const clearMenuFocus = useCallback(() => setMenuFocus(null), []);

  const applyCustomization = useCallback(
    (input = {}) => {
      if (input.cartItemId) {
        const item = cartApi.editItem(input.cartItemId, input);
        if (!item) return { error: `No cart item "${input.cartItemId}".` };
        return { ok: true, cartItem: item };
      }
      const pizza = catalog.findPizza(input.pizzaId);
      if (!pizza) {
        return { error: "Provide pizzaId or cartItemId to customize." };
      }
      const customization = customs.setDraft(pizza.id, input);
      const added =
        Array.isArray(input.addToppings) && input.addToppings.length
          ? input.addToppings[0]
          : Array.isArray(input.toppings) && input.toppings.length
            ? input.toppings[input.toppings.length - 1]
            : null;
      flashAction("customize", {
        pizzaId: pizza.id,
        name: pizza.name,
        size: input.size || customization.size,
        crust: input.crust || customization.crust,
        toppingId: added,
        addToppings: input.addToppings,
        toppings: input.toppings,
      });
      return {
        ok: true,
        pizzaId: pizza.id,
        customization,
        unitPrice: priceFor(pizza, customization),
      };
    },
    [cartApi, catalog, customs, flashAction]
  );

  const removeCustomization = useCallback(
    (input = {}) => {
      if (input.cartItemId) {
        if (input.reset) {
          const item = cartApi.getCart().find((c) => c.id === input.cartItemId);
          if (!item) return { error: `No cart item "${input.cartItemId}".` };
          const pizza = catalog.findPizza(item.pizzaId);
          const next = cartApi.editItem(input.cartItemId, {
            ...DEFAULT_CUSTOMIZATION,
            ...(pizza?.defaults || {}),
            toppings: pizza?.defaults?.toppings || [],
            notes: "",
          });
          return { ok: true, cartItem: next };
        }
        const patch = {};
        if (Array.isArray(input.toppings)) patch.removeToppings = input.toppings;
        if (input.clearNotes) patch.notes = "";
        const item = cartApi.editItem(input.cartItemId, patch);
        if (!item) return { error: `No cart item "${input.cartItemId}".` };
        return { ok: true, cartItem: item };
      }

      const pizza = catalog.findPizza(input.pizzaId);
      if (!pizza) return { error: "Provide pizzaId or cartItemId." };

      if (input.reset || (!input.toppings && !input.clearNotes)) {
        const customization = customs.resetDraft(pizza.id);
        return { ok: true, pizzaId: pizza.id, customization };
      }

      const patch = {};
      if (Array.isArray(input.toppings)) patch.removeToppings = input.toppings;
      if (input.clearNotes) patch.notes = "";
      const customization = customs.setDraft(pizza.id, patch);
      return { ok: true, pizzaId: pizza.id, customization };
    },
    [cartApi, catalog, customs]
  );

  const addToCart = useCallback(
    (input = {}) => {
      const pizza = catalog.findPizza(input.pizzaId);
      if (!pizza) return { error: `No pizza matched "${input.pizzaId}".` };

      let customization;
      if (input.useDraft) {
        customization = customs.getDraft(pizza.id);
      } else {
        customization = {
          ...customs.getDraft(pizza.id),
          ...(input.size ? { size: input.size } : {}),
          ...(input.crust ? { crust: input.crust } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(Array.isArray(input.toppings) ? { toppings: input.toppings } : {}),
        };
      }

      const cartItemId = cartApi.addItem(
        pizza.id,
        customization,
        input.quantity || 1
      );
      flashAction("add", { pizzaId: pizza.id, cartItemId, name: pizza.name });
      showToast(`${pizza.name} added to cart`);
      return {
        ok: true,
        cartItemId,
        pizzaId: pizza.id,
        name: pizza.name,
        quantity: Math.max(1, Number(input.quantity) || 1),
        unitPrice: priceFor(pizza, customization),
      };
    },
    [cartApi, catalog, customs, flashAction, showToast]
  );

  const editCartItem = useCallback(
    (input = {}) => {
      const item = cartApi.editItem(input.cartItemId, input);
      if (!item) return { error: `No cart item "${input.cartItemId}".` };
      return { ok: true, cartItem: item };
    },
    [cartApi]
  );

  const removeFromCart = useCallback(
    (cartItemId) => {
      const ok = cartApi.removeItem(cartItemId);
      if (!ok) return { error: `No cart item "${cartItemId}".` };
      flashAction("remove", { cartItemId });
      showToast("Removed from cart");
      return { ok: true, removed: cartItemId };
    },
    [cartApi, flashAction, showToast]
  );

  const go = useCallback(
    (page, pizzaId) => {
      const map = {
        home: "/",
        menu: "/",
        cart: "/cart",
      };
      if (page === "detail") {
        const pizza = catalog.findPizza(pizzaId);
        if (!pizza) return { error: `Need a valid pizzaId for detail.` };
        setMenuFocus(null);
        flashAction("focus", { pizzaId: pizza.id, name: pizza.name });
        navigate(`/pizza/${pizza.id}`);
        return { ok: true, page: "detail", pizzaId: pizza.id, path: `/pizza/${pizza.id}` };
      }
      if (page === "customize") {
        const pizza = catalog.findPizza(pizzaId);
        if (!pizza) return { error: `Need a valid pizzaId for customize.` };
        setMenuFocus(null);
        flashAction("focus", { pizzaId: pizza.id, name: pizza.name });
        navigate(`/customize/${pizza.id}`);
        return {
          ok: true,
          page: "customize",
          pizzaId: pizza.id,
          path: `/customize/${pizza.id}`,
        };
      }
      const path = map[page];
      if (!path) return { error: `Unknown page "${page}".` };
      navigate(path);
      return { ok: true, page, path };
    },
    [catalog, flashAction, navigate]
  );

  const api = useMemo(
    () => ({
      getPizzas: catalog.getPizzas,
      findPizza: catalog.findPizza,
      focusPizza,
      applyCustomization,
      removeCustomization,
      addToCart,
      getCart: cartApi.getCart,
      editCartItem,
      removeFromCart,
      navigate: go,
    }),
    [
      addToCart,
      applyCustomization,
      cartApi.getCart,
      catalog.findPizza,
      catalog.getPizzas,
      editCartItem,
      focusPizza,
      go,
      removeCustomization,
      removeFromCart,
    ]
  );

  const value = useMemo(
    () => ({
      pizzas: catalog.pizzas,
      cart: cartApi.cart,
      itemCount: cartApi.itemCount,
      toast,
      actionFlash,
      menuFocus,
      clearMenuFocus,
      showToast,
      focusPizza,
      findPizza: catalog.findPizza,
      getDraft: customs.getDraft,
      setDraft: customs.setDraft,
      resetDraft: customs.resetDraft,
      addToCart,
      editCartItem,
      removeFromCart,
      clearCart: cartApi.clear,
      applyCustomization,
      navigatePage: go,
      api,
    }),
    [
      actionFlash,
      addToCart,
      api,
      applyCustomization,
      cartApi.cart,
      cartApi.clear,
      cartApi.itemCount,
      catalog.findPizza,
      catalog.pizzas,
      clearMenuFocus,
      customs.getDraft,
      customs.resetDraft,
      customs.setDraft,
      editCartItem,
      focusPizza,
      go,
      menuFocus,
      removeFromCart,
      showToast,
      toast,
    ]
  );

  return (
    <PizzaContext.Provider value={value}>
      <PizzaWebMCPTools api={api} />
      {children}
    </PizzaContext.Provider>
  );
}

export function usePizzaApp() {
  const ctx = useContext(PizzaContext);
  if (!ctx) throw new Error("usePizzaApp must be used inside PizzaProvider");
  return ctx;
}
