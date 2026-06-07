const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { connectWebSocket, fetchJson } = require("./cdpClient");
const { FONT_PATHS } = require("../templates/documentPdfTemplate");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.EDGE_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const DEBUG_HTML_DIR = path.resolve(__dirname, "../../debug-output");

let cachedBrowserPath = null;
let puppeteerBrowserPromise = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const logBrowserResolution = (source, executablePath) => {
  console.log(`[PDF] Platform: ${process.platform}`);
  console.log(`[PDF] Browser source: ${source}`);
  console.log(`[PDF] Executable: ${executablePath}`);
};

const getPuppeteer = () => {
  try {
    return require("puppeteer-core");
  } catch (error) {
    return null;
  }
};

const getSparticuzChromium = () => {
  try {
    return require("@sparticuz/chromium");
  } catch (error) {
    return null;
  }
};

const resolveBrowserExecutable = async () => {
  if (cachedBrowserPath && fs.existsSync(cachedBrowserPath)) {
    return cachedBrowserPath;
  }

  let source = "";
  let executablePath = "";

  const envPath = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
  ].find((candidate) => candidate && fs.existsSync(candidate));

  if (envPath) {
    source = "env override";
    executablePath = envPath;
  }

  if (!executablePath && process.platform === "linux") {
    const chromium = getSparticuzChromium();
    if (chromium) {
      try {
        const linuxPath = await chromium.executablePath();
        if (linuxPath && fs.existsSync(linuxPath)) {
          source = "sparticuz";
          executablePath = linuxPath;
        }
      } catch (error) {
        console.warn("[PDF] @sparticuz/chromium executablePath failed:", error.message);
      }
    }
  }

  if (!executablePath) {
    const systemPath = CHROME_CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate));
    if (systemPath) {
      source = "system chrome";
      executablePath = systemPath;
    }
  }

  if (!executablePath) {
    try {
      const puppeteer = require("puppeteer");
      const puppeteerPath = puppeteer.executablePath();
      if (puppeteerPath && fs.existsSync(puppeteerPath)) {
        source = "puppeteer";
        executablePath = puppeteerPath;
      }
    } catch (error) {
      // puppeteer optional fallback for local dev
    }
  }

  if (executablePath) {
    cachedBrowserPath = executablePath;
    logBrowserResolution(source, executablePath);
    return executablePath;
  }

  logBrowserResolution("none", "(not found)");
  return "";
};

const buildLaunchOptions = async (extraArgs = []) => {
  const executablePath = await resolveBrowserExecutable();
  if (!executablePath) {
    throw new Error("No headless browser found for PDF generation.");
  }

  const options = {
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", ...extraArgs],
  };

  if (process.platform === "linux") {
    const chromium = getSparticuzChromium();
    if (chromium) {
      options.args = [...chromium.args, ...extraArgs];
      if (chromium.defaultViewport) options.defaultViewport = chromium.defaultViewport;
      if (chromium.headless !== undefined) options.headless = chromium.headless;
    }
  }

  return options;
};

const getPuppeteerBrowser = async () => {
  const puppeteer = getPuppeteer();
  if (!puppeteer) return null;

  if (!puppeteerBrowserPromise) {
    puppeteerBrowserPromise = (async () => {
      const launchOptions = await buildLaunchOptions(["--allow-file-access-from-files"]);
      return puppeteer.launch(launchOptions);
    })();
  }

  return puppeteerBrowserPromise;
};

const prepareHtmlBundle = (html) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-pdf-"));
  const fontsDir = path.join(tmpDir, "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });
  fs.copyFileSync(FONT_PATHS.regular, path.join(fontsDir, "NotoSansArabic-Regular.ttf"));
  fs.copyFileSync(FONT_PATHS.bold, path.join(fontsDir, "NotoSansArabic-Bold.ttf"));
  const htmlPath = path.join(tmpDir, "document.html");
  fs.writeFileSync(htmlPath, html, { encoding: "utf8" });
  return { tmpDir, htmlPath, fileUrl: `file:///${htmlPath.replace(/\\/g, "/")}` };
};

const saveDebugHtml = (html, label = "latest") => {
  try {
    fs.mkdirSync(DEBUG_HTML_DIR, { recursive: true });
    const debugDir = path.join(DEBUG_HTML_DIR, label);
    fs.mkdirSync(debugDir, { recursive: true });
    const fontsDir = path.join(debugDir, "fonts");
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.copyFileSync(FONT_PATHS.regular, path.join(fontsDir, "NotoSansArabic-Regular.ttf"));
    fs.copyFileSync(FONT_PATHS.bold, path.join(fontsDir, "NotoSansArabic-Bold.ttf"));
    const htmlPath = path.join(debugDir, "document.html");
    fs.writeFileSync(htmlPath, html, { encoding: "utf8" });
    return htmlPath;
  } catch (error) {
    console.warn("[PDF] Could not save debug HTML:", error.message);
    return "";
  }
};

