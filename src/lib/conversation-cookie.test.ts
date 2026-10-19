import { describe, expect, it } from "vitest";
import {
  buildConversationCookie,
  readConversationId,
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

describe("readConversationId", () => {
  it("relit l'identifiant valide", () => {
    expect(readConversationId({ cookie: "a=1; conversationId=42; b=2" })).toBe(
      "42",
    );
  });

  it.each(["", "a=1", "conversationId=a b", "conversationId="])(
    "renvoie null pour %j",
    (cookie) => {
      expect(readConversationId({ cookie })).toBeNull();
    },
  );

  it("renvoie null si les cookies sont bloqués", () => {
    const jar = {
      get cookie(): string {
        throw new Error("blocked");
      },
    };
    expect(readConversationId(jar)).toBeNull();
  });
});
