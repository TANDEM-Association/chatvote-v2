// Logique d'interface du sélecteur de commune, sans DOM : testable seule.
// Utilisée par src/scripts/commune-switcher.ts (navigateur, aucun import Node).

import type { SearchHit } from "./search";

/** Délai avant de lancer la recherche après la dernière frappe. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Lien vers une commune : navigation complète, l'iframe Zaq repart neuve. */
export function buildCommuneHref(code: string): string {
  return `/?commune=${encodeURIComponent(code)}`;
}

export interface HitDisplay {
  name: string;
  /** « Puy-de-Dôme · 63396 (63450) » ; département omis s'il porte le même nom que la commune. */
  meta: string;
  available: boolean;
}

export function describeHit(hit: SearchHit): HitDisplay {
  const department = hit.departmentLabel ? `${hit.departmentLabel} · ` : "";
  const postalCode = hit.postalCode ? ` (${hit.postalCode})` : "";
  return {
    name: hit.name,
    meta: `${department}${hit.code}${postalCode}`,
    available: hit.available,
  };
}

export type TriggerVariant = "pill" | "bar";

export interface PopoverPlacementInput {
  variant: TriggerVariant;
  trigger: { left: number; width: number; bottom: number };
  viewport: { width: number; height: number };
}

export interface PopoverPlacement {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const MARGIN = 8;
const PILL_WIDTH = 320;
const BAR_MAX_WIDTH = 448;
const PILL_GAP = 10;
const BAR_GAP = 8;
const MAX_HEIGHT = 416;
const MIN_HEIGHT = 160;

/**
 * Position du popover (coordonnées de la fenêtre, popover en `position: fixed`).
 *  - pastille (bureau) : 320 px de large, centré sur l'axe vertical de la pastille,
 *    sans sortir de l'écran ;
 *  - barre (mobile) : aligné à gauche de l'écran, jusqu'à 448 px de large.
 */
export function computePopoverPlacement({
  variant,
  trigger,
  viewport,
}: PopoverPlacementInput): PopoverPlacement {
  const available = viewport.width - 2 * MARGIN;
  const gap = variant === "pill" ? PILL_GAP : BAR_GAP;
  const top = trigger.bottom + gap;
  const maxHeight = Math.max(
    MIN_HEIGHT,
    Math.min(MAX_HEIGHT, viewport.height - top - MARGIN),
  );

  if (variant === "bar") {
    return {
      top,
      left: MARGIN,
      width: Math.min(BAR_MAX_WIDTH, available),
      maxHeight,
    };
  }

  const width = Math.min(PILL_WIDTH, available);
  const centered = trigger.left + trigger.width / 2 - width / 2;
  const left = Math.min(
    Math.max(centered, MARGIN),
    viewport.width - width - MARGIN,
  );
  return { top, left, width, maxHeight };
}
