module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ assets: "assets" });
  eleventyConfig.addPassthroughCopy("favicon.ico");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("sitemap.xml");
  eleventyConfig.addPassthroughCopy("llms.txt");
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
