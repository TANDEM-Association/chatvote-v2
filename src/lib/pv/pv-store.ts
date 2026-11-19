// Lecture des PV augmentés dans le stockage (Scaleway Object Storage) : simples
// GET HTTP sur des fichiers publics.
//   <baseUrl>/<INSEE>/index.json   liste des séances
//   <baseUrl>/<INSEE>/<id>.md      PV augmenté, converti en HTML ici
//   <baseUrl>/<INSEE>/<id>.pdf     version PDF, relayée telle quelle
//
// Serveur uniquement. Cache mémoire par instance (TTL court) : un nouveau PV
// apparaît en quelques minutes sans redéploiement. Une panne du stockage ne
// casse jamais la page : elle est signalée par `status: "error"`.

import { isValidCommuneCode } from "../commune/commune-code";
import {
  isValidSeanceId,
  type PvCommuneIndex,
  type PvSeance,
  parsePvCommuneIndex,
} from "./pv-format";
import { renderPvMarkdown } from "./pv-markdown";

export type PvResult<T> =
  | { status: "ok"; value: T }
  /** Rien de publié (commune sans PV, séance inconnue, stockage non configuré). */
  | { status: "none" }
  /** Stockage injoignable ou réponse invalide. */
  | { status: "error" };

export interface PvStoreOptions {
  /** URL de base du dossier `pv/` ; absente = aucun PV (ex. preview sans stockage). */
  baseUrl: string | undefined;
  fetch?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
  /** Durée pendant laquelle une erreur est gardée, pour ne pas marteler le stockage. */
  errorTtlMs?: number;
  timeoutMs?: number;
  /** Nombre maximal d'entrées en cache (index + documents). */
  maxEntries?: number;
}

export interface PvStore {
  getIndex(codeInsee: string): Promise<PvResult<PvCommuneIndex>>;
  getHtml(codeInsee: string, id: string): Promise<PvResult<string>>;
  getPdf(codeInsee: string, id: string): Promise<PvResult<Response>>;
}

interface CacheEntry {
  expires: number;
  value: Promise<PvResult<unknown>>;
}

const NONE = { status: "none" } as const;
const ERROR = { status: "error" } as const;

export function createPvStore({
  baseUrl,
  fetch: fetchImpl = fetch,
  now = Date.now,
  ttlMs = 5 * 60_000,
  errorTtlMs = 30_000,
  timeoutMs = 4_000,
  maxEntries = 500,
}: PvStoreOptions): PvStore {
  const base = baseUrl?.replace(/\/+$/, "");
  const cache = new Map<string, CacheEntry>();

  /** Partage la même promesse entre requêtes simultanées. */
  function cached<T>(
    key: string,
    load: () => Promise<PvResult<T>>,
  ): Promise<PvResult<T>> {
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.value as Promise<PvResult<T>>;

    const value = load().catch(() => ERROR);
    const entry: CacheEntry = { expires: now() + ttlMs, value };
    cache.delete(key);
    cache.set(key, entry);
    if (cache.size > maxEntries) {
      // La Map garde l'ordre d'insertion : la première clé est la plus ancienne.
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    void value.then((result) => {
      if (result.status === "error") entry.expires = now() + errorTtlMs;
    });
    return value;
  }

  async function get(path: string): Promise<PvResult<Response>> {
    const response = await fetchImpl(`${base}/${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 404 || response.status === 403) {
      // Object storage : un fichier absent d'un bucket public peut renvoyer 403.
      await response.body?.cancel();
      return NONE;
    }
    if (!response.ok) {
      await response.body?.cancel();
      return ERROR;
    }
    return { status: "ok", value: response };
  }

  function getIndex(codeInsee: string): Promise<PvResult<PvCommuneIndex>> {
    if (!base || !isValidCommuneCode(codeInsee)) return Promise.resolve(NONE);
    return cached(`index:${codeInsee}`, async () => {
      const result = await get(`${codeInsee}/index.json`);
      if (result.status !== "ok") return result;
      return {
        status: "ok",
        value: parsePvCommuneIndex(await result.value.json(), codeInsee),
      };
    });
  }

  /** La séance doit figurer dans l'index : on ne lit que ce qui est publié. */
  async function findSeance(
    codeInsee: string,
    id: string,
  ): Promise<PvResult<PvSeance>> {
    if (!isValidSeanceId(id)) return NONE;
    const index = await getIndex(codeInsee);
    if (index.status !== "ok") return index;
    const seance = index.value.seances.find((s) => s.id === id);
    return seance ? { status: "ok", value: seance } : NONE;
  }

  function getHtml(codeInsee: string, id: string): Promise<PvResult<string>> {
    return cached(`html:${codeInsee}/${id}`, async () => {
      const seance = await findSeance(codeInsee, id);
      if (seance.status !== "ok") return seance;
      const result = await get(`${codeInsee}/${id}.md`);
      if (result.status !== "ok") return result;
      return {
        status: "ok",
        value: renderPvMarkdown(await result.value.text()),
      };
    });
  }

  // Pas de cache mémoire pour les PDF : c'est le cache HTTP qui s'en charge.
  async function getPdf(
    codeInsee: string,
    id: string,
  ): Promise<PvResult<Response>> {
    try {
      const seance = await findSeance(codeInsee, id);
      if (seance.status !== "ok") return seance;
      return await get(`${codeInsee}/${id}.pdf`);
    } catch {
      return ERROR;
    }
  }

  return { getIndex, getHtml, getPdf };
}
