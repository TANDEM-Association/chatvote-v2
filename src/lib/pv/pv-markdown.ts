// Conversion d'un PV augmenté (Markdown) en HTML affichable dans la modale.
// Serveur uniquement. Le Markdown vient du stockage, rédigé avec l'aide d'une IA :
// on le traite comme non fiable et on ne garde que le Markdown standard.
//
// Moteur : satteri, celui qu'Astro 7 utilise déjà (aucun nouveau paquet dans
// l'arbre de dépendances, seulement déclaré en direct).

import { defineMdastPlugin, markdownToHtml } from "satteri";

const SAFE_LINK = /^(?:https?:|mailto:)/i;

const sanitize = defineMdastPlugin({
  name: "pv-sanitize",
  // HTML brut : supprimé (sinon recopié tel quel dans la page).
  html(node, ctx) {
    ctx.removeNode(node);
  },
  // Les consignes excluent les images ; on ne charge rien d'externe.
  image(node, ctx) {
    ctx.removeNode(node);
  },
  imageReference(node, ctx) {
    ctx.removeNode(node);
  },
  // Lien vers autre chose que http(s) ou mailto (javascript:, data:, chemin
  // relatif) : on garde le texte, sans le lien.
  link(node, ctx) {
    if (!SAFE_LINK.test(node.url)) ctx.replaceNode(node, node.children);
  },
  // Le titre de niveau 1 répète la date déjà affichée dans l'en-tête de la vue.
  heading(node, ctx) {
    if (node.depth === 1) ctx.removeNode(node);
  },
});

/** Convertit le `.md` complet (en-tête compris, ignoré) en HTML nettoyé. */
export function renderPvMarkdown(source: string): string {
  return markdownToHtml(source, {
    mdastPlugins: [sanitize],
    features: { gfm: { footnotes: false }, frontmatter: true },
  }).html;
}
