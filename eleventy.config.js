import fs from "node:fs";
import path from "node:path";
import { HtmlBasePlugin } from "@11ty/eleventy";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);

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

  function readImageDimensions(publicPath) {
    try {
      const cleanRel = String(publicPath || "").replace(/^\/+/, "");
      const filePath = path.join("src", cleanRel);
      const buf = fs.readFileSync(filePath);

      if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
      }

      if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
        const chunk = buf.toString("ascii", 12, 16);
        if (chunk === "VP8 " && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
          return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
        }
        if (chunk === "VP8L") {
          const bits = buf.readUInt32LE(21);
          return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        if (chunk === "VP8X") {
          return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
        }
      }

      if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < buf.length) {
          if (buf[offset] !== 0xff) {
            offset += 1;
            continue;
          }
          const marker = buf[offset + 1];
          if (marker === 0xff) {
            offset += 1;
            continue;
          }
          if (
            (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf)
          ) {
            return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
          }
          if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
            offset += 2;
          } else {
            const segLen = buf.readUInt16BE(offset + 2);
            if (segLen < 2) break;
            offset += 2 + segLen;
          }
        }
      }

      const ispeIdx = buf.indexOf(Buffer.from("ispe"));
      if (ispeIdx !== -1 && ispeIdx + 16 <= buf.length) {
        return { width: buf.readUInt32BE(ispeIdx + 8), height: buf.readUInt32BE(ispeIdx + 12) };
      }
    } catch {
      return null;
    }
    return null;
  }

  eleventyConfig.addFilter("groupGalleryImages", (images) => {
    if (!Array.isArray(images)) return [];
    const valid = images.filter(Boolean);
    const isTallPortrait = (imgPath) => {
      const dims = readImageDimensions(imgPath);
      return Boolean(dims && dims.height > 0 && dims.width / dims.height < 0.8);
    };

    const rows = [];
    for (let i = 0; i < valid.length; i += 1) {
      const current = valid[i];
      const next = valid[i + 1];
      if (next && isTallPortrait(current) && isTallPortrait(next)) {
        rows.push([current, next]);
        i += 1;
      } else {
        rows.push([current]);
      }
    }
    return rows;
  });

  return {
    pathPrefix: "/LunarLightAwakening/",
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
