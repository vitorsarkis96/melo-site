const fs = require("fs");
const path = require("path");

module.exports = () => {
  const dir = path.join(__dirname, "cases");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    // Case criado com campos faltando (pelo painel) não pode quebrar o site:
    // inglês cai para o português e listas vazias viram [].
    .map((c) => {
      const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== "" && v != null && !(Array.isArray(v) && !v.length)));
      const pt = { tags: [], ...(c.pt || {}) };
      const en = { ...pt, ...clean(c.en) };
      return {
        ...c,
        dataService: c.dataService || [],
        otherCases: c.otherCases || [],
        rowsBeforeApproach: c.rowsBeforeApproach || [],
        rowsAfterApproach: c.rowsAfterApproach || [],
        heroMedia: c.heroMedia || { type: "image", src: c.cardImage || "" },
        pt,
        en: { ...en, tags: en.tags || [] },
      };
    })
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
};
