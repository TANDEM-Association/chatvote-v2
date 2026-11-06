import { isValidCommuneCode } from "../lib/commune/commune-code";
import {
  readConversationId,
  storeConversationId,
} from "../lib/conversation-cookie";

/** Commune affichée et contexte à transmettre, posés par le serveur sur [data-chat-frame] (ZaqWidget.astro). */
interface ChatContext {
  communeCode: string;
  promptContext: string;
}

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

function readChatContext(): ChatContext | null {
  const frame = document.querySelector<HTMLElement>("[data-chat-frame]");
  const communeCode = frame?.dataset.communeCode;
  const promptContext = frame?.dataset.promptContext;
  if (!isValidCommuneCode(communeCode) || !promptContext) {
    console.error(
      "[zaq-widget] Commune ou contexte absent de [data-chat-frame] : widget non configuré.",
    );
    return null;
  }
  return { communeCode, promptContext };
}

/** Réglages et contexte, à (ré)appliquer quand le widget est prêt. */
async function configure(widget: ZaqWidget, chat: ChatContext) {
  // Conversation connue de CETTE commune : Zaq vérifie qu'elle appartient au
  // visiteur. Sinon (aucune, ou celle d'une autre commune), le contexte ne vaut
  // que pour la première question d'une nouvelle conversation.
  // Appelé en premier, comme dans le guide Zaq (directement au `zaq:ready`).
  const conversationId = readConversationId(document, chat.communeCode);
  try {
    await widget.updateContext(
      conversationId
        ? { conversation_id: conversationId }
        : { prompt_context: chat.promptContext },
    );
  } catch (error) {
    console.error(error);
  }
  // Un échec de la reprise ne doit pas empêcher les réglages.
  await widget.updateSettings({ theme: "dark", language: "fr" });
}

function setup(widget: ZaqWidget) {
  const chat = readChatContext();
  if (!chat) return;

  // embed.js récupère et renouvelle le jeton (data-token-url). Les événements
  // sont émis sur l'iframe #zaq-widget, créée à l'exécution : écoute en capture
  // sur le document.
  document.addEventListener(
    "zaq:ready",
    () => {
      Promise.resolve(configure(widget, chat)).catch(console.error);
    },
    true,
  );
  document.addEventListener(
    "zaq:conversation",
    (event) => {
      const detail = (event as CustomEvent<{ conversation_id?: unknown }>)
        .detail;
      storeConversationId(
        document,
        chat.communeCode,
        detail?.conversation_id,
        COOKIE_MAX_AGE,
      );
    },
    true,
  );

  // `zaq:ready` a pu être émis avant notre écoute.
  if (widget.isReady()) {
    Promise.resolve(configure(widget, chat)).catch(console.error);
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
