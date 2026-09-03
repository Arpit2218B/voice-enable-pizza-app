import { PIZZA_TOOL_NAMES, PIZZA_TOOLS } from "../webmcp/toolDefs";
import { getModelContext, runModelTool } from "./modelContext";

const KEY_STORAGE = "forno_openai_api_key";
const DEFAULT_MODEL = "gpt-4o-mini";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const ALLOWED = new Set(PIZZA_TOOL_NAMES);

export function getOpenAiKey() {
  return (
    globalThis.OPENAI_API_KEY ||
    (typeof window !== "undefined" ? window.localStorage.getItem(KEY_STORAGE) : "") ||
    ""
  );
}

export function setOpenAiKey(value) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(KEY_STORAGE, value);
  else window.localStorage.removeItem(KEY_STORAGE);
}

function parseToolArgs(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function systemPrompt(toolNames) {
  return [
    "You are Forno, the voice assistant for a wood-fired pizza ordering site.",
    "Replies are spoken aloud — use short, natural sentences. No markdown, bullets, or long lists.",
    "",
    "TOOLS (one job each — chain them; never bundle navigation into other tools):",
    toolNames.join(", "),
    "",
    "=== LISTING / BROWSE ===",
    "Required tool chain for every menu / filter question:",
    "  1. Call list_pizzas (no args) — full menu only.",
    "  2. Decide matches yourself from name/blurb/description/category/vegetarian/spicy.",
    "  3. MUST call match_pizzas with pizzaIds = the matching ids (can be [], [one], or [several]).",
    "     - One id → app scrolls the carousel to that pizza.",
    "     - Several ids → no scroll; you then speak a short summary of those matches.",
    "     - Empty → say none matched.",
    "  4. Then speak. Do not call get_pizza during browse — match_pizzas handles focus.",
    "Examples:",
    "  \"sausage pizza\" → list_pizzas → match_pizzas pizzaIds:[\"sausage-fennel\"] → speak.",
    "  \"fungi options\" → list_pizzas → match_pizzas pizzaIds:[\"funghi\"] → speak.",
    "  \"non veg\" → list_pizzas → match_pizzas pizzaIds:[\"pepperoni-fire\",\"sausage-fennel\",...] → speak summary, no scroll.",
    "Call list_pizzas and match_pizzas at most once each per turn.",
    "Do NOT navigate to detail unless they ask to open the detail page.",
    "Do NOT add to cart during a browse-only question.",
    "",
    "=== ORDER (add to cart) ===",
    "Phrases like \"add [name]\", \"order [name]\", \"I want [name]\" mean add an existing menu pizza to the cart.",
    "Before ordering, call get_pizza or list_pizzas to confirm the pizza exists.",
    "If the pizza is NOT on the menu, say you cannot find it and offer list_pizzas results — customers cannot create new menu items.",
    "When the customer wants to order, NEVER call add_to_cart immediately.",
    "Step A — Confirm the pizza: use get_pizza or list_pizzas if the id/name is unclear.",
    "Step B — Ask out loud: \"Would you like to customize that — size, crust, or extra toppings — or add it as-is?\"",
    "  STOP and wait for their answer. Do not call add_to_cart or add_customization until they respond.",
    "Step C — If they want customization:",
    "  1. Call navigate page customize with pizzaId.",
    "  2. Call list_options if they need sizes/crusts/toppings explained.",
    "  3. Apply changes with add_customization (one or more calls as they specify).",
    "  4. Follow the CUSTOMIZATION flow below before adding to cart.",
    "Step D — If they want it as-is: call add_to_cart with pizzaId (useDraft false or defaults).",
    "Step E — Confirm briefly: \"Added [name] to your cart.\"",
    "",
    "=== CUSTOMIZATION (active session) ===",
    "While the customer is customizing a pizza:",
    "- Use add_customization to apply each change they request (size, crust, toppings, notes).",
    "- After each change, briefly confirm what you set — do not navigate away.",
    "- Do NOT call add_to_cart until they explicitly say they are done customizing.",
    "- Before adding to cart, ALWAYS ask: \"Are you done customizing? Should I add it to your cart?\"",
    "  WAIT for yes/no. Only call add_to_cart with useDraft true after they confirm.",
    "- If they want to change something else, keep customizing — do not add yet.",
    "- If they say done / add it / that's all → add_to_cart with pizzaId and useDraft true.",
    "",
    "=== NAVIGATION ===",
    "Call navigate ONLY when the customer asks to view, open, or go to a screen — or when a flow above requires it:",
    "  menu or home → navigate page menu",
    "  cart → navigate page cart (optionally view_cart afterward for totals)",
    "  pizza details → navigate page detail, pizzaId required",
    "  customize screen → navigate page customize, pizzaId required",
    "Do not call navigate for pure data questions if they did not ask to see a page.",
    "",
    "=== CART ===",
    "View cart: navigate page cart, then view_cart to read lines and total.",
    "Edit line: edit_cart_item or add_customization with cartItemId.",
    "Remove line: remove_from_cart with cartItemId.",
    "",
    "=== WHEN TO ASK vs WHEN TO ACT ===",
    "ASK and WAIT (one short question only, then stop):",
    "  - Before add_to_cart: customize or as-is?",
    "  - During customization: done? add to cart?",
    "  - Ambiguous pizza name or missing pizzaId for detail/customize",
    "ACT immediately (use tools, do not ask more questions):",
    "  - list_pizzas, get_pizza, view_cart, list_options for direct questions",
    "  - navigate when they ask to open a screen",
    "  - add_customization when they state a concrete size, crust, or topping",
    "  - add_to_cart only after customize/as-is is resolved",
    "",
    "=== GENERAL ===",
    "Do not repeat the same tool with identical arguments in one turn.",
    "After tool results, answer the customer — then stop unless another tool is clearly needed.",
  ].join("\n");
}

function parseInputSchema(schema) {
  if (!schema) return { type: "object", properties: {} };
  if (typeof schema === "string") {
    try {
      const parsed = JSON.parse(schema);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* fall through */
    }
  }
  if (typeof schema === "object") return schema;
  return { type: "object", properties: {} };
}

/** OpenAI tool defs from our pizza tool catalog (avoids stringified polyfill schemas). */
function fetchPizzaTools() {
  return PIZZA_TOOLS.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: parseInputSchema(tool.inputSchema),
    },
  }));
}

