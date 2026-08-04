"use client";

import { useRef } from "react";

import { SearchIcon, CloseIcon } from "@/components/icons";
import type { MenuCategory } from "@/lib/menu-types";

/**
 * The sticky toolbar: live search plus the category chip row.
 *
 * الكل / الأكثر طلبًا / العروض are fixed; one chip per real category follows,
 * derived from the data so the row always matches the menu instead of a
 * hardcoded list. The row scrolls horizontally inside itself (see `.chip-row`)
 * — it never widens the page.
 */
export function MenuToolbar({
  categories,
  activeCat,
  onCatChange,
  query,
  onQueryChange,
}: {
  categories: MenuCategory[];
  activeCat: string;
  onCatChange: (cat: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const chips = [
    { cat: "all", label: "الكل" },
    { cat: "featured", label: "الأكثر طلبًا" },
    { cat: "offers", label: "العروض" },
    ...categories.map((category) => ({ cat: category.id, label: category.name })),
  ];

  return (
    <div className="toolbar">
      <div className="wrap">
        <div className="search" role="search">
          <label className="sr-only" htmlFor="searchInput">
            ابحث في المنيو
          </label>
          <SearchIcon />
          <input
            ref={inputRef}
            id="searchInput"
            type="search"
            placeholder="ابحث عن صنف…"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <button
            className="clear"
            type="button"
            aria-label="مسح البحث"
            hidden={query.length === 0}
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="chip-row" aria-label="أقسام المنيو">
          {chips.map((chip) => {
            const active = chip.cat === activeCat;
            return (
              <button
                key={chip.cat}
                type="button"
                className={active ? "chip is-active" : "chip"}
                aria-pressed={active}
                onClick={() => onCatChange(chip.cat)}
              >
                {chip.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
