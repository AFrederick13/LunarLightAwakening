export default function (eleventyConfig) {
  // Pass through static assets
  eleventyConfig.addPassthroughCopy("./src/css");
  eleventyConfig.addPassthroughCopy("./src/images");

  function parseValidDate(dateObj) {
    if (!dateObj) return null;
    const parsed = new Date(dateObj);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    const parsed = parseValidDate(dateObj);
    if (!parsed) return "";
    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    const parsed = parseValidDate(dateObj);
    return parsed ? parsed.toISOString().slice(0, 10) : "";
  });

  eleventyConfig.addFilter("recentPosts", (posts, currentUrl, limit = 2) => {
    return [...posts]
      .reverse()
      .filter((post) => post.url !== currentUrl)
      .slice(0, limit);
  });

  function stripHtml(htmlContent) {
    if (!htmlContent) return "";
    return htmlContent
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  eleventyConfig.addFilter("excerpt", (htmlContent, maxLength = 155) => {
    const text = stripHtml(htmlContent);
    if (!text || text.length <= maxLength) return text;
    const trimmed = text.slice(0, maxLength);
    const lastSpace = trimmed.lastIndexOf(" ");
    return (lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed) + "...";
  });

  eleventyConfig.addFilter("readTime", (htmlContent, wordsPerMinute = 200) => {
    const text = stripHtml(htmlContent);
    if (!text) return "1 min read";
    const wordCount = text.split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
    return `${minutes} min read`;
  });

  eleventyConfig.addCollection("events", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/events/*.md")
      .filter((item) => item.data.active !== false)
      .sort((a, b) => {
        const orderDiff = (a.data.order ?? 999) - (b.data.order ?? 999);
        if (orderDiff !== 0) return orderDiff;
        return (a.data.title || "").localeCompare(b.data.title || "");
      });
  });

  eleventyConfig.addCollection("practitioners", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/practitioners/*.md")
      .filter((item) => item.data.active !== false)
      .sort((a, b) => {
        const orderDiff = (a.data.order ?? 999) - (b.data.order ?? 999);
        if (orderDiff !== 0) return orderDiff;
        return (a.data.name || "").localeCompare(b.data.name || "");
      });
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
