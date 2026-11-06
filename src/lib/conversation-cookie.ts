import { isValidCommuneCode } from "./commune/commune-code";
import { CONVERSATION_ID_COOKIE_NAME, isValidConversationId } from "./zaq-ids";

// Valeur du cookie : `<code commune>:<id de conversation>` (ex. `63396:abc123`).
// La commune est dans la valeur pour qu'une conversation ne soit jamais reprise
// avec le contexte d'une autre commune (changement par l'URL, lien partagé, retour arrière).

/** Cookie lu par le navigateur pour reprendre la conversation (`updateContext`) ; posé en JS, donc sans HttpOnly. */
export function buildConversationCookie(
  communeCode: string,
  id: string,
  maxAgeSeconds: number,
): string {
  return `${CONVERSATION_ID_COOKIE_NAME}=${communeCode}:${id}; Path=/; Max-Age=${maxAgeSeconds}; Secure; SameSite=Lax`;
}

/** Enregistre l'identifiant de conversation si la commune et l'identifiant sont valides. Ne lève jamais (cookies bloqués). */
export function storeConversationId(
  jar: { cookie: string },
  communeCode: string,
  id: unknown,
  maxAgeSeconds: number,
): boolean {
  if (
    !isValidCommuneCode(communeCode) ||
    typeof id !== "string" ||
    !isValidConversationId(id)
  ) {
    return false;
  }
  try {
    jar.cookie = buildConversationCookie(communeCode, id, maxAgeSeconds);
    return true;
  } catch {
    return false;
  }
}

/**
 * Relit l'identifiant de conversation, ou null : absent, invalide, cookies
 * bloqués, ancien format (sans commune) ou conversation d'une autre commune.
 */
export function readConversationId(
  jar: { cookie: string },
  communeCode: string,
): string | null {
  try {
    for (const part of jar.cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name !== CONVERSATION_ID_COOKIE_NAME) continue;
      const value = rest.join("=");
      const separator = value.indexOf(":");
      if (separator === -1) return null;
      const storedCommune = value.slice(0, separator);
      const id = value.slice(separator + 1);
      return storedCommune === communeCode && isValidConversationId(id)
        ? id
        : null;
    }
  } catch {
    // cookies bloqués
  }
  return null;
}
