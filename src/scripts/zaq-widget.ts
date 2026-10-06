import {
  hasConversationCookie,
  storeConversationId,
} from "../lib/conversation-cookie";

interface ZaqWidget {
  init(options: { identity_token: string }): Promise<unknown>;
  updateSettings(settings: {
    theme?: "light" | "dark" | "auto";
    language?: "en" | "fr" | "ar";
  }): Promise<unknown>;
}

declare global {
  interface Window {
    zaq?: { widget?: ZaqWidget };
  }
}

const IDENTITY_ENDPOINT = "/api/widget-identity";
const COOKIE_MAX_AGE = Number(
  import.meta.env.PUBLIC_USER_ID_COOKIE_MAX_AGE ?? 31536000,
);

async function fetchIdentityToken(): Promise<string> {
  const response = await fetch(IDENTITY_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`identité Zaq : HTTP ${response.status}`);
  const { identity_token } = (await response.json()) as {
    identity_token?: unknown;
  };
  if (typeof identity_token !== "string") {
    throw new Error("identité Zaq : jeton absent");
  }
  return identity_token;
}

/** Masque l'accueil (logo + texte) dès qu'une conversation existe. */
const stage = document.querySelector<HTMLElement>("[data-zaq-stage]");
const markConversationStarted = () => stage?.setAttribute("data-started", "");
if (hasConversationCookie(document.cookie)) markConversationStarted();

let pending: Promise<void> | null = null;

/** Récupère un jeton puis (ré)initialise le widget. Un seul appel à la fois. */
function authenticate(widget: ZaqWidget): Promise<void> {
  pending ??= fetchIdentityToken()
    .then((identity_token) => widget.init({ identity_token }))
    .then(() => undefined)
    .finally(() => {
      pending = null;
    });
  return pending;
}

async function setup(widget: ZaqWidget) {
  // Les événements sont émis sur l'iframe #zaq-widget, créée par embed.js :
  // écoute en capture sur le document, quel que soit le moment de sa création.
  document.addEventListener(
    "zaq:authentication-required",
    () => {
      authenticate(widget).catch(console.error);
    },
    true,
  );
  document.addEventListener(
    "zaq:conversation",
    (event) => {
      const detail = (event as CustomEvent<{ conversation_id?: unknown }>)
        .detail;
      markConversationStarted();
      storeConversationId(document, detail?.conversation_id, COOKIE_MAX_AGE);
    },
    true,
  );

  await widget.updateSettings({ theme: "dark", language: "fr" });
  await authenticate(widget);
}

/** embed.js est chargé en defer : on attend que `zaq.widget` existe. */
function whenWidgetReady(callback: (widget: ZaqWidget) => void) {
  let started = false;
  const check = () => {
    const widget = window.zaq?.widget;
    if (widget && !started) {
      started = true;
      callback(widget);
    }
  };
  check();
  if (started) return;

  const embed = document.querySelector<HTMLScriptElement>(
    "script[data-widget-id]",
  );
  embed?.addEventListener("load", check);
  window.addEventListener("load", check);
}

whenWidgetReady((widget) => {
  setup(widget).catch(console.error);
});
