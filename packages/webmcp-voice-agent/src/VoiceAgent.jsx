import { useCallback, useEffect, useRef, useState } from "react";
import { SPEECH_SOFT_ERRORS, useSpeechOutput, useSpeechRecognition } from "./useSpeech.js";
import {
  getVoicePreference,
  OPENAI_VOICES,
  setVoicePreference,
} from "./voicePrefs.js";
import "./VoiceAgent.css";

export const DEFAULT_BODY_CLASSES = {
  live: "wva-live",
  listing: "wva-listing",
};

function VoiceOrb({ mode }) {
  return (
    <div className={`wva-orb wva-orb--${mode}`} aria-hidden="true">
      <span className="wva-orb__glow" />
      <span className="wva-orb__ring wva-orb__ring--a" />
      <span className="wva-orb__ring wva-orb__ring--b" />
      <span className="wva-orb__ring wva-orb__ring--c" />
      <span className="wva-orb__core">
        <span className="wva-orb__blob wva-orb__blob--1" />
        <span className="wva-orb__blob wva-orb__blob--2" />
        <span className="wva-orb__blob wva-orb__blob--3" />
        <span className="wva-orb__shine" />
      </span>
      <span className="wva-orb__wave">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

/**
 * Drop-in voice UI for WebMCP apps. Pair with useVoiceAgent(createWebMCPAgent(...)).
 */
export function VoiceAgent({
  agent,
  title = "Voice",
  listingMode = false,
  onNotify,
  renderBadge,
  renderListingSide,
  launcherLabel = "Talk",
  stageSelector = ".app-stage",
  actionSignal,
  bodyClassNames = DEFAULT_BODY_CLASSES,
  scrollKey,
}) {
  const { busy, apiKey, setApiKey, ask, resetConversation, hasKey } = agent;
  const [voice, setVoice] = useState(() => getVoicePreference());
  const { speaking, say, stop: stopSpeaking } = useSpeechOutput({ apiKey, voice });
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [caption, setCaption] = useState("");
  const dockRef = useRef(null);

  const live = listingMode || open;
  const liveClass = bodyClassNames.live ?? DEFAULT_BODY_CLASSES.live;
  const listingClass = bodyClassNames.listing ?? DEFAULT_BODY_CLASSES.listing;

  const notify = useCallback(
    (message) => {
      if (message) onNotify?.(message);
    },
    [onNotify]
  );

  const setDockHeight = useCallback((px) => {
    document.documentElement.style.setProperty(
      "--voice-dock-h",
      `${Math.max(0, Math.round(px))}px`
    );
  }, []);

  const handleTurn = useCallback(
    async (question) => {
      if (!question.trim()) return;
      setCaption(question);
      setStatus("thinking");
      stopSpeaking();

      try {
        const result = await ask(question);
        if (!result) return;
        setCaption(result.text);
        setStatus("speaking");
        await say(result.text);
        setCaption("");
      } catch (error) {
        const message = error?.message || "Something went wrong.";
        setCaption(message);
        notify(message);
        if (/api key/i.test(message)) setSettingsOpen(true);
      } finally {
        setStatus("idle");
      }
    },
    [ask, notify, say, stopSpeaking]
  );

  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    onFinal: handleTurn,
    onError: (error) => {
      const code = error.message || "";
      if (code === "aborted" || code === "interrupted") {
        setStatus("idle");
        return;
      }
      if (SPEECH_SOFT_ERRORS.has(code)) {
        setCaption(
          error.heardAudio
            ? "Didn't catch that — tap to try again."
            : "No mic audio detected. Check browser mic permission and input device, then tap to retry."
        );
        setStatus("idle");
        return;
      }
      setCaption(code);
      notify(code);
      setStatus("idle");
    },
  });

  useEffect(() => {
    document.body.classList.toggle(liveClass, live);
    document.body.classList.toggle(listingClass, listingMode);
    if (!live) {
      setDockHeight(0);
    }
    return () => {
      document.body.classList.remove(liveClass);
      document.body.classList.remove(listingClass);
      setDockHeight(0);
    };
  }, [live, listingClass, listingMode, liveClass, setDockHeight]);

  useEffect(() => {
    if (!live || !dockRef.current) return undefined;
    const node = dockRef.current;
    const sync = () => {
      const top = node.getBoundingClientRect().top;
      setDockHeight(Math.max(120, window.innerHeight - top));
    };
    sync();
    const raf = window.requestAnimationFrame(sync);
    const settle = window.setTimeout(sync, 80);
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    window.addEventListener("resize", sync);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [live, listingMode, settingsOpen, setDockHeight]);

  useEffect(() => {
    if (!live || !actionSignal) return;
    const stage = document.querySelector(stageSelector);
    if (!stage) return;
    stage.classList.add("is-action-flash");
    const clear = window.setTimeout(() => stage.classList.remove("is-action-flash"), 700);
    return () => window.clearTimeout(clear);
  }, [actionSignal, live, stageSelector]);

  useEffect(() => {
    if (!live || listingMode || scrollKey === undefined) return;
    const stage = document.querySelector(stageSelector);
    if (!stage) return;
    stage.scrollTo({ top: 0, behavior: "smooth" });
  }, [live, listingMode, scrollKey, stageSelector]);

  useEffect(() => {
    if (!live || listingMode) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      stop();
      stopSpeaking();
      setStatus("idle");
      setCaption("");
      setSettingsOpen(false);
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, listingMode, stop, stopSpeaking]);

  const orbMode = listening
    ? "listening"
    : status === "thinking"
      ? "thinking"
      : speaking
        ? "speaking"
        : "idle";

  const micLabel = listening
    ? "Listening"
    : status === "thinking"
      ? "Thinking"
      : speaking
        ? "Speaking"
        : "Tap to talk";

  function toggleMic() {
    if (busy || speaking) return;
    if (listening) {
      stop();
      setStatus("idle");
      return;
    }
    if (!hasKey) {
      setSettingsOpen(true);
      notify("Add your OpenAI API key first.");
      return;
    }
    if (!supported) {
      notify("Voice input needs Chrome or Edge with speech recognition.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      notify("Microphone needs HTTPS or localhost.");
      return;
    }
    setCaption("");
    setStatus("listening");
    start();
  }

  const liveCaption = interim || caption;
  const badge = renderBadge?.();

  const speakBar = (
    <section
      ref={dockRef}
      className={`wva-voice-canvas${listingMode ? " wva-voice-canvas--listing" : ""}`}
      aria-label={`${title} voice`}
    >
      <div className="wva-voice-canvas__wash" aria-hidden="true" />
      <div className="wva-voice-canvas__bloom" aria-hidden="true" />

      {listingMode ? null : (
        <header className="wva-voice-canvas__chrome">
          <div className="wva-voice-canvas__meta">
            <span className="wva-voice-canvas__pulse" aria-hidden="true" />
            <span>{title}</span>
            {badge ? <span className="wva-voice-canvas__cart">{badge}</span> : null}
          </div>
          <div className="wva-voice-canvas__actions">
            <button
              type="button"
              className="wva-voice-icon-btn"
              aria-label="Settings"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              ⚙
            </button>
            <button
              type="button"
              className="wva-voice-icon-btn"
              aria-label="Close voice"
              onClick={() => {
                stop();
                stopSpeaking();
                setStatus("idle");
                setCaption("");
                setSettingsOpen(false);
                setOpen(false);
              }}
            >
              ✕
            </button>
          </div>
        </header>
      )}

      {settingsOpen ? (
        <div className="wva-voice-settings">
          <label>
            OpenAI API key
            <input
              type="password"
              value={apiKey}
              placeholder="sk-…"
              autoComplete="off"
              onChange={(event) => setApiKey(event.target.value.trim())}
            />
          </label>
          <label>
            Voice
            <select
              value={voice}
              onChange={(event) => {
                const next = event.target.value;
                setVoice(next);
                setVoicePreference(next);
              }}
            >
              {OPENAI_VOICES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="wva-voice-settings-actions">
            <button
              type="button"
              onClick={() => {
                resetConversation();
                setCaption("");
              }}
            >
              Reset
            </button>
            <button type="button" className="primary" onClick={() => setSettingsOpen(false)}>
              Done
            </button>
          </div>
        </div>
      ) : null}

      <div className="wva-voice-canvas__orb-zone">
        <button
          className={`wva-voice-orb-btn wva-voice-orb-btn--${orbMode}`}
          type="button"
          aria-label={micLabel}
          disabled={busy && !listening}
          onClick={toggleMic}
        >
          <VoiceOrb mode={orbMode} />
        </button>
        <div className="wva-voice-canvas__copy">
          <p className={`wva-voice-status wva-voice-status--${orbMode}`}>{micLabel}</p>
          {liveCaption ? <p className="wva-voice-caption">{liveCaption}</p> : null}
        </div>
        {listingMode ? (
          <div className="wva-voice-canvas__side">
            {renderListingSide?.()}
            <button
              type="button"
              className="wva-voice-icon-btn"
              aria-label="Settings"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              ⚙
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );

  return (
    <div className={`wva-voice-agent${live ? " is-open" : ""}${listingMode ? " is-listing" : ""}`}>
      {listingMode ? (
        speakBar
      ) : !open ? (
        <button
          className="wva-voice-launcher"
          type="button"
          onClick={() => {
            setOpen(true);
            setCaption("");
            if (!hasKey) setSettingsOpen(true);
          }}
          aria-label={`Open ${title} voice`}
        >
          <VoiceOrb mode="idle" />
          <span className="wva-voice-launcher__hint">{launcherLabel}</span>
        </button>
      ) : (
        speakBar
      )}
    </div>
  );
}
