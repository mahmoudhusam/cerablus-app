/* ==========================================================================
   Cerablus Coffee — menu engine
   Rendering, search, cart, WhatsApp ordering and Google Sheet loading.

   BOTH PAGES LOAD THIS FILE. menu.html has the full application; index.html
   only has the landing page's preview row, and none of the menu chrome. So
   every piece of wiring below looks its elements up and returns quietly when
   they are absent — a missing #menuBody, #catNav, cart drawer or search box is
   a normal page, not an error.
   ========================================================================== */

const CONFIG = {
  /* Placeholder — the café's real number lands at Step 8b. Digits only, no +.
     This constant is NOT the only occurrence: every page also ships a hardcoded
     wa.me href as its no-JS fallback. All of them must change together, and
     CLAUDE.md ("WhatsApp number — every occurrence") lists them. */
  PHONE: "970590000000",

  /* The client's Google Sheet, published to the web as CSV. Empty until Step 8b:
     while it is empty the site never touches the network and simply renders the
     copy baked into data/menu.js. */
  SHEET_CSV_URL: "",

  // Give up on a slow sheet rather than leaving the menu stale-but-loading.
  SHEET_TIMEOUT_MS: 5000,

  /* A published sheet that parses to almost nothing is far more likely to be
     broken than to be the real menu, so treat it as a failure and keep the
     baked-in copy. */
  SHEET_MIN_ITEMS: 3
};

/* --------------------------------------------------------------------------
   Missing image photos
   --------------------------------------------------------------------------
   Menu content will eventually come from a Google Sheet edited by a
   non-technical person, so image filenames will sometimes be missing, renamed
   or misspelled. Hiding a failed image reveals the branded placeholder styled
   in .card .top::after, so a customer never sees a broken-image icon.
   -------------------------------------------------------------------------- */

const MISSING_IMAGE_CLASS = "is-missing";

/** Hide a single image that could not be loaded. */
function markImageMissing(img) {
  if (img instanceof HTMLImageElement) img.classList.add(MISSING_IMAGE_CLASS);
}

// Load errors do not bubble, so listen during the capture phase to catch them
// from any image on the page — including lazy ones that load much later.
window.addEventListener(
  "error",
  (event) => {
    if (event.target instanceof HTMLImageElement) markImageMissing(event.target);
  },
  true
);

/**
 * Catch images that already failed before this script ran. A finished image
 * with zero intrinsic width is one the browser could not decode.
 */
function sweepBrokenImages() {
  document.querySelectorAll("img").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) markImageMissing(img);
  });
}

/* --------------------------------------------------------------------------
   Arabic-aware text normalization
   --------------------------------------------------------------------------
   Real customers type without diacritics and spell alef/ya/ta-marbuta however
   they please ("قهوه" for "قهوة"). Both the query and the searched text run
   through the same normalizer so those spellings all collapse to one form.
   -------------------------------------------------------------------------- */

// Harakat, the dagger alef and tatweel. Escapes, not literals: these are
// invisible or bidi-reordering characters that no editor renders reliably.
const TASHKEEL_AND_TATWEEL = /[\u064B-\u065F\u0670\u0640]/g;

/** Fold an Arabic/Latin string down to a spelling-insensitive search key. */
function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(TASHKEEL_AND_TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/* --------------------------------------------------------------------------
   Menu model
   -------------------------------------------------------------------------- */

// Current view state. Filtering is derived from this on every render.
const state = {
  cat: "all",   // "all" | "featured" | a category id
  query: ""
};

/* The menu, read once in init() and held here. Building it normalizes every
   item's search key, so re-reading it per render would do that work on every
   keystroke and defeat the cache. Step 7 reassigns this after the Google Sheet
   loads and calls render() again. */
let menu = null;

/**
 * Put a raw menu object — from data/menu.js or from the sheet parser — into the
 * shape the renderer wants. Both sources go through here, so the sheet can
 * never produce a menu the renderer treats differently.
 */
function decorateMenu(raw) {
  const source = raw || {};
  const items = Array.isArray(source.items) ? source.items : [];
  return {
    currency: source.currency || "ل.س",
    categories: Array.isArray(source.categories) ? source.categories : [],
    // Cache the search key once instead of normalizing on every keystroke.
    items: items.map((item) => ({
      ...item,
      searchKey: normalize(`${item.name || ""} ${item.desc || ""}`)
    }))
  };
}

/* ===== DEMO PLACEHOLDER IMAGES — remove this whole block before the client adds real photos =====
   Branch demo/client-menu-syp ONLY. Fills every image:"" item with a
   category-appropriate stock photo AT RUNTIME so the preview looks full, WITHOUT
   downloading files or editing data/menu.js. Photos are hotlinked from the
   Unsplash CDN (images.unsplash.com) — fast and reliable; each id below was
   checked returning 200 at authoring time. The item id picks one photo from its
   category's pool, so the choice is stable per item but varies within a category
   (24 iced drinks don't share one photo). If a URL ever fails to load, the
   existing image-error handler reveals the branded placeholder — untouched, and
   lazy-loading is unchanged too. It hooks the one funnel every menu passes
   through (decorateMenu), so cards, the landing preview and hero eligibility all
   pick it up. Self-contained: delete this block and every card returns to the
   placeholder, with zero other changes. */
(function () {
  const U = (id) => `https://images.unsplash.com/photo-${id}?w=600&h=400&fit=crop&q=70`;

  // Verified-live Unsplash photo pools (200 image/jpeg at authoring time).
  const COFFEE = ["1509042239860-f550ce710b93", "1447933601403-0c6688de566e", "1461023058943-07fcbe16d735", "1495474472287-4d71bcdd2085", "1442512595331-e89e73853f31", "1497515114629-f71d768fd07c", "1514432324607-a09d9b4aefdd", "1521302080334-4bebac2763a6", "1509785307050-d4066910ec1e"];
  const BEANS = ["1497935586351-b67a49e012bf", "1524350876685-274059332603", "1559056199-641a0ac8b55e"];
  const TEA = ["1544787219-7f47ccb76574", "1571934811356-5cc061b6821f", "1597318181409-cf64d0b5d8a2", "1558160074-4d7d8bdf4256", "1576092768241-dec231879fc3"];
  const ICED = ["1517701550927-30cf4ba1dba5"].concat(COFFEE);
  const JUICE = ["1546171753-97d7676e4602", "1600271886742-f049cd451bba", "1613478223719-2ab802602423", "1560508180-03f285f67ded"];
  const COCKTAIL = ["1514362545857-3bc16c4c7d1b", "1536935338788-846bb9981813", "1544145945-f90425340c7e", "1551024709-8f23befc6f87"];
  const SMOOTHIE = ["1553530666-ba11a7da3888", "1502741224143-90386d7f8c82", "1553787499-6f9133860278", "1505252585461-04db1eb84625", "1568901839119-631418a3910d"];
  const DESSERT = ["1551024601-bec78aea704b", "1578985545062-69928b1d9587", "1565958011703-44f9829ba187", "1488477181946-6428a0291777", "1563729784474-d77dbb933a9e"];
  const WAFFLE = ["1519915028121-7d3463d20b13", "1562376552-0d160a2f238d", "1504754524776-8f4f37790ca0", "1567620905732-2d1ec7ab7445"];
  const FRUIT = ["1490474418585-ba9bad8fd0ea", "1564093497595-593b96d80180", "1519996529931-28324d5a630e"];
  const KUNAFA = ["1519676867240-f03562e64548", "1541599468348-e96984315921", "1505253716362-afaea1d3d1af", "1578985545062-69928b1d9587"];

  // 16 real category ids -> themed pool (by category MEANING).
  const POOLS = {
    "القهوه-الساخنه": COFFEE,                 // hot coffee
    "القهوه-العربيه-والتركيه": COFFEE,         // arabic / turkish coffee
    "خلطات-القهوه-الساخنه": COFFEE,            // hot coffee blends
    "مشروبات-الكافيين-الساخنه": COFFEE,        // hot caffeine drinks
    "الشاي-والمشروبات-الساخنه": TEA,           // tea & hot drinks
    "ايس-كافيين": ICED,                        // iced coffee
    "موهيتو-وعصاير": JUICE.concat(COCKTAIL),   // mojito & juices
    "كوكتيلات": COCKTAIL,                      // cocktails (mocktails)
    "سموزي-وميلك-شيك": SMOOTHIE,               // smoothie & milkshake
    "الحلويات-البارده": DESSERT,               // cold desserts
    "كريب-وافل-بان-كيك": WAFFLE,               // crepe / waffle / pancake
    "سلطه-فواكه": FRUIT,                       // fruit salad
    "قهوه-بن-ومنتجات-جاهزه": BEANS.concat(COFFEE), // coffee beans & packaged
    "الكنافه-العربيه": KUNAFA,                 // arabic kunafa
    "الكنافه-التركيه": KUNAFA,                 // turkish kunafa
    "كنافه-جرابلس-سبيشيال": KUNAFA             // jarablus special kunafa
  };
  const DEFAULT_POOL = COFFEE.concat(DESSERT); // unknown category → still on-brand

  // Stable hash so an item always maps to the same photo across reloads.
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }
  function demoImage(item) {
    const pool = POOLS[item.cat] || DEFAULT_POOL;
    return U(pool[hash(item.id || item.name || "x") % pool.length]);
  }

  const original = decorateMenu;
  decorateMenu = function (raw) {
    const decorated = original(raw);
    decorated.items.forEach((item) => {
      const hasImage = typeof item.image === "string" && item.image.trim() !== "";
      if (!hasImage) item.image = demoImage(item);
    });
    return decorated;
  };
})();
/* ===== END DEMO PLACEHOLDER IMAGES ===== */

