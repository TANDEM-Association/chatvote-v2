import type { APIRoute } from "astro";
// `?raw` : le fichier est servi tel quel, sans que TypeScript n'en infère le type (3 Mo).
import index from "../data/generated/communes-index.json?raw";

// Route statique (pré-rendue au build) : le navigateur charge l'index au premier
// focus du champ de recherche. Généré par scripts/build-communes-index.ts.
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(index, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