const waitForFontsInPage = async (evaluate) => {
  await evaluate(() => document.fonts && document.fonts.ready);
  await evaluate(() => {
    const families = ['"Noto Sans Arabic"', '"Cairo"'];
    return Promise.all(
      families.map((family) => {
        if (!document.fonts || !document.fonts.load) return Promise.resolve();
        return document.fonts.load(`16px ${family}`);
      })
    );
  });
  await evaluate(
    () =>
      new Promise((resolve) => {
        if (document.body?.dataset?.fontsReady === "true") return resolve(true);
        const observer = new MutationObserver(() => {
          if (document.body?.dataset?.fontsReady === "true") {
            observer.disconnect();
            resolve(true);
          }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ["data-fonts-ready"] });
        setTimeout(() => {
          observer.disconnect();
          resolve(true);
        }, 8000);
      })
  );
};

const waitForDevtools = (port, attempts = 40) =>
  new Promise((resolve, reject) => {
    let tries = 0;
    const tick = () => {
      fetchJson(`http://127.0.0.1:${port}/json/version`)
        .then(resolve)
        .catch(() => {
          tries += 1;
          if (tries >= attempts) reject(new Error("Timed out waiting for headless browser DevTools"));
          else setTimeout(tick, 250);
        });
    };
    tick();
  });

const launchHeadlessBrowser = async (port) => {
  const browser = await resolveBrowserExecutable();
  if (!browser) {
    throw new Error("No headless browser found for PDF generation. Install Chrome/Edge or set CHROME_PATH.");
  }
  const args = [
    `--remote-debugging-port=${port}`,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ];
  return spawn(browser, args, { stdio: "ignore", detached: false });
};

const renderWithPuppeteer = async (bundle) => {
  const browser = await getPuppeteerBrowser();
  if (!browser) return null;

  const page = await browser.newPage();
  try {
    await page.goto(bundle.fileUrl, { waitUntil: "networkidle0", timeout: 45000 });
    await waitForFontsInPage((fn) => page.evaluate(fn));
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
};

const renderWithCdp = async (bundle) => {
  const port = 9300 + Math.floor(Math.random() * 200);
  let browserProc = null;
  let cdp = null;

  try {
    browserProc = await launchHeadlessBrowser(port);
    await waitForDevtools(port);

    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error("Could not connect to headless browser page target");
    }

    cdp = await connectWebSocket(pageTarget.webSocketDebuggerUrl);
    const loadPromise = new Promise((resolve) => {
      const timer = setTimeout(resolve, 12000);
      cdp.on("event", (msg) => {
        if (msg.method === "Page.loadEventFired") {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: bundle.fileUrl });
    await loadPromise;
    await sleep(300);

    await cdp.send("Runtime.evaluate", {
      expression:
        "document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()",
      awaitPromise: true,
    });
    await cdp.send("Runtime.evaluate", {
      expression:
        "Promise.all(['Noto Sans Arabic','Cairo'].map((f)=>document.fonts.load?document.fonts.load('16px \"'+f+'\"'):Promise.resolve()))",
      awaitPromise: true,
    });
    await cdp.send("Runtime.evaluate", {
      expression:
        "new Promise((resolve)=>{if(document.body?.dataset?.fontsReady==='true')return resolve(true);const obs=new MutationObserver(()=>{if(document.body?.dataset?.fontsReady==='true'){obs.disconnect();resolve(true);}});obs.observe(document.body,{attributes:true,attributeFilter:['data-fonts-ready']});setTimeout(()=>{obs.disconnect();resolve(true);},8000);})",
      awaitPromise: true,
    });

    const printed = await cdp.send("Page.printToPDF", {
      printBackground: true,
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0.55,
      marginBottom: 0.55,
      marginLeft: 0.55,
      marginRight: 0.55,
      preferCSSPageSize: true,
    });

    return Buffer.from(printed.data, "base64");
  } finally {
    if (cdp) cdp.close();
    if (browserProc && !browserProc.killed) browserProc.kill("SIGTERM");
  }
};

const renderWithCli = async (bundle) => {
  const browser = await resolveBrowserExecutable();
  if (!browser) throw new Error("No headless browser found for PDF generation.");

  const pdfPath = path.join(bundle.tmpDir, "document.pdf");
  await new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--allow-file-access-from-files",
      "--no-pdf-header-footer",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=30000",
      `--print-to-pdf=${pdfPath}`,
      bundle.fileUrl,
    ];
    const proc = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(pdfPath)) resolve();
      else reject(new Error(stderr.trim() || `CLI PDF renderer exited with code ${code}`));
    });
  });
  return fs.readFileSync(pdfPath);
};

