import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const vercel = JSON.parse(read("../vercel.json")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const header = (key: string) =>
  vercel.headers.flatMap((h) => h.headers).find((h) => h.key === key)?.value ??
  "";

const zaqUrl = new URL(
  /^PUBLIC_ZAQ_URL=(.+)$/m.exec(read("../.env.example"))?.[1] ?? "",
);
const zaqOrigin = zaqUrl.origin;
const zaqWebSocket = `wss://${zaqUrl.host}`;

describe("vercel.json", () => {
  const csp = header("Content-Security-Policy");

  it("autorise exactement l'origine Zaq de .env.example (script, iframe, API, WebSocket)", () => {
    expect(csp).toMatch(new RegExp(`script-src 'self' ${zaqOrigin}[ ;]`));
    expect(csp).toContain(`frame-src ${zaqOrigin};`);
    expect(csp).toContain(`connect-src 'self' ${zaqOrigin} ${zaqWebSocket}`);
    expect(header("Permissions-Policy")).toContain(`"${zaqOrigin}"`);
  });

  it.each(["/fonts/(.*)", "/zaq-widget.css"])(
    "autorise l'origine Zaq à charger %s depuis l'iframe (CORS)",
    (source) => {
      const rule = vercel.headers.find((h) => h.source === source);
      expect(
        rule?.headers.find((h) => h.key === "Access-Control-Allow-Origin")
          ?.value,
      ).toBe(zaqOrigin);
    },
  );

  it("n'utilise ni unsafe-inline, ni unsafe-eval, ni joker", () => {
    expect(csp).not.toMatch(/unsafe-|\*/);
  });

  it("interdit d'être intégré ailleurs", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
