import { describe, expect, it } from "vitest";
import {
  buildConversationCookie,
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
