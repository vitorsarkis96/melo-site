const fs = require("fs");
const path = require("path");

module.exports = () => {
  const dir = path.join(__dirname, "cases");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
};
