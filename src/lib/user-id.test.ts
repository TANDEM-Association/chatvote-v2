import { describe, expect, it } from "vitest";
import {
  buildUserIdCookie,
  getOrCreateUserId,
  isValidUserId,
  readUserId,
  USER_ID_COOKIE_NAME,
} from "./user-id";

const VALID = "3b241101-e2bb-4255-8caf-4136c566a962";
const OTHER = "9b2f6c1e-7a4d-4e0b-9c3a-1f5d8e2a6b47";
const MAX_AGE = 31536000;

describe("isValidUserId", () => {
  it("accepte un UUID v4", () => {
    expect(isValidUserId(VALID)).toBe(true);
  });

  it.each([
    "",
    "abc",
    "3b241101-e2bb-1255-8caf-4136c566a962", // version 1
    "3b241101-e2bb-4255-1caf-4136c566a962", // variante invalide
    `${VALID}x`,
    "<script>alert(1)</script>",
  ])("refuse %j", (value) => {
    expect(isValidUserId(value)).toBe(false);
  });
});

describe("readUserId", () => {
  it("lit le cookie parmi d'autres", () => {
    expect(readUserId(`a=1; ${USER_ID_COOKIE_NAME}=${VALID}; b=2`)).toBe(VALID);
  });

  it("renvoie null si absent ou invalide", () => {
    expect(readUserId("")).toBeNull();
    expect(readUserId("a=1")).toBeNull();
    expect(readUserId(`${USER_ID_COOKIE_NAME}=nope`)).toBeNull();
  });

  it("ne confond pas avec un cookie au nom proche", () => {
    expect(readUserId(`x${USER_ID_COOKIE_NAME}=${VALID}`)).toBeNull();
  });
});

describe("buildUserIdCookie", () => {
  it("pose les attributs prévus, sans Domain ni HttpOnly", () => {
    const cookie = buildUserIdCookie(VALID, MAX_AGE);
    expect(cookie).toBe(
      `userID=${VALID}; Path=/; Max-Age=${MAX_AGE}; Secure; SameSite=Lax`,
    );
    expect(cookie).not.toMatch(/Domain|HttpOnly/i);
  });
});

describe("getOrCreateUserId", () => {
  it("réutilise l'identifiant existant sans écrire", () => {
    let writes = 0;
    const jar = {
      get cookie() {
        return `${USER_ID_COOKIE_NAME}=${VALID}`;
      },
      set cookie(_value: string) {
        writes++;
      },
    };
    expect(getOrCreateUserId(jar, MAX_AGE, () => OTHER)).toBe(VALID);
    expect(writes).toBe(0);
  });

  it("génère et stocke un identifiant si le cookie est absent", () => {
    const jar = { cookie: "" };
    const writes: string[] = [];
    const tracked = {
      get cookie() {
        return jar.cookie;
      },
      set cookie(value: string) {
        writes.push(value);
        jar.cookie = value.split(";")[0] ?? "";
      },
    };
    expect(getOrCreateUserId(tracked, MAX_AGE, () => OTHER)).toBe(OTHER);
    expect(writes).toEqual([buildUserIdCookie(OTHER, MAX_AGE)]);
    // Rechargement : le même identifiant est réutilisé.
    expect(getOrCreateUserId(tracked, MAX_AGE, () => VALID)).toBe(OTHER);
  });

  it("remplace une valeur invalide par un nouvel identifiant valide", () => {
    const jar = { cookie: `${USER_ID_COOKIE_NAME}=garbage` };
    const id = getOrCreateUserId(jar, MAX_AGE, () => OTHER);
    expect(id).toBe(OTHER);
    expect(jar.cookie).toBe(buildUserIdCookie(OTHER, MAX_AGE));
  });

  it("garde un identifiant éphémère si l'écriture échoue", () => {
    const blocked = {
      get cookie() {
        return "";
      },
      set cookie(_value: string) {
        throw new Error("cookies bloqués");
      },
    };
    expect(getOrCreateUserId(blocked, MAX_AGE, () => OTHER)).toBe(OTHER);
  });

  it("garde un identifiant éphémère si le navigateur ignore silencieusement le cookie", () => {
    const ignoring = {
      get cookie() {
        return "";
      },
      set cookie(_value: string) {},
    };
    expect(getOrCreateUserId(ignoring, MAX_AGE, () => OTHER)).toBe(OTHER);
  });

  it("génère par défaut un UUID v4 valide", () => {
    expect(isValidUserId(getOrCreateUserId({ cookie: "" }, MAX_AGE))).toBe(
      true,
    );
  });
});
