import { createHmac, randomUUID } from "node:crypto";

export {
  CONVERSATION_ID_COOKIE_NAME,
  isValidConversationId,
  isValidUserId,
  PROMPT_CONTEXT,
  USER_ID_COOKIE_NAME,
} from "./zaq-ids";

/** Durée de validité du jeton, en secondes (Zaq : 7 jours au maximum par défaut ; le jeton doit être utilisé dans les 5 s). */
export const TOKEN_TTL_SECONDS = 240;

export interface IdentityConfig {
  signingKey: string;
  issuer: string;
  audience: string;
  widgetId: number;
}

export interface IdentityInput {
  userId: string;
  /** Secondes Unix. */
  now: number;
  jti?: string;
}

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url");

/** Signe un jeton d'identité HS256 pour le widget Zaq. Zaq rejette toute claim inconnue (dont `conversation_id` et `prompt_context`). */
export function signIdentityToken(
  config: IdentityConfig,
  input: IdentityInput,
): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      widget_id: config.widgetId,
      user_id: input.userId,
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
