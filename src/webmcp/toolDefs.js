import { SIZES, CRUSTS, TOPPINGS, priceFor } from "../data/pizzas";

function serializePizza(pizza) {
  if (!pizza) return null;
  return {
    id: pizza.id,
    name: pizza.name,
    category: pizza.category,
    blurb: pizza.blurb,
    description: pizza.description,
    price: pizza.price,
    spicy: pizza.spicy,
    vegetarian: pizza.vegetarian,
    defaults: pizza.defaults,
    image: pizza.image,
  };
}

function serializeCartItem(item, pizzas) {
  const pizza = pizzas.find((p) => p.id === item.pizzaId);
  return {
    cartItemId: item.id,
    pizzaId: item.pizzaId,
    name: pizza ? pizza.name : item.pizzaId,
    quantity: item.quantity,
    customization: item.customization,
    unitPrice: pizza ? priceFor(pizza, item.customization) : 0,
    lineTotal: pizza ? priceFor(pizza, item.customization) * item.quantity : 0,
  };
}

/** Tool configs for usewebmcp — execute receives live api via ref in PizzaWebMCPTools */
export const PIZZA_TOOL_NAMES = [
  "list_pizzas",
  "match_pizzas",
  "get_pizza",
  "add_customization",
  "edit_customization",
  "remove_customization",
  "add_to_cart",
  "view_cart",
  "edit_cart_item",
  "remove_from_cart",
  "navigate",
  "list_options",
];