/** The baked-in menu — the fallback that guarantees the page always renders. */
function readMenu() {
  return decorateMenu(window.MENU);
}

/** Prices for an item, whether it is single-price or has variants. */
function variantsOf(item) {
  return Array.isArray(item.variants) && item.variants.length
    ? item.variants
    : null;
}

/* Group digits for display: 1500 -> "1,500". Western digits with a comma
   separator — the rest of the site already renders Western numerals (prices,
   the cart count, the Sora-set quantity steppers), and Western digits stay
   unambiguous in the WhatsApp order the café reads on their phone. Built once
   and reused, so formatting 133+ prices per render stays cheap. */
const PRICE_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Format a number for display. One place, so currency and grouping never drift. */
function formatPrice(value, currency) {
  const number = Number(value);
  const shown = Number.isFinite(number) ? PRICE_FORMAT.format(number) : value;
  return `${shown} ${currency}`;
}

/* --------------------------------------------------------------------------
   Filtering
   -------------------------------------------------------------------------- */

/* Chips that filter on an item flag instead of a category id, mapped to the
   flag they test. Their results span categories, which is also what decides
   whether category headings are worth showing. Adding a flag chip means adding
   a button in menu.html and one entry here — nothing else. */
const FLAG_CHIPS = {
  featured: "featured",
  offers: "offer"
};

/** True for chips whose results are drawn from more than one category. */
function isFlagChip(cat) {
  return Object.prototype.hasOwnProperty.call(FLAG_CHIPS, cat);
}

/**
 * Apply the active chip and the search box together — both constraints always
 * hold, so searching inside a category narrows rather than resets.
 */
function filterItems() {
  const query = normalize(state.query);
  const flag = FLAG_CHIPS[state.cat];

  return menu.items.filter((item) => {
    if (flag) {
      if (item[flag] !== true) return false;
    } else if (state.cat !== "all") {
      if (item.cat !== state.cat) return false;
    }
    if (query && !item.searchKey.includes(query)) return false;
    return true;
  });
}

/* --------------------------------------------------------------------------
   Rendering
   --------------------------------------------------------------------------
   Nodes are built with createElement/textContent rather than innerHTML: menu
   text will eventually come from a Google Sheet edited by the client, and
   textContent makes any markup in it inert by construction.
   -------------------------------------------------------------------------- */

/**
 * The one badge a card gets, in strict priority order:
 *
 *   1. غير متوفر — the most actionable fact; nothing else matters if you
 *      cannot order it.
 *   2. عرض       — an offer the customer can act on right now.
 *   3. مميّز      — nice to know, and the one worth losing.
 *
 * Kept as a single ordered decision rather than stacked conditions, so the
 * precedence is legible in one place and cannot drift.
 */
function badgeFor(item) {
  if (item.available === false) return { className: "tag-out", text: "غير متوفر" };
  if (item.offer === true) return { className: "tag-offer", text: "عرض" };
  if (item.featured === true) return { className: "fav", text: "مميّز" };
  return null;
}

/**
 * The old price to strike through beside the live one, or null for "render
 * nothing extra".
 *
 * Defensive on purpose: from Step 7 this field is typed into a spreadsheet by a
 * non-technical person, so it arrives missing, blank, as a string, or as a
 * number that makes no sense next to the live price. Number() handles the
 * numeric-string case; everything else falls through to null silently, because
 * a customer must never see a warning and a bad cell must never break a card.
 */
function oldPriceFor(item, livePrice) {
  if (item.offer !== true) return null;

  const previous = Number(item.oldPrice);
  if (!Number.isFinite(previous) || !Number.isFinite(livePrice)) return null;

  // An "old" price at or below what you pay today is not a discount.
  return previous > livePrice ? previous : null;
}

/** The image zone: a real photo when we have one, the branded tile otherwise. */
function buildImageZone(item) {
  const top = document.createElement("div");
  top.className = "top";

  const src = typeof item.image === "string" ? item.image.trim() : "";
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = item.name || "";
    // setAttribute, not the IDL properties: a filter re-render can create these
    // before layout, and the attribute form is what every engine honours.
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    top.append(img);
  }

  // Exactly one badge; they all occupy the same corner. See badgeFor().
  const badge = badgeFor(item);
  if (badge) {
    const tag = document.createElement("span");
    tag.className = badge.className;
    tag.textContent = badge.text;
    top.append(tag);
  }

  return top;
}

/**
 * Size pills for a multi-price item. Selecting one updates this card's price
 * and reports the choice back through onSelect, so the card's add button knows
 * which variant is live without having to read it back out of the DOM.
 */
function buildSizePills(variants, priceEl, currency, onSelect) {
  const row = document.createElement("div");
  row.className = "sizes";

  variants.forEach((variant, index) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = index === 0 ? "size is-active" : "size";
    pill.textContent = variant.label ?? "";
    pill.setAttribute("aria-pressed", index === 0 ? "true" : "false");
    pill.dataset.price = String(variant.price);

    pill.addEventListener("click", () => {
      row.querySelectorAll(".size").forEach((other) => {
        other.classList.remove("is-active");
        other.setAttribute("aria-pressed", "false");
      });
      pill.classList.add("is-active");
      pill.setAttribute("aria-pressed", "true");
      priceEl.textContent = formatPrice(variant.price, currency);
      onSelect(variant);
    });

    row.append(pill);
  });

  return row;
}

/**
 * One menu card.
 *
 * `linkToMenu` builds the landing page's variant: identical card, except the
 * action is a link into menu.html instead of an add-to-cart button. There is no
 * cart on the landing page, so a button there could only ever be dead; sending
 * the customer to the page where they can actually order is the honest control.
 */
