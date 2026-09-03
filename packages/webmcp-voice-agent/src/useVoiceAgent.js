import { useCallback, useRef, useState } from "react";
import { getApiKey, setApiKey as persistApiKey } from "./apiKey.js";

/**
 * React hook that wraps a createWebMCPAgent() instance with conversation state.
 */
export function useVoiceAgent(agent) {
  const historyRef = useRef([]);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKeyState] = useState(() => getApiKey(agent.storageKey));

  const setApiKey = useCallback(
    (value) => {
      persistApiKey(value, agent.storageKey);
      setApiKeyState(value);
    },
    [agent.storageKey]
  );

  const resetConversation = useCallback(() => {
    historyRef.current = [];
  }, []);

  const ask = useCallback(
    async (question) => {
      if (!question.trim() || busy) return null;
      setBusy(true);
      try {
        return await agent.ask(question.trim(), historyRef.current, { apiKey });
      } finally {
        setBusy(false);
      }
    },
    [agent, apiKey, busy]
  );

  return {
    busy,
    apiKey,
    setApiKey,
    ask,
    resetConversation,
    hasKey: Boolean(apiKey),
  };
}
