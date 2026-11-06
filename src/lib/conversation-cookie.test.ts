import { describe, expect, it } from "vitest";
import {
  buildConversationCookie,
  readConversationId,
  storeConversationId,
} from "./conversation-cookie";

describe("storeConversationId", () => {
  it("écrit un cookie first-party `commune:id` pour une valeur valide", () => {
    const jar = { cookie: "" };
    expect(storeConversationId(jar, "63396", "42", 100)).toBe(true);
    expect(jar.cookie).toBe(buildConversationCookie("63396", "42", 100));
    expect(jar.cookie.startsWith("conversationId=63396:42;")).toBe(true);
    expect(jar.cookie).toContain("Path=/; Max-Age=100; Secure; SameSite=Lax");
    expect(jar.cookie).not.toContain("Domain");
  });

  it("accepte une commune corse", () => {
    const jar = { cookie: "" };
    expect(storeConversationId(jar, "2A004", "42", 100)).toBe(true);
    expect(jar.cookie.startsWith("conversationId=2A004:42;")).toBe(true);
  });

  it.each([undefined, null, 42, "", "a;b", "a b", "a:b"])(
    "ignore l'identifiant invalide %j",
    (value) => {
      const jar = { cookie: "" };
      expect(storeConversationId(jar, "63396", value, 100)).toBe(false);
      expect(jar.cookie).toBe("");
    },
  );

  it.each(["", "abc", "6339", "63396;x", "2a004"])(
    "ignore le code de commune invalide %j",
    (code) => {
      const jar = { cookie: "" };
      expect(storeConversationId(jar, code, "42", 100)).toBe(false);
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
    expect(storeConversationId(jar, "63396", "42", 100)).toBe(false);
  });
});

describe("readConversationId", () => {
  it("relit l'identifiant de la commune courante", () => {
    expect(
      readConversationId(
        { cookie: "a=1; conversationId=63396:42; b=2" },
        "63396",
      ),
    ).toBe("42");
    expect(
      readConversationId({ cookie: "conversationId=2A004:abc_-1" }, "2A004"),
    ).toBe("abc_-1");
  });

  it("ignore la conversation d'une autre commune", () => {
    expect(
      readConversationId({ cookie: "conversationId=72320:42" }, "63396"),
    ).toBeNull();
  });

  it("ignore l'ancien format, sans commune", () => {
    expect(
      readConversationId({ cookie: "conversationId=42" }, "63396"),
    ).toBeNull();
  });

  it.each([
    "",
    "a=1",
    "conversationId=",
    "conversationId=63396:",
    "conversationId=63396:a b",
    "conversationId=63396:a:b",
    "conversationId=:42",
  ])("renvoie null pour %j", (cookie) => {
    expect(readConversationId({ cookie }, "63396")).toBeNull();
  });

  it("renvoie null si les cookies sont bloqués", () => {
    const jar = {
      get cookie(): string {
        throw new Error("blocked");
      },
    };
    expect(readConversationId(jar, "63396")).toBeNull();
  });

  it("relit ce qui vient d'être écrit, et seulement pour la même commune", () => {
    const written =
      buildConversationCookie("63396", "xyz", 100).split(";")[0] ?? "";
    expect(readConversationId({ cookie: written }, "63396")).toBe("xyz");
    expect(readConversationId({ cookie: written }, "2A004")).toBeNull();
  });
});