function buildCard(item, currency, { linkToMenu = false } = {}) {
  const outOfStock = item.available === false;

  const card = document.createElement("article");
  card.className = outOfStock ? "card is-out" : "card";
  card.dataset.id = item.id || "";

  card.append(buildImageZone(item));

  const body = document.createElement("div");
  body.className = "b";

  const title = document.createElement("h3");
  title.textContent = item.name || "";
  body.append(title);

  const desc = document.createElement("p");
  desc.textContent = item.desc || "";
  body.append(desc);

  // The price element is created before the pills so they can drive it. The
  // wrapper keeps the live price and any struck-through old price together as
  // one unit inside the flex row.
  const priceWrap = document.createElement("div");
  priceWrap.className = "price-wrap";

  const price = document.createElement("span");
  price.className = "price";
  priceWrap.append(price);

  // The variant this card will add. Size pills reassign it; a single-price item
  // leaves it null and the add button falls back to item.price.
  const variants = variantsOf(item);
  let selected = null;

  if (variants) {
    selected = variants[0];
    price.textContent = formatPrice(selected.price, currency);
    body.append(
      buildSizePills(variants, price, currency, (variant) => {
        selected = variant;
      })
    );
  } else {
    price.textContent = formatPrice(item.price, currency);
  }

  /* Struck-through old price.
     ------------------------------------------------------------------------
     VARIANTS + OFFERS: skipped entirely for an item with sizes.
     The data model carries one oldPrice per item, but a multi-size item has
     several live prices, and there is no way to tell which one that single
     number was the "before" of. Pairing it with whichever pill happens to be
     selected would misstate the discount every time it is not that size —
     showing "16 ₪" struck beside a 10 ₪ small implies a saving the café never
     offered. So a multi-size item still gets its عرض badge, and simply shows
     no strikethrough. If per-size offers are ever needed, the sheet can carry
     them as separate rows with their own oldPrice. */
  if (!variants) {
    const previous = oldPriceFor(item, Number(item.price));
    if (previous !== null) {
      const del = document.createElement("del");
      del.className = "price-old";

      // <del> alone announces only "deletion"; name what the number is.
      const label = document.createElement("span");
      label.className = "sr-only";
      label.textContent = "السعر القديم ";
      del.append(label);

      // Same formatPrice() as everywhere else — one formatting path.
      del.append(document.createTextNode(formatPrice(previous, currency)));
      priceWrap.append(del);
    }
  }

  const row = document.createElement("div");
  row.className = "r";
  row.append(priceWrap);

  if (linkToMenu) {
    const link = document.createElement("a");
    link.className = "add";
    link.href = "menu.html";
    link.textContent = "اطلب";
    // The visible label is short by design; name the item for screen readers.
    link.setAttribute("aria-label", `اطلب ${item.name || ""} من المنيو`);
    row.append(link);
  } else {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add";
    if (outOfStock) {
      // A disabled button fires no click, so an unavailable item stays unaddable
      // even though the handler below is attached to every card the same way.
      add.disabled = true;
      add.textContent = "غير متوفر";
    } else {
      add.textContent = "أضف +";
      add.addEventListener("click", () => {
        addToCart(item, selected);
        flashAdded(add);
      });
    }
    row.append(add);
  }

  body.append(row);
  card.append(body);
  return card;
}

/** A category block: styled heading (optional) plus its grid of cards. */
function buildCategorySection(category, items, currency, showHeading) {
  const section = document.createElement("section");
  section.className = "cat";
  section.id = `cat-${category.id}`;
  section.setAttribute("aria-label", category.name);

  if (showHeading) {
    const head = document.createElement("h2");
    head.className = "cat-head";
    head.append(document.createTextNode(`${category.name} `));

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(items.length);
    head.append(count);

    section.append(head);
  }

  const grid = document.createElement("div");
  grid.className = "menu-grid";
  items.forEach((item) => grid.append(buildCard(item, currency)));
  section.append(grid);

  return section;
}

/** Nothing matched: an on-brand message instead of a blank page. */
function buildEmptyState() {
  const box = document.createElement("div");
  box.className = "empty";

  const glyph = document.createElement("span");
  glyph.className = "empty-mark";
  glyph.setAttribute("aria-hidden", "true");
  box.append(glyph);

  const title = document.createElement("h2");
  title.textContent = "ما في نتائج";
  box.append(title);

  const hint = document.createElement("p");
  hint.textContent = "جرّب كلمة تانية، أو اختر قسم من فوق.";
  box.append(hint);

  return box;
}

/**
 * Render the whole menu list for the current state. Everything is assembled in
 * a DocumentFragment and appended once, so 113 cards cost a single layout pass
 * even while the customer is typing.
 *
 * menu.html only — index.html has no #menuBody and falls straight out.
 */
function renderMenuList() {
  const body = document.getElementById("menuBody");
  const status = document.getElementById("resultStatus");
  if (!body) return;

  const visible = filterItems();
  const fragment = document.createDocumentFragment();

  if (!visible.length) {
    fragment.append(buildEmptyState());
  } else {
    // A single active category chip already names the section, so its heading
    // would just repeat the chip. Headings stay for الكل and for the flag chips
    // (الأكثر طلبًا, العروض), whose results span several categories and so keep
    // the grouping meaningful.
    const showHeadings = state.cat === "all" || isFlagChip(state.cat);

    menu.categories.forEach((category) => {
      const inCategory = visible.filter((item) => item.cat === category.id);
      if (!inCategory.length) return; // skip empty categories entirely
      fragment.append(
        buildCategorySection(category, inCategory, menu.currency, showHeadings)
      );
    });
  }

  body.replaceChildren(fragment);
  if (status) {
    status.textContent = visible.length
      ? `${visible.length} صنف`
      : "ما في نتائج";
  }

  // Freshly rendered photos may already be in the cache and broken, in which
  // case no error event fires for them — sweep so the placeholder still shows.
  sweepBrokenImages();
}

/* --------------------------------------------------------------------------
   Landing-page preview row
   --------------------------------------------------------------------------
   index.html shows a short taste of the menu. It reads the same window.MENU and
   builds the same cards as menu.html, so a price shown on the landing page can
   never drift from the menu — and when the Google Sheet loads, both pages pick
   the change up together.
   -------------------------------------------------------------------------- */

const PREVIEW_LIMIT = 4;

/* The landing page's chip row filters this preview. It is index-only state,
   entirely separate from the menu page's `state.cat`, so the two pages never
   reach into each other. Default "featured" so الأكثر طلبًا starts active,
   matching the chip marked is-active in the markup. Values mirror the menu's
   chips: a FLAG_CHIPS key ("featured" | "offers") or a category id. */
const previewState = {
  filter: "featured"
};

/**
 * The items the landing page shows off, honouring the active preview chip.
 *
 * The same filtering semantics as filterItems() on the menu page — flag chips
 * test an item flag via FLAG_CHIPS, a category chip matches item.cat — so the
 * preview and the menu can never disagree about what a chip means. Two rules
 * hold across every filter: unavailable items never appear (the landing page is
 * a shop window; there is no point advertising what the café cannot serve
 * today), and the row is capped at PREVIEW_LIMIT.
 *
 * الأكثر طلبًا keeps its original behaviour: مميّز items first, then topped up
 * in menu order, so a client who flags only two items still gets a full row
 * rather than a gap-toothed one. That same featured-first ordering is the
 * empty-safe fallback — if a stricter filter (say العروض with nothing on offer
 * today) matches nothing, we show it instead of leaving a blank hole. So the
 * preview row is only ever empty when the whole menu is.
 */
function previewItems(limit = PREVIEW_LIMIT) {
  const sellable = menu.items.filter((item) => item.available !== false);

  // مميّز first, then the rest in menu order — the shop-window default and the
  // fallback for any filter that would otherwise come back empty.
  const featuredFirst = () => {
    const featured = sellable.filter((item) => item.featured === true);
    const rest = sellable.filter((item) => item.featured !== true);
    return [...featured, ...rest];
  };

  const filter = previewState.filter;
  let matched;

  if (filter === "featured") {
    matched = featuredFirst();
  } else if (isFlagChip(filter)) {
    // العروض and any future flag chip: strictly the flagged items.
    matched = sellable.filter((item) => item[FLAG_CHIPS[filter]] === true);
  } else {
    // A category id.
    matched = sellable.filter((item) => item.cat === filter);
  }

  if (!matched.length) matched = featuredFirst();

  return matched.slice(0, limit);
}

/**
 * Show only the chips whose target still exists in the current data.
 *
 * Flag chips (الأكثر طلبًا, العروض) are data-independent and always stay. A
 * category chip is hidden when its id is not in menu.categories — that is what
 * lets the client rename or drop a category in the sheet without stranding a
 * chip that would filter to nothing. Re-run on every preview render, because a
 * Google Sheet load can change the categories after first paint; if the active
 * chip is the one being hidden, fall back to الأكثر طلبًا so a chip is always
 * active.
 */
