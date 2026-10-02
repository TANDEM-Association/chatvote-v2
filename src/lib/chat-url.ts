import { resolveMunicipalityCode } from "./municipality";

export interface ChatUrlConfig {
  /** URL de base du chat, absolue. */
  chatUrl: string;
  /** Nom du paramètre « code commune » attendu par le chat. */
  municipalityParam: string;
  defaultMunicipalityCode: string;
  /** Nom du paramètre « userID » attendu par le chat. */
  userIdParam: string;
}

/** Paramètres de l'URL parente relayés tels quels vers le chat (liste blanche). */
// TODO: à définir avec l'équipe du chat (institutionId, conseilView… ?).
const RELAYED_PARAMS: readonly string[] = [];

/** Nom du paramètre de l'URL parente portant le code commune. */
export const PARENT_MUNICIPALITY_PARAM = "municipalityCode";

export function buildChatUrl(
  config: ChatUrlConfig,
  parentSearch: string,
  userId: string,
): string {
  const parent = new URLSearchParams(parentSearch);
  const url = new URL(config.chatUrl);

  url.searchParams.set(
    config.municipalityParam,
    resolveMunicipalityCode(
      parent.get(PARENT_MUNICIPALITY_PARAM),
      config.defaultMunicipalityCode,
    ),
  );
  for (const name of RELAYED_PARAMS) {
    const value = parent.get(name);
    if (value !== null) url.searchParams.set(name, value);
  }
  url.searchParams.set(config.userIdParam, userId);

  return url.toString();
}
