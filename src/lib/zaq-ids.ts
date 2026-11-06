// Partagé serveur/navigateur : aucun import Node ici.

/** Cookie posé par le serveur (HttpOnly) : identifiant pseudonyme du visiteur, transmis à Zaq (`user_id`). */
export const USER_ID_COOKIE_NAME = "userID";
/** Cookie posé par le navigateur à l'événement `zaq:conversation` : reprise de la conversation. */
export const CONVERSATION_ID_COOKIE_NAME = "conversationId";

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
