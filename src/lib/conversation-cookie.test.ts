import { describe, expect, it } from "vitest";
import {
  buildConversationCookie,
  hasConversationCookie,
  storeConversationId,
} from "./conversation-cookie";

describe("storeConversationId", () => {
  it("écrit un cookie first-party pour un identifiant valide", () => {
    const jar = { cookie: "" };
    expect(storeConversationId(jar, "42", 100)).toBe(true);
    expect(jar.cookie).toBe(buildConversationCookie("42", 100));
    expect(jar.cookie).toContain("Secure; SameSite=Lax");
    expect(jar.cookie).not.toContain("Domain");
  });

  it.each([undefined, null, 42, "", "a;b", "a b"])(
    "ignore la valeur invalide %j",
    (value) => {
      const jar = { cookie: "" };
      expect(storeConversationId(jar, value, 100)).toBe(false);
      expect(jar.cookie).toBe("");
    },
  );

  it("ne lève pas si les cookies sont bloqués", () => {
    const jar = {
      set cookie(_: string) {
        throw new Error("blocked");
      },
      get cookie() {
        return "";
      },
    };
    expect(storeConversationId(jar, "42", 100)).toBe(false);
  });
});

describe("hasConversationCookie", () => {
  it("détecte une conversation valide parmi d'autres cookies", () => {
    expect(hasConversationCookie("a=1; conversationId=42; b=2")).toBe(true);
  });

  it.each([
    "",
    "a=1",
    "conversationId=",
    "conversationId=a b",
    "xconversationId=42",
  ])("renvoie false pour %j", (value) => {
    expect(hasConversationCookie(value)).toBe(false);
  });
});
