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
  { name: "mobile", width: 390, height: 844 },
  { name: "controller", width: 1280, height: 800, gamepad: true }
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

  if (config.gamepad) {
    await page.addInitScript(() => {
      const axes = [0, 0, 0, 0];
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
      const gamepad = {
        id: "Verifier Standard Gamepad",
        index: 0,
        connected: true,
        mapping: "standard",
        timestamp: 0,
        axes,
        buttons
      };

      window.__setVerifierGamepad = (state = {}) => {
        const nextAxes = state.axes ?? [0, 0, 0, 0];
        for (let index = 0; index < axes.length; index += 1) {
          axes[index] = nextAxes[index] ?? 0;
        }

        const pressed = new Set(state.buttons ?? []);
        for (let index = 0; index < buttons.length; index += 1) {
          buttons[index].pressed = pressed.has(index);
          buttons[index].touched = pressed.has(index);
          buttons[index].value = pressed.has(index) ? 1 : 0;
        }

        gamepad.timestamp += 16;
      };

      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [gamepad]
      });
    });
  }

  await page.goto(html, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(700);
  await waitForDrawableCanvas(page);

  const titlePixels = await sampleCanvas(page);
  const titleControls = await page.evaluate(() => document.querySelector(".controlGuide")?.textContent?.replace(/\s+/g, " ").trim() ?? "");
  const titleMenu = await menuState(page);
  await page.screenshot({ path: resolve(outDir, `${config.name}-title.png`), fullPage: true });

  if (config.gamepad) {
    await setGamepad(page, { buttons: [0] });
    await page.waitForTimeout(120);
    await setGamepad(page, {});
  } else {
    await page.getByText("Enter Playground").click();
  }

  await page.waitForTimeout(250);

  const playgroundState = await page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    return window.__waffleTest.playgroundState();
  });
  let controlState = null;
  let touchExercise = null;
  let controllerExercise = null;

  if (config.name === "desktop") {
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(220);
    await page.keyboard.up("KeyD");
    await page.mouse.click(Math.floor(config.width * 0.62), Math.floor(config.height * 0.48));
    await page.keyboard.press("Space");
    await page.keyboard.press("KeyQ");
  } else {
    if (config.gamepad) {
      const before = await inputState(page);
      await setGamepad(page, { axes: [0.9, 0, 0, 0] });
      await page.waitForTimeout(320);
      const afterMove = await inputState(page);
      await setGamepad(page, { axes: [0.9, 0, 0, 0] });
      await page.waitForTimeout(120);
      await setGamepad(page, { axes: [0.9, 0, 0, 0], buttons: [2] });
      await page.waitForTimeout(80);
      const afterAttack = await inputState(page);
      await setGamepad(page, {});
      await setGamepad(page, { buttons: [1] });
      await page.waitForTimeout(80);
      await setGamepad(page, {});
      await setGamepad(page, { buttons: [0] });
      await page.waitForTimeout(80);
      await setGamepad(page, {});
      await setGamepad(page, { buttons: [6] });
      await page.waitForTimeout(80);
      await setGamepad(page, {});
      await setGamepad(page, { buttons: [3] });
      await page.waitForTimeout(80);
      await setGamepad(page, {});
      await setGamepad(page, { buttons: [5] });
      await page.waitForTimeout(80);
      await setGamepad(page, {});
      controlState = await inputState(page);
      controllerExercise = { before, afterMove, afterAttack, after: controlState };
    } else {
      await page.getByRole("button", { name: "Strike" }).tap();
      const afterAttack = await inputState(page);
      await page.getByRole("button", { name: "Dash" }).tap();
      const afterDash = await inputState(page);
      await page.getByRole("button", { name: "Special" }).tap();
      const afterSpecial = await inputState(page);
      await page.getByRole("button", { name: "Spell" }).tap();
      await page.getByRole("button", { name: "Weapon" }).tap();
      controlState = await inputState(page);
      touchExercise = { afterAttack, afterDash, afterSpecial, afterCycle: controlState };
    }
  }

  if (!controlState) {
    controlState = await inputState(page);
  }

  const playgroundBeforePortal = await page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    return window.__waffleTest.playgroundState();
  });
  const portalExit = await page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    return window.__waffleTest.stepOnPortal();
  });
  await page.waitForTimeout(250);
  const afterPortalState = await inputState(page);

  await page.waitForTimeout(800);
  const playingPixels = await sampleCanvas(page);
  await page.screenshot({ path: resolve(outDir, `${config.name}-playing.png`), fullPage: true });
  const spellUi = await page.evaluate(() => {
    const deck = document.querySelector("#spellDeck");
    const slots = [...document.querySelectorAll("#spellDeck [data-spell-index]")];
    const rect = deck instanceof HTMLElement ? deck.getBoundingClientRect() : null;

    return {
      visible: deck instanceof HTMLElement && getComputedStyle(deck).display !== "none",
      bounds: rect ? { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom } : null,
      slotCount: slots.length,
      activeCount: slots.filter((slot) => slot.classList.contains("isActive")).length,
      labels: slots.map((slot) => slot.textContent?.replace(/\s+/g, " ").trim() ?? "")
    };
  });
  const touchUi = await page.evaluate(() => {
    const root = document.querySelector("#touchControls");
    const stick = document.querySelector("#stick");
    const buttons = [...document.querySelectorAll("#touchControls button")];
    const rectFor = (element) => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    };
    const buttonRects = buttons.map((button) => ({
      label: button.textContent?.trim() ?? "",
      rect: rectFor(button)
    }));
    const allRects = [rectFor(stick), ...buttonRects.map((entry) => entry.rect)].filter(Boolean);
    let overlaps = 0;

    for (let i = 0; i < allRects.length; i += 1) {
      for (let j = i + 1; j < allRects.length; j += 1) {
        const a = allRects[i];
        const b = allRects[j];
        const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

        if (overlapX * overlapY > 4) {
          overlaps += 1;
        }
      }
    }

    return {
      visible: root instanceof HTMLElement && getComputedStyle(root).display !== "none",
      stick: rectFor(stick),
      buttons: buttonRects,
      overlaps,
      withinViewport: allRects.every((rect) => rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight)
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
    window.__waffleTest.grantFocusPoint();
    const grantedSpell = window.__waffleTest.spellState();
    const grantedWeapon = window.__waffleTest.weaponState();
    const upgraded = window.__waffleTest.upgradeSpell(1);
    const after = window.__waffleTest.spellState();
    const afterWeapon = window.__waffleTest.weaponState();
    return { before, grantedSpell, grantedWeapon, upgraded, after, afterWeapon };
  });
  const weaponUpgrade = await page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    const before = window.__waffleTest.weaponState();
    window.__waffleTest.grantFocusPoint();
    const grantedWeapon = window.__waffleTest.weaponState();
    const grantedSpell = window.__waffleTest.spellState();
    const upgraded = window.__waffleTest.upgradeWeapon(1);
    const after = window.__waffleTest.weaponState();
    const afterSpell = window.__waffleTest.spellState();
    return { before, grantedWeapon, grantedSpell, upgraded, after, afterSpell };
  });
  const techniqueChoice = await page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    const before = window.__waffleTest.progressionState();
    const chosen = window.__waffleTest.chooseTechnique(0);
    const after = window.__waffleTest.progressionState();
    return { before, chosen, after };
  });
  let menuExercise = null;

  if (config.gamepad) {
    await page.evaluate(() => {
      if (!window.__waffleTest) {
        throw new Error("Missing __waffleTest hook");
      }

      window.__waffleTest.previewBoonMenu();
    });
    await page.waitForTimeout(120);
    const beforeProgression = await progressionState(page);
    const before = await menuState(page);
    await setGamepad(page, { buttons: [15] });
    await page.waitForTimeout(120);
    await setGamepad(page, {});
    await page.waitForTimeout(80);
    const afterRight = await menuState(page);
    await setGamepad(page, { buttons: [13] });
    await page.waitForTimeout(120);
    await setGamepad(page, {});
    await page.waitForTimeout(80);
    const afterDown = await menuState(page);
    await setGamepad(page, { buttons: [0] });
    await page.waitForTimeout(120);
    await setGamepad(page, {});
    await page.waitForTimeout(120);
    const afterSelect = await inputState(page);
    const afterProgression = await progressionState(page);
    menuExercise = { beforeProgression, before, afterRight, afterDown, afterSelect, afterProgression };
  }

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
  const pickupText = await page.evaluate(() => {
    window.__waffleTest?.previewPickup("heal");
    return window.__waffleTest?.combatTextLabels() ?? [];
  });

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
    titleControls,
    titleMenu,
    playgroundState,
    playgroundBeforePortal,
    portalExit,
    afterPortalState,
    playingPixels,
    spellUi,
    touchUi,
    controlState,
    touchExercise,
    controllerExercise,
    menuExercise,
    spellUpgrade,
    weaponUpgrade,
    techniqueChoice,
    roomSummary,
    roomSamples,
    powerupPixels,
    pickupText,
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
  const requiredWeaponIds = ["spatula", "fork", "rollingPin"];
  const requiredTechniqueIds = ["glassBatter", "syrupScholar", "ironBirthday", "dashChef", "trapwright", "greedyGriddle", "heavyServe", "swiftFrosting"];
  const requiredPowerupKinds = ["heal", "syrup", "haste", "might"];
  const requiredTouchLabels = ["Strike", "Dash", "Special", "Trap", "Spell", "Weapon"];
  const titleMenuOk = result.titleMenu.labels.some((label) => label.includes("Enter Playground")) && result.titleMenu.focusedLabel.includes("Enter Playground");
  const titleControlsOk =
    ["Keyboard", "Touch", "Controller", "Left stick move and aim", "West attack", "east dash", "South spell", "north cycle spell", "South or Start select"].every((label) => result.titleControls.includes(label));
  const playgroundOk =
    result.playgroundState.active === true
    && result.playgroundState.portalActive === true
    && result.playgroundState.distanceToPortal > 1
    && result.playgroundBeforePortal.active === true
    && result.playgroundBeforePortal.portalActive === true
    && result.portalExit === "playing"
    && result.afterPortalState.mode === "playing";
  const spellUiOk =
    result.spellUi.visible
    && result.spellUi.slotCount >= requiredSpellIds.length
    && result.spellUi.activeCount === 1
    && ["Waffle Bolt", "Syrup Nova", "Candle Spiral", "Griddle Slam"].every((name) => result.spellUi.labels.some((label) => label.includes(name)))
    && (result.viewport.name !== "mobile" || (result.spellUi.bounds && result.spellUi.bounds.height <= 52));
  const touchUiOk =
    result.viewport.name !== "mobile"
    || (
      result.touchUi.visible
      && result.touchUi.withinViewport
      && result.touchUi.overlaps === 0
      && result.touchUi.stick
      && result.touchUi.stick.width >= 110
      && result.touchUi.stick.height >= 110
      && requiredTouchLabels.every((label) => result.touchUi.buttons.some((button) => button.label === label && button.rect && button.rect.width >= 60 && button.rect.height >= 48))
    );
  const mobileControlsOk =
    result.viewport.name !== "mobile"
    || (
      result.controlState.activeInput === "touch"
      && result.touchExercise
      && result.touchExercise.afterAttack.attackCooldown > 0
      && result.touchExercise.afterDash.dashCooldown > 0
      && result.touchExercise.afterSpecial.specialCooldown > 0
      && result.controlState.spellIndex === 1
      && result.controlState.weaponIndex === 1
      && requiredTouchLabels.every((label) => result.controlState.touchButtons.includes(label))
    );
  const controllerControlsOk =
    !result.viewport.gamepad
    || (
      result.controlState.gamepadActive === true
      && result.controlState.gamepadSupported === true
      && result.controlState.gamepadCount >= 1
      && result.controlState.gamepadIndex === 0
      && result.controlState.activeInput === "gamepad"
      && result.controlState.gamepadName.includes("Verifier")
      && result.controllerExercise
      && result.controllerExercise.afterMove.pos.x > result.controllerExercise.before.pos.x + 0.25
      && result.controllerExercise.afterAttack.lastAim.x > 0.55
      && Math.abs(result.controllerExercise.afterAttack.lastAim.y) < 0.45
      && result.controllerExercise.afterAttack.attackCooldown > 0
      && result.controllerExercise.after.dashCooldown > 0
      && result.controllerExercise.after.specialCooldown > 0
      && result.controllerExercise.after.trapCooldown > 0
      && result.controllerExercise.after.spellIndex === 1
      && result.controllerExercise.after.weaponIndex === 1
    );
  const controllerMenuOk =
    !result.viewport.gamepad
    || (
      result.menuExercise
      && result.menuExercise.before.labels.length > 1
      && result.menuExercise.afterRight.focusIndex !== result.menuExercise.before.focusIndex
      && result.menuExercise.afterDown.focusIndex !== result.menuExercise.afterRight.focusIndex
      && result.menuExercise.afterSelect.activeInput === "gamepad"
      && (
        result.menuExercise.afterSelect.mode === "playing"
        || result.menuExercise.afterProgression.focusPoints < result.menuExercise.beforeProgression.focusPoints
        || result.menuExercise.afterProgression.techniques.length > result.menuExercise.beforeProgression.techniques.length
      )
    );
  const spellUpgradeOk =
    result.spellUpgrade.upgraded === true
    && result.spellUpgrade.after.levels.syrupNova === result.spellUpgrade.before.levels.syrupNova + 1
    && result.spellUpgrade.grantedSpell.points === result.spellUpgrade.grantedWeapon.points
    && result.spellUpgrade.after.points === result.spellUpgrade.afterWeapon.points
    && result.spellUpgrade.after.points < result.spellUpgrade.before.points + 1;
  const weaponUpgradeOk =
    result.weaponUpgrade.upgraded === true
    && result.weaponUpgrade.after.levels.fork === result.weaponUpgrade.before.levels.fork + 1
    && result.weaponUpgrade.grantedWeapon.points === result.weaponUpgrade.grantedSpell.points
    && result.weaponUpgrade.after.points === result.weaponUpgrade.afterSpell.points
    && result.weaponUpgrade.after.points < result.weaponUpgrade.before.points + 1;
  const techniqueChoiceOk =
    result.techniqueChoice.chosen === true
    && result.techniqueChoice.after.techniques.length === result.techniqueChoice.before.techniques.length + 1
    && result.techniqueChoice.after.techniques.length <= result.techniqueChoice.after.techniqueSlots
    && (result.techniqueChoice.after.spellPower !== result.techniqueChoice.before.spellPower || result.techniqueChoice.after.weaponPower !== result.techniqueChoice.before.weaponPower || result.techniqueChoice.after.techniques.length > 0);
  const pickupTextOk = result.pickupText.some((label) => label.includes("HEAL"));
  const summaryOk =
    result.roomSummary.roomCount >= 8
    && result.roomSummary.bossRoomCount >= 3
    && result.roomSummary.arenaIds.length >= 5
    && result.roomSummary.spellMaxLevel >= 4
    && result.roomSummary.weaponMaxLevel >= 4
    && result.roomSummary.techniqueSlots >= 3
    && requiredEnemyKinds.every((kind) => result.roomSummary.enemyKinds.includes(kind))
    && requiredSpellIds.every((id) => result.roomSummary.spellIds.includes(id))
    && requiredWeaponIds.every((id) => result.roomSummary.weaponIds.includes(id))
    && requiredTechniqueIds.every((id) => result.roomSummary.techniqueIds.includes(id))
    && requiredPowerupKinds.every((kind) => result.roomSummary.powerupKinds.includes(kind));
  const roomSamplesOk =
    result.roomSamples.length === result.roomSummary.roomCount
    && new Set(result.roomSamples.map((sample) => sample.pixels.hash)).size >= 5
    && result.roomSamples.every((sample) => sample.pixels.nonBlankRatio > 0.08 && sample.pixels.uniqueColors > 24);
  const spellSamplesOk =
    result.spellSamples.length >= requiredSpellIds.length
    && new Set(result.spellSamples.map((sample) => sample.pixels.hash)).size >= 3
    && result.spellSamples.every((sample) => sample.pixels.nonBlankRatio > 0.08 && sample.pixels.uniqueColors > 24);

  if (!titleOk || !titleMenuOk || !titleControlsOk || !playgroundOk || !playingOk || !powerupsOk || !changedOk || !spellUiOk || !touchUiOk || !mobileControlsOk || !controllerControlsOk || !controllerMenuOk || !spellUpgradeOk || !weaponUpgradeOk || !techniqueChoiceOk || !pickupTextOk || !summaryOk || !roomSamplesOk || !spellSamplesOk || result.errors.length > 0) {
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

async function waitForDrawableCanvas(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      return false;
    }

    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return Boolean(gl && gl.drawingBufferWidth > 0 && gl.drawingBufferHeight > 0);
  });
}

async function setGamepad(page, state) {
  await page.evaluate((nextState) => {
    window.__setVerifierGamepad?.(nextState);
  }, state);
}

async function inputState(page) {
  return page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    return window.__waffleTest.inputState();
  });
}

async function menuState(page) {
  return page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    return window.__waffleTest.menuState();
  });
}

async function progressionState(page) {
  return page.evaluate(() => {
    if (!window.__waffleTest) {
      throw new Error("Missing __waffleTest hook");
    }

    return window.__waffleTest.progressionState();
  });
}
