const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const exists = (filePath) => {
  try {
    return Boolean(filePath && fs.existsSync(filePath));
  } catch (error) {
    return false;
  }
};

const log = (message) => console.log(`[ensure-chrome] ${message}`);

const tryPuppeteerPath = () => {
  try {
    const puppeteer = require("puppeteer");
    const executablePath = puppeteer.executablePath();
    if (exists(executablePath)) {
      log(`puppeteer chromium ready: ${executablePath}`);
      return true;
    }
    log(`puppeteer installed but chromium missing at: ${executablePath || "(empty)"}`);
  } catch (error) {
    log(`puppeteer not available: ${error.message}`);
  }
  return false;
};

const trySparticuzPath = async () => {
  try {
    const chromium = require("@sparticuz/chromium");
    const executablePath = await chromium.executablePath();
    if (exists(executablePath)) {
      log(`@sparticuz/chromium ready: ${executablePath}`);
      return true;
    }
    log(`@sparticuz/chromium path missing: ${executablePath || "(empty)"}`);
  } catch (error) {
    log(`@sparticuz/chromium not available: ${error.message}`);
  }
  return false;
};

const installPuppeteerChrome = () => {
  const cli = path.join(__dirname, "..", "node_modules", "puppeteer", "lib", "esm", "puppeteer", "node", "install.js");
  const legacyCli = path.join(__dirname, "..", "node_modules", "puppeteer", "install.mjs");
  if (exists(cli)) {
    execSync(`node "${cli}" chrome`, { stdio: "inherit" });
    return;
  }
  if (exists(legacyCli)) {
    execSync(`node "${legacyCli}"`, { stdio: "inherit" });
    return;
  }
  execSync("npx puppeteer browsers install chrome", {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
};

const main = async () => {
  if (tryPuppeteerPath()) return;
  if (await trySparticuzPath()) return;

  log("installing chrome for puppeteer...");
  try {
    installPuppeteerChrome();
  } catch (error) {
    log(`chrome install failed: ${error.message}`);
    process.exit(0);
  }

  if (!tryPuppeteerPath() && !(await trySparticuzPath())) {
    log("warning: no chromium executable found after install attempt");
  }
};

main().catch((error) => {
  log(`failed: ${error.message}`);
  process.exit(0);
});
