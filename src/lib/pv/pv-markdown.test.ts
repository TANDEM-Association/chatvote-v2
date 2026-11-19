import { describe, expect, it } from "vitest";
import { renderPvMarkdown } from "./pv-markdown";

const md = (body: string) => `---\ntype: pv-augmente\n---\n\n${body}\n`;

describe("renderPvMarkdown", () => {
  it("ignore l'en-tête et retire le titre de niveau 1", () => {
    const html = renderPvMarkdown(md("# Synthèse\n\n## L'essentiel\n\nTexte"));
    expect(html).not.toContain("pv-augmente");
    expect(html).not.toContain("<h1");
    expect(html).toContain("<h2>L'essentiel</h2>");
  });

  it("rend les tableaux, le gras et l'italique", () => {
    const html = renderPvMarkdown(
      md(
        "| Point | Pour |\n|---|---|\n| A | 13 |\n\n**Adopté** *Pour comprendre : x*",
      ),
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<strong>Adopté</strong>");
    expect(html).toContain("<em>Pour comprendre : x</em>");
  });

  it("supprime le HTML brut", () => {
    const html = renderPvMarkdown(
      md(
        '<script>alert(1)</script>\n\nTexte <img src=x onerror="alert(1)"> fin',
      ),
    );
    expect(html).not.toMatch(/<script|<img|onerror/);
    expect(html).toContain("Texte");
  });

  it("supprime les images", () => {
    expect(
      renderPvMarkdown(md("![x](https://exemple.fr/x.png)")),
    ).not.toContain("<img");
  });

  it("garde les liens http(s) et retire les autres en gardant le texte", () => {
    const html = renderPvMarkdown(
      md(
        "[PV](https://exemple.fr/pv.pdf) [piège](javascript:alert(1)) [rel](/x)",
      ),
    );
    expect(html).toContain('<a href="https://exemple.fr/pv.pdf">PV</a>');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('href="/x"');
    expect(html).toContain("piège");
    expect(html).toContain("rel");
  });

  it("échappe le texte qui ressemble à du HTML dans un code", () => {
    expect(renderPvMarkdown(md("`<b>`"))).toContain("&lt;b&gt;");
  });
});
