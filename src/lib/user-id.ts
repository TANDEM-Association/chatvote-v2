export const USER_ID_COOKIE_NAME = "userID";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUserId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}

/** Lit le userID dans une chaîne `document.cookie`. Renvoie null si absent ou invalide. */
export function readUserId(cookieString: string): string | null {
  for (const part of cookieString.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === USER_ID_COOKIE_NAME) {
      const value = rest.join("=");
      return isValidUserId(value) ? value : null;
    }
  }
  return null;
}

/** Cookie first-party : sans Domain (lié au domaine exact), posé en JS donc sans HttpOnly. */
export function buildUserIdCookie(id: string, maxAgeSeconds: number): string {
  return `${USER_ID_COOKIE_NAME}=${id}; Path=/; Max-Age=${maxAgeSeconds}; Secure; SameSite=Lax`;
}

interface CookieJar {
  cookie: string;
}

/**
 * Réutilise le userID du cookie, sinon en génère un et tente de le stocker.
 * Si le cookie ne peut pas être écrit (cookies bloqués), l'identifiant reste
 * valable pour la page seulement, sans erreur.
 */
export function getOrCreateUserId(
  jar: CookieJar,
  maxAgeSeconds: number,
  generate: () => string = () => crypto.randomUUID(),
): string {
  const existing = readUserId(jar.cookie);
  if (existing) return existing;

  const id = generate();
  try {
    jar.cookie = buildUserIdCookie(id, maxAgeSeconds);
  } catch {
    // Écriture impossible : identifiant éphémère.
  }
  return id;
}
