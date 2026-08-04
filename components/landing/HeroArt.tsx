"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CerablusLogotype } from "@/components/brand/CerablusLogotype";
import type { MenuItem } from "@/lib/menu-types";

/* --------------------------------------------------------------------------
   Hero art panel
   --------------------------------------------------------------------------
   The green panel shows the Cerablus logo as a placeholder. When the menu
   carries real photography it becomes a slideshow of the café's featured items,
   pulled from the same menu as the rest of the page — so a photo uploaded in
   the admin (Step 6) appears here with no separate image list to maintain.

   Graceful degradation is the whole point: a slideshow needs at least two real
   photos, so with zero or one the panel stays EXACTLY as authored below. With
   today's photo-less data that is always the outcome. If an image 404s at
   runtime its slide is dropped, and if that takes the count below two the logo
   panel comes back.
   -------------------------------------------------------------------------- */

const HERO_INTERVAL_MS = 5000;
const HERO_MIN_SLIDES = 2; // fewer than this is not a slideshow — keep the logo

/** Western digits to Arabic-Indic, for aria-labels on an Arabic page. */
function toArabicDigits(value: number): string {
  return String(value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/**
 * `eligible` is already filtered by the server (featured + available + a real
 * image), so the landing page ships a handful of slide records rather than the
 * whole menu. Today that list is empty and the panel is the logo placeholder.
 */
export function HeroArt({ eligible }: { eligible: MenuItem[] }) {
  // Slides that 404 at runtime are dropped from this list; when it falls below
  // HERO_MIN_SLIDES the panel reverts to the logo.
  const [dropped, setDropped] = useState<ReadonlySet<string>>(() => new Set());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState({ hover: false, press: false, focus: false });

  const dotsRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef<number | null>(null);

  const slides = eligible.filter((item) => !dropped.has(item.id));
  const isSlideshow = slides.length >= HERO_MIN_SLIDES;
  const isPaused = paused.hover || paused.press || paused.focus;

  /* Clamp at render rather than correcting the stored index in an effect:
     dropping a broken slide shortens the list, and this keeps the active index
     in range on the very same render instead of one render later. */
  const active = slides.length > 0 ? index % slides.length : 0;

  const goTo = useCallback(
    (n: number) => {
      setIndex(() => {
        const length = slides.length;
        if (length === 0) return 0;
        return ((n % length) + length) % length;
      });
    },
    [slides.length],
  );

  // Auto-advance. Reduced motion means no auto-advance and no fade: the first
  // slide shows statically and the dots still work for manual navigation.
  useEffect(() => {
    if (!isSlideshow || isPaused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % slides.length),
      HERO_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [isSlideshow, isPaused, slides.length]);

  const focusActiveDot = useCallback(() => {
    const dots = dotsRef.current?.querySelectorAll<HTMLButtonElement>(".hero-dot");
    dots?.[active]?.focus();
  }, [active]);

  /* --- the logo placeholder: also the fallback the slideshow tears down to --- */
  if (!isSlideshow) {
    return (
      <div className="hero-art">
        <span className="dot" />
        <div className="logo-full">
          <CerablusLogotype />
        </div>
        <span className="badge">☕ محمّصة طازة</span>
      </div>
    );
  }

  return (
    <div
      className="hero-art is-slideshow"
      onMouseEnter={() => setPaused((p) => ({ ...p, hover: true }))}
      onMouseLeave={() => setPaused((p) => ({ ...p, hover: false }))}
      onFocus={() => setPaused((p) => ({ ...p, focus: true }))}
      onBlur={() => setPaused((p) => ({ ...p, focus: false }))}
      onTouchStart={(event) => {
        setPaused((p) => ({ ...p, press: true }));
        swipeStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        setPaused((p) => ({ ...p, press: false }));
        const start = swipeStartX.current;
        swipeStartX.current = null;
        if (start === null) return;
        const dx = (event.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) < 40) return; // ignore taps and tiny drags
        // RTL: a leftward swipe moves forward, a rightward swipe moves back.
        goTo(active + (dx < 0 ? 1 : -1));
      }}
      onKeyDown={(event) => {
        // RTL: dots run right-to-left, so ArrowLeft advances and ArrowRight goes back.
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goTo(active + 1);
          focusActiveDot();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goTo(active - 1);
          focusActiveDot();
        }
      }}
    >
      <div className="hero-slides">
        {slides.map((item, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            className={i === active ? "hero-slide is-active" : "hero-slide"}
            // Load only the current and the next image; the rest stay unloaded.
            src={i === active || i === (active + 1) % slides.length ? item.image : undefined}
            alt={item.name}
            decoding="async"
            onError={() =>
              setDropped((current) => new Set(current).add(item.id))
            }
          />
        ))}
      </div>

      <div className="hero-dots" ref={dotsRef} role="group" aria-label="شرائح الصور">
        {slides.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={i === active ? "hero-dot is-active" : "hero-dot"}
            aria-current={i === active}
            aria-label={`الشريحة ${toArabicDigits(i + 1)}`}
            // Roving tabindex: the dot group is one tab stop; arrows move within it.
            tabIndex={i === active ? 0 : -1}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      {/* The gold badge reads well over a photo (solid pill, high contrast), so
          it is kept. The faint decorative corner dot is not: a translucent
          circle over a photo looks like a lens smudge. */}
      <span className="badge">☕ محمّصة طازة</span>
    </div>
  );
}
