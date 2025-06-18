const config = require("./config");
const path = require("path");
const http = require("http");
const https = require("https");
const { promises: fs } = require("fs");
const fsExtra = require("fs-extra");
const puppeteer = require("puppeteer");
const { CronJob } = require("cron");
const { execa } = require("execa");
const express = require("express");
const mqtt = require("mqtt");

// Simple in-memory request log for debugging (keep last 100 requests)
const requestLog = [];
const MAX_LOG_ENTRIES = 100;

// Track refresh counts per device
const deviceRefreshCounts = new Map();
const deviceRefreshHistory = new Map();
const MAX_REFRESH_HISTORY = 1000;

// MQTT client setup
let mqttClient = null;

function setupMqttClient() {
  // Check if MQTT service is available (provided by Home Assistant Supervisor)
  // Try both MQTT_USERNAME and MQTT_USER as different versions may use different names
  const mqttUsername = process.env.MQTT_USERNAME || process.env.MQTT_USER;
  const mqttHost = process.env.MQTT_HOST;
  const mqttPassword = process.env.MQTT_PASSWORD;
  
  // Debug: Log all MQTT environment variables
  console.log('MQTT Environment Variables:', {
    MQTT_HOST: process.env.MQTT_HOST || 'undefined',
    MQTT_PORT: process.env.MQTT_PORT || 'undefined', 
    MQTT_USERNAME: process.env.MQTT_USERNAME || 'undefined',
    MQTT_USER: process.env.MQTT_USER || 'undefined',
    MQTT_PASSWORD: process.env.MQTT_PASSWORD ? '[SET]' : 'undefined',
    MQTT_PROTOCOL: process.env.MQTT_PROTOCOL || 'undefined',
    MQTT_SSL: process.env.MQTT_SSL || 'undefined'
  });
  
  // Debug: Log ALL environment variables that might be MQTT-related
  const mqttEnvVars = Object.keys(process.env).filter(key => 
    key.includes('MQTT') || key.includes('mqtt') || key.includes('BROKER') || key.includes('broker')
  );
  console.log('All MQTT-related environment variables found:', mqttEnvVars.length > 0 ? mqttEnvVars : 'NONE');
  
  // Debug: Log a sample of all environment variables to see what's available
  console.log('Sample of all environment variables:');
  const allEnvKeys = Object.keys(process.env);
  console.log(`Total environment variables: ${allEnvKeys.length}`);
  console.log('First 20 env vars:', allEnvKeys.slice(0, 20));
  
  // Check for any variables that look like they might be service-related
  const serviceEnvVars = Object.keys(process.env).filter(key => 
    key.includes('SERVICE') || key.includes('service') || key.includes('ADDON') || key.includes('addon')
  );
  if (serviceEnvVars.length > 0) {
    console.log('Service-related environment variables:', serviceEnvVars);
  }
  
  // Check for null, undefined, or empty string values
  if (!mqttHost || mqttHost === 'null' || !mqttUsername || mqttUsername === 'null' || !mqttPassword || mqttPassword === 'null') {
    console.log('MQTT service not available from Supervisor, running without MQTT support');
    console.log('This is normal if:');
    console.log('  - Running outside Home Assistant OS/Supervised');
    console.log('  - No MQTT broker add-on is installed');
    console.log('  - Add-on does not have "services: [mqtt:need]" in config.yaml');
    return;
  }

  const mqttOptions = {
    host: mqttHost,
    port: parseInt(process.env.MQTT_PORT) || 1883,
    username: mqttUsername,
    password: mqttPassword,
    protocol: 'mqtt',
    protocolVersion: process.env.MQTT_PROTOCOL === '5' ? 5 : 4,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
    keepalive: 60,
    // Limit reconnection attempts to prevent infinite loops
    reconnectPeriod: 10000, // Try every 10 seconds instead of 5
    connectTimeout: 30000,
    // Stop trying to reconnect after some failures
    reconnectionBackOff: 2000
  };

  console.log(`Attempting MQTT connection to ${mqttOptions.host}:${mqttOptions.port} as user '${mqttOptions.username}'`);

  mqttClient = mqtt.connect(mqttOptions);

  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    reconnectAttempts = 0; // Reset counter on successful connection
  });

  mqttClient.on('error', (error) => {
    console.error('MQTT connection error:', error.message);
    
    // If we get ENOTFOUND or similar DNS errors, stop trying
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      reconnectAttempts++;
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log(`Failed to connect to MQTT after ${maxReconnectAttempts} attempts. Disabling MQTT functionality.`);
        mqttClient.end(true); // Force close and stop reconnecting
        mqttClient = null;
        return;
      }
    }
    console.log('Continuing without MQTT support...');
  });

  mqttClient.on('reconnect', () => {
    reconnectAttempts++;
    if (reconnectAttempts <= maxReconnectAttempts) {
      console.log(`Reconnecting to MQTT broker... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
    }
  });

  mqttClient.on('offline', () => {
    console.log('MQTT client went offline');
  });

  mqttClient.on('close', () => {
    console.log('MQTT connection closed');
  });
}

function publishToMqtt(topic, payload, retain = true) {
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(topic, JSON.stringify(payload), { retain }, (error) => {
      if (error) {
        console.error(`Failed to publish to MQTT topic ${topic}:`, error);
      }
    });
  } else if (mqttClient === null) {
    // MQTT was disabled due to connection failures, silently skip
    return;
  } else {
    console.warn(`MQTT client not connected. Failed to publish to topic: ${topic}`);
  }
}

function logRequest(deviceId, ipAddress, pageNumber, batteryLevel, isCharging, refreshType) {
  const entry = {
    timestamp: new Date().toISOString(),
    deviceId,
    ipAddress,
    pageNumber,
    batteryLevel,
    isCharging,
    refreshType: refreshType || 'unknown'
  };
  
  requestLog.push(entry);
  if (requestLog.length > MAX_LOG_ENTRIES) {
    requestLog.shift(); // Remove oldest entry
  }
  
  // Log to console (appears in HA addon logs)
  console.log(`${entry.timestamp}: Device ${deviceId} (${ipAddress}) requested page ${pageNumber}${
    batteryLevel !== null ? ` [battery: ${batteryLevel}%${isCharging !== null ? (isCharging ? ' charging' : ' not charging') : ''}]` : ''
  } [refresh: ${refreshType || 'unknown'}]`);
}

function trackRefresh(deviceId, refreshType) {
  // Increment total refresh count
  const currentCount = deviceRefreshCounts.get(deviceId) || 0;
  const newCount = currentCount + 1;
  deviceRefreshCounts.set(deviceId, newCount);

  // Add to refresh history
  const refreshEntry = {
    timestamp: new Date().toISOString(),
    type: refreshType || 'unknown',
    count: newCount
  };

  if (!deviceRefreshHistory.has(deviceId)) {
    deviceRefreshHistory.set(deviceId, []);
  }
  
  const history = deviceRefreshHistory.get(deviceId);
  history.push(refreshEntry);
  
  // Keep history within limits
  if (history.length > MAX_REFRESH_HISTORY) {
    history.shift();
  }

  // Publish refresh increment to MQTT
  publishToMqtt(`inkplate-dashboard/${deviceId}/refresh`, {
    count: newCount,
    type: refreshType || 'unknown',
    timestamp: refreshEntry.timestamp
  });

  console.log(`Device ${deviceId}: Refresh count now ${newCount} (${refreshType || 'unknown'})`);
}

function publishBatteryStatusToMqtt(deviceId, batteryData) {
  // Publish battery level
  publishToMqtt(`inkplate-dashboard/${deviceId}/battery`, {
    level: batteryData.batteryLevel,
    timestamp: new Date().toISOString()
  });

  // Publish charging status
  publishToMqtt(`inkplate-dashboard/${deviceId}/charging`, {
    status: batteryData.isCharging,
    timestamp: new Date().toISOString()
  });

  console.log(`Published battery data for device ${deviceId}: ${batteryData.batteryLevel}% ${batteryData.isCharging ? 'charging' : 'not charging'}`);
}

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

  // Check if ImageMagick is available
  try {
    const magickCommand = config.useImageMagick ? 'magick' : 'convert';
    await execa(magickCommand, ['-version']);
    console.log(`ImageMagick ${config.useImageMagick ? '(magick)' : '(convert)'} is available`);
  } catch (error) {
    console.error('ImageMagick not found! Please ensure ImageMagick is installed.');
    console.error('Error:', error.message);
    process.exit(1);
  }

  // Setup MQTT client
  setupMqttClient();

  console.log("Starting browser...");
  let browser = await puppeteer.launch({
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      `--lang=${config.language}`,
      config.ignoreCertificateErrors && "--ignore-certificate-errors"
    ].filter((x) => x),
    defaultViewport: null,
    timeout: config.browserLaunchTimeout,
    headless: config.debug !== true
  });

  console.log(`Visiting '${config.baseUrl}' to login...`);
  let page = await browser.newPage();
  
  const hassTokens = {
    hassUrl: config.baseUrl,
    access_token: config.accessToken,
    token_type: "Bearer"
  };

  console.log("Adding authentication entry to browser's local storage...");
  
  // Retry logic for setting localStorage
  let authSuccess = false;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (!authSuccess && retryCount < maxRetries) {
    try {
      await page.goto(config.baseUrl, {
        timeout: config.renderingTimeout,
        waitUntil: 'domcontentloaded'
      });
      
      // Wait a bit for the page to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await page.evaluate(
        (hassTokens, selectedLanguage) => {
          localStorage.setItem("hassTokens", hassTokens);
          localStorage.setItem("selectedLanguage", selectedLanguage);
        },
        JSON.stringify(hassTokens),
        JSON.stringify(config.language)
      );
      
      authSuccess = true;
      console.log("Successfully added authentication to localStorage");
    } catch (error) {
      retryCount++;
      console.warn(`Attempt ${retryCount} failed to set localStorage:`, error.message);
      
      if (retryCount < maxRetries) {
        console.log(`Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create a new page if the current one is broken
        try {
          await page.close();
        } catch (e) {
          // Ignore close errors
        }
        page = await browser.newPage();
      } else {
        console.error("Failed to set localStorage after all retries. Continuing anyway...");
        // Don't throw - continue with the application
      }
    }
  }

  try {
    await page.close();
  } catch (e) {
    // Ignore close errors
  }

  if (config.debug) {
    console.log(
      "Debug mode active, will only render once in non-headless model and keep page open"
    );
    renderAndConvertAsync(browser);
  } else {
    console.log("Starting first render...");
    await renderAndConvertAsync(browser);
    console.log("Starting rendering cronjob...");
    const job = CronJob.from({
      cronTime: config.cronJob,
      onTick: () => renderAndConvertAsync(browser),
      start: true
    });
  }

  // Helper function to get device identifier
  function getDeviceId(req) {
    return req.query.id || req.query.deviceId || req.ip || req.connection.remoteAddress;
  }

  // Setup Express app
  const app = express();
  app.use(express.json());
  app.set('trust proxy', true); // Trust reverse proxy for correct IP

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      pages: config.pages.length,
      mqtt_connected: mqttClient && mqttClient.connected,
      total_devices: deviceRefreshCounts.size
    });
  });

  // Debug endpoint to view refresh statistics
  app.get('/debug/refreshes', (req, res) => {
    const stats = {};
    for (const [deviceId, count] of deviceRefreshCounts.entries()) {
      stats[deviceId] = {
        total_refreshes: count,
        recent_history: deviceRefreshHistory.get(deviceId)?.slice(-10) || []
      };
    }
    res.json(stats);
  });

  // Debug endpoint to view recent requests
  app.get('/debug/requests', (req, res) => {
    res.json({
      recent_requests: requestLog.slice(-50),
      total_logged: requestLog.length
    });
  });

  // Main image serving function with proper HTTP semantics
  async function serveImage(req, res) {
    // Parse page number from URL (support both /1 and /1.png)
    const pageNumberMatch = req.params.pageNumber?.match(/^(\d+)(?:\.\w+)?$/) || 
                           req.params[0]?.match(/^(\d+)(?:\.\w+)?$/);
    const pageNumber = pageNumberMatch ? parseInt(pageNumberMatch[1]) : 1;
    
    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > config.pages.length) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    try {
      const deviceId = getDeviceId(req);
      const ipAddress = req.ip;
      
      // Extract battery info from query params
      const batteryLevel = parseInt(req.query.battery || req.query.batteryLevel);
      const isChargingParam = req.query.charging || req.query.isCharging;
      const isCharging = ['true', '1', 'Yes', 'yes'].includes(isChargingParam) ? true : 
                        ['false', '0', 'No', 'no'].includes(isChargingParam) ? false : null;

      // Extract refresh type from query params
      const refreshType = req.query.refresh || 'unknown'; // 'full', 'partial', or 'unknown'

      // Log the request
      logRequest(
        deviceId, 
        ipAddress, 
        pageNumber, 
        !isNaN(batteryLevel) ? batteryLevel : null, 
        isCharging,
        refreshType
      );

      // Track refresh count
      trackRefresh(deviceId, refreshType);

      // Publish battery data to MQTT if provided
      if (!isNaN(batteryLevel)) {
        publishBatteryStatusToMqtt(deviceId, {
          batteryLevel,
          isCharging: isCharging || false
        });
      }

      const pageIndex = pageNumber - 1;
      const configPage = config.pages[pageIndex];
      const outputPathWithExtension = configPage.outputPath + "." + configPage.imageFormat;
      
      const stat = await fs.stat(outputPathWithExtension);
      const lastModified = new Date(stat.mtime);
      const etag = `"${stat.mtime}-${stat.size}"`;

      // Check if client has current version (proper HTTP caching)
      const clientEtag = req.headers['if-none-match'];
      const clientModified = req.headers['if-modified-since'];
      
      if (clientEtag === etag || (clientModified && new Date(clientModified) >= lastModified)) {
        return res.status(304).end();
      }

      const data = await fs.readFile(outputPathWithExtension);
      
      res.set({
        'Content-Type': `image/${configPage.imageFormat}`,
        'Last-Modified': lastModified.toUTCString(),
        'ETag': etag,
        'Cache-Control': 'public, max-age=60',
        'Content-Length': data.length
      });
      
      res.send(data);
    } catch (e) {
      console.error('Error serving image:', e);
      res.status(404).send('Image not found');
    }
  }

  // Image serving routes - support multiple formats
  app.get('/:pageNumber', (req, res) => {
    if (req.params.pageNumber === 'favicon.ico') {
      return res.status(404).end();
    }
    serveImage(req, res);
  });
  
  app.get('/image/:pageNumber', serveImage);
  
  app.get('/', (req, res) => {
    req.params.pageNumber = '1';
    serveImage(req, res);
  });

  const port = config.port || 5000;
  app.listen(port, () => {
    console.log(`Express server running on port ${port}`);
    console.log(`Endpoints:`);
    console.log(`  GET  /health                     - Health check with MQTT status`);
    console.log(`  GET  /:pageNumber[.ext]          - Serve image (supports /1, /1.png, etc.)`);
    console.log(`  GET  /image/:pageNumber[.ext]    - Serve image`);
    console.log(`  GET  /                           - Serve page 1`);
    console.log(`  GET  /debug/refreshes            - View refresh statistics per device`);
    console.log(`  GET  /debug/requests             - View recent request log`);
    console.log(`Query parameters:`);
    console.log(`  ?id=deviceName                   - Device identifier (fallback: IP address)`);
    console.log(`  ?battery=85                      - Battery level (0-100, publishes to MQTT)`);
    console.log(`  ?charging=true                   - Charging status (true/false/1/0/Yes/No)`);
    console.log(`  ?refresh=full                    - Refresh type (full/partial, tracked in MQTT)`);
    console.log(`Features:`);
    console.log(`  • Proper HTTP caching (ETags, Last-Modified, 304 responses)`);
    console.log(`  • Request logging (last ${MAX_LOG_ENTRIES} requests in memory)`);
    console.log(`  • MQTT publishing for battery data and refresh tracking`);
    console.log(`  • Per-device refresh count tracking (up to ${MAX_REFRESH_HISTORY} history entries)`);
    console.log(`MQTT Topics:`);
    console.log(`  inkplate-dashboard/{deviceId}/battery   - Battery level updates`);
    console.log(`  inkplate-dashboard/{deviceId}/charging  - Charging status updates`);
    console.log(`  inkplate-dashboard/{deviceId}/refresh   - Refresh count increments`);
  });
})();

