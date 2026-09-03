import { useCallback, useEffect, useRef, useState } from "react";

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({ onFinal, onError, lang = "en-US" } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);

  onFinalRef.current = onFinal;
  onErrorRef.current = onError;

  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.(new Error("Speech recognition is not supported in this browser."));
      return;
    }

    window.speechSynthesis?.cancel();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setInterim("");
    };

    recognition.onresult = (event) => {
      let draft = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += chunk;
        else draft += chunk;
      }
      setInterim(draft || finalText);
      if (finalText.trim()) onFinalRef.current?.(finalText.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "interrupted") {
        setListening(false);
        return;
      }
      onErrorRef.current?.(new Error(event.error || "Speech recognition failed"));
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

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
