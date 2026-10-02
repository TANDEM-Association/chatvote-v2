import { buildChatUrl } from "../lib/chat-url";
import { getOrCreateUserId } from "../lib/user-id";

const frame = document.querySelector<HTMLIFrameElement>(
  "iframe[data-chat-url]",
);
const wrapper = frame?.closest<HTMLElement>("[data-chat-frame]");

if (frame && wrapper) {
  const {
    chatUrl,
    municipalityParam,
    defaultMunicipality,
    userIdParam,
    cookieMaxAge,
  } = frame.dataset;

  if (chatUrl && municipalityParam && defaultMunicipality && userIdParam) {
    const userId = getOrCreateUserId(document, Number(cookieMaxAge));

    frame.addEventListener("load", () => {
      wrapper.dataset.loaded = "";
    });
    frame.src = buildChatUrl(
      {
        chatUrl,
        municipalityParam,
        defaultMunicipalityCode: defaultMunicipality,
        userIdParam,
      },
      window.location.search,
      userId,
    );
  }
}
