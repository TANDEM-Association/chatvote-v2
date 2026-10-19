import { CONVERSATION_ID_COOKIE_NAME, isValidConversationId } from "./zaq-ids";

/** Cookie lu par le navigateur pour reprendre la conversation (`updateContext`) ; posé en JS, donc sans HttpOnly. */
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

/** Relit l'identifiant de conversation enregistré, ou null (absent, invalide, cookies bloqués). */
export function readConversationId(jar: { cookie: string }): string | null {
  try {
    for (const part of jar.cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === CONVERSATION_ID_COOKIE_NAME) {
        const value = rest.join("=");
        return isValidConversationId(value) ? value : null;
      }
    }
  } catch {
    // cookies bloqués
  }
  return null;
}
