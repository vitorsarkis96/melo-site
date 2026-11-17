module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ assets: "assets" });
  eleventyConfig.addPassthroughCopy("favicon.ico");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy({ "admin": "admin" });

  eleventyConfig.addFilter("videoType", function (src) {
    const ext = (src || "").split(".").pop().toLowerCase();
    const map = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
    return map[ext] || "video/mp4";
  });

  eleventyConfig.addFilter("youtubeId", function (url) {
    if (!url) return null;
    const patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  });

  eleventyConfig.addFilter("faqPairs", (pairs) => (pairs || []).map((p) => ({ "@type": "Question", name: p[0], acceptedAnswer: { "@type": "Answer", text: p[1] } })));
  eleventyConfig.addFilter("countService", (cases, key) => (cases || []).filter((c) => key === "todos" || (c.dataService || []).includes(key)).length);
  eleventyConfig.addFilter("nextCase", (cases, item) => {
    const list = cases || [];
    const pick = (item.otherCases || []).find((s) => s !== item.slug && list.some((c) => c.slug === s));
    if (pick) return list.find((c) => c.slug === pick);
    const i = list.findIndex((c) => c.slug === item.slug);
    return list[(i + 1) % list.length];
  });
  eleventyConfig.addFilter("caseIndex", (cases, slug) => (cases || []).findIndex((c) => c.slug === slug) + 1);
  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));

  eleventyConfig.addFilter("findCase", function (cases, slug) {
    return (cases || []).find((c) => c.slug === slug);
  });

  eleventyConfig.addFilter("onHome", function (cases) {
    return (cases || []).filter((c) => c.showOnHome);
  });

  eleventyConfig.addFilter("faqEntities", function (faq) {
    return (faq || []).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }));
  });

  eleventyConfig.addFilter("resolveHeroSlides", function (slides, cases) {
    return (slides || [])
      .map((slide) => ({ ...slide, caseData: (cases || []).find((c) => c.slug === slide.case) }))
      .filter((slide) => slide.caseData);
  });

  eleventyConfig.addFilter("formatNumber", function (value, format) {
    if (format === "thousand") return Number(value).toLocaleString("pt-BR");
    return value;
  });

  // Images with a hand-generated "-mobile" variant on disk (always
  // 800px wide) plus the full-size file's own pixel width, so the
  // srcset width descriptors are accurate. Only these get a srcset —
  // everything else keeps a plain src, so we never reference a mobile
  // file that doesn't exist.
  const MOBILE_IMAGE_VARIANTS = {
    "/assets/img/cases/4RESEARCH_BILLBOARDRUA.jpg": 2000,
    "/assets/img/cases/brain4care_dublin.png": 1200,
    "/assets/img/cases/red_bannerevento_REDCap.jpeg": 2000,
    "/assets/img/ekoenergy-brand.png": 1400,
    "/assets/img/syn_thumb.jpg": 2000,
    "/assets/img/photographer.png": 1024,
  };
  eleventyConfig.addFilter("imgSrcset", function (src) {
    const fullWidth = MOBILE_IMAGE_VARIANTS[src];
    if (!src || !fullWidth) return null;
    const lastDot = src.lastIndexOf(".");
    const mobileSrc = `${src.slice(0, lastDot)}-mobile${src.slice(lastDot)}`;
    return `${mobileSrc} 800w, ${src} ${fullWidth}w`;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
