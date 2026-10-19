import {
  readConversationId,
  storeConversationId,
} from "../lib/conversation-cookie";
import { PROMPT_CONTEXT } from "../lib/zaq-ids";

interface ZaqWidget {
  isReady(): boolean;
  updateSettings(settings: {
    theme?: "light" | "dark" | "auto";
    language?: "en" | "fr" | "ar";
  }): Promise<unknown> | unknown;
  updateContext(context: {
    conversation_id?: string;
    prompt_context?: string;
  }): Promise<unknown> | unknown;
}

declare global {
  interface Window {
    zaq?: { widget?: ZaqWidget };
  }
}

const COOKIE_MAX_AGE = Number(
  import.meta.env.PUBLIC_USER_ID_COOKIE_MAX_AGE ?? 31536000,
);

/** Réglages et contexte, à (ré)appliquer quand le widget est prêt. */
async function configure(widget: ZaqWidget) {
  await widget.updateSettings({ theme: "dark", language: "fr" });
  // Conversation connue : Zaq vérifie qu'elle appartient au visiteur. Sinon,
  // le contexte ne vaut que pour la première question d'une nouvelle conversation.
  const conversationId = readConversationId(document);
  await widget.updateContext(
    conversationId
      ? { conversation_id: conversationId }
      : { prompt_context: PROMPT_CONTEXT },
  );
}

function setup(widget: ZaqWidget) {
  // embed.js récupère et renouvelle le jeton (data-token-url). Les événements
  // sont émis sur l'iframe #zaq-widget, créée à l'exécution : écoute en capture
  // sur le document.
  document.addEventListener(
    "zaq:ready",
    () => {
      Promise.resolve(configure(widget)).catch(console.error);
    },
    true,
  );
  document.addEventListener(
    "zaq:conversation",
    (event) => {
      const detail = (event as CustomEvent<{ conversation_id?: unknown }>)
        .detail;
      storeConversationId(document, detail?.conversation_id, COOKIE_MAX_AGE);
    },
    true,
  );

  // `zaq:ready` a pu être émis avant notre écoute.
  if (widget.isReady()) {
    Promise.resolve(configure(widget)).catch(console.error);
  }
}

/** embed.js est chargé en defer : on attend que `zaq.widget` existe. */
function whenWidgetExists(callback: (widget: ZaqWidget) => void) {
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

whenWidgetExists(setup);
