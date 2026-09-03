import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePizzaApp } from "../context/PizzaContext";
import { usePizzaAgent } from "../hooks/usePizzaAgent";
import { useSpeechOutput, useSpeechRecognition } from "../hooks/useSpeech";
import "./VoiceAgent.css";

function VoiceOrb({ mode }) {
  return (
    <div className={`forno-orb forno-orb--${mode}`} aria-hidden="true">
      <span className="forno-orb__glow" />
      <span className="forno-orb__ring forno-orb__ring--a" />
      <span className="forno-orb__ring forno-orb__ring--b" />
      <span className="forno-orb__ring forno-orb__ring--c" />
      <span className="forno-orb__core">
        <span className="forno-orb__blob forno-orb__blob--1" />
        <span className="forno-orb__blob forno-orb__blob--2" />
        <span className="forno-orb__blob forno-orb__blob--3" />
        <span className="forno-orb__shine" />
      </span>
      <span className="forno-orb__wave">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

export function VoiceAgent({ listingMode = false }) {
  const { showToast, itemCount, actionFlash } = usePizzaApp();
  const { busy, apiKey, setApiKey, ask, resetConversation, hasKey } = usePizzaAgent();
  const { speaking, say, stop: stopSpeaking } = useSpeechOutput();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [caption, setCaption] = useState("");
  const location = useLocation();
  const dockRef = useRef(null);

  const live = listingMode || open;

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
        showToast(message);
        if (/api key/i.test(message)) setSettingsOpen(true);
      } finally {
        setStatus("idle");
      }
    },
    [ask, say, showToast, stopSpeaking]
  );

  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    onFinal: handleTurn,
    onError: (error) => {
      if (error.message !== "aborted") {
        setCaption(error.message);
        showToast(error.message);
      }
      setStatus("idle");
    },
  });

  useEffect(() => {
    document.body.classList.toggle("forno-voice-live", live);
    document.body.classList.toggle("forno-listing", listingMode);
    if (!live) {
      setDockHeight(0);
    }
    return () => {
      document.body.classList.remove("forno-voice-live");
      document.body.classList.remove("forno-listing");
      setDockHeight(0);
    };
  }, [live, listingMode, setDockHeight]);

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
    if (!live || !actionFlash?.pizzaId) return;
    const stage = document.querySelector(".app-stage");
    if (!stage) return;
    stage.classList.add("is-action-flash");
    const clear = window.setTimeout(() => stage.classList.remove("is-action-flash"), 700);
    // Carousel scroll is owned by MenuPage via menuFocus (handles navigate timing).
    return () => window.clearTimeout(clear);
  }, [actionFlash, live]);

  useEffect(() => {
    if (!live || listingMode) return;
    const stage = document.querySelector(".app-stage");
    if (!stage) return;
    stage.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, live, listingMode]);

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
      showToast("Add your OpenAI API key first.");
      return;
    }
    if (!supported) {
      showToast("Voice input needs Chrome or Edge with speech recognition.");
      return;
    }
    setCaption("");
    setStatus("listening");
    start();
  }

  const liveCaption = interim || caption;

  const speakBar = (
    <section
      ref={dockRef}
      className={`forno-voice-canvas${listingMode ? " forno-voice-canvas--listing" : ""}`}
      aria-label="Forno voice"
    >
      <div className="forno-voice-canvas__wash" aria-hidden="true" />
      <div className="forno-voice-canvas__bloom" aria-hidden="true" />

      {listingMode ? null : (
        <header className="forno-voice-canvas__chrome">
          <div className="forno-voice-canvas__meta">
            <span className="forno-voice-canvas__pulse" aria-hidden="true" />
            <span>Forno</span>
            {itemCount > 0 ? <span className="forno-voice-canvas__cart">{itemCount} in cart</span> : null}
          </div>
          <div className="forno-voice-canvas__actions">
            <button
              type="button"
              className="forno-voice-icon-btn"
              aria-label="Settings"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              ⚙
            </button>
            <button
              type="button"
              className="forno-voice-icon-btn"
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
        <div className="forno-voice-settings">
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
          <div className="forno-voice-settings-actions">
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

      <div className="forno-voice-canvas__orb-zone">
        <button
          className={`forno-voice-orb-btn forno-voice-orb-btn--${orbMode}`}
          type="button"
          aria-label={micLabel}
          disabled={busy && !listening}
          onClick={toggleMic}
        >
          <VoiceOrb mode={orbMode} />
        </button>
        <div className="forno-voice-canvas__copy">
          <p className={`forno-voice-status forno-voice-status--${orbMode}`}>{micLabel}</p>
          {liveCaption ? <p className="forno-voice-caption">{liveCaption}</p> : null}
        </div>
        {listingMode ? (
          <div className="forno-voice-canvas__side">
            {location.pathname === "/cart" ? (
              <Link className="forno-voice-cart-link" to="/">
                Menu
              </Link>
            ) : (
              <Link className="forno-voice-cart-link" to="/cart">
                Cart{itemCount > 0 ? ` · ${itemCount}` : ""}
              </Link>
            )}
            <button
              type="button"
              className="forno-voice-icon-btn"
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
    <div className={`forno-voice-agent${live ? " is-open" : ""}${listingMode ? " is-listing" : ""}`}>
      {listingMode ? (
        speakBar
      ) : !open ? (
        <button
          className="forno-voice-launcher"
          type="button"
          onClick={() => {
            setOpen(true);
            setCaption("");
            if (!hasKey) setSettingsOpen(true);
          }}
          aria-label="Open Forno voice"
        >
          <VoiceOrb mode="idle" />
          <span className="forno-voice-launcher__hint">Talk</span>
        </button>
      ) : (
        speakBar
      )}
    </div>
  );
}
