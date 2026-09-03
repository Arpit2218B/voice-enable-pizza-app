import { getApiKey } from "./apiKey.js";
import { getModelContext, runModelTool } from "./modelContext.js";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MAX_ROUNDS = 8;

function parseToolArgs(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
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

function toOpenAiTools(toolDefs) {
  return toolDefs.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: parseInputSchema(tool.inputSchema),
    },
  }));
}

async function generate(messages, tools, apiKey, endpoint, model) {
  if (!apiKey) throw new Error("Add an OpenAI API key in voice settings.");

  const body = { model, messages };
  if (tools.length) body.tools = tools;

  const response = await fetch(endpoint, {
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
 * Create a WebMCP voice agent that drives OpenAI tool calls against
 * document.modelContext (or navigator.modelContext).
 *
 * @param {object} config
 * @param {string[]|Set<string>} config.allowedToolNames - tool names the model may call
 * @param {Array<{name,description,inputSchema}>} [config.toolDefs] - OpenAI schemas; defaults to allowed names only
 * @param {(toolNames: string[]) => string} config.getSystemPrompt
 * @param {string} [config.storageKey] - localStorage key for API key
 * @param {string} [config.model]
 * @param {string} [config.endpoint]
 * @param {number} [config.maxRounds]
 * @param {(calls: object[]) => object[]} [config.sortToolCalls]
 * @param {(ctx: object) => { skip?: boolean, result?: object }} [config.beforeToolCall]
 * @param {(ctx: object) => void} [config.afterToolCall]
 * @param {(ctx: object) => { continue?: boolean, nudge?: string }} [config.beforeFinalReply]
 */
export function createWebMCPAgent(config) {
  const {
    allowedToolNames,
    toolDefs,
    getSystemPrompt,
    storageKey,
    model = DEFAULT_MODEL,
    endpoint = DEFAULT_ENDPOINT,
    maxRounds = DEFAULT_MAX_ROUNDS,
    sortToolCalls,
    beforeToolCall,
    afterToolCall,
    beforeFinalReply,
  } = config;

  const allowed = allowedToolNames instanceof Set
    ? allowedToolNames
    : new Set(allowedToolNames);

  const openAiToolDefs = toolDefs?.length
    ? toolDefs.filter((tool) => allowed.has(tool.name))
    : [...allowed].map((name) => ({
        name,
        description: `WebMCP tool: ${name}`,
        inputSchema: { type: "object", properties: {} },
      }));

  const openAiTools = toOpenAiTools(openAiToolDefs);

  async function ask(question, history, { apiKey = getApiKey(storageKey) } = {}) {
    const ctx = getModelContext();
    if (!ctx?.getTools || !ctx?.executeTool) {
      throw new Error("WebMCP modelContext is not available.");
    }

    if (!openAiTools.length) {
      throw new Error("No WebMCP tools are configured for this agent.");
    }

    const toolNames = openAiTools.map((tool) => tool.function.name);
    const prompt = getSystemPrompt(toolNames);

    if (!history.length) {
      history.push({ role: "system", content: prompt });
    } else if (history[0]?.role === "system") {
      history[0].content = prompt;
    }

    history.push({ role: "user", content: question });

    const used = [];
    const turnState = {};

    for (let round = 0; round < maxRounds; round += 1) {
      const payload = await generate(history, openAiTools, apiKey, endpoint, model);
      const message = payload.choices?.[0]?.message;
      if (!message) return { text: "No response from OpenAI.", tools: used };

      const toolCalls = message.tool_calls || [];
      if (!toolCalls.length) {
        const reply =
          (message.content || "").trim() ||
          "I couldn't find an answer. Try asking again.";

        if (beforeFinalReply) {
          const decision = beforeFinalReply({ history, turnState, reply });
          if (decision?.nudge) {
            history.push({ role: "user", content: decision.nudge });
            if (decision.continue !== false) continue;
          }
        }

        history.push({ role: "assistant", content: reply });
        return { text: reply, tools: used };
      }

      history.push({
        role: "assistant",
        content: message.content || null,
        tool_calls: toolCalls,
      });

      const orderedCalls = sortToolCalls
        ? sortToolCalls(toolCalls, turnState)
        : toolCalls;

      for (const call of orderedCalls) {
        const name = call.function?.name;
        if (!allowed.has(name)) {
          history.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Tool "${name}" is not allowed.` }),
          });
          continue;
        }

        const args = parseToolArgs(call.function?.arguments);

        if (beforeToolCall) {
          const guard = beforeToolCall({ name, args, turnState, call });
          if (guard?.skip) {
            history.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(
                guard.result ?? { skipped: true, error: "Tool call skipped." }
              ),
            });
            used.push({ name, args, skipped: true });
            continue;
          }
        }

        const result = await runModelTool(name, args);
        used.push({ name, args });
        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });

        if (afterToolCall) {
          afterToolCall({ name, args, result, turnState });
        }
      }
    }

    return {
      text: "I couldn't finish that request. Please try again.",
      tools: used,
    };
  }

  return {
    ask,
    allowedToolNames: allowed,
    toolNames: openAiTools.map((tool) => tool.function.name),
    storageKey,
  };
}
