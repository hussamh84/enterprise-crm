const { join } = require("path");

/**
 * Persist Puppeteer browser cache inside the project on Render.
 * Set PUPPETEER_CACHE_DIR in Render env to override.
 */
module.exports = {
  cacheDirectory:
    process.env.PUPPETEER_CACHE_DIR || join(__dirname, ".cache", "puppeteer"),
};
