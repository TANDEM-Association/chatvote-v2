import {
  PUBLIC_ZAQ_WIDGET_ID,
  ZAQ_AUDIENCE,
  ZAQ_ISSUER,
  ZAQ_SIGNING_KEY,
} from "astro:env/server";
import type { APIRoute } from "astro";
import {
  isValidUserId,
  signIdentityToken,
  USER_ID_COOKIE_NAME,
} from "../../lib/zaq-identity";

// Seule route rendue à la demande : le reste du site est statique.
export const prerender = false;

const USER_ID_MAX_AGE = Number(
  import.meta.env.PUBLIC_USER_ID_COOKIE_MAX_AGE ?? 31536000,
);

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

// Appelé en GET par embed.js (`data-token-url`). Same-origin uniquement : un GET
// same-origin n'envoie pas toujours Origin, on s'appuie donc aussi sur Sec-Fetch-Site.
const isSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (origin !== null) return origin === new URL(request.url).origin;
  return request.headers.get("sec-fetch-site") === "same-origin";
};

export const GET: APIRoute = ({ request, cookies }) => {
  if (!isSameOrigin(request)) {
    return json({ error: "forbidden" }, 403);
  }

  // Identifiant pseudonyme stable : permet à Zaq de reconnaître le visiteur.
  const stored = cookies.get(USER_ID_COOKIE_NAME)?.value;
  const userId = isValidUserId(stored) ? stored : crypto.randomUUID();
  if (userId !== stored) {
    cookies.set(USER_ID_COOKIE_NAME, userId, {
      path: "/",
      maxAge: USER_ID_MAX_AGE,
      secure: true,
      sameSite: "lax",
      httpOnly: true,
    });
  }

  const identity_token = signIdentityToken(
    {
      signingKey: ZAQ_SIGNING_KEY,
      issuer: ZAQ_ISSUER,
      audience: ZAQ_AUDIENCE,
      widgetId: PUBLIC_ZAQ_WIDGET_ID,
    },
    { userId, now: Math.floor(Date.now() / 1000) },
  );

  return json({ identity_token }, 200);
};