async function generate(messages, tools, apiKey, model = DEFAULT_MODEL) {
  if (!apiKey) throw new Error("Add an OpenAI API key in voice settings.");

  const body = { model, messages };
  if (tools.length) body.tools = tools;

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload.error?.message || `OpenAI request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

/**
 * Run a pizza-only tool loop against modelContext + OpenAI.
 * history is mutated across calls for conversation continuity.
 */
export async function askPizzaAgent(question, history, { apiKey = getOpenAiKey() } = {}) {
  const ctx = getModelContext();
  if (!ctx?.getTools || !ctx?.executeTool) {
    throw new Error("WebMCP modelContext is not available.");
  }

  const tools = fetchPizzaTools();
  if (!tools.length) {
    throw new Error("No Forno pizza tools are configured.");
  }

  const toolNames = tools.map((tool) => tool.function.name);
  const prompt = systemPrompt(toolNames);

  if (!history.length) {
    history.push({ role: "system", content: prompt });
  } else if (history[0]?.role === "system") {
    history[0].content = prompt;
  }

  history.push({ role: "user", content: question });

  const used = [];
  let listPizzasDone = false;
  let matchPizzasDone = false;
  let matchNudgeSent = false;
  let successfulGetPizza = 0;

  for (let round = 0; round < 8; round += 1) {
    const payload = await generate(history, tools, apiKey);
    const message = payload.choices?.[0]?.message;
    if (!message) return { text: "No response from OpenAI.", tools: used };

    const toolCalls = message.tool_calls || [];
    if (!toolCalls.length) {
      const reply =
        (message.content || "").trim() ||
        "I couldn't find an answer. Try asking about the menu or cart.";

      // Browse must finish with match_pizzas so single-match scroll runs in code.
      if (listPizzasDone && !matchPizzasDone && !matchNudgeSent) {
        matchNudgeSent = true;
        history.push({
          role: "user",
          content:
            "[System] You must call match_pizzas now with pizzaIds set to the matching pizza id(s) from list_pizzas before any spoken answer. Use [] if none match, one id if one matches, or several ids if several match.",
        });
        continue;
      }

      history.push({ role: "assistant", content: reply });
      return { text: reply, tools: used };
    }

    history.push({
      role: "assistant",
      content: message.content || null,
      tool_calls: toolCalls,
    });

    // Prefer list_pizzas before match_pizzas if the model batches them.
    const orderedCalls = [...toolCalls].sort((a, b) => {
      const rank = (name) => {
        if (name === "list_pizzas") return 0;
        if (name === "match_pizzas") return 1;
        return 2;
      };
      return rank(a.function?.name) - rank(b.function?.name);
    });

    for (const call of orderedCalls) {
      const name = call.function?.name;
      if (!ALLOWED.has(name)) {
        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: `Tool "${name}" is not allowed.` }),
        });
        continue;
      }

      const args = parseToolArgs(call.function?.arguments);

      if (name === "match_pizzas" && matchPizzasDone) {
        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            skipped: true,
            error: "match_pizzas already used this turn. Speak your answer now.",
          }),
        });
        used.push({ name, args, skipped: true });
        continue;
      }

      if (name === "get_pizza" && (matchPizzasDone || successfulGetPizza >= 1)) {
        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            skipped: true,
            error:
              "Skip get_pizza — browse focus is handled by match_pizzas, or get_pizza already succeeded.",
          }),
        });
        used.push({ name, args, skipped: true });
        continue;
      }

      const result = await runModelTool(name, args);
      used.push({ name, args });
      history.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });

      if (name === "list_pizzas") listPizzasDone = true;
      if (name === "match_pizzas" && !result?.error) matchPizzasDone = true;
      if (name === "get_pizza" && result && !result.error) successfulGetPizza += 1;
    }
  }

  return {
    text: "I couldn't finish that request. Please try again.",
    tools: used,
  };
}
