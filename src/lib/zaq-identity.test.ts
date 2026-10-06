import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isValidConversationId,
  isValidUserId,
  PROMPT_CONTEXT,
  signIdentityToken,
  TOKEN_TTL_SECONDS,
} from "./zaq-identity";

const config = {
  signingKey: "secret",
  issuer: "iss-test",
  audience: "aud-test",
  widgetId: 13,
};
const USER = "3b241101-e2bb-4255-8caf-4136c566a962";

const decode = (part: string) =>
  JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("signIdentityToken", () => {
  const token = signIdentityToken(config, {
    userId: USER,
    conversationId: null,
    now: 1000,
    jti: "0123456789abcdef",
  });
  const [header, payload, signature] = token.split(".") as [
    string,
    string,
    string,
  ];

  it("utilise l'en-tête HS256 attendu", () => {
    expect(decode(header)).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("contient les claims requis par Zaq", () => {
    expect(decode(payload)).toEqual({
      widget_id: 13,
      user_id: USER,
      conversation_id: null,
      prompt_context: PROMPT_CONTEXT,
      iss: "iss-test",
      aud: "aud-test",
      iat: 1000,
      exp: 1000 + TOKEN_TTL_SECONDS,
      jti: "0123456789abcdef",
    });
  });

  it("expire au plus 300 s après l'émission", () => {
    expect(TOKEN_TTL_SECONDS).toBeLessThanOrEqual(300);
  });

  it("est signé en HMAC-SHA256 avec la clé", () => {
    const expected = createHmac("sha256", "secret")
      .update(`${header}.${payload}`)
      .digest("base64url");
    expect(signature).toBe(expected);
  });

  it("génère un jti de 16 à 255 caractères par défaut", () => {
    const t = signIdentityToken(config, {
      userId: USER,
      conversationId: "abc",
      now: 1,
    });
    const claims = decode(t.split(".")[1] as string);
    expect(claims.jti.length).toBeGreaterThanOrEqual(16);
    expect(claims.conversation_id).toBe("abc");
  });
});

describe("isValidUserId", () => {
  it("accepte un UUID v4 et rejette le reste", () => {
    expect(isValidUserId(USER)).toBe(true);
    for (const v of ["", "abc", undefined, `${USER}x`]) {
      expect(isValidUserId(v)).toBe(false);
    }
  });
});

describe("isValidConversationId", () => {
  it("accepte un identifiant sûr et rejette le reste", () => {
    expect(isValidConversationId("42")).toBe(true);
    expect(isValidConversationId(USER)).toBe(true);
    for (const v of ["", "a b", "a;b", "a".repeat(256), undefined]) {
      expect(isValidConversationId(v)).toBe(false);
    }
  });
});