function syncPreviewChips(nav) {
  const known = new Set(menu.categories.map((category) => category.id));
  let activeHidden = false;

  nav.querySelectorAll(".chip").forEach((chip) => {
    const cat = chip.dataset.cat || "";
    const hide = !isFlagChip(cat) && !known.has(cat);
    chip.hidden = hide;
    if (hide && chip.classList.contains("is-active")) activeHidden = true;
  });

  if (activeHidden) {
    previewState.filter = "featured";
    setActivePreviewChip(nav, "featured");
  }
}

/** Mark exactly one chip active, keeping .is-active and aria-pressed in step. */
function setActivePreviewChip(nav, filter) {
  nav.querySelectorAll(".chip").forEach((chip) => {
    const active = (chip.dataset.cat || "featured") === filter;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

/** index.html only — menu.html has no #previewGrid and falls straight out. */
function renderPreview() {
  const grid = document.getElementById("previewGrid");
  if (!grid) return;

  // Hide any chip whose category vanished from the data before rendering, so a
  // dropped category can't leave a dead chip standing beside the row.
  const nav = document.getElementById("previewChips");
  if (nav) syncPreviewChips(nav);

  const fragment = document.createDocumentFragment();
  previewItems().forEach((item) => {
    fragment.append(buildCard(item, menu.currency, { linkToMenu: true }));
  });

  grid.replaceChildren(fragment);
  sweepBrokenImages();
}

/**
 * Draw whatever this page happens to have. Both halves no-op on the page that
 * does not own them, so one call site serves the landing page, the menu, and
 * the re-render that follows a successful sheet load.
 */
function render() {
  if (!menu) return;
  renderMenuList();
  renderPreview();
}

/* --------------------------------------------------------------------------
   Hero slideshow (index.html only)
   --------------------------------------------------------------------------
   The landing hero's green art panel shows the Cerablus logo as a placeholder.
   When the menu carries real photography, that panel becomes a photo slideshow
   of the café's featured items — pulled from the same window.MENU as the rest
   of the page, so a photo added to the Google Sheet appears here on next load
   with no separate image list to maintain.

   Graceful degradation is the whole point: a slideshow needs at least two real
   photos, so with zero or one the panel is left EXACTLY as authored in the HTML
   (the logo placeholder). With today's photo-less data that is always the
   outcome, which is what makes this safe to ship before the client's photos
   exist. If an image 404s at runtime its slide is dropped, and if that takes
   the count below two the logo panel is restored.
   -------------------------------------------------------------------------- */

const HERO_INTERVAL_MS = 5000;
const HERO_MIN_SLIDES = 2; // fewer than this is not a slideshow — keep the logo

/** Western digits to Arabic-Indic, for aria-labels on an Arabic page. */
function toArabicDigits(value) {
  return String(value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/**
 * Items eligible for the hero slideshow: featured, available, and carrying a
 * real non-empty image. Same window.MENU the rest of the page reads, so the
 * slideshow can never drift from the menu or need its own image list.
 */
function heroEligibleItems() {
  return menu.items.filter(
    (item) =>
      item.featured === true &&
      item.available !== false &&
      typeof item.image === "string" &&
      item.image.trim() !== ""
  );
}

/**
 * Build the slideshow inside the panel and return a small controller (mostly so
 * it is drivable from a test without a browser). Everything is a closure over
 * the slide records, so dropping a bad image reindexes cleanly.
 *
 * The panel's original markup is captured first and restored verbatim if the
 * slideshow ever has to tear down — that is what guarantees the fallback is the
 * unchanged logo panel, not an approximation of it.
 */
function buildHeroSlideshow(panel, items) {
  const originalHTML = panel.innerHTML;
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The gold "محمّصة طازة" badge reads well over a photo (solid pill, high
  // contrast), so it is kept. The faint decorative corner dot is not: a
  // translucent circle over a photo looks like a lens smudge, so it is dropped.
  const badge = panel.querySelector(".badge");

  const track = document.createElement("div");
  track.className = "hero-slides";

  const dots = document.createElement("div");
  dots.className = "hero-dots";
  dots.setAttribute("role", "group");
  dots.setAttribute("aria-label", "شرائح الصور");

  // One record per slide; operations key off the object, never a live index.
  let slides = items.map((item) => {
    const img = document.createElement("img");
    img.className = "hero-slide";
    img.alt = item.name || "";
    img.setAttribute("decoding", "async");

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "hero-dot";

    const rec = { item, img, dot, url: (item.image || "").trim() };
    img.addEventListener("error", () => dropSlide(rec));
    dot.addEventListener("click", () => {
      const at = slides.indexOf(rec);
      if (at !== -1) goTo(at);
    });
    return rec;
  });

  let index = 0;
  let timer = null;
  // Auto-advance pauses on any of these; the running interval reads the union
  // so hover + keyboard focus can't race each other into resuming early.
  const pause = { hover: false, press: false, focus: false };
  const isPaused = () => pause.hover || pause.press || pause.focus;

  /** Give a slide its src the first time it is needed — current + next only. */
  function loadSlide(rec) {
    if (rec && rec.url && !rec.img.getAttribute("src")) {
      rec.img.setAttribute("src", rec.url);
    }
  }

  function paint() {
    slides.forEach((rec, i) => {
      const active = i === index;
      rec.img.classList.toggle("is-active", active);
      rec.dot.classList.toggle("is-active", active);
      rec.dot.setAttribute("aria-current", active ? "true" : "false");
      rec.dot.setAttribute("aria-label", `الشريحة ${toArabicDigits(i + 1)}`);
      // Roving tabindex: the dot group is one tab stop; arrows move within it.
      rec.dot.setAttribute("tabindex", active ? "0" : "-1");
    });
    // Preload only the current and the next image; the rest stay unloaded.
    loadSlide(slides[index]);
    if (slides.length > 1) loadSlide(slides[(index + 1) % slides.length]);
  }

  function goTo(n) {
    if (!slides.length) return;
    index = ((n % slides.length) + slides.length) % slides.length;
    paint();
  }

  function focusActiveDot() {
    const rec = slides[index];
    if (rec && typeof rec.dot.focus === "function") rec.dot.focus();
  }

  function startAuto() {
    // Reduced motion: no auto-advance and no motion. The first slide shows
    // statically and the dots still work for manual navigation.
    if (reduceMotion || timer !== null || slides.length < HERO_MIN_SLIDES) return;
    timer = window.setInterval(() => {
      if (!isPaused()) goTo(index + 1);
    }, HERO_INTERVAL_MS);
  }

  function stopAuto() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function teardown() {
    stopAuto();
    panel.classList.remove("is-slideshow");
    panel.innerHTML = originalHTML; // verbatim logo panel — the exact fallback
  }

  /** A slide's image failed to load: drop it, and fall back if too few remain. */
  function dropSlide(rec) {
    if (!slides.includes(rec)) return;
    const removingActive = slides[index] === rec;

    rec.img.remove();
    rec.dot.remove();
    slides = slides.filter((s) => s !== rec);

    if (slides.length < HERO_MIN_SLIDES) {
      teardown();
      return;
    }
    // Keep index in range; if the active slide went, land on the one that took
    // its place (or wrap to the first).
    if (index >= slides.length) index = 0;
    else if (removingActive) index = index % slides.length;
    paint();
  }

  // --- assemble ---
  slides.forEach((rec) => track.append(rec.img));
  slides.forEach((rec) => dots.append(rec.dot));

  panel.classList.add("is-slideshow");
  panel.replaceChildren(track, dots);
  if (badge) panel.append(badge); // re-attach the kept badge on top

  // --- interaction: pause on hover / press / focus ---
  panel.addEventListener("mouseenter", () => { pause.hover = true; });
  panel.addEventListener("mouseleave", () => { pause.hover = false; });
  panel.addEventListener("focusin", () => { pause.focus = true; });
  panel.addEventListener("focusout", () => { pause.focus = false; });

  // --- interaction: touch press-and-hold to pause, plus swipe to navigate ---
  let swipeStartX = null;
  panel.addEventListener(
    "touchstart",
    (event) => {
      pause.press = true;
      swipeStartX = event.touches && event.touches[0] ? event.touches[0].clientX : null;
    },
    { passive: true }
  );
  panel.addEventListener("touchend", (event) => {
    pause.press = false;
    if (swipeStartX === null) return;
    const touch = event.changedTouches && event.changedTouches[0];
    const dx = touch ? touch.clientX - swipeStartX : 0;
    swipeStartX = null;
    if (Math.abs(dx) < 40) return; // ignore taps and tiny drags
    // RTL: a leftward swipe moves forward, a rightward swipe moves back.
    goTo(index + (dx < 0 ? 1 : -1));
  });

  // --- interaction: arrow keys while a control in the panel has focus ---
  panel.addEventListener("keydown", (event) => {
    // RTL: dots run right-to-left, so ArrowLeft advances and ArrowRight goes back.
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index + 1);
      focusActiveDot();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index - 1);
      focusActiveDot();
    }
  });

  paint();
  startAuto();

  return {
    goTo,
    next: () => goTo(index + 1),
    dropSlide,
    get index() { return index; },
    get count() { return slides.length; },
    get running() { return timer !== null; },
    _slides: slides
  };
}

/**
 * Mount the hero slideshow if this page has the panel and the data earns it.
 * index.html only — menu.html has no #heroArt and this returns null, exactly
 * like the other landing-only wiring. Returns the controller (or null) so a
 * test can drive it without a browser.
 */
function initHeroSlideshow() {
  const panel = document.getElementById("heroArt");
  if (!panel || !menu) return null;

  const items = heroEligibleItems();
  if (items.length < HERO_MIN_SLIDES) return null; // 0 or 1 → keep the logo panel

  return buildHeroSlideshow(panel, items);
}

/* ==========================================================================
   CART
   --------------------------------------------------------------------------
   State lives here, entirely independent of the DOM, so searching or changing
   the category chip re-renders the menu without touching the cart. In memory
   only — no localStorage, so it resets on reload. That is intentional.
   ========================================================================== */

/**
 * key -> { id, name, variantLabel, price, qty }
 * A Map because insertion order is stable, which keeps drawer lines from
 * jumping around as quantities change.
 */
const cart = new Map();

/** Line identity: a large and a small cappuccino are different lines. */
function lineKey(id, variantLabel) {
  return `${id}::${variantLabel}`;
}

/** Human label for a line, used in the drawer and by the reader status. */
function lineTitle(line) {
  return line.variantLabel ? `${line.name} (${line.variantLabel})` : line.name;
}

/** Total quantity and money across the whole cart. */
function cartTotals() {
  let count = 0;
  let total = 0;
  cart.forEach((line) => {
    count += line.qty;
    // Skip a malformed price rather than poisoning the whole total with NaN.
    const amount = line.price * line.qty;
    if (Number.isFinite(amount)) total += amount;
  });
  return { count, total };
}

/**
 * Add one of `item` to the cart, at `variant` if the item has sizes.
 *
 * The unit price is captured here, at add time, from the variant or from
 * item.price — both of which are the *live* price. oldPrice (Step 6) is a
 * display-only field and must never reach the cart.
 */
function addToCart(item, variant) {
  if (item.available === false) return; // belt and braces; the button is disabled

  const variantLabel = variant ? String(variant.label ?? "") : "";
  const price = Number(variant ? variant.price : item.price);
  if (!Number.isFinite(price)) return; // a malformed sheet row must not poison the cart

  const key = lineKey(item.id, variantLabel);
  const existing = cart.get(key);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.set(key, { id: item.id, name: item.name || "", variantLabel, price, qty: 1 });
  }

  renderCart();
  announceCart(cart.get(key));
}

/** Move a line's quantity by delta; hitting zero removes the line outright. */
function changeQty(key, delta) {
  const line = cart.get(key);
  if (!line) return;

  line.qty += delta;
  if (line.qty <= 0) {
    cart.delete(key);
    setCartStatus(`تم حذف ${lineTitle(line)} من السلة`);
  } else {
    announceCart(line);
  }
  renderCart();
}

/* --------------------------------------------------------------------------
   WhatsApp order message
   --------------------------------------------------------------------------
   The whole order flow ends in a pre-filled WhatsApp message — there is no
   checkout. The message is built into the link's href rather than assembled in
   a click handler, so it behaves identically for a mouse click, the keyboard,
   a long-press "copy link", and a browser with JS disabled.
   -------------------------------------------------------------------------- */

/* Beyond this many characters some mobile browsers and WhatsApp's own intent
   handler truncate the URL, which would send a half-order. Measured against the
   fully encoded href, since Arabic characters cost six characters each once
   percent-encoded. */
const MAX_ORDER_URL = 1800;

/** "كابتشينو (كبير)" for a variant line, plain name for a single-price one. */
function orderLineName(line) {
  return line.variantLabel ? `${line.name} (${line.variantLabel})` : line.name;
}

/**
 * Build the order message.
 *
 * Two knobs, both only used by the oversized-order fallback below:
 *   compact — drop the per-line amounts, keeping item, variant and quantity.
 *   limit   — list at most this many lines, then say how many were left out.
 *
 * The grand total is always the true total for the whole cart, at every level
 * of degradation, so the café always knows what the order comes to.
 *
 * All money goes through formatPrice(), so this message can never disagree with
 * the drawer about a number. Amounts come from line.price — the price captured
 * when the item was added, which is always the live price and never oldPrice.
 */
function buildOrderMessage(currency, { compact = false, limit = Infinity } = {}) {
  const lines = [];
  let listed = 0;

  cart.forEach((line) => {
    if (listed >= limit) return;
    listed += 1;

    const amount = line.price * line.qty;
    // A malformed price must never reach the café as "NaN ₪" — drop the amount
    // and keep the item, so the order is still actionable.
    const showAmount = !compact && Number.isFinite(amount);
    lines.push(
      showAmount
        ? `• ${orderLineName(line)} ×${line.qty} — ${formatPrice(amount, currency)}`
        : `• ${orderLineName(line)} ×${line.qty}`
    );
  });

  // Never drop items silently: say plainly that the list was shortened.
  const omitted = cart.size - listed;
  if (omitted > 0) lines.push(`• و${omitted} صنف إضافي — التفاصيل بالمحادثة`);

  const { total } = cartTotals();

  return [
    "مرحبا 👋 حابب أعمل هذا الطلب:",
    "",
    ...lines,
    "",
    `المجموع: ${formatPrice(total, currency)}`,
    "",
    "الاسم:",
    "العنوان:"
  ].join("\n");
}

/** The bare chat link — no order attached. Also the empty-cart fallback. */
function plainOrderHref() {
  return `https://wa.me/${CONFIG.PHONE}`;
}

/** wa.me link carrying the message. encodeURIComponent handles Arabic, the
    emoji, ₪ and the newlines (which become %0A and render as line breaks). */
function orderHref(message) {
  return `${plainOrderHref()}?text=${encodeURIComponent(message)}`;
}

/**
 * The href the order button should currently carry.
 *
 * Degrades in three steps, each only reached if the one before it is still too
 * long for MAX_ORDER_URL:
 *   1. the full message
 *   2. compact — same items, no per-line amounts
 *   3. compact and trimmed to the lines that fit, with a closing line stating
 *      how many were left out
 *
 * An empty cart short-circuits to a plain chat link with no text at all.
 */
function currentOrderHref(currency) {
  if (cart.size === 0) return plainOrderHref();

  const full = orderHref(buildOrderMessage(currency));
  if (full.length <= MAX_ORDER_URL) return full;

  let href = orderHref(buildOrderMessage(currency, { compact: true }));
  if (href.length <= MAX_ORDER_URL) return href;

  // Drop one line at a time until it fits. Bounded by the cart size and only
  // recomputed when the cart changes, so the cost is irrelevant in practice.
  for (let limit = cart.size - 1; limit >= 0; limit -= 1) {
    href = orderHref(buildOrderMessage(currency, { compact: true, limit }));
    if (href.length <= MAX_ORDER_URL) break;
  }
  return href;
}

/* --------------------------------------------------------------------------
   Cart rendering
   -------------------------------------------------------------------------- */

/** Update the sr-only live region. Visual users read the drawer itself. */
function setCartStatus(text) {
  const status = document.getElementById("cartStatus");
  if (status) status.textContent = text;
}

function announceCart(line) {
  if (line) setCartStatus(`${lineTitle(line)} — الكمية ${line.qty}`);
}

/** Brief pulse on the add button so a tap has an obvious result. */
function flashAdded(button) {
  button.classList.remove("is-added");
  // Reading offsetWidth restarts the animation when the same button is
  // tapped repeatedly, instead of the class change being coalesced away.
  void button.offsetWidth;
  button.classList.add("is-added");
  window.setTimeout(() => button.classList.remove("is-added"), 400);
}

/** One row in the drawer: title, stepper, line total. */
function buildCartLine(key, line, currency) {
  const row = document.createElement("div");
  row.className = "cart-line";
  row.dataset.key = key;

  const info = document.createElement("div");
  info.className = "cl-info";

  const name = document.createElement("h3");
  name.className = "cl-name";
  name.textContent = line.name;
  info.append(name);

  if (line.variantLabel) {
    const variant = document.createElement("span");
    variant.className = "cl-var";
    variant.textContent = line.variantLabel;
    info.append(variant);
  }

  const unit = document.createElement("span");
  unit.className = "cl-unit";
  unit.textContent = formatPrice(line.price, currency);
  info.append(unit);

  row.append(info);

  const side = document.createElement("div");
  side.className = "cl-side";

  const stepper = document.createElement("div");
  stepper.className = "qty";

  const title = lineTitle(line);
  // The − at qty 1 removes the line, so its label says so rather than "إنقاص".
  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "q";
  minus.dataset.delta = "-1";
  minus.textContent = "−";
  minus.setAttribute("aria-label", line.qty === 1 ? `حذف ${title}` : `إنقاص ${title}`);

  const count = document.createElement("span");
  count.className = "q-n";
  count.textContent = String(line.qty);

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "q";
  plus.dataset.delta = "1";
  plus.textContent = "+";
  plus.setAttribute("aria-label", `زيادة ${title}`);

  stepper.append(minus, count, plus);
  side.append(stepper);

  const lineTotal = document.createElement("span");
  lineTotal.className = "cl-total";
  lineTotal.textContent = formatPrice(line.price * line.qty, currency);
  side.append(lineTotal);

  row.append(side);
  return row;
}

/** The drawer's own empty state, echoing the empty-search treatment. */
function buildCartEmpty() {
  const box = document.createElement("div");
  box.className = "empty empty-cart";

  const glyph = document.createElement("span");
  glyph.className = "empty-mark";
  glyph.setAttribute("aria-hidden", "true");
  box.append(glyph);

  const title = document.createElement("h2");
  title.textContent = "سلّتك فاضية";
  box.append(title);

  const hint = document.createElement("p");
  hint.textContent = "أضف أصنافك من المنيو وبتظهر هون.";
  box.append(hint);

  return box;
}

/**
 * Redraw everything the cart owns: the drawer lines, the running total, the
 * order button's enabled state, and the header count badge.
 */
function renderCart() {
  const currency = menu ? menu.currency : "ل.س";
  const { count, total } = cartTotals();

  const lines = document.getElementById("cartLines");
  if (lines) {
    const fragment = document.createDocumentFragment();
    if (cart.size === 0) {
      fragment.append(buildCartEmpty());
    } else {
      cart.forEach((line, key) => fragment.append(buildCartLine(key, line, currency)));
    }
    lines.replaceChildren(fragment);
  }

  const totalEl = document.getElementById("cartTotal");
  if (totalEl) totalEl.textContent = formatPrice(total, currency);

  const order = document.getElementById("orderBtn");
  if (order) {
    const empty = cart.size === 0;
    // Rebuilding the href here — the one place every add, increment, decrement
    // and removal already funnels through — is what keeps the link from ever
    // going stale against the cart.
    order.href = currentOrderHref(currency);
    order.classList.toggle("is-disabled", empty);
    order.setAttribute("aria-disabled", empty ? "true" : "false");
    // Removing it from the tab order matches how it looks and behaves.
    if (empty) order.setAttribute("tabindex", "-1");
    else order.removeAttribute("tabindex");
  }

  const badge = document.getElementById("cartCount");
  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle("is-empty", count === 0);
  }

  const button = document.getElementById("cartBtn");
  if (button) {
    button.setAttribute(
      "aria-label",
      count === 0 ? "سلة الطلب — فاضية" : `سلة الطلب — ${count} صنف`
    );
  }
}

/* --------------------------------------------------------------------------
   Cart drawer: open / close, focus management, scroll lock
   -------------------------------------------------------------------------- */

const FOCUSABLE =
  'a[href]:not([tabindex="-1"]), button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

let drawerOpen = false;

function focusablesInDrawer(drawer) {
  return [...drawer.querySelectorAll(FOCUSABLE)];
}

function openDrawer() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  if (!drawer || drawerOpen) return;

  drawerOpen = true;
  if (overlay) overlay.hidden = false;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-locked");

  // Focus the close button rather than the panel: it is the first control, and
  // it gives the keyboard user an immediate way back out.
  const close = document.getElementById("cartClose");
  if (close) close.focus();
}

