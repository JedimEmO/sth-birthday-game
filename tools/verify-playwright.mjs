import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(new URL("..", import.meta.url).pathname);
const html = pathToFileURL(resolve(root, "dist/index.html")).href;
const chromiumPath = process.env.CHROMIUM_PATH ?? "/snap/bin/chromium";
const outDir = resolve(root, "dist/verification");

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromiumPath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"]
});

const results = [];

for (const config of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 }
]) {
  const page = await browser.newPage({
    viewport: { width: config.width, height: config.height },
    deviceScaleFactor: config.name === "mobile" ? 2 : 1,
    isMobile: config.name === "mobile",
    hasTouch: config.name === "mobile"
  });

  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await page.goto(html, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(700);

  const titlePixels = await sampleCanvas(page);
  await page.screenshot({ path: resolve(outDir, `${config.name}-title.png`), fullPage: true });

  await page.getByText("Begin Run").click();
  await page.waitForTimeout(250);

  if (config.name === "desktop") {
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(220);
    await page.keyboard.up("KeyD");
    await page.mouse.click(Math.floor(config.width * 0.62), Math.floor(config.height * 0.48));
    await page.keyboard.press("Space");
    await page.keyboard.press("KeyQ");
  } else {
    await page.getByRole("button", { name: "Strike" }).tap();
    await page.getByRole("button", { name: "Dash" }).tap();
    await page.getByRole("button", { name: "Special" }).tap();
  }

  await page.waitForTimeout(800);
  const playingPixels = await sampleCanvas(page);
  await page.screenshot({ path: resolve(outDir, `${config.name}-playing.png`), fullPage: true });
  const spellUi = await page.evaluate(() => {
    const deck = document.querySelector("#spellDeck");
    const slots = [...document.querySelectorAll("#spellDeck [data-spell-index]")];

    return {
      visible: deck instanceof HTMLElement && getComputedStyle(deck).display !== "none",
      slotCount: slots.length,
      activeCount: slots.filter((slot) => slot.classList.contains("isActive")).length,
      labels: slots.map((slot) => slot.textContent?.replace(/\s+/g, " ").trim() ?? "")
    };
  });
  const roomSummary = await page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    return window.__waffleTest.roomSummary();
  });
  const spellUpgrade = await page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    const before = window.__waffleTest.spellState();
    window.__waffleTest.grantSpellPoint();
    const upgraded = window.__waffleTest.upgradeSpell(1);
    const after = window.__waffleTest.spellState();
    return { before, upgraded, after };
  });
  const roomSamples = [];

  for (let index = 0; index < roomSummary.roomCount; index += 1) {
    await page.evaluate((roomIndex) => {
      window.__waffleTest?.previewRoom(roomIndex);
    }, index);
    await page.waitForTimeout(220);
    roomSamples.push({
      index,
      name: roomSummary.roomNames[index],
      pixels: await sampleCanvas(page)
    });
  }

  await page.evaluate(() => {
    window.__waffleTest?.previewPowerups();
  });
  await page.waitForTimeout(350);
  const powerupPixels = await sampleCanvas(page);

  const spellSamples = [];
  for (let index = 0; index < roomSummary.spellIds.length; index += 1) {
    await page.evaluate((spellIndex) => {
      window.__waffleTest?.previewSpell(spellIndex);
    }, index);
    await page.waitForTimeout(280);
    spellSamples.push({
      id: roomSummary.spellIds[index],
      pixels: await sampleCanvas(page)
    });
  }

  await page.screenshot({ path: resolve(outDir, `${config.name}-final-boss.png`), fullPage: true });

  results.push({
    viewport: config,
    titlePixels,
    playingPixels,
    spellUi,
    spellUpgrade,
    roomSummary,
    roomSamples,
    powerupPixels,
    spellSamples,
    errors,
    changedSamples: Math.abs(playingPixels.hash - titlePixels.hash)
  });

  await page.close();
}

await browser.close();

