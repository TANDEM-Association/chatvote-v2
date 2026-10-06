import { CONVERSATION_ID_COOKIE_NAME, isValidConversationId } from "./zaq-ids";

/** Cookie lu par /api/widget-identity pour reprendre la conversation (posé en JS, donc sans HttpOnly). */
export function buildConversationCookie(
  id: string,
  maxAgeSeconds: number,
): string {
  return `${CONVERSATION_ID_COOKIE_NAME}=${id}; Path=/; Max-Age=${maxAgeSeconds}; Secure; SameSite=Lax`;
}

/** Enregistre l'identifiant de conversation si valide. Ne lève jamais (cookies bloqués). */
export function storeConversationId(
  jar: { cookie: string },
  id: unknown,
  maxAgeSeconds: number,
): boolean {
  if (typeof id !== "string" || !isValidConversationId(id)) return false;
  try {
    jar.cookie = buildConversationCookie(id, maxAgeSeconds);
    return true;
  } catch {
    return false;
  }
}
