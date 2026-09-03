export const SIZES = [
  { id: "sm", label: "Small (10\")", priceDelta: 0 },
  { id: "md", label: "Medium (12\")", priceDelta: 3 },
  { id: "lg", label: "Large (14\")", priceDelta: 6 },
];

export const CRUSTS = [
  { id: "classic", label: "Classic", priceDelta: 0 },
  { id: "thin", label: "Thin & crisp", priceDelta: 0 },
  { id: "stuffed", label: "Cheese-stuffed", priceDelta: 2.5 },
  { id: "gluten-free", label: "Gluten-free", priceDelta: 3 },
];

export const TOPPINGS = [
  { id: "mozzarella", label: "Extra mozzarella", price: 1.5 },
  { id: "basil", label: "Fresh basil", price: 0.75 },
  { id: "mushroom", label: "Mushrooms", price: 1.25 },
  { id: "pepperoni", label: "Pepperoni", price: 1.75 },
  { id: "olive", label: "Black olives", price: 1 },
  { id: "jalapeno", label: "Jalapeños", price: 1 },
  { id: "onion", label: "Red onion", price: 0.75 },
  { id: "sausage", label: "Italian sausage", price: 2 },
];

export const DEFAULT_CUSTOMIZATION = {
  size: "md",
  crust: "classic",
  toppings: [],
  notes: "",
};

export const INITIAL_PIZZAS = [
  {
    id: "margherita",
    name: "Margherita",
    category: "Classic",
    blurb: "San Marzano tomato, fior di latte, basil, and olive oil.",
    description:
      "The Neapolitan standard: bright tomato, milky mozzarella, and torn basil finished with a thread of oil.",
    price: 14,
    spicy: false,
    vegetarian: true,
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&h=900&q=80",
    defaults: { size: "md", crust: "classic", toppings: ["basil"] },
  },
  {
    id: "pepperoni-fire",
    name: "Pepperoni Fire",
    category: "Classic",
    blurb: "Cupped pepperoni, hot honey, and smoked mozzarella.",
    description:
      "Crisp cups of pepperoni with a drizzle of hot honey over smoked mozzarella and tomato.",
    price: 17,
    spicy: true,
    vegetarian: false,
    image:
      "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=1200&h=900&q=80",
    defaults: { size: "md", crust: "classic", toppings: ["pepperoni", "jalapeno"] },
  },
  {
    id: "funghi",
    name: "Funghi Forest",
    category: "Seasonal",
    blurb: "Roasted mushrooms, thyme, garlic oil, and pecorino.",
    description:
      "A mix of roasted cremini and oyster mushrooms with garlic oil, thyme, and shaved pecorino.",
    price: 16,
    spicy: false,
    vegetarian: true,
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&h=900&q=80",
    defaults: { size: "md", crust: "thin", toppings: ["mushroom"] },
  },
  {
    id: "sausage-fennel",
    name: "Sausage & Fennel",
    category: "House",
    blurb: "Fennel sausage, caramelized onion, and chili flake.",
    description:
      "House fennel sausage with sweet onion, chili flake, and a stretch of mozzarella.",
    price: 18,
    spicy: true,
    vegetarian: false,
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&h=900&q=80",
    defaults: { size: "lg", crust: "classic", toppings: ["sausage", "onion"] },
  },
  {
    id: "bianca",
    name: "Bianca Verde",
    category: "White",
    blurb: "Ricotta, mozzarella, garlic, and lemon zest — no tomato.",
    description:
      "A white pie with whipped ricotta, mozzarella, roasted garlic, and lemon zest.",
    price: 15,
    spicy: false,
    vegetarian: true,
    image:
      "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=1200&h=900&q=80",
    defaults: { size: "md", crust: "thin", toppings: ["mozzarella", "basil"] },
  },
  {
    id: "olive-garden",
    name: "Olive Garden",
    category: "House",
    blurb: "Black olives, red onion, oregano, and tomato.",
    description:
      "Briny olives and red onion over tomato with dried oregano and olive oil.",
    price: 15.5,
    spicy: false,
    vegetarian: true,
    image:
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=1200&h=900&q=80",
    defaults: { size: "md", crust: "classic", toppings: ["olive", "onion"] },
  },
];

export function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

export function priceFor(pizza, customization = DEFAULT_CUSTOMIZATION) {
  if (!pizza) return 0;
  const size = SIZES.find((s) => s.id === customization.size) || SIZES[1];
  const crust = CRUSTS.find((c) => c.id === customization.crust) || CRUSTS[0];
  const toppingTotal = (customization.toppings || []).reduce((sum, id) => {
    const topping = TOPPINGS.find((t) => t.id === id);
    return sum + (topping ? topping.price : 0);
  }, 0);
  return pizza.price + size.priceDelta + crust.priceDelta + toppingTotal;
}

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
