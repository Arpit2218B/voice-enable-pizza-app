export function getModelContext() {
  const doc = typeof document !== "undefined" ? document : null;
  const nav = typeof navigator !== "undefined" ? navigator : null;
  return (doc && doc.modelContext) || (nav && nav.modelContext) || null;
}

/** Turn polyfill / MCP tool output into plain JSON for OpenAI tool messages. */
export function formatToolResultForOpenAI(result) {
  if (result == null) return { result: null };

  let value = result;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { text: value };
    }
  }

  if (typeof value !== "object") return { result: value };

  if (value.isError) {
    const message =
      value.content?.find?.((part) => part.type === "text")?.text ||
      "Tool returned an error.";
    return { error: message };
  }

  if (value.structuredContent !== undefined) {
    return value.structuredContent;
  }

  if (Array.isArray(value.content)) {
    const text = value.content
      .map((part) => (part?.type === "text" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return { text };
      }
    }
  }

  return value;
}

export async function runModelTool(name, args) {
  const ctx = getModelContext();
  if (!ctx || typeof ctx.executeTool !== "function") {
    return { error: "WebMCP modelContext.executeTool is not available." };
  }

  try {
    let toolRef = null;
    if (typeof ctx.getTools === "function") {
      const tools = await ctx.getTools();
      toolRef = tools.find((tool) => tool.name === name) || null;
    }

    if (!toolRef) {
      return { error: `Tool "${name}" is not registered.` };
    }

    const raw = await ctx.executeTool(toolRef, JSON.stringify(args || {}));
    return formatToolResultForOpenAI(raw);
  } catch (error) {
    const message = error?.message || String(error);
    return { error: message };
  }
}
