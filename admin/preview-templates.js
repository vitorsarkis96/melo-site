/* Custom Decap CMS preview panes.
   Reuses the real site stylesheet + class names so the preview looks like
   the actual page instead of Decap's default raw-field dump. Written
   against the global `createClass`/`h`/`CMS` API the decap-cms.js UMD
   bundle exposes — no build step, loaded straight in admin/index.html. */

CMS.registerPreviewStyle("/assets/css/style.css");
CMS.registerPreviewStyle(
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@400;500;600;700&display=swap"
);

function genericPreview(entry) {
  var data = entry.get("data");
  return h(
    "div",
    { style: { padding: 24, fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap" } },
    "Esse arquivo não tem um preview visual próprio ainda — só os dados brutos:\n\n" +
      JSON.stringify(data && data.toJS ? data.toJS() : data, null, 2)
  );
}

var PagesPreview = createClass({
  render: function () {
    var entry = this.props.entry;
    if (entry.get("slug") !== "home") return genericPreview(entry);

    var lang = "pt";
    var t = entry.getIn(["data", lang]) || entry.getIn(["data", "en"]);
    if (!t) return h("div", { style: { padding: 24 } }, "Preencha o conteúdo em Português ou Inglês pra ver o preview.");

    var heroImage = entry.getIn(["data", "heroImage"]);
    var services = t.get("services");
    var faq = t.get("faq");

    return h(
      "div",
      {},
      h(
        "div",
        { className: "hero-wrap", style: { padding: 8 } },
        h(
          "section",
          {
            className: "hero-card",
            style: {
              height: "auto",
              minHeight: 420,
              backgroundImage: heroImage ? "url(" + heroImage + ")" : "none",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: "#111",
            },
          },
          h(
            "div",
            { className: "hero-card__content", style: { opacity: 1 } },
            h("h1", { className: "hero-headline" }, t.get("heroHeadline"))
          )
        )
      ),
      h(
        "section",
        { className: "section-about" },
        h(
          "div",
          { className: "intro-row" },
          h(
            "div",
            { className: "tag" },
            h("span", { className: "tag-text" }, t.get("atuamosTag"))
          ),
          h("p", { className: "intro-statement", style: { opacity: 1 } }, t.get("introStatement"))
        )
      ),
      services &&
        h(
          "section",
          { className: "section-about" },
          h(
            "div",
            { className: "services" },
            services.map(function (service, i) {
              return h(
                "div",
                { className: "service-row", key: i },
                h(
                  "div",
                  { className: "service-content" },
                  h("h2", { className: "service-title" }, service.get("title")),
                  h(
                    "div",
                    { className: "service-aside" },
                    h("p", { className: "service-desc" }, service.get("desc"))
                  )
                )
              );
            })
          )
        ),
      faq &&
        h(
          "section",
          { className: "section-about section-faq" },
          h(
            "div",
            { className: "faq-row" },
            h(
              "div",
              { className: "faq-intro" },
              h("div", { className: "tag" }, h("span", { className: "tag-text" }, t.get("faqTag"))),
              h("h2", {}, t.get("faqHeading"))
            ),
            h(
              "div",
              { className: "faq-list" },
              faq.map(function (item, i) {
                return h(
                  "details",
                  { className: "faq-item", key: i },
                  h("summary", {}, item.get("q")),
                  h("p", {}, item.get("a"))
                );
              })
            )
          )
        )
    );
  },
});

var CasePreview = createClass({
  render: function () {
    var entry = this.props.entry;
    var lang = "pt";
    var t = entry.getIn(["data", lang]) || entry.getIn(["data", "en"]);
    if (!t) return h("div", { style: { padding: 24 } }, "Preencha o conteúdo em Português ou Inglês pra ver o preview.");

    var heroMedia = entry.getIn(["data", "heroMedia"]);
    var tags = t.get("tags");

    return h(
      "div",
      {},
      h(
        "section",
        { className: "case-hero-header" },
        h(
          "div",
          {},
          h("h1", {}, t.get("heroTitleLine1"), h("br"), t.get("heroTitleLine2"))
        ),
        h(
          "div",
          { className: "case-tags" },
          tags &&
            tags.map(function (tag, i) {
              return h("span", { className: "case-tag", key: i }, tag);
            })
        )
      ),
      h(
        "div",
        { className: "case-media-row single" },
        h(
          "div",
          { className: "case-media" },
          heroMedia &&
            h("img", {
              src: heroMedia.get("src"),
              alt: t.get("heroAlt"),
              style: { width: "100%", display: "block" },
            })
        )
      ),
      h(
        "section",
        { className: "section-about" },
        h(
          "div",
          { className: "case-text-row" },
          h(
            "div",
            { className: "tag" },
            h("span", { className: "tag-text" }, t.get("challengeTag"))
          ),
          h(
            "div",
            { className: "case-text-content" },
            h("p", { className: "case-text-heading" }, t.get("challengeHeading")),
            h("p", { className: "case-text-detail" }, t.get("challengeDetail"))
          )
        )
      )
    );
  },
});

CMS.registerPreviewTemplate("pages", PagesPreview);
CMS.registerPreviewTemplate("home", PagesPreview);
CMS.registerPreviewTemplate("cases_page", PagesPreview);
CMS.registerPreviewTemplate("sobre_page", PagesPreview);
CMS.registerPreviewTemplate("cases", CasePreview);
