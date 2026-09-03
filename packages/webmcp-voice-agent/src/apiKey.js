const DEFAULT_STORAGE_KEY = "webmcp_voice_agent_api_key";

export function getApiKey(storageKey = DEFAULT_STORAGE_KEY) {
  return (
    globalThis.OPENAI_API_KEY ||
    (typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : "") ||
    ""
  );
}

export function setApiKey(value, storageKey = DEFAULT_STORAGE_KEY) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(storageKey, value);
  else window.localStorage.removeItem(storageKey);
}
