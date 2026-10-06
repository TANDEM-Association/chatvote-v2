import { createHmac, randomUUID } from "node:crypto";

export {
  CONVERSATION_ID_COOKIE_NAME,
  isValidConversationId,
  isValidUserId,
  USER_ID_COOKIE_NAME,
} from "./zaq-ids";

/** Contexte transmis au chat (V1 : une seule commune). */
export const PROMPT_CONTEXT = "Je vais te poser des questions sur la ville de Saint-Saturnin dont le code postal est 63450";

/** Durée de validité du jeton, en secondes (Zaq accepte 300 au maximum). */
export const TOKEN_TTL_SECONDS = 240;

export interface IdentityConfig {
  signingKey: string;
  issuer: string;
  audience: string;
  widgetId: number;
}

export interface IdentityInput {
  userId: string;
  conversationId: string | null;
  /** Secondes Unix. */
  now: number;
  jti?: string;
}

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url");

/** Signe un jeton d'identité HS256 pour le widget Zaq. */
export function signIdentityToken(
  config: IdentityConfig,
  input: IdentityInput,
): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      widget_id: config.widgetId,
      user_id: input.userId,
      conversation_id: input.conversationId,
      prompt_context: PROMPT_CONTEXT,
      iss: config.issuer,
      aud: config.audience,
      iat: input.now,
      exp: input.now + TOKEN_TTL_SECONDS,
      jti: input.jti ?? randomUUID(),
    }),
  );
  const signature = createHmac("sha256", config.signingKey)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}
