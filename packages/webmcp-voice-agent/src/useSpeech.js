import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_OPENAI_VOICE } from "./voicePrefs.js";

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** Benign Web Speech errors — safe to show inline, not as a blocking toast. */
export const SPEECH_SOFT_ERRORS = new Set(["no-speech"]);

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const BROWSER_VOICE_PATTERNS = [
  /Samantha/i,
  /Karen/i,
  /Daniel/i,
  /Google US English/i,
  /Microsoft .* Natural/i,
  /Enhanced/i,
  /Premium/i,
  /Neural/i,
];

let activeAudio = null;
let activeBlobUrl = null;
let activeAbort = null;

function stopActivePlayback() {
  activeAbort?.();
  activeAbort = null;

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }

  if (activeBlobUrl) {
    URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
  }

  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }
}

function pickBrowserVoice(voices, lang = "en") {
  const matches = voices.filter((voice) => voice.lang?.toLowerCase().startsWith(lang));
  for (const pattern of BROWSER_VOICE_PATTERNS) {
    const match = matches.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }
  const cloud = matches.find((voice) => !voice.localService);
  if (cloud) return cloud;
  return matches[0] || voices[0] || null;
}

function loadBrowserVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }

  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const finish = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.onvoiceschanged = finish;
    window.setTimeout(finish, 300);
  });
}

async function warmUpMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getAudioTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.name || "denied", message: error?.message };
  }
}

export function useSpeechRecognition({ onFinal, onError, lang = "en-US" } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef(null);
  const stoppedByUserRef = useRef(false);
  const sessionRef = useRef(0);
  const noSpeechRetriesRef = useRef(0);
  const pendingStartRef = useRef(false);
  const retryPendingRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);

  onFinalRef.current = onFinal;
  onErrorRef.current = onError;

  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    pendingStartRef.current = false;
    noSpeechRetriesRef.current = 0;
    sessionRef.current += 1;
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const beginRecognition = useCallback(
    (session) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor || session !== sessionRef.current) return;

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const isCurrent = () => session === sessionRef.current;
      let finalized = false;
      const pipeline = { audio: false, sound: false, speech: false };

      recognition.onstart = () => {
        if (!isCurrent()) return;
        retryPendingRef.current = false;
        setListening(true);
        setInterim("");
      };

      recognition.onaudiostart = () => {
        if (!isCurrent()) return;
        pipeline.audio = true;
      };

      recognition.onsoundstart = () => {
        if (!isCurrent()) return;
        pipeline.sound = true;
      };

      recognition.onspeechstart = () => {
        if (!isCurrent()) return;
        pipeline.speech = true;
      };

      recognition.onresult = (event) => {
        if (!isCurrent()) return;
        let draft = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) finalText += chunk;
          else draft += chunk;
        }
        setInterim(draft || finalText);
        if (finalText.trim() && !finalized) {
          finalized = true;
          noSpeechRetriesRef.current = 0;
          onFinalRef.current?.(finalText.trim());
          try {
            recognition.stop();
          } catch {
            /* ignore */
          }
        }
      };

      recognition.onerror = (event) => {
        if (!isCurrent()) return;
        const code = event.error || "unknown";

        if (code === "aborted" || code === "interrupted") {
          setListening(false);
          return;
        }

        if (code === "no-speech") {
          if (
            !stoppedByUserRef.current &&
            !finalized &&
            noSpeechRetriesRef.current < 1 &&
            !pipeline.audio
          ) {
            noSpeechRetriesRef.current += 1;
            retryPendingRef.current = true;
            window.setTimeout(() => {
              if (!isCurrent() || stoppedByUserRef.current) {
                retryPendingRef.current = false;
                return;
              }
              try {
                recognitionRef.current?.abort();
              } catch {
                /* ignore */
              }
              beginRecognition(session);
            }, 250);
            return;
          }

          setListening(false);
          if (!stoppedByUserRef.current) {
            const err = new Error("no-speech");
            err.heardAudio = pipeline.audio || pipeline.sound || pipeline.speech;
            onErrorRef.current?.(err);
          }
          return;
        }

        if (code === "not-allowed") {
          setListening(false);
          onErrorRef.current?.(
            new Error("Microphone access was denied. Allow the mic in browser settings.")
          );
          return;
        }

        onErrorRef.current?.(new Error(code));
        setListening(false);
      };

      recognition.onend = () => {
        if (!isCurrent()) return;
        if (retryPendingRef.current) return;
        if (!finalized && !stoppedByUserRef.current && pendingStartRef.current) {
          return;
        }
        setListening(false);
        setInterim("");
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
      } catch (error) {
        setListening(false);
        pendingStartRef.current = false;
        onErrorRef.current?.(
          new Error(error?.message || "Could not start speech recognition.")
        );
      }
    },
    [lang]
  );

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.(
        new Error("Speech recognition is not supported in this browser.")
      );
      return;
    }

    if (!window.isSecureContext) {
      onErrorRef.current?.(
        new Error("Microphone needs HTTPS or localhost. Open the app on a secure origin.")
      );
      return;
    }

    stopActivePlayback();

    const prev = recognitionRef.current;
    if (prev) {
      try {
        prev.abort();
      } catch {
        /* ignore */
      }
    }

    stoppedByUserRef.current = false;
    pendingStartRef.current = true;
    noSpeechRetriesRef.current = 0;

    const session = sessionRef.current + 1;
    sessionRef.current = session;

    (async () => {
      const mic = await warmUpMicrophone();
      if (session !== sessionRef.current || stoppedByUserRef.current) return;

      if (!mic.ok) {
        pendingStartRef.current = false;
        const message =
          mic.reason === "NotAllowedError" || mic.reason === "denied"
            ? "Microphone access was denied. Allow the mic in browser settings."
            : "Could not access the microphone.";
        onErrorRef.current?.(new Error(message));
        return;
      }

      beginRecognition(session);
    })();
  }, [beginRecognition]);

  useEffect(
    () => () => {
      sessionRef.current += 1;
      pendingStartRef.current = false;
      recognitionRef.current?.abort();
    },
    []
  );

  return { supported, listening, interim, start, stop };
}

