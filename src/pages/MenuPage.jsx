import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "../data/pizzas";
import { usePizzaApp } from "../context/PizzaContext";

function scrollCarouselToId(track, pizzaId, behavior = "smooth") {
  if (!track || !pizzaId) return false;
  const slide = track.querySelector(`[data-webmcp-item-id="${pizzaId}"]`);
  if (!slide) return false;

  // Prefer native centering — more reliable with snap + padding than offset math.
  if (typeof slide.scrollIntoView === "function") {
    slide.scrollIntoView({ behavior, inline: "center", block: "nearest" });
  }

  const trackRect = track.getBoundingClientRect();
  const slideRect = slide.getBoundingClientRect();
  const left =
    track.scrollLeft +
    (slideRect.left - trackRect.left) -
    (trackRect.width - slideRect.width) / 2;
  track.scrollTo({ left: Math.max(0, left), behavior });
  return true;
}

function CarouselSlide({ pizza, active }) {
  return (
    <article
      className={`pizza-slide${active ? " is-focused" : ""}`}
      data-webmcp-item="true"
      data-webmcp-item-id={pizza.id}
    >
      <img className="pizza-slide__img" src={pizza.image} alt="" loading="lazy" />
      <div className="pizza-slide__scrim" aria-hidden="true" />
      <div className="pizza-slide__body">
        <p className="pizza-slide__price" data-webmcp-field="price">
          {money(pizza.price)}
        </p>
        <h2 className="pizza-slide__title" data-webmcp-field="name">
          {pizza.name}
        </h2>
        <p className="pizza-slide__copy" data-webmcp-field="description">
          {pizza.blurb}
        </p>
        <p className="pizza-slide__prompt" data-webmcp-field="category">
          Say “Tell me about the {pizza.name}”
        </p>
      </div>
    </article>
  );
}

export function MenuPage() {
  const { pizzas, menuFocus, clearMenuFocus } = usePizzaApp();
  const [activeId, setActiveId] = useState(null);
  const trackRef = useRef(null);
  const list = useMemo(() => pizzas, [pizzas]);

  useEffect(() => {
    if (!list.length) return;
    if (!activeId || !list.some((p) => p.id === activeId)) {
      setActiveId(list[0].id);
    }
  }, [list, activeId]);

  useEffect(() => {
    const pizzaId = menuFocus?.pizzaId;
    if (!pizzaId) return undefined;
    if (!list.some((p) => p.id === pizzaId)) return undefined;

    setActiveId(pizzaId);

    let cancelled = false;
    let attempts = 0;
    let raf = 0;
    const timers = [];

    const tryScroll = () => {
      if (cancelled) return;
      const track = trackRef.current;
      const ok = scrollCarouselToId(track, pizzaId, attempts === 0 ? "auto" : "smooth");
      if (ok) {
        timers.push(
          window.setTimeout(() => {
            if (!cancelled) scrollCarouselToId(trackRef.current, pizzaId, "smooth");
          }, 120)
        );
        timers.push(
          window.setTimeout(() => {
            if (!cancelled) clearMenuFocus?.();
          }, 900)
        );
        return;
      }
      attempts += 1;
      if (attempts < 40) {
        raf = window.requestAnimationFrame(tryScroll);
      }
    };

    // Wait a frame so route navigation can mount the carousel.
    raf = window.requestAnimationFrame(tryScroll);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [menuFocus, list, clearMenuFocus]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const onScroll = () => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = null;
      let bestDist = Infinity;
      track.querySelectorAll("[data-webmcp-item-id]").forEach((node) => {
        const center = node.offsetLeft + node.clientWidth / 2;
        const dist = Math.abs(center - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = node.getAttribute("data-webmcp-item-id");
        }
      });
      if (best) setActiveId(best);
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [list.length]);

  return (
    <main className="listing-screen">
      <div
        className="pizza-carousel"
        ref={trackRef}
        data-webmcp-listing="true"
        aria-label="Pizza carousel"
      >
        {list.map((pizza) => (
          <CarouselSlide key={pizza.id} pizza={pizza} active={activeId === pizza.id} />
        ))}
      </div>
    </main>
  );
}
