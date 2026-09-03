import { useCallback, useRef, useState } from "react";
import { askPizzaAgent, getOpenAiKey, setOpenAiKey } from "../agent/pizzaAgent";

export function usePizzaAgent() {
  const historyRef = useRef([]);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKeyState] = useState(() => getOpenAiKey());

  const setApiKey = useCallback((value) => {
    setOpenAiKey(value);
    setApiKeyState(value);
  }, []);

  const resetConversation = useCallback(() => {
    historyRef.current = [];
  }, []);

  const ask = useCallback(
    async (question) => {
      if (!question.trim() || busy) return null;
      setBusy(true);
      try {
        return await askPizzaAgent(question.trim(), historyRef.current, { apiKey });
      } finally {
        setBusy(false);
      }
    },
    [apiKey, busy]
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
