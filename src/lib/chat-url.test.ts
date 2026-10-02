import { describe, expect, it } from "vitest";
import { buildChatUrl, type ChatUrlConfig } from "./chat-url";

const config: ChatUrlConfig = {
  chatUrl: "https://app.chatvote.org/chat",
  municipalityParam: "municipality_code",
  defaultMunicipalityCode: "63396",
  userIdParam: "userID",
};
const UID = "3b241101-e2bb-4255-8caf-4136c566a962";

function params(url: string) {
  return Object.fromEntries(new URL(url).searchParams);
}

describe("buildChatUrl", () => {
  it("utilise le code par défaut sans paramètre parent", () => {
    const url = buildChatUrl(config, "", UID);
    expect(url).toBe(
      `https://app.chatvote.org/chat?municipality_code=63396&userID=${UID}`,
    );
  });

  it("utilise municipalityCode de l'URL parente s'il est valide", () => {
    expect(
      params(buildChatUrl(config, "?municipalityCode=63001", UID)),
    ).toEqual({
      municipality_code: "63001",
      userID: UID,
    });
  });

  it("retombe sur la valeur par défaut si le code est invalide", () => {
    const p = params(buildChatUrl(config, "?municipalityCode=abc", UID));
    expect(p.municipality_code).toBe("63396");
  });

  it("ne relaie aucun autre paramètre du parent", () => {
    const p = params(
      buildChatUrl(
        config,
        "?foo=bar&userID=forged&municipalityCode=63001",
        UID,
      ),
    );
    expect(p).toEqual({ municipality_code: "63001", userID: UID });
  });

  it("encode correctement les valeurs", () => {
    const url = buildChatUrl(config, "?municipalityCode=63396%26x%3D1", UID);
    expect(new URL(url).searchParams.has("x")).toBe(false);
  });

  it("respecte les noms de paramètres configurés", () => {
    const p = params(
      buildChatUrl(
        { ...config, municipalityParam: "commune", userIdParam: "uid" },
        "",
        UID,
      ),
    );
    expect(p).toEqual({ commune: "63396", uid: UID });
  });
});
