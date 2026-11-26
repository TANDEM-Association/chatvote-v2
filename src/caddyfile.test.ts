import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { globalHeader, pathHeader } from "./caddyfile-helper";

const envExample = readFileSync(
  new URL("../.env.example", import.meta.url),
  "utf8",
);
const zaqUrl = new URL(/^PUBLIC_ZAQ_URL=(.+)$/m.exec(envExample)?.[1] ?? "");
const zaqOrigin = zaqUrl.origin;
const zaqWebSocket = `wss://${zaqUrl.host}`;

describe("deploy/base/Caddyfile", () => {
  const csp = globalHeader("Content-Security-Policy");

  it("autorise exactement l'origine Zaq de .env.example (script, iframe, API, WebSocket)", () => {
    expect(csp).toMatch(new RegExp(`script-src 'self' ${zaqOrigin}[ ;]`));
    expect(csp).toContain(`frame-src ${zaqOrigin};`);
    expect(csp).toContain(`connect-src 'self' ${zaqOrigin} ${zaqWebSocket}`);
    expect(globalHeader("Permissions-Policy")).toContain(`"${zaqOrigin}"`);
  });

  it.each(["/fonts/*", "/zaq-widget.css"])(
    "autorise l'origine Zaq à charger %s depuis l'iframe (CORS)",
    (path) => {
      expect(pathHeader(path, "Access-Control-Allow-Origin")).toBe(zaqOrigin);
    },
  );

  it("pose les en-têtes de cache attendus par chemin", () => {
    const immutable = "public, max-age=31536000, immutable";
    expect(pathHeader("/_astro/*", "Cache-Control")).toBe(immutable);
    expect(pathHeader("/fonts/*", "Cache-Control")).toBe(immutable);
    expect(pathHeader("/zaq-widget.css", "Cache-Control")).toBe(
      "public, max-age=3600",
    );
    expect(pathHeader("/communes-index.json", "Cache-Control")).toBe(
      "public, max-age=3600",
    );
  });

  it("pose les autres en-têtes de sécurité sur toutes les réponses", () => {
    expect(globalHeader("X-Content-Type-Options")).toBe("nosniff");
    expect(globalHeader("X-Frame-Options")).toBe("DENY");
    expect(globalHeader("Strict-Transport-Security")).toBe("max-age=31536000");
    expect(globalHeader("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("n'utilise ni unsafe-inline, ni unsafe-eval, ni joker", () => {
    expect(csp).not.toMatch(/unsafe-|\*/);
  });

  it("interdit d'être intégré ailleurs", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