function closeDrawer() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  if (!drawer || !drawerOpen) return;

  drawerOpen = false;
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  if (overlay) overlay.hidden = true;
  document.body.classList.remove("is-locked");

  const button = document.getElementById("cartBtn");
  if (button) button.focus();
}

/** Keep Tab inside the drawer while it is open. */
function trapTab(event, drawer) {
  const focusables = focusablesInDrawer(drawer);
  if (!focusables.length) {
    event.preventDefault();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && (active === first || !drawer.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ==========================================================================
   GOOGLE SHEET LOADING
   --------------------------------------------------------------------------
   The client updates the menu by editing a Google Sheet published as CSV —
   that is what "منيو قابل للتحديث" means in the contract, and they must never
   need us to change a price.

   Everything below assumes the file is hostile. It is typed by a non-technical
   person into a spreadsheet that may be reordered, half-filled, or pasted over.
   Nothing in here is allowed to throw: the worst outcome is that the whole
   sheet is rejected and data/menu.js keeps the site running.

   parseSheetCsv() is a pure function — CSV text in, menu object out (or null).
   It touches no globals and no DOM, so it is testable without a network.
   ========================================================================== */

/* --- RFC 4180-ish CSV reader ------------------------------------------- */

/**
 * Split CSV text into rows of fields.
 *
 * Handles quoted fields containing commas and newlines, "" as an escaped quote
 * inside a quoted field, both \r\n and \n line endings, and a leading UTF-8 BOM
 * (which Google Sheets does emit, and which would otherwise corrupt the very
 * first header and break column matching entirely).
 */
function parseCsv(text) {
  const source = String(text ?? "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (source[i + 1] === '"') {
        field += '"'; // "" inside quotes is a literal quote
        i += 1;
      } else {
        inQuotes = false;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n") {
      endRow();
    } else if (char === "\r") {
      if (source[i + 1] === "\n") i += 1; // swallow the pair
      endRow();
    } else {
      field += char;
    }
  }

  // Anything still buffered is a final row with no trailing newline.
  if (field !== "" || row.length > 0) endRow();

  return rows;
}

/** True when every cell in the row is blank — a spacer row to skip. */
function isBlankRow(row) {
  return row.every((cell) => String(cell ?? "").trim() === "");
}

/* --- column mapping ----------------------------------------------------- */

/* Canonical key -> the Arabic header from the client intake template. Matching
   is by name, never position, so the client can reorder columns or add their
   own notes column without breaking anything. */
const SHEET_COLUMNS = {
  cat: "القسم",
  name: "اسم الصنف",
  desc: "الوصف",
  size: "الحجم / النوع",
  price: "السعر",
  image: "اسم ملف الصورة",
  available: "متوفر",
  featured: "مميّز",
  offer: "عرض",
  oldPrice: "السعر القديم"
};

/* Without these three there is no menu to build. Everything else is optional
   and falls back to a documented default. */
const REQUIRED_COLUMNS = ["cat", "name", "price"];

/**
 * Fold a header cell for matching: the shared Arabic normalizer, then all
 * whitespace removed — so "الحجم / النوع", "الحجم/النوع" and "الحجم  /  النوع"
 * are the same column.
 */
function normalizeHeader(text) {
  return normalize(text).replace(/\s+/g, "");
}

/**
 * Build { canonicalKey: columnIndex } from the header row.
 * Returns null if a required column is missing — which invalidates the sheet.
 */
function mapSheetColumns(headerRow) {
  const seen = new Map();
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    // First occurrence wins, so a duplicated header cannot shadow the real one.
    if (key && !seen.has(key)) seen.set(key, index);
  });

  const columns = {};
  Object.entries(SHEET_COLUMNS).forEach(([key, header]) => {
    const index = seen.get(normalizeHeader(header));
    if (index !== undefined) columns[key] = index;
  });

  const missing = REQUIRED_COLUMNS.filter((key) => columns[key] === undefined);
  if (missing.length) {
    console.warn(
      "[cerablus] sheet is missing required columns:",
      missing.map((key) => SHEET_COLUMNS[key]).join(", ")
    );
    return null;
  }

  return columns;
}

