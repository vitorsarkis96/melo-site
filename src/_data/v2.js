// Conteúdo do site (redesign nov/2026). Os textos ficam em src/_data/conteudo/*.json
// e são editados pelo painel /admin. Aqui só convertemos para o formato que os templates usam.
const geral = require("./conteudo/geral.json");
const pt = require("./conteudo/pt.json");
const en = require("./conteudo/en.json");
// Textos fixos de interface (acessibilidade, rótulos), fora do painel.
const fixos = require("./conteudo/_fixos.json");

const merge = (base, over) => {
  if (!over || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...(base || {}) };
  for (const k of Object.keys(over)) out[k] = merge(out[k], over[k]);
  return out;
};

const shape = (raw, lang, reviews) => { const c = merge(fixos[lang], raw); return {
  ...c,
  meta: (c.meta || []).map((m) => [m.label, m.value]),
  faq: (c.faq || []).map((f) => [f.q, f.a]),
  reviews: (reviews || []).map((r) => [r.name, r.company, r.text]),
  contactSec: { ...c.contactSec, info: (c.contactSec.info || []).map((i) => [i.label, i.value, i.link || ""]) },
  casesPage: { ...c.casesPage, filters: (c.casesPage.filters || []).map((f) => [f.key, f.label]) },
  services: (c.services || []).map((s) => ({ ...s, l: s.l || [] })),
}; };

module.exports = {
  ...merge(fixos.geral, geral),
  clients: (geral.clients || []).map((c) => [c.file, c.name]),
  pt: shape(pt, "pt", pt.reviews),
  // Avaliações são depoimentos reais em português; a versão EN mostra os mesmos textos.
  en: shape(en, "en", pt.reviews),
};