const withTimeout = async (promise, ms, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const renderHtmlToPdfBuffer = async (html) => {
  const bundle = prepareHtmlBundle(html);

  try {
    const puppeteerPdf = await renderWithPuppeteer(bundle);
    if (puppeteerPdf) {
      return puppeteerPdf;
    }
  } catch (error) {
    console.warn("[PDF] puppeteer render failed:", error.message);
  }

  try {
    const cdpPdf = await withTimeout(renderWithCdp(bundle), 25000, "CDP PDF");
    return cdpPdf;
  } catch (error) {
    console.warn("[PDF] CDP render failed:", error.message);
  }

  const cliPdf = await renderWithCli(bundle);
  return cliPdf;
};

const renderUrlWithCdp = async (url) => {
  const port = 9300 + Math.floor(Math.random() * 200);
  let browserProc = null;
  let cdp = null;

  try {
    browserProc = await launchHeadlessBrowser(port);
    await waitForDevtools(port);

    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error("Could not connect to headless browser page target");
    }

    cdp = await connectWebSocket(pageTarget.webSocketDebuggerUrl);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url });
    await sleep(1500);
    await cdp.send("Runtime.evaluate", {
      expression:
        "new Promise((resolve)=>{const done=()=>resolve(true);const body=document.body;if(!body)return setTimeout(done,3000);if(body.dataset?.pdfReady==='true')return done();const obs=new MutationObserver(()=>{if(body.dataset?.pdfReady==='true'){obs.disconnect();done();}});obs.observe(body,{attributes:true,attributeFilter:['data-pdf-ready']});setTimeout(()=>{obs.disconnect();done();},45000);})",
      awaitPromise: true,
    });
    await cdp.send("Runtime.evaluate", {
      expression:
        "document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()",
      awaitPromise: true,
    });
    await cdp.send("Runtime.evaluate", {
      expression:
        "Promise.all(['Noto Sans Arabic','Cairo'].map((f)=>document.fonts.load?document.fonts.load('16px \"'+f+'\"'):Promise.resolve()))",
      awaitPromise: true,
    });

    const printed = await cdp.send("Page.printToPDF", {
      printBackground: true,
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0.39,
      marginBottom: 0.39,
      marginLeft: 0.39,
      marginRight: 0.39,
      preferCSSPageSize: true,
    });

    return Buffer.from(printed.data, "base64");
  } finally {
    if (cdp) cdp.close();
    if (browserProc && !browserProc.killed) browserProc.kill("SIGTERM");
  }
};

const renderUrlWithCli = async (url) => {
  const browser = await resolveBrowserExecutable();
  if (!browser) throw new Error("No headless browser found for PDF generation.");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-url-pdf-"));
  const pdfPath = path.join(tmpDir, "document.pdf");
  await new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--no-pdf-header-footer",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=45000",
      `--print-to-pdf=${pdfPath}`,
      url,
    ];
    const proc = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(pdfPath)) resolve();
      else reject(new Error(stderr.trim() || `CLI URL PDF renderer exited with code ${code}`));
    });
  });
  return fs.readFileSync(pdfPath);
};

const renderUrlToPdfBuffer = async (url) => {
  try {
    const browser = await getPuppeteerBrowser();
    if (browser) {
      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForFunction(() => document.body?.dataset?.pdfReady === "true", { timeout: 45000 });
        await waitForFontsInPage((fn) => page.evaluate(fn));
        const pdf = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
        });
        return Buffer.from(pdf);
      } finally {
        await page.close();
      }
    }
  } catch (error) {
    console.warn("[PDF] puppeteer URL render failed:", error.message);
  }

  try {
    const cdpPdf = await withTimeout(renderUrlWithCdp(url), 120000, "CDP URL PDF");
    return cdpPdf;
  } catch (error) {
    console.warn("[PDF] CDP URL render failed:", error.message);
  }

  const cliPdf = await renderUrlWithCli(url);
  return cliPdf;
};

const streamHtmlPdf = async (res, filename, html) => {
  const buffer = await renderHtmlToPdfBuffer(html);
  res.setHeader("Content-Type", "application/pdf; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.end(buffer);
};

const streamUrlPdf = async (res, filename, url) => {
  const buffer = await renderUrlToPdfBuffer(url);
  res.setHeader("Content-Type", "application/pdf; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.end(buffer);
};

module.exports = {
  resolveBrowserExecutable,
  renderHtmlToPdfBuffer,
  renderUrlToPdfBuffer,
  streamHtmlPdf,
  streamUrlPdf,
  saveDebugHtml,
  prepareHtmlBundle,
};