async function renderAndConvertAsync(browser) {
  for (let pageIndex = 0; pageIndex < config.pages.length; pageIndex++) {
    const pageConfig = config.pages[pageIndex];

    const url = `${config.baseUrl}${pageConfig.screenShotUrl}`;

    const outputPath = pageConfig.outputPath + "." + pageConfig.imageFormat;
    await fsExtra.ensureDir(path.dirname(outputPath));

    const tempPath = outputPath + ".temp";

    console.log(`Rendering ${url} to image...`);
    const renderSuccess = await renderUrlToImageAsync(browser, pageConfig, url, tempPath);

    if (renderSuccess) {
      console.log(`Converting rendered screenshot of ${url} to grayscale...`);
      await convertImageToKindleCompatiblePngAsync(
        pageConfig,
        tempPath,
        outputPath
      );
      
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        console.warn(`Could not delete temp file ${tempPath}:`, e.message);
      }
      
      console.log(`Finished ${url}`);
    } else {
      console.error(`Failed to render ${url}, skipping image conversion`);
    }
  }
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
        }`
    });

    if (pageConfig.renderingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, pageConfig.renderingDelay));
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
    
    // Return success if we got here
    return true;
  } catch (e) {
    console.error("Failed to render", e);
    return false;
  } finally {
    if (config.debug === false && page) {
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

  // Use ImageMagick directly via execa
  const magickCommand = config.useImageMagick ? 'magick' : 'convert';
  await execa(magickCommand, [
    `${palPath}.ppm`,
    '-colors', steps.toString(),
    '-type', 'Palette',
    palPath
  ]);
  await fs.unlink(`${palPath}.ppm`);
  return palPath;
}

async function convertImageToKindleCompatiblePngAsync(pageCfg, input, output) {
  // Check if input file exists
  try {
    await fs.access(input);
  } catch (error) {
    throw new Error(`Input file ${input} does not exist or is not readable`);
  }

  const depth = Number(pageCfg.grayscaleDepth);      // 1‒4 or 8
  const pal = depth < 8 ? await ensurePalette(depth) : null;
  const ditherAlgo = pageCfg.ditherAlgo || "Riemersma";
  const useDither = pageCfg.dither;

  // Build ImageMagick command arguments
  const magickCommand = config.useImageMagick ? 'magick' : 'convert';
  const args = [
    input,
    // ---- linear workflow ----
    '-colorspace', 'Gray',
    '-gamma', '0.45455',            // sRGB → linear
    // optional contrast / saturation tweaks
    '-modulate', `100,${100 * pageCfg.saturation}`,
    '-brightness-contrast', `${pageCfg.contrast}`,
    '-level', `${pageCfg.blackLevel},${pageCfg.whiteLevel}`,
    '-gamma', '2.2',                // back to perceptual
  ];

  // ---- sharpening ----
  if (pageCfg.sharpen) {
    args.push('-unsharp', pageCfg.sharpen);
  }

  // ---- rotation ----
  args.push('-rotate', pageCfg.rotation.toString());
  args.push('-background', 'white');

  // ---- quantise & dither ----
  if (depth < 8) {
    args.push(
      '-type', 'Palette',
      '-dither', useDither ? ditherAlgo : 'None',
      '-define', `png:bit-depth=${depth}`,
      '-remap', pal
    );
  } else {
    args.push('-define', `png:bit-depth=8`);
  }

  // ---- compression + clean ----
  args.push(
    '-strip',
    '-define', 'png:compression-level=9',
    '-define', 'png:compression-filter=5',
    '-define', 'png:compression-strategy=1',
    '-define', 'png:compression-window=15',
    '-define', 'png:compression-memory=8',
    output
  );

  // Execute ImageMagick command with better error handling
  try {
    await execa(magickCommand, args);
  } catch (error) {
    console.error(`ImageMagick command failed: ${magickCommand} ${args.join(' ')}`);
    console.error(`Error: ${error.message}`);
    if (error.stderr) {
      console.error(`stderr: ${error.stderr}`);
    }
    throw error;
  }
}
