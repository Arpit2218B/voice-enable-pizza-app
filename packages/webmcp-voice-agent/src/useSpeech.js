import { useCallback, useEffect, useRef, useState } from "react";

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** Benign Web Speech errors — safe to show inline, not as a blocking toast. */
export const SPEECH_SOFT_ERRORS = new Set(["no-speech"]);

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

    window.speechSynthesis?.cancel();

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

export function speak(text, { rate = 1, pitch = 1, onEnd, onError } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onError?.(new Error("Speech synthesis is not supported."));
    return () => {};
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
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

export function useSpeechOutput() {
  const [speaking, setSpeaking] = useState(false);
  const cancelRef = useRef(() => {});

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
