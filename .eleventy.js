module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ assets: "assets" });
  eleventyConfig.addPassthroughCopy("favicon.ico");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("sitemap.xml");
  eleventyConfig.addPassthroughCopy({ "admin": "admin" });

  eleventyConfig.addFilter("videoType", function (src) {
    const ext = (src || "").split(".").pop().toLowerCase();
    const map = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
    return map[ext] || "video/mp4";
  });

  eleventyConfig.addFilter("findCase", function (cases, slug) {
    return (cases || []).find((c) => c.slug === slug);
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
