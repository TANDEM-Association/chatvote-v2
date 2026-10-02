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

const chatOrigin = new URL(
  /^PUBLIC_CHAT_URL=(.+)$/m.exec(read("../.env.example"))?.[1] ?? "",
).origin;

describe("vercel.json", () => {
  const csp = header("Content-Security-Policy");

  it("autorise en iframe exactement l'origine du chat de .env.example", () => {
    expect(csp).toContain(`frame-src ${chatOrigin};`);
    expect(header("Permissions-Policy")).toContain(`"${chatOrigin}"`);
  });

  it("n'utilise ni unsafe-inline, ni unsafe-eval, ni joker", () => {
    expect(csp).not.toMatch(/unsafe-|\*/);
  });

  it("interdit d'être intégré ailleurs", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
