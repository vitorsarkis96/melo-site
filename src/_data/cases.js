// Cases publicados. Rascunhos (draft: true) ficam fora de listas, home, sitemap e llms.txt,
// mas a página existe (sem indexação) para ser editada no editor visual antes de publicar.
const all = require("./casesAll.js");
module.exports = () => all().filter((c) => !c.draft);