/** Read a cell by canonical column name, trimmed, defaulting to "". */
function cell(row, columns, key) {
  const index = columns[key];
  if (index === undefined) return "";
  return String(row[index] ?? "").trim();
}

/* --- value coercion ----------------------------------------------------- */

/** Arabic-Indic and Persian digits to Western — clients type ٠١٢٣ routinely. */
function toWesternDigits(text) {
  return String(text ?? "").replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/**
 * Coerce a price cell to a number, or null.
 *
 * Strips the things people actually type into a price cell: currency symbols
 * and words, thousands separators (Western and Arabic), and stray whitespace.
 * "١٢", "12 ₪", "1500 ل.س", "ILS 12", "1,200" and " 12 " all come back as numbers.
 */
function parseSheetNumber(value) {
  let text = toWesternDigits(value).trim();
  if (!text) return null;

  text = text
    .replace(/[٬,]/g, "")           // thousands separators
    .replace(/٫/g, ".")             // Arabic decimal separator
    .replace(/[₪$€]/g, "")          // currency symbols
    .replace(/ل\.?\s*س|ليرة(?:\s*سورية)?|\b(?:ils|nis|shekels?|syp)\b|شيكل|شواكل/gi, "")
    .trim();

  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/**
 * A price cell that must not be negative. parseSheetNumber does all the coercion
 * (digits, currency symbols, separators); this only rejects a negative result to
 * null. Used for both the live price and oldPrice:
 *   - a negative LIVE price makes the row invalid, so it is skipped like any
 *     other bad row (a "-5 ₪" card could otherwise drag the cart total negative);
 *   - a negative oldPrice is simply treated as absent, so no strikethrough shows.
 * price === 0 is allowed on purpose — a legitimate "free with order".
 */
function parseSheetPrice(value) {
  const number = parseSheetNumber(value);
  return number !== null && number < 0 ? null : number;
}

const TRUE_WORDS = new Set(["نعم", "ايوه", "اي", "yes", "y", "true", "1", "✓", "✔", "صح"]);
const FALSE_WORDS = new Set(["لا", "no", "n", "false", "0", "✗", "✘", "خطا", "غير متوفر"]);

/**
 * Coerce a yes/no cell. Anything unrecognised — including blank — takes the
 * caller's default, so a half-filled sheet still produces a usable menu.
 */
function parseSheetBoolean(value, fallback) {
  const text = normalize(toWesternDigits(value));
  if (!text) return fallback;
  if (TRUE_WORDS.has(text)) return true;
  if (FALSE_WORDS.has(text)) return false;
  return fallback;
}

/**
 * Turn a bare filename into a path under assets/menu/.
 *
 * The sheet holds a filename, not a path. Anything that looks like a path, a
 * traversal, or an absolute URL is rejected outright and becomes "" — the card
 * then renders the branded placeholder, which is a fine outcome and a much
 * better one than letting a spreadsheet cell point at an arbitrary URL.
 */
function parseSheetImage(value) {
  const name = String(value ?? "").trim();
  if (!name) return "";
  if (/[\\/]/.test(name) || name.includes("..") || /^[a-z][a-z0-9+.-]*:/i.test(name)) {
    console.warn("[cerablus] ignoring suspicious image filename:", name);
    return "";
  }
  return `assets/menu/${name}`;
}

/* --- identity ----------------------------------------------------------- */

/**
 * A URL-ish slug from Arabic or Latin text. Letters and numbers survive in any
 * script; everything else collapses to a hyphen.
 */
function slugify(text) {
  return normalize(text)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The grouping key for an item: normalized category + normalized name.
 *
 * Normalizing means "قهوة" and "قهوه" on two rows are recognised as the same
 * item rather than silently becoming two, which is exactly the kind of typo a
 * spreadsheet collects.
 */
function sheetGroupKey(catText, nameText) {
  return `${normalize(catText)}|${normalize(nameText)}`;
}

/* --- the parser --------------------------------------------------------- */

/**
 * Parse published-sheet CSV into the window.MENU shape.
 *
 * Returns null when the sheet is unusable as a whole (no rows, no header, a
 * missing required column). Individual bad rows are skipped with a warning
 * instead — one unparseable price must never cost the café its whole menu.
 *
 * The output matches the documented data model exactly, so nothing downstream
 * needs to know where the menu came from.
 */
function parseSheetCsv(csvText, currency = "ل.س") {
  const rows = parseCsv(csvText).filter((row) => !isBlankRow(row));
  if (rows.length < 2) {
    console.warn("[cerablus] sheet has no data rows");
    return null;
  }

  const columns = mapSheetColumns(rows[0]);
  if (!columns) return null;

  /* Categories in order of FIRST APPEARANCE — that ordering is the client's
     menu ordering, and it is the only place it is expressed. */
  const categories = new Map(); // slug -> { id, name }
  const groups = new Map();     // groupKey -> item under construction

  rows.slice(1).forEach((row, index) => {
    const sheetRow = index + 2; // 1-based, and the header occupies row 1

    const catText = cell(row, columns, "cat");
    const nameText = cell(row, columns, "name");
    const price = parseSheetPrice(cell(row, columns, "price"));

    if (!catText || !nameText || price === null) {
      console.warn(`[cerablus] skipping sheet row ${sheetRow}: missing category or name, or invalid price`);
      return;
    }

    const catId = slugify(catText);
    if (!catId) {
      console.warn(`[cerablus] skipping sheet row ${sheetRow}: unusable category name`);
      return;
    }
    if (!categories.has(catId)) categories.set(catId, { id: catId, name: catText });

    const key = sheetGroupKey(catText, nameText);
    const size = cell(row, columns, "size");

    if (!groups.has(key)) {
      groups.set(key, {
        id: slugify(key),
        cat: catId,
        name: nameText,
        desc: cell(row, columns, "desc"),
        image: parseSheetImage(cell(row, columns, "image")),
        // متوفر defaults to TRUE: an item nobody answered for should still sell.
        available: parseSheetBoolean(cell(row, columns, "available"), true),
        // مميّز and عرض default to FALSE: a badge must be asked for.
        featured: parseSheetBoolean(cell(row, columns, "featured"), false),
        offer: parseSheetBoolean(cell(row, columns, "offer"), false),
        oldPrice: parseSheetPrice(cell(row, columns, "oldPrice")),
        rows: []
      });
    }

    groups.get(key).rows.push({ sheetRow, size, price });
  });

  /* Resolve each group into a single-price item or a variant item.

     SIZE CONTRADICTION: when an item's rows disagree — some carry a
     الحجم / النوع and some are blank — the sized rows win and the blank ones
     are dropped with a warning. A deliberate size is a stronger signal than an
     empty cell, and the alternatives are worse: inventing a label for the blank
     row puts words in the café's mouth, and throwing the sizes away to keep one
     price loses real menu structure. */
  const items = [];
  const usedIds = new Set();

  groups.forEach((group) => {
    const sized = group.rows.filter((row) => row.size !== "");

    let priced;
    if (sized.length === 0) {
      // No sizes anywhere: a single-price item. Extra rows are duplicates.
      if (group.rows.length > 1) {
        console.warn(`[cerablus] "${group.name}" repeats with no size; using the first price`);
      }
      priced = { price: group.rows[0].price };
    } else {
      if (sized.length !== group.rows.length) {
        const dropped = group.rows.filter((row) => row.size === "").map((row) => row.sheetRow);
        console.warn(
          `[cerablus] "${group.name}" mixes sized and unsized rows; ignoring row(s) ${dropped.join(", ")}`
        );
      }
      priced = { variants: sized.map((row) => ({ label: row.size, price: row.price })) };
    }

    /* Ids must be stable across reloads because the cart keys off them, so they
       are derived from category + name, never from a row index — inserting a
       row at the top of the sheet must not reshuffle every id. Two different
       groups can still collapse to the same slug if they differ only in
       punctuation, so uniqueness is enforced here in first-appearance order. */
    let id = group.id || "item";
    if (usedIds.has(id)) {
      let suffix = 2;
      while (usedIds.has(`${id}-${suffix}`)) suffix += 1;
      console.warn(`[cerablus] duplicate id "${id}" for "${group.name}"; using "${id}-${suffix}"`);
      id = `${id}-${suffix}`;
    }
    usedIds.add(id);

    items.push({
      id,
      cat: group.cat,
      name: group.name,
      desc: group.desc,
      ...priced, // exactly one of price / variants, never both
      image: group.image,
      available: group.available,
      featured: group.featured,
      offer: group.offer,
      oldPrice: group.oldPrice
    });
  });

  if (!items.length) {
    console.warn("[cerablus] sheet produced no valid items");
    return null;
  }

  return { currency, categories: [...categories.values()], items };
}

/* --- the loader --------------------------------------------------------- */

/**
 * Swap in a freshly parsed menu.
 *
 * The cart is deliberately NOT touched. Its lines already captured their prices
 * at add time, and silently repricing a customer's cart underneath them — or
 * dropping a line because the sheet renamed an item — is far worse than a brief
 * inconsistency that resolves the moment they reload. renderCart() still runs,
 * so the wa.me href is rebuilt and cannot go stale against the new currency.
 *
 * state.cat and state.query are untouched, so the active chip and whatever the
 * customer has typed both survive the re-render.
 */
function applySheetMenu(parsed) {
  menu = decorateMenu(parsed);
  render();
  renderCart();
}

/**
 * Fetch the published sheet and, if everything about it checks out, use it.
 *
 * Every failure path ends the same way: warn for us, and leave the baked-in
 * menu exactly as it is for the customer. Nothing here is awaited by the
 * initial render, so a slow or dead sheet costs the visitor nothing.
 */
async function loadSheetMenu() {
  const url = CONFIG.SHEET_CSV_URL;
  if (!url) return; // not configured yet — no fetch, no noise

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CONFIG.SHEET_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    if (!text || !text.trim()) throw new Error("empty response");

    const parsed = parseSheetCsv(text, menu ? menu.currency : "ل.س");
    if (!parsed) throw new Error("could not parse the sheet");
    if (parsed.items.length < CONFIG.SHEET_MIN_ITEMS) {
      throw new Error(`only ${parsed.items.length} valid item(s); expected at least ${CONFIG.SHEET_MIN_ITEMS}`);
    }

    applySheetMenu(parsed);
  } catch (error) {
    // Deliberately silent for the visitor: the baked-in menu is already on screen.
    console.warn("[cerablus] using the baked-in menu —", error && error.message);
  } finally {
    window.clearTimeout(timer);
  }
}

/* --------------------------------------------------------------------------
   Wiring
   -------------------------------------------------------------------------- */

/**
 * Append one chip per category to a chip row, derived from the live data so the
 * ids always exist — no hardcoded category ids that drift when the menu changes.
 * Idempotent: clears any it added before, so it is safe to re-run after a sheet
 * reload. Used for both the menu page's full list and the landing teaser.
 */
function appendCategoryChips(nav, categories) {
  nav.querySelectorAll('.chip[data-generated="1"]').forEach((chip) => chip.remove());
  categories.forEach((category) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.cat = category.id;
    chip.dataset.generated = "1"; // marks it generated, so a rebuild can clear it
    chip.setAttribute("aria-pressed", "false");
    chip.textContent = category.name;
    nav.append(chip);
  });
}

/** Category chips: exactly one active at a time, aria-pressed kept in sync. */
function wireChips() {
  const nav = document.getElementById("catNav");
  if (!nav) return;

  // Build one chip per real category (all 16 for the client's menu) after the
  // fixed الكل / الأكثر طلبًا / العروض chips, then wire the delegated handler
  // so it covers them too.
  appendCategoryChips(nav, menu.categories);

  nav.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip || !nav.contains(chip)) return;

    state.cat = chip.dataset.cat || "all";
    nav.querySelectorAll(".chip").forEach((other) => {
      const active = other === chip;
      other.classList.toggle("is-active", active);
      other.setAttribute("aria-pressed", active ? "true" : "false");
    });
    render();
  });
}