export const PIZZA_TOOLS = [
  {
    name: "list_pizzas",
    description:
      "Return the COMPLETE pizza menu only — never filters. After this, you MUST call match_pizzas with the pizza id(s) that match the customer.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: { readOnlyHint: true },
    execute: (api) => {
      const list = api.getPizzas().map(serializePizza);
      api.navigate?.("menu");
      return {
        count: list.length,
        pizzas: list,
        pizzaIds: list.map((p) => p.id),
        instruction:
          "Next you MUST call match_pizzas with pizzaIds set to every matching id (use ids from pizzaIds). One id → UI scrolls. Multiple ids → no scroll. Empty array if none match.",
      };
    },
  },
  {
    name: "match_pizzas",
    description:
      "REQUIRED after list_pizzas. Pass the pizza id(s) that match the customer. Exactly one id scrolls the menu carousel to that pizza. Multiple ids return those pizzas without scrolling. Empty array if none match.",
    inputSchema: {
      type: "object",
      properties: {
        pizzaIds: {
          type: "array",
          items: { type: "string" },
          description: "Matching pizza ids from list_pizzas (0, 1, or many).",
        },
      },
      required: ["pizzaIds"],
    },
    annotations: { readOnlyHint: true },
    execute: (api, input = {}) => {
      const raw = Array.isArray(input.pizzaIds) ? input.pizzaIds : [];
      const seen = new Set();
      const matched = [];
      for (const id of raw) {
        const pizza = api.findPizza(id);
        if (!pizza || seen.has(pizza.id)) continue;
        seen.add(pizza.id);
        matched.push(serializePizza(pizza));
      }

      if (matched.length === 1) {
        api.focusPizza?.(matched[0].id);
      } else {
        api.navigate?.("menu");
      }

      return {
        count: matched.length,
        pizzas: matched,
        focused: matched.length === 1 ? matched[0].id : null,
        scrolled: matched.length === 1,
      };
    },
  },
  {
    name: "get_pizza",
    description:
      "Load one pizza by id or name and scroll the menu to it. Prefer match_pizzas after list_pizzas for browse questions. Use get_pizza when confirming a specific pie during ordering.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Pizza id or exact/partial name from the menu." },
      },
      required: ["id"],
    },
    annotations: { readOnlyHint: true },
    execute: (api, input = {}) => {
      const pizza = api.findPizza(input.id);
      if (!pizza) return { error: `No pizza matched "${input.id}".` };
      api.focusPizza?.(pizza.id);
      return serializePizza(pizza);
    },
  },
  {
    name: "add_customization",
    description:
      "Set size, crust, toppings, or notes on a pizza before adding to cart, or update a cart line. Pass pizzaId for draft customization, or cartItemId to edit a cart line.",
    inputSchema: {
      type: "object",
      properties: {
        pizzaId: { type: "string", description: "Menu pizza to customize (draft)." },
        cartItemId: { type: "string", description: "Existing cart line to update." },
        size: { type: "string", enum: SIZES.map((s) => s.id) },
        crust: { type: "string", enum: CRUSTS.map((c) => c.id) },
        toppings: {
          type: "array",
          items: { type: "string", enum: TOPPINGS.map((t) => t.id) },
        },
        addToppings: {
          type: "array",
          items: { type: "string" },
          description: "Topping ids to add without replacing the full list.",
        },
        removeToppings: {
          type: "array",
          items: { type: "string" },
          description: "Topping ids to remove.",
        },
        notes: { type: "string" },
      },
    },
    annotations: { readOnlyHint: false },
    execute: (api, input = {}) => api.applyCustomization(input),
  },
  {
    name: "edit_customization",
    description: "Alias of add_customization for editing size, crust, toppings, or notes.",
    inputSchema: {
      type: "object",
      properties: {
        pizzaId: { type: "string" },
        cartItemId: { type: "string" },
        size: { type: "string" },
        crust: { type: "string" },
        toppings: { type: "array", items: { type: "string" } },
        addToppings: { type: "array", items: { type: "string" } },
        removeToppings: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
    },
    annotations: { readOnlyHint: false },
    execute: (api, input = {}) => api.applyCustomization(input),
  },
  {
    name: "remove_customization",
    description:
      "Clear draft customization for a pizza, or remove specific toppings/notes from a cart line.",
    inputSchema: {
      type: "object",
      properties: {
        pizzaId: { type: "string" },
        cartItemId: { type: "string" },
        toppings: {
          type: "array",
          items: { type: "string" },
          description: "If set, only remove these toppings.",
        },
        clearNotes: { type: "boolean" },
        reset: {
          type: "boolean",
          description: "Reset to pizza defaults (draft) or clear extras on cart line.",
        },
      },
    },
    annotations: { readOnlyHint: false },
    execute: (api, input = {}) => api.removeCustomization(input),
  },
  {
    name: "add_to_cart",
    description: "Add a menu pizza to the shopping cart with optional customization.",
    inputSchema: {
      type: "object",
      properties: {
        pizzaId: { type: "string", description: "Pizza id or name." },
        quantity: { type: "integer", minimum: 1 },
        size: { type: "string" },
        crust: { type: "string" },
        toppings: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
        useDraft: {
          type: "boolean",
          description: "If true, use the current draft customization for this pizza.",
        },
      },
      required: ["pizzaId"],
    },
    annotations: { readOnlyHint: false },
    execute: (api, input = {}) => api.addToCart(input),
  },
  {
    name: "view_cart",
    description: "Return cart lines, quantities, and totals.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: (api) => {
      const cart = api.getCart();
      const pizzas = api.getPizzas();
      const items = cart.map((item) => serializeCartItem(item, pizzas));
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      return {
        count: items.length,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
        items,
      };
    },
  },
  {
    name: "edit_cart_item",
    description: "Change quantity or customization on a cart line.",
    inputSchema: {
      type: "object",
      properties: {
        cartItemId: { type: "string" },
        quantity: { type: "integer", minimum: 1 },
        size: { type: "string" },
        crust: { type: "string" },
        toppings: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      required: ["cartItemId"],
    },
    annotations: { readOnlyHint: false },
    execute: (api, input = {}) => api.editCartItem(input),
  },
  {
    name: "remove_from_cart",
    description: "Remove a cart line by cartItemId.",
    inputSchema: {
      type: "object",
      properties: { cartItemId: { type: "string" } },
      required: ["cartItemId"],
    },
    annotations: { readOnlyHint: false },
    execute: (api, input = {}) => api.removeFromCart(input.cartItemId),
  },
  {
    name: "navigate",
    description:
      "Navigate to menu, cart, pizza detail (pizzaId required), or customize screen (pizzaId required).",
    inputSchema: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: ["menu", "cart", "detail", "customize", "home"],
        },
        pizzaId: { type: "string", description: "Required for detail and customize." },
      },
      required: ["page"],
    },
    annotations: { readOnlyHint: false },
    execute: (api, input = {}) => api.navigate(input.page, input.pizzaId),
  },
  {
    name: "list_options",
    description: "List available sizes, crusts, and toppings for customization.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => ({ sizes: SIZES, crusts: CRUSTS, toppings: TOPPINGS }),
  },
];