await writeFile(resolve(outDir, "report.json"), JSON.stringify(results, null, 2), "utf8");

for (const result of results) {
  const titleOk = result.titlePixels.nonBlankRatio > 0.08 && result.titlePixels.uniqueColors > 24;
  const playingOk = result.playingPixels.nonBlankRatio > 0.08 && result.playingPixels.uniqueColors > 24;
  const powerupsOk = result.powerupPixels.nonBlankRatio > 0.08 && result.powerupPixels.uniqueColors > 24;
  const changedOk = result.changedSamples > 1000;
  const requiredEnemyKinds = ["burger", "shade", "mage", "golem", "griddleBoss", "candleBoss", "burgerBoss"];
  const requiredSpellIds = ["waffle", "syrupNova", "candleSpiral", "griddleSlam"];
  const requiredPowerupKinds = ["heal", "syrup", "haste", "might"];
  const spellUiOk =
    result.spellUi.visible
    && result.spellUi.slotCount >= requiredSpellIds.length
    && result.spellUi.activeCount === 1
    && ["Waffle Bolt", "Syrup Nova", "Candle Spiral", "Griddle Slam"].every((name) => result.spellUi.labels.some((label) => label.includes(name)));
  const spellUpgradeOk =
    result.spellUpgrade.upgraded === true
    && result.spellUpgrade.after.levels.syrupNova === result.spellUpgrade.before.levels.syrupNova + 1
    && result.spellUpgrade.after.points < result.spellUpgrade.before.points + 1;
  const summaryOk =
    result.roomSummary.roomCount >= 8
    && result.roomSummary.bossRoomCount >= 3
    && result.roomSummary.arenaIds.length >= 5
    && result.roomSummary.spellMaxLevel >= 4
    && requiredEnemyKinds.every((kind) => result.roomSummary.enemyKinds.includes(kind))
    && requiredSpellIds.every((id) => result.roomSummary.spellIds.includes(id))
    && requiredPowerupKinds.every((kind) => result.roomSummary.powerupKinds.includes(kind));
  const roomSamplesOk =
    result.roomSamples.length === result.roomSummary.roomCount
    && new Set(result.roomSamples.map((sample) => sample.pixels.hash)).size >= 5
    && result.roomSamples.every((sample) => sample.pixels.nonBlankRatio > 0.08 && sample.pixels.uniqueColors > 24);
  const spellSamplesOk =
    result.spellSamples.length >= requiredSpellIds.length
    && new Set(result.spellSamples.map((sample) => sample.pixels.hash)).size >= 3
    && result.spellSamples.every((sample) => sample.pixels.nonBlankRatio > 0.08 && sample.pixels.uniqueColors > 24);

  if (!titleOk || !playingOk || !powerupsOk || !changedOk || !spellUiOk || !spellUpgradeOk || !summaryOk || !roomSamplesOk || !spellSamplesOk || result.errors.length > 0) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  }
}

if (process.exitCode !== 1) {
  console.log("Playwright verification passed");
}

async function sampleCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas missing");
    }

    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");

    if (!gl) {
      throw new Error("WebGL context missing");
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const step = Math.max(4, Math.floor((width * height) / 9000) * 4);
    const colors = new Set();
    let nonBlank = 0;
    let total = 0;
    let hash = 0;

    for (let i = 0; i < pixels.length; i += step) {
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      const a = pixels[i + 3] ?? 0;
      total += 1;
      colors.add(`${r >> 3},${g >> 3},${b >> 3},${a >> 5}`);
      hash = (hash + (r * 3 + g * 5 + b * 7 + a * 11) * total) % 1000000007;

      if (a > 0 && (Math.abs(r - 24) + Math.abs(g - 23) + Math.abs(b - 33)) > 12) {
        nonBlank += 1;
      }
    }

    return {
      width,
      height,
      samples: total,
      nonBlankRatio: nonBlank / total,
      uniqueColors: colors.size,
      hash
    };
  });
}