/**
 * Landing-page preview chips: index-only, and a no-op on menu.html (no
 * #previewChips), exactly like renderPreview(). One chip active at a time.
 * Clicking sets the active filter and re-renders only the preview; the chip's
 * visibility is reconciled inside renderPreview() via syncPreviewChips().
 */
/* How many real category chips the landing preview shows beside the two flag
   chips. The full 16-category list lives on the menu page; the landing stays a
   short teaser, so it leads with a few categories and the "شوف المنيو كامل"
   link carries the rest. */
const PREVIEW_CATEGORY_CHIPS = 3;

/**
 * Append a few real category chips to the landing preview row, derived from the
 * live data so each one always maps to a category that exists — no hardcoded
 * ids that could drift when the menu changes. Idempotent: it removes any it
 * added before, so it is safe to re-run (e.g. after a sheet reload).
 */
function buildPreviewCategoryChips(nav) {
  appendCategoryChips(nav, menu.categories.slice(0, PREVIEW_CATEGORY_CHIPS));
}

function wirePreviewChips() {
  const nav = document.getElementById("previewChips");
  if (!nav) return;

  // Fill the category chips from the real data before wiring, so the delegated
  // handler below covers them too.
  buildPreviewCategoryChips(nav);

  nav.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip || !nav.contains(chip)) return;

    previewState.filter = chip.dataset.cat || "featured";
    setActivePreviewChip(nav, previewState.filter);
    renderPreview();
  });
}