function speakBrowser(text, { rate = 0.94, pitch = 1.02, voice, onEnd, onError } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onError?.(new Error("Speech synthesis is not supported."));
    return () => {};
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = (event) => {
    if (event.error === "interrupted" || event.error === "canceled") {
      onEnd?.();
      return;
    }
    onError?.(new Error(event.error || "Speech failed"));
  };
  window.speechSynthesis.speak(utterance);

  return () => window.speechSynthesis.cancel();
}

async function speakOpenAI(text, { apiKey, voice = DEFAULT_OPENAI_VOICE, onEnd, onError }) {
  const controller = new AbortController();
  activeAbort = () => controller.abort();

  const response = await fetch(OPENAI_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      speed: 1,
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || `OpenAI TTS failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  activeBlobUrl = url;

  const audio = new Audio(url);
  activeAudio = audio;
  activeAbort = null;

  await new Promise((resolve, reject) => {
    const cleanup = () => {
      if (activeBlobUrl === url) {
        URL.revokeObjectURL(url);
        activeBlobUrl = null;
      }
      if (activeAudio === audio) activeAudio = null;
    };

    audio.onended = () => {
      cleanup();
      onEnd?.();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      const error = new Error("Audio playback failed.");
      onError?.(error);
      reject(error);
    };
    audio.play().catch((error) => {
      cleanup();
      onError?.(error);
      reject(error);
    });
  });
}

/**
 * Speak text using OpenAI TTS when an API key is available, otherwise browser TTS.
 */
export function speak(
  text,
  {
    apiKey,
    voice = DEFAULT_OPENAI_VOICE,
    engine = "auto",
    rate,
    pitch,
    onEnd,
    onError,
  } = {}
) {
  stopActivePlayback();

  const trimmed = text?.trim();
  if (!trimmed) {
    onEnd?.();
    return () => {};
  }

  const useOpenAI = engine === "openai" || (engine === "auto" && Boolean(apiKey));
  let cancelled = false;

  const finish = () => {
    if (!cancelled) onEnd?.();
  };

  const fail = (error) => {
    if (!cancelled) onError?.(error);
  };

  if (useOpenAI && apiKey) {
    speakOpenAI(trimmed, { apiKey, voice, onEnd: finish, onError: fail }).catch(async (error) => {
      if (cancelled || error?.name === "AbortError") {
        finish();
        return;
      }

      try {
        const voices = await loadBrowserVoices();
        const browserVoice = pickBrowserVoice(voices);
        speakBrowser(trimmed, {
          rate,
          pitch,
          voice: browserVoice,
          onEnd: finish,
          onError: fail,
        });
      } catch (fallbackError) {
        fail(fallbackError);
      }
    });
  } else {
    loadBrowserVoices()
      .then((voices) => {
        if (cancelled) return;
        const browserVoice = pickBrowserVoice(voices);
        speakBrowser(trimmed, {
          rate,
          pitch,
          voice: browserVoice,
          onEnd: finish,
          onError: fail,
        });
      })
      .catch((error) => fail(error));
  }

  return () => {
    cancelled = true;
    stopActivePlayback();
  };
}

export function useSpeechOutput({ apiKey, voice = DEFAULT_OPENAI_VOICE } = {}) {
  const [speaking, setSpeaking] = useState(false);
  const cancelRef = useRef(() => {});
  const apiKeyRef = useRef(apiKey);
  const voiceRef = useRef(voice);

  apiKeyRef.current = apiKey;
  voiceRef.current = voice;

  const stop = useCallback(() => {
    cancelRef.current();
    setSpeaking(false);
  }, []);

  const say = useCallback(
    (text) =>
      new Promise((resolve, reject) => {
        stop();
        setSpeaking(true);
        cancelRef.current = speak(text, {
          apiKey: apiKeyRef.current,
          voice: voiceRef.current,
          onEnd: () => {
            setSpeaking(false);
            resolve();
          },
          onError: (error) => {
            setSpeaking(false);
            reject(error);
          },
        });
      }),
    [stop]
  );

  useEffect(() => () => stop(), [stop]);

  return { speaking, say, stop };
}
