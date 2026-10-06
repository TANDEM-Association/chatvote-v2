import { createHmac, randomUUID } from "node:crypto";

/** Cookie posé par le serveur (HttpOnly) : identifiant pseudonyme du visiteur, transmis à Zaq (`user_id`). */
export const USER_ID_COOKIE_NAME = "userID";
/** Cookie posé par le navigateur à l'événement `zaq:conversation` : reprise de la conversation. */
export const CONVERSATION_ID_COOKIE_NAME = "conversationId";

/** Contexte transmis au chat (V1 : une seule commune). */
export const PROMPT_CONTEXT = "Saint-Saturnin 63450";

/** Durée de validité du jeton, en secondes (Zaq accepte 300 au maximum). */
export const TOKEN_TTL_SECONDS = 240;

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Format de l'identifiant de conversation non documenté par Zaq : on accepte
// un jeu de caractères sûr plutôt que de recopier une valeur arbitraire dans le jeton.
const CONVERSATION_ID_RE = /^[A-Za-z0-9_-]{1,255}$/;

export function isValidUserId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}

export function isValidConversationId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && CONVERSATION_ID_RE.test(value);
}

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
