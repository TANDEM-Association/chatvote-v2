import { describe, expect, it } from "vitest";
import type { SearchHit } from "./search";
import {
  buildCommuneHref,
  computePopoverPlacement,
  describeHit,
} from "./switcher-ui";

describe("buildCommuneHref", () => {
  it("construit un lien vers la commune", () => {
    expect(buildCommuneHref("63396")).toBe("/?commune=63396");
    expect(buildCommuneHref("2A004")).toBe("/?commune=2A004");
  });

  it("encode toute valeur inattendue", () => {
    expect(buildCommuneHref("a&b=c")).toBe("/?commune=a%26b%3Dc");
  });
});

describe("describeHit", () => {
  const hit: SearchHit = {
    code: "63396",
    name: "Saint-Saturnin",
    departmentLabel: "Puy-de-Dôme",
    postalCode: "63450",
    available: true,
  };

  it("affiche département, code INSEE et code postal", () => {
    expect(describeHit(hit)).toEqual({
      name: "Saint-Saturnin",
      meta: "Puy-de-Dôme · 63396 (63450)",
      available: true,
    });
  });

  it("omet le département identique au nom (Paris)", () => {
    expect(
      describeHit({
        ...hit,
        name: "Paris",
        code: "75056",
        departmentLabel: null,
        postalCode: "75001",
        available: false,
      }),
    ).toEqual({ name: "Paris", meta: "75056 (75001)", available: false });
  });

  it("omet le code postal quand il n'y en a pas", () => {
    expect(describeHit({ ...hit, postalCode: null }).meta).toBe(
      "Puy-de-Dôme · 63396",
    );
  });
});

describe("computePopoverPlacement", () => {
  const desktop = { width: 1280, height: 800 };

  it("centre le popover sur l'axe vertical de la pastille", () => {
    const placement = computePopoverPlacement({
      variant: "pill",
      trigger: { left: 800, width: 200, bottom: 100 },
      viewport: desktop,
    });
    expect(placement.width).toBe(320);
    // Centre de la pastille : 900 ; centre du popover : left + 160.
    expect(placement.left + placement.width / 2).toBe(900);
    expect(placement.top).toBe(110);
  });

  it("ne sort pas de l'écran à droite ni à gauche", () => {
    const right = computePopoverPlacement({
      variant: "pill",
      trigger: { left: 1200, width: 100, bottom: 100 },
      viewport: desktop,
    });
    expect(right.left + right.width).toBe(desktop.width - 8);
    const left = computePopoverPlacement({
      variant: "pill",
      trigger: { left: 0, width: 40, bottom: 100 },
      viewport: desktop,
    });
    expect(left.left).toBe(8);
  });

  it("se rétrécit sur un écran plus étroit que le popover", () => {
    const placement = computePopoverPlacement({
      variant: "pill",
      trigger: { left: 10, width: 100, bottom: 100 },
      viewport: { width: 300, height: 600 },
    });
    expect(placement.width).toBe(284);
    expect(placement.left).toBe(8);
  });

  it("aligne la feuille mobile à gauche, sur presque toute la largeur", () => {
    const placement = computePopoverPlacement({
      variant: "bar",
      trigger: { left: 0, width: 375, bottom: 152 },
      viewport: { width: 375, height: 667 },
    });
    expect(placement).toMatchObject({ left: 8, width: 359, top: 160 });
  });

  it("plafonne la largeur de la feuille sur tablette", () => {
    const placement = computePopoverPlacement({
      variant: "bar",
      trigger: { left: 0, width: 900, bottom: 150 },
      viewport: { width: 900, height: 900 },
    });
    expect(placement.width).toBe(448);
  });

  it("limite la hauteur à l'espace restant (clavier virtuel), jamais sous 160 px", () => {
    const tall = computePopoverPlacement({
      variant: "bar",
      trigger: { left: 0, width: 375, bottom: 152 },
      viewport: { width: 375, height: 667 },
    });
    expect(tall.maxHeight).toBe(416);
    const shortScreen = computePopoverPlacement({
      variant: "bar",
      trigger: { left: 0, width: 375, bottom: 152 },
      viewport: { width: 375, height: 320 },
    });
    expect(shortScreen.maxHeight).toBe(160);
    const keyboard = computePopoverPlacement({
      variant: "bar",
      trigger: { left: 0, width: 375, bottom: 152 },
      viewport: { width: 375, height: 420 },
    });
    expect(keyboard.maxHeight).toBe(420 - 160 - 8);
  });
});
