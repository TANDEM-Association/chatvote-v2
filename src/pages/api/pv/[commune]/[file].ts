// Sert un PV augmenté depuis le stockage, via notre domaine :
//   /api/pv/<INSEE>/<id>.html  Markdown converti et nettoyé (fragment chargé par la modale)
//   /api/pv/<INSEE>/<id>.pdf   PDF relayé tel quel
// Le navigateur ne parle donc qu'à notre site (CSP inchangée). Contenu public :
// pas de restriction d'origine, mise en cache HTTP courte.
import type { APIRoute } from "astro";
import { isValidCommuneCode } from "../../../../lib/commune/commune-code";
import { isValidSeanceId } from "../../../../lib/pv/pv-format";
import { pvStore } from "../../../../lib/pv/pv-server";
import type { PvResult } from "../../../../lib/pv/pv-store";

export const prerender = false;

const CACHE = "public, max-age=300, s-maxage=300";

const fail = (result: PvResult<unknown>) =>
  new Response(null, {
    status: result.status === "none" ? 404 : 503,
    headers: { "Cache-Control": "no-store" },
  });

export const GET: APIRoute = async ({ params }) => {
  const { commune = "", file = "" } = params;
  const match = file.match(/^(.+)\.(html|pdf)$/);
  const id = match?.[1];
  if (!isValidCommuneCode(commune) || !match || !isValidSeanceId(id)) {
    return fail({ status: "none" });
  }

  if (match[2] === "html") {
    const result = await pvStore.getHtml(commune, id);
    if (result.status !== "ok") return fail(result);
    return new Response(result.value, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": CACHE,
      },
    });
  }

  const result = await pvStore.getPdf(commune, id);
  if (result.status !== "ok") return fail(result);
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="PV-augmente-${commune}-${id}.pdf"`,
    "Cache-Control": CACHE,
  });
  const length = result.value.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(result.value.body, { headers });
};
