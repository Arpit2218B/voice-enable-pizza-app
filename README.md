# Forno Pizza + WebMCP Voice Agent

A demo pizza ordering app with WebMCP tools, split into two decoupled parts:

| Part | Location | Role |
|------|----------|------|
| **Voice agent** | `packages/webmcp-voice-agent` | Reusable React package — speech UI, OpenAI tool loop, WebMCP `modelContext` bridge |
| **Pizza app** | `src/` | Menu, cart, WebMCP tools, and pizza-specific agent prompts |

Anyone building a WebMCP-powered React app can install `@webmcp/voice-agent`, register their tools with `usewebmcp`, and plug in voice navigation.

## Quick start

```bash
npm install
npm run dev
```

Initialize the WebMCP polyfill (already in `src/main.jsx`), register your tools, then mount `VoiceAgent`.

## Pizza app integration

```jsx
// src/agent/pizzaAgent.js — app-specific prompts + tool guards
import { createWebMCPAgent } from "@webmcp/voice-agent";
import { PIZZA_TOOL_NAMES, PIZZA_TOOLS } from "../webmcp/toolDefs";

export const pizzaAgent = createWebMCPAgent({
  storageKey: "forno_openai_api_key",
  allowedToolNames: PIZZA_TOOL_NAMES,
  toolDefs: PIZZA_TOOLS,
  getSystemPrompt: (toolNames) => `You are Forno… Tools: ${toolNames.join(", ")}`,
  // optional: sortToolCalls, beforeToolCall, afterToolCall, beforeFinalReply
});
```

```jsx
// src/components/PizzaVoiceAgent.jsx — thin wrapper
import { VoiceAgent, useVoiceAgent } from "@webmcp/voice-agent";
import "@webmcp/voice-agent/style.css";
import { pizzaAgent } from "../agent/pizzaAgent";

export function PizzaVoiceAgent(props) {
  const agent = useVoiceAgent(pizzaAgent);
  return <VoiceAgent agent={agent} title="Forno" {...props} />;
}
```

WebMCP tools live in `src/webmcp/` and are registered inside `PizzaProvider` via `PizzaWebMCPTools`.

## Plug voice agent into your own React + WebMCP app

1. **Install** (from this monorepo: `"@webmcp/voice-agent": "workspace:*"`, or copy `packages/webmcp-voice-agent`).

2. **Polyfill** — in your entry file:

   ```js
   import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
   initializeWebMCPPolyfill();
   ```

3. **Register tools** with `usewebmcp` so they appear on `document.modelContext`.

4. **Create an agent**:

   ```js
   import { createWebMCPAgent } from "@webmcp/voice-agent";

   export const myAgent = createWebMCPAgent({
     allowedToolNames: ["navigate", "search", "add_item"],
     toolDefs: MY_TOOLS, // same shapes as usewebmcp tool configs
     getSystemPrompt: (names) =>
       `You are a voice assistant. Use tools: ${names.join(", ")}. Keep replies short for speech.`,
   });
   ```

5. **Mount the UI**:

   ```jsx
   import { VoiceAgent, useVoiceAgent } from "@webmcp/voice-agent";
   import "@webmcp/voice-agent/style.css";

   function App() {
     const agent = useVoiceAgent(myAgent);
     return (
       <>
         <YourApp />
         <VoiceAgent agent={agent} title="My App" onNotify={console.log} />
       </>
     );
   }
   ```

### `createWebMCPAgent` options

| Option | Description |
|--------|-------------|
| `allowedToolNames` | Whitelist of tool names the model may call |
| `toolDefs` | OpenAI function schemas (`name`, `description`, `inputSchema`) |
| `getSystemPrompt(toolNames)` | System message builder |
| `storageKey` | `localStorage` key for OpenAI API key (default: `webmcp_voice_agent_api_key`) |
| `sortToolCalls` | Reorder parallel tool calls in a turn |
| `beforeToolCall` | Return `{ skip: true, result }` to block a call |
| `afterToolCall` | Track per-turn state after each tool runs |
| `beforeFinalReply` | Return `{ nudge, continue }` to force another model round |

### `VoiceAgent` props

| Prop | Description |
|------|-------------|
| `agent` | Return value of `useVoiceAgent(...)` |
| `title` | Shown in the voice chrome |
| `listingMode` | Docked bottom bar (e.g. menu-first layouts) |
| `onNotify` | Toast / error callback |
| `renderBadge` | Optional header badge (e.g. cart count) |
| `renderListingSide` | Extra controls in listing mode (links, etc.) |
| `bodyClassNames` | CSS hooks for layout (`live`, `listing`) |
| `actionSignal` | Changing value flashes `stageSelector` (tool side-effects) |
| `scrollKey` | e.g. route pathname — scrolls stage on change |

## Project layout

```
packages/webmcp-voice-agent/   # @webmcp/voice-agent package
src/
  agent/pizzaAgent.js          # Pizza prompts + tool-loop guards
  webmcp/                      # Pizza WebMCP tool definitions
  components/PizzaVoiceAgent.jsx
  pages/ …                     # Pizza UI
```

## License

MIT
