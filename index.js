const config = require("./config");
const path = require("path");
const http = require("http");
const https = require("https");
const { promises: fs } = require("fs");
const fsExtra = require("fs-extra");
const puppeteer = require("puppeteer");
const { CronJob } = require("cron");
const gm = require("gm");

// keep state of current battery level and whether the device is charging
const batteryStore = {};

(async () => {
  if (config.pages.length === 0) {
    return console.error("Please check your configuration");
  }
  for (const i in config.pages) {
    const pageConfig = config.pages[i];
    if (pageConfig.rotation % 90 > 0) {
      return console.error(
        `Invalid rotation value for entry ${i + 1}: ${pageConfig.rotation}`
      );
    }
  }

  console.log("Starting browser...");
  let browser = await puppeteer.launch({
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      `--lang=${config.language}`,
      config.ignoreCertificateErrors && "--ignore-certificate-errors",
      // Enhanced rendering flags for better e-ink quality
      "--disable-gpu",
      "--disable-lcd-text",
      "--disable-font-subpixel-positioning",
      "--blink-settings=fontAntialiasing=none",
      "--force-device-scale-factor=1",
      "--high-dpi-support=1",
      "--force-color-profile=srgb"
    ].filter((x) => x),
    defaultViewport: null,
    timeout: config.browserLaunchTimeout,
    headless: config.debug !== true
  });

  console.log(`Visiting '${config.baseUrl}' to login...`);
  let page = await browser.newPage();
  await page.goto(config.baseUrl, {
    timeout: config.renderingTimeout
  });

  const hassTokens = {
    hassUrl: config.baseUrl,
    access_token: config.accessToken,
    token_type: "Bearer"
  };

  console.log("Adding authentication entry to browser's local storage...");
  await page.evaluate(
    (hassTokens, selectedLanguage) => {
      localStorage.setItem("hassTokens", hassTokens);
      localStorage.setItem("selectedLanguage", selectedLanguage);
    },
    JSON.stringify(hassTokens),
    JSON.stringify(config.language)
  );

  page.close();

  if (config.debug) {
    console.log(
      "Debug mode active, will only render once in non-headless model and keep page open"
    );
    renderAndConvertAsync(browser);
  } else {
    console.log("Starting first render...");
    await renderAndConvertAsync(browser);
    console.log("Starting rendering cronjob...");
    new CronJob({
      cronTime: config.cronJob,
      onTick: () => renderAndConvertAsync(browser),
      start: true
    });
  }

  const httpServer = http.createServer(async (request, response) => {
    // Parse the request
    const url = new URL(request.url, `http://${request.headers.host}`);
    // Check the page number
    const pageNumberStr = url.pathname;
    // and get the battery level, if any
    // (see https://github.com/sibbl/hass-lovelace-kindle-screensaver/README.md for patch to generate it on Kindle)
    const batteryLevel = parseInt(url.searchParams.get("batteryLevel"));
    const isCharging = url.searchParams.get("isCharging");
    const pageNumber =
      pageNumberStr === "/" ? 1 : parseInt(pageNumberStr.substr(1));
    if (
      isFinite(pageNumber) === false ||
      pageNumber > config.pages.length ||
      pageNumber < 1
    ) {
      console.log(`Invalid request: ${request.url} for page ${pageNumber}`);
      response.writeHead(400);
      response.end("Invalid request");
      return;
    }
    try {
      // Log when the page was accessed
      const n = new Date();
      console.log(`${n.toISOString()}: Image ${pageNumber} was accessed`);

      const pageIndex = pageNumber - 1;
      const configPage = config.pages[pageIndex];

      const outputPathWithExtension = configPage.outputPath + "." + configPage.imageFormat
      const data = await fs.readFile(outputPathWithExtension);
      const stat = await fs.stat(outputPathWithExtension);

      const lastModifiedTime = new Date(stat.mtime).toUTCString();

      response.writeHead(200, {
        "Content-Type": "image/" + configPage.imageFormat,
        "Content-Length": Buffer.byteLength(data),
        "Last-Modified": lastModifiedTime
      });
      response.end(data);

      let pageBatteryStore = batteryStore[pageIndex];
      if (!pageBatteryStore) {
        pageBatteryStore = batteryStore[pageIndex] = {
          batteryLevel: null,
          isCharging: false
        };
      }
      if (!isNaN(batteryLevel) && batteryLevel >= 0 && batteryLevel <= 100) {
        if (batteryLevel !== pageBatteryStore.batteryLevel) {
          pageBatteryStore.batteryLevel = batteryLevel;
          console.log(
            `New battery level: ${batteryLevel} for page ${pageNumber}`
          );
        }

        if (
          (isCharging === "Yes" || isCharging === "1") &&
          pageBatteryStore.isCharging !== true) {
          pageBatteryStore.isCharging = true;
          console.log(`Battery started charging for page ${pageNumber}`);
        } else if (
          (isCharging === "No" || isCharging === "0") &&
          pageBatteryStore.isCharging !== false
        ) {
          console.log(`Battery stopped charging for page ${pageNumber}`);
          pageBatteryStore.isCharging = false;
        }
      }
    } catch (e) {
      console.error(e);
      response.writeHead(404);
      response.end("Image not found");
    }
  });

  const port = config.port || 5000;
  httpServer.listen(port, () => {
    console.log(`Server is running at ${port}`);
  });
})();

