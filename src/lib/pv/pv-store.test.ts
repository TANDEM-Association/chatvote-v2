import { describe, expect, it, vi } from "vitest";
import { buildPvCommuneIndex } from "./pv-format";
import { createPvStore } from "./pv-store";

const BASE = "https://stockage.test/pv";

const INDEX = buildPvCommuneIndex("63396", [
  {
    id: "2025-01-29",
    date: "2025-01-29",
    resume: "Résumé.",
    sujets: ["A", "B"],
    nbDeliberations: 2,
    sourceUrl: null,
    statutRelecture: "relu par agent",
  },
]);

const MD =
  "---\ntype: pv-augmente\n---\n\n# Titre\n\n## L'essentiel\n\nTexte\n";

/** Faux stockage : chemin relatif → réponse. Compte les appels. */
function fakeStorage(files: Record<string, () => Response>) {
  return vi.fn(async (input: string | URL | Request) => {
    const path = String(input).slice(BASE.length + 1);
    const file = files[path];
    return file ? file() : new Response("", { status: 404 });
  });
}

const json = (data: unknown) => () => Response.json(data);
const text = (body: string) => () => new Response(body);

function setup(
  files: Record<string, () => Response>,
  baseUrl: string | undefined = BASE,
) {
  let time = 0;
  const fetch = fakeStorage(files);
  const store = createPvStore({
    baseUrl,
    fetch,
    now: () => time,
    ttlMs: 1000,
    errorTtlMs: 100,
  });
  return { store, fetch, advance: (ms: number) => (time += ms) };
}

describe("createPvStore", () => {
  it("lit l'index d'une commune", async () => {
    const { store } = setup({ "63396/index.json": json(INDEX) });
    expect(await store.getIndex("63396")).toEqual({
      status: "ok",
      value: INDEX,
    });
  });

  it("répond « none » sans stockage configuré, sans appel réseau", async () => {
    const { store, fetch } = setup({}, "");
    expect(await store.getIndex("63396")).toEqual({ status: "none" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("répond « none » pour une commune sans PV (404 ou 403)", async () => {
    const { store } = setup({
      "2A004/index.json": () => new Response("", { status: 403 }),
    });
    expect(await store.getIndex("63450")).toEqual({ status: "none" });
    expect(await store.getIndex("2A004")).toEqual({ status: "none" });
  });

  it("refuse un code INSEE invalide sans appel réseau", async () => {
    const { store, fetch } = setup({});
    expect(await store.getIndex("../x")).toEqual({ status: "none" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("signale une panne, un index invalide ou une exception", async () => {
    const { store } = setup({
      "63396/index.json": () => new Response("", { status: 500 }),
      "63450/index.json": json({ formatVersion: 99 }),
      "2A004/index.json": () => {
        throw new TypeError("fetch failed");
      },
    });
    expect(await store.getIndex("63396")).toEqual({ status: "error" });
    expect(await store.getIndex("63450")).toEqual({ status: "error" });
    expect(await store.getIndex("2A004")).toEqual({ status: "error" });
  });

  it("met l'index en cache jusqu'à expiration", async () => {
    const { store, fetch, advance } = setup({
      "63396/index.json": json(INDEX),
    });
    await store.getIndex("63396");
    await store.getIndex("63396");
    expect(fetch).toHaveBeenCalledTimes(1);
    advance(1001);
    await store.getIndex("63396");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("partage une seule requête entre appels simultanés", async () => {
    const { store, fetch } = setup({ "63396/index.json": json(INDEX) });
    await Promise.all([store.getIndex("63396"), store.getIndex("63396")]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("garde une erreur moins longtemps qu'un succès", async () => {
    const { store, fetch, advance } = setup({
      "63396/index.json": () => new Response("", { status: 503 }),
    });
    await store.getIndex("63396");
    advance(50);
    await store.getIndex("63396");
    expect(fetch).toHaveBeenCalledTimes(1);
    advance(51);
    await store.getIndex("63396");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("convertit le Markdown d'une séance publiée", async () => {
    const { store } = setup({
      "63396/index.json": json(INDEX),
      "63396/2025-01-29.md": text(MD),
    });
    const result = await store.getHtml("63396", "2025-01-29");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.value).toContain("<h2>L'essentiel</h2>");
      expect(result.value).not.toContain("<h1");
    }
  });

  it("ne lit pas un document absent de l'index", async () => {
    const { store, fetch } = setup({
      "63396/index.json": json(INDEX),
      "63396/2025-03-26.md": text(MD),
    });
    expect(await store.getHtml("63396", "2025-03-26")).toEqual({
      status: "none",
    });
    expect(await store.getHtml("63396", "../../secret")).toEqual({
      status: "none",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("relaie le PDF d'une séance publiée", async () => {
    const { store } = setup({
      "63396/index.json": json(INDEX),
      "63396/2025-01-29.pdf": () =>
        new Response("%PDF-1.7", {
          headers: { "Content-Type": "application/pdf" },
        }),
    });
    const result = await store.getPdf("63396", "2025-01-29");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(await result.value.text()).toBe("%PDF-1.7");
    }
  });

  it("signale un PDF manquant alors que la séance est publiée", async () => {
    const { store } = setup({ "63396/index.json": json(INDEX) });
    expect(await store.getPdf("63396", "2025-01-29")).toEqual({
      status: "none",
    });
  });
});
