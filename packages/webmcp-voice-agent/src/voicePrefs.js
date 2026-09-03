const DEFAULT_STORAGE_KEY = "webmcp_voice_agent_voice";
export const DEFAULT_OPENAI_VOICE = "nova";

/** OpenAI TTS voices — nova and shimmer sound the most natural for assistants. */
export const OPENAI_VOICES = [
  { id: "nova", label: "Nova (warm)" },
  { id: "shimmer", label: "Shimmer (bright)" },
  { id: "alloy", label: "Alloy (neutral)" },
  { id: "echo", label: "Echo (male)" },
  { id: "fable", label: "Fable (expressive)" },
  { id: "onyx", label: "Onyx (deep)" },
];

export function getVoicePreference(storageKey = DEFAULT_STORAGE_KEY) {
  if (typeof window === "undefined") return DEFAULT_OPENAI_VOICE;
  return window.localStorage.getItem(storageKey) || DEFAULT_OPENAI_VOICE;
}

export function setVoicePreference(value, storageKey = DEFAULT_STORAGE_KEY) {
  if (typeof window === "undefined") return;
  const voice = value || DEFAULT_OPENAI_VOICE;
  window.localStorage.setItem(storageKey, voice);
}