async function renderAndConvertAsync(browser) {
  for (let pageIndex = 0; pageIndex < config.pages.length; pageIndex++) {
    const pageConfig = config.pages[pageIndex];
    const pageBatteryStore = batteryStore[pageIndex];

    const url = `${config.baseUrl}${pageConfig.screenShotUrl}`;

    const outputPath = pageConfig.outputPath + "." + pageConfig.imageFormat;
    await fsExtra.ensureDir(path.dirname(outputPath));

    const tempPath = outputPath + ".temp";

    console.log(`Rendering ${url} to image...`);
    await renderUrlToImageAsync(browser, pageConfig, url, tempPath);

    console.log(`Converting rendered screenshot of ${url} to grayscale...`);
    await convertImageToKindleCompatiblePngAsync(
      pageConfig,
      tempPath,
      outputPath
    );

    fs.unlink(tempPath);
    console.log(`Finished ${url}`);

    if (
      pageBatteryStore &&
      pageBatteryStore.batteryLevel !== null &&
      pageConfig.batteryWebHook
    ) {
      sendBatteryLevelToHomeAssistant(
        pageIndex,
        pageBatteryStore,
        pageConfig.batteryWebHook
      );
    }
  }
}

function sendBatteryLevelToHomeAssistant(
  pageIndex,
  batteryStore,
  batteryWebHook
) {
  const batteryStatus = JSON.stringify(batteryStore);
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(batteryStatus)
    },
    rejectUnauthorized: !config.ignoreCertificateErrors
  };
  const url = `${config.baseUrl}/api/webhook/${batteryWebHook}`;
  const httpLib = url.toLowerCase().startsWith("https") ? https : http;
  const req = httpLib.request(url, options, (res) => {
    if (res.statusCode !== 200) {
      console.error(
        `Update device ${pageIndex} at ${url} status ${res.statusCode}: ${res.statusMessage}`
      );
    }
  });
  req.on("error", (e) => {
    console.error(`Update ${pageIndex} at ${url} error: ${e.message}`);
  });
  req.write(batteryStatus);
  req.end();
}

