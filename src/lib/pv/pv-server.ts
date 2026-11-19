// Instance unique du lecteur de PV, configurée par PV_BASE_URL.
// Serveur uniquement (importe astro:env/server).
import { PV_BASE_URL } from "astro:env/server";
import { createPvStore } from "./pv-store";

export const pvStore = createPvStore({ baseUrl: PV_BASE_URL });

/** URL, sur notre site, d'un PV augmenté converti en HTML ou de son PDF. */
export const pvFileUrl = (codeInsee: string, id: string, ext: "html" | "pdf") =>
  `/api/pv/${codeInsee}/${id}.${ext}`;
