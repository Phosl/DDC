import { expect, test, type Page } from "@playwright/test";

type GamepadPatch = Readonly<{
  axes?: readonly number[];
  buttons?: Readonly<Record<number, number>>;
  connected?: boolean;
}>;

async function installGamepadStub(page: Page) {
  await page.addInitScript(() => {
    type MutablePadState = {
      axes: number[];
      buttons: number[];
      connected: boolean;
      timestamp: number;
    };
    type TestWindow = Window & {
      __DDC_SET_GAMEPAD__?: (patch: {
        axes?: readonly number[];
        buttons?: Readonly<Record<number, number>>;
        connected?: boolean;
      }) => void;
    };

    const state: MutablePadState = {
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => 0),
      connected: true,
      timestamp: 0,
    };
    const testWindow = window as TestWindow;

    testWindow.__DDC_SET_GAMEPAD__ = (patch) => {
      if (patch.axes) state.axes = [...patch.axes];
      if (patch.buttons) {
        state.buttons.fill(0);
        Object.entries(patch.buttons).forEach(([index, value]) => {
          state.buttons[Number(index)] = value;
        });
      }
      if (patch.connected !== undefined) state.connected = patch.connected;
      state.timestamp += 1;
    };

    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => {
        if (!state.connected) return [];
        return [
          {
            id: "Cantica Zero test controller",
            index: 0,
            connected: true,
            mapping: "standard",
            timestamp: state.timestamp,
            axes: [...state.axes],
            buttons: state.buttons.map((value) => ({
              pressed: value > 0.5,
              touched: value > 0,
              value,
            })),
            vibrationActuator: null,
          },
        ];
      },
    });
  });
}

async function setGamepad(page: Page, patch: GamepadPatch) {
  await page.evaluate((nextPatch) => {
    const testWindow = window as Window & {
      __DDC_SET_GAMEPAD__?: (value: GamepadPatch) => void;
    };
    testWindow.__DDC_SET_GAMEPAD__?.(nextPatch);
  }, patch);
}

async function readTelemetry(page: Page) {
  return page.evaluate(() => {
    const telemetry = window.__CANTICA_ZERO_TEST__?.readTelemetry?.();
    if (!telemetry) throw new Error("Cantica Zero telemetry is unavailable.");
    return telemetry;
  });
}

async function fireAndRead(
  page: Page,
  axes: readonly number[],
  previousSequence: number,
) {
  await setGamepad(page, { axes, buttons: { 7: 1 } });
  await expect
    .poll(async () => (await readTelemetry(page)).lastShot?.sequence ?? 0)
    .toBeGreaterThan(previousSequence);
  const telemetry = await readTelemetry(page);
  await setGamepad(page, { axes: [0, 0, 0, 0], buttons: {} });
  await page.waitForTimeout(210);
  return telemetry;
}

test.describe("Cantica Zero 360 gamepad aim", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "Gamepad mapping is checked on desktop Chromium.");
    await installGamepadStub(page);
    await page.goto("/gioco");
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    await expect.poll(async () => (await readTelemetry(page)).player.grounded).toBe(true);
  });

  test("fires at full speed in all four cardinal directions", async ({ page }) => {
    let sequence = (await readTelemetry(page)).lastShot?.sequence ?? 0;

    const right = await fireAndRead(page, [0, 0, 1, 0], sequence);
    sequence = right.lastShot?.sequence ?? sequence;
    expect(right.lastShot?.velocityX).toBeGreaterThan(450);
    expect(Math.abs(right.lastShot?.velocityY ?? Infinity)).toBeLessThan(2);

    const down = await fireAndRead(page, [0, 0, 0, 1], sequence);
    sequence = down.lastShot?.sequence ?? sequence;
    expect(down.lastShot?.velocityY).toBeGreaterThan(450);
    expect(Math.abs(down.lastShot?.velocityX ?? Infinity)).toBeLessThan(2);

    const left = await fireAndRead(page, [0, 0, -1, 0], sequence);
    sequence = left.lastShot?.sequence ?? sequence;
    expect(left.lastShot?.velocityX).toBeLessThan(-450);
    expect(Math.abs(left.lastShot?.velocityY ?? Infinity)).toBeLessThan(2);

    const up = await fireAndRead(page, [0, 0, 0, -1], sequence);
    expect(up.lastShot?.velocityY).toBeLessThan(-450);
    expect(Math.abs(up.lastShot?.velocityX ?? Infinity)).toBeLessThan(2);
  });

  test("aims opposite to the run while preserving movement-facing and releases safely", async ({ page }) => {
    const initialSequence = (await readTelemetry(page)).lastShot?.sequence ?? 0;
    await setGamepad(page, { axes: [1, 0, -1, 0], buttons: { 7: 1 } });

    await expect.poll(async () => (await readTelemetry(page)).player.velocityX).toBeGreaterThan(100);
    await expect.poll(async () => (await readTelemetry(page)).player.facing).toBe(1);
    await expect
      .poll(async () => (await readTelemetry(page)).lastShot?.sequence ?? 0)
      .toBeGreaterThan(initialSequence);
    expect((await readTelemetry(page)).lastShot?.velocityX).toBeLessThan(-450);

    await setGamepad(page, { connected: false });
    await page.waitForTimeout(80);
    const releasedSequence = (await readTelemetry(page)).lastShot?.sequence ?? 0;
    await page.waitForTimeout(450);
    expect((await readTelemetry(page)).lastShot?.sequence ?? 0).toBe(releasedSequence);
  });

  test("uses Start to pause and resume without touching fullscreen", async ({ page }) => {
    const shell = page.getByTestId("rise-game-shell");
    const displayMode = await shell.getAttribute("data-display-mode");

    await setGamepad(page, { buttons: { 9: 1 } });
    await expect(page.getByRole("dialog", { name: "Partita in pausa" })).toBeVisible();
    await expect(shell).toHaveAttribute("data-display-mode", displayMode ?? "inline");

    await setGamepad(page, { buttons: {} });
    await page.waitForTimeout(40);
    await setGamepad(page, { buttons: { 9: 1 } });
    await expect(page.getByRole("dialog", { name: "Partita in pausa" })).toBeHidden();
    await expect(shell).toHaveAttribute("data-display-mode", displayMode ?? "inline");
  });
});