/** Live search plus its clear button. */
function wireSearch() {
  const input = document.getElementById("searchInput");
  const clear = document.getElementById("searchClear");
  if (!input) return;

  const syncClear = () => {
    if (clear) clear.hidden = input.value.length === 0;
  };

  input.addEventListener("input", () => {
    state.query = input.value;
    syncClear();
    render();
  });

  if (clear) {
    clear.addEventListener("click", () => {
      input.value = "";
      state.query = "";
      syncClear();
      render();
      input.focus();
    });
  }

  syncClear();
}

/** Everything the drawer needs: openers, closers, steppers, focus trap. */
function wireCart() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  const openBtn = document.getElementById("cartBtn");
  const closeBtn = document.getElementById("cartClose");
  const lines = document.getElementById("cartLines");

  if (openBtn) openBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);

  // Quantity steppers, delegated: the rows are rebuilt on every cart change.
  if (lines) {
    lines.addEventListener("click", (event) => {
      const button = event.target.closest(".q");
      if (!button || !lines.contains(button)) return;

      const row = button.closest(".cart-line");
      if (!row) return;
      changeQty(row.dataset.key, Number(button.dataset.delta));
    });
  }

  document.addEventListener("keydown", (event) => {
    if (!drawerOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
    } else if (event.key === "Tab" && drawer) {
      trapTab(event, drawer);
    }
  });
}

function init() {
  menu = readMenu();
  sweepBrokenImages();
  wireChips();
  wirePreviewChips();
  wireSearch();
  wireCart();
  render();
  renderCart(); // paints the empty state and the zeroed header badge
  initHeroSlideshow(); // index.html only; no-ops without real photos

  /* The baked-in menu is on screen by now. Go looking for a fresher one in the
     background — deliberately not awaited, so the customer never waits on the
     network and never sees a spinner. */
  loadSheetMenu();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
