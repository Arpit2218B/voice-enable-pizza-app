# @webmcp/voice-agent

Plug-in voice agent for **WebMCP-powered React apps**.

- Speech input/output (Web Speech API)
- OpenAI chat completions with tool calling
- Executes tools via `document.modelContext` / `navigator.modelContext`
- Drop-in `VoiceAgent` UI component

## Install

```bash
npm install @webmcp/voice-agent
```

Peer dependencies: `react`, `react-dom`.

Your app must also use `@mcp-b/webmcp-polyfill` and `usewebmcp` to register tools.

## Usage

See the [root README](../../README.md) for a full integration guide.

```jsx
import { createWebMCPAgent, useVoiceAgent, VoiceAgent } from "@webmcp/voice-agent";
import "@webmcp/voice-agent/style.css";

const agent = createWebMCPAgent({
  allowedToolNames: ["my_tool"],
  toolDefs: [{ name: "my_tool", description: "…", inputSchema: { type: "object", properties: {} } }],
  getSystemPrompt: (names) => `Voice assistant. Tools: ${names.join(", ")}`,
});

function MyVoice() {
  const voice = useVoiceAgent(agent);
  return <VoiceAgent agent={voice} title="My App" />;
}
```

## Exports

- `createWebMCPAgent` — agent factory
- `useVoiceAgent` — React hook (history, API key, `ask`)
- `VoiceAgent` — UI component
- `useSpeechRecognition`, `useSpeechOutput`, `speak`
- `getModelContext`, `runModelTool`, `formatToolResultForOpenAI`
- `getApiKey`, `setApiKey`