async function renderUrlToImageAsync(browser, pageConfig, url, path) {
  let page;
  try {
    page = await browser.newPage();
    await page.emulateMediaFeatures([
      {
        name: "prefers-color-scheme",
        value: `${pageConfig.prefersColorScheme}`
      }
    ]);

    let size = {
      width: Number(pageConfig.renderingScreenSize.width),
      height: Number(pageConfig.renderingScreenSize.height)
    };

    if (pageConfig.rotation % 180 > 0) {
      size = {
        width: size.height,
        height: size.width
      };
    }

    await page.setViewport(size);
    const startTime = new Date().valueOf();
    await page.goto(url, {
      waitUntil: ["domcontentloaded", "load", "networkidle0"],
      timeout: config.renderingTimeout
    });

    const navigateTimespan = new Date().valueOf() - startTime;
    await page.waitForSelector("home-assistant", {
      timeout: Math.max(config.renderingTimeout - navigateTimespan, 1000)
    });

    await page.addStyleTag({
      content: `
        body {
          zoom: ${pageConfig.scaling * 100}%;
          overflow: hidden;
        }
        html, body {
          -webkit-font-smoothing: none;
          font-smooth: never;
          text-rendering: geometricPrecision;
        }
        img, canvas, video {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }`
    });

    if (pageConfig.renderingDelay > 0) {
      await page.waitForTimeout(pageConfig.renderingDelay);
    }
    await page.screenshot({
      path,
      type: 'png', // Always use PNG for screenshot
      captureBeyondViewport: false,
      clip: {
        x: 0,
        y: 0,
        ...size
      }
    });
  } catch (e) {
    console.error("Failed to render", e);
  } finally {
    if (config.debug === false) {
      await page.close();
    }
  }
}

/**
 * Generate a tiny 1×N PNG that contains exactly N gray entries.
 * Depth 1  → 2 colours, depth 3 → 8 colours, depth 4 → 16, depth 8 → 256.
 */
async function ensurePalette(depth) {
  const steps = 2 ** depth;
  const palPath = path.join(__dirname, `palette${depth}.png`);
  try { await fs.access(palPath); return palPath; } catch (_) {}

  // build a PPM row, then pipe through ImageMagick to PNG-8
  const row = Buffer.alloc(steps * 3);
  for (let i = 0; i < steps; i++) {
    const v = Math.round((i / (steps - 1)) * 255);
    row.fill(v, i * 3, i * 3 + 3);
  }
  await fs.writeFile(`${palPath}.ppm`,
    `P6 ${steps} 1 255\n`, "binary");
  await fs.appendFile(`${palPath}.ppm`, row);

  await new Promise((resolve, reject) => {
    gm(`${palPath}.ppm`).in("-colors", steps)
      .in("-type", "Palette").write(palPath, err => err ? reject(err) : resolve());
  });
  await fs.unlink(`${palPath}.ppm`);
  return palPath;
}

async function convertImageToKindleCompatiblePngAsync(pageCfg, input, output) {
  return new Promise(async (resolve, reject) => {
    const depth = Number(pageCfg.grayscaleDepth);      // 1‒4 or 8
    const pal = depth < 8 ? await ensurePalette(depth) : null;
    const ditherAlgo = pageCfg.ditherAlgo || "Riemersma";
    const useDither = pageCfg.dither;

    let gmInstance = gm(input)
      .options({ imageMagick: config.useImageMagick === true })
      // ---- linear workflow ----
      .in("-colorspace", "Gray")
      .in("-gamma", 0.45455)            // sRGB → linear
      // optional contrast / saturation tweaks
      .modulate(100, 100 * pageCfg.saturation)
      .in("-brightness-contrast", `${pageCfg.contrast}`)
      .in("-level", `${pageCfg.blackLevel},${pageCfg.whiteLevel}`)
      .in("-gamma", 2.2)                // back to perceptual
      .rotate("white", pageCfg.rotation);

    // ---- quantise & dither ----
    if (depth < 8) {
      gmInstance = gmInstance
        .in("-type", "Palette")
        .in("-dither", useDither ? ditherAlgo : "None")
        .in("-define", `png:bit-depth=${depth}`)
        .in("-remap", pal);
    } else {
      gmInstance = gmInstance
        .in("-define", `png:bit-depth=8`);
    }

    // ---- compression + clean ----
    gmInstance = gmInstance
      .in("-strip")
      .in("-define", "png:compression-level=9")
      .in("-define", "png:compression-filter=5")
      .in("-define", "png:compression-strategy=1")
      .in("-define", "png:compression-window=15")
      .in("-define", "png:compression-memory=8");

    gmInstance.write(output, err => err ? reject(err) : resolve());
  });
}
