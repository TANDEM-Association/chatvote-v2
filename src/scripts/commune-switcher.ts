// Sélecteur de commune : positionnement du popover natif et recherche.
// L'URL reste la source de vérité : choisir une commune est un simple lien
// (`/?commune=…`), donc une navigation complète. Aucun stockage local.

import { isCommuneAvailable } from "../data/availability";
import type { CommuneIndex } from "../lib/commune/communes-index";
import {
  foldText,
  prepareSearchIndex,
  SEARCH_MIN_LENGTH,
  type SearchEntry,
  searchCommunes,
} from "../lib/commune/search";
import {
  buildCommuneHref,
  computePopoverPlacement,
  describeHit,
  SEARCH_DEBOUNCE_MS,
  type TriggerVariant,
} from "../lib/commune/switcher-ui";

const popover = document.querySelector<HTMLElement>("[data-commune-popover]");
const input = popover?.querySelector<HTMLInputElement>("[data-commune-input]");
const clearButton = popover?.querySelector<HTMLButtonElement>(
  "[data-commune-clear]",
);
const status = popover?.querySelector<HTMLElement>("[data-commune-status]");
const results = popover?.querySelector<HTMLElement>("[data-commune-results]");
const triggers = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-commune-trigger]"),
];

if (popover && input && clearButton && status && results) {
  setup(popover, input, clearButton, status, results);
}

function setup(
  popover: HTMLElement,
  input: HTMLInputElement,
  clearButton: HTMLButtonElement,
  status: HTMLElement,
  results: HTMLElement,
) {
  const currentCode = popover.dataset.currentCode;
  let activeTrigger: HTMLButtonElement | undefined;
  let timer: number | undefined;
  let searchId = 0;
  let entriesPromise: Promise<SearchEntry[]> | undefined;

  /** Charge l'index au premier besoin ; en cas d'échec, une nouvelle tentative est possible. */
  function loadEntries(): Promise<SearchEntry[]> {
    entriesPromise ??= fetch("/communes-index.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`communes-index.json : ${response.status}`);
        }
        return response.json() as Promise<CommuneIndex>;
      })
      .then((index) => prepareSearchIndex(index, isCommuneAvailable))
      .catch((error) => {
        entriesPromise = undefined;
        throw error;
      });
    return entriesPromise;
  }

  // --- Positionnement -----------------------------------------------------

  function visibleTrigger(): HTMLButtonElement | undefined {
    // Un seul des deux déclencheurs est affiché à une largeur donnée.
    return triggers.find((trigger) => trigger.offsetParent !== null);
  }

  function place() {
    const trigger =
      activeTrigger && activeTrigger.offsetParent !== null
        ? activeTrigger
        : visibleTrigger();
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const variant: TriggerVariant =
      trigger.dataset.variant === "bar" ? "bar" : "pill";
    const placement = computePopoverPlacement({
      variant,
      trigger: { left: rect.left, width: rect.width, bottom: rect.bottom },
      viewport: {
        width: window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
      },
    });
    popover.style.top = `${placement.top}px`;
    popover.style.left = `${placement.left}px`;
    popover.style.width = `${placement.width}px`;
    popover.style.maxHeight = `${placement.maxHeight}px`;
  }

  for (const trigger of triggers) {
    trigger.addEventListener("click", () => {
      activeTrigger = trigger;
    });
  }

  popover.addEventListener("beforetoggle", (event) => {
    if ((event as ToggleEvent).newState === "open") place();
  });

  popover.addEventListener("toggle", (event) => {
    const open = (event as ToggleEvent).newState === "open";
    for (const trigger of triggers) {
      trigger.setAttribute("aria-expanded", String(open));
    }
    if (open) {
      input.focus();
      // Précharge l'index ; une erreur s'affiche à la première recherche.
      loadEntries().catch(() => {});
    } else {
      reset();
    }
  });

  const reposition = () => {
    if (popover.matches(":popover-open")) place();
  };
  window.addEventListener("resize", reposition);
  window.visualViewport?.addEventListener("resize", reposition);

  // --- Recherche ----------------------------------------------------------

  function reset() {
    window.clearTimeout(timer);
    searchId += 1;
    input.value = "";
    clearButton.hidden = true;
    status.textContent = "";
    results.replaceChildren();
  }

  function renderHits(hits: ReturnType<typeof searchCommunes>) {
    const items = hits.map((hit) => {
      const display = describeHit(hit);
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "commune-hit";
      link.href = buildCommuneHref(hit.code);
      link.dataset.communeCode = hit.code;

      const main = document.createElement("span");
      main.className = "commune-hit__main";
      const name = document.createElement("span");
      name.className = "commune-hit__name";
      name.textContent = display.name;
      const meta = document.createElement("span");
      meta.className = "commune-hit__meta";
      meta.textContent = display.meta;
      main.append(name, meta);
      link.append(main);

      if (display.available) {
        const badge = document.createElement("span");
        badge.className = "commune-hit__badge";
        badge.textContent = "Disponible";
        link.append(badge);
      }
      item.append(link);
      return item;
    });
    results.replaceChildren(...items);
  }

  async function runSearch(query: string, id: number) {
    try {
      const entries = await loadEntries();
      if (id !== searchId) return;
      const hits = searchCommunes(entries, query);
      renderHits(hits);
      // Texte construit avec textContent : la saisie n'est jamais interprétée comme du HTML.
      status.textContent =
        hits.length === 0
          ? `Aucune commune trouvée pour « ${query.trim()} »`
          : "";
    } catch (error) {
      if (id !== searchId) return;
      console.error(error);
      results.replaceChildren();
      status.textContent =
        "Impossible de charger la liste des communes. Réessayez dans un instant.";
    }
  }

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    searchId += 1;
    const id = searchId;
    const query = input.value;
    clearButton.hidden = query === "";

    if (foldText(query).length < SEARCH_MIN_LENGTH) {
      status.textContent = "";
      results.replaceChildren();
      return;
    }
    status.textContent = "Recherche en cours…";
    timer = window.setTimeout(() => {
      void runSearch(query, id);
    }, SEARCH_DEBOUNCE_MS);
  });

  clearButton.addEventListener("click", () => {
    reset();
    input.focus();
  });

  // --- Clavier et clics sur les résultats ---------------------------------

  const links = () => [...results.querySelectorAll<HTMLAnchorElement>("a")];

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      links()[0]?.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      links()[0]?.click();
    }
  });

  results.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const all = links();
    const index = all.indexOf(document.activeElement as HTMLAnchorElement);
    if (index === -1) return;
    event.preventDefault();
    if (event.key === "ArrowDown") {
      all[Math.min(index + 1, all.length - 1)]?.focus();
    } else if (index === 0) {
      input.focus();
    } else {
      all[index - 1]?.focus();
    }
  });

  results.addEventListener("click", (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a");
    // Même commune : pas la peine de recharger la page.
    if (link && link.dataset.communeCode === currentCode) {
      event.preventDefault();
      popover.hidePopover();
    }
  });
}
