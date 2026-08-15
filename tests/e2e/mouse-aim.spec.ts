import { expect, test, type Page } from "@playwright/test";

async function readTelemetry(page: Page) {
  return page.evaluate(() => {
    const telemetry = window.__CANTICA_ZERO_TEST__?.readTelemetry?.();
    if (!telemetry) throw new Error("Cantica Zero telemetry is unavailable.");
    return telemetry;
  });
}

async function waitForNextShot(page: Page, sequence: number) {
  await expect
    .poll(async () => (await readTelemetry(page)).lastShot?.sequence ?? 0)
    .toBeGreaterThan(sequence);
  return readTelemetry(page);
}

test.describe("Cantica Zero desktop mouse aim", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "Mouse aim is desktop-only.");
    await page.goto("/gioco");
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    await expect.poll(async () => (await readTelemetry(page)).player.grounded).toBe(true);
  });

  test("aims at the real pointer and holds the left button to fire", async ({ page }) => {
    const surface = page.getByTestId("rise-game-pointer-surface");
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await expect(surface).toHaveCSS("cursor", "crosshair");
    await expect(page.getByTestId("rise-game-instructions")).toContainText(
      "Mouse mira · click spara",
    );

    await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.3);
    await expect.poll(async () => (await readTelemetry(page)).aim?.x ?? 0).toBeGreaterThan(0.2);
    await expect.poll(async () => (await readTelemetry(page)).aim?.y ?? 0).toBeLessThan(-0.2);

    const before = (await readTelemetry(page)).lastShot?.sequence ?? 0;
    await page.mouse.down({ button: "left" });
    const firing = await waitForNextShot(page, before);
    expect(firing.aim).not.toBeNull();
    expect(firing.lastShot?.velocityX).toBeCloseTo((firing.aim?.x ?? 0) * 460, 0);
    expect(firing.lastShot?.velocityY).toBeCloseTo((firing.aim?.y ?? 0) * 460, 0);

    await page.mouse.up({ button: "left" });
    await page.waitForTimeout(220);
    const releasedSequence = (await readTelemetry(page)).lastShot?.sequence ?? 0;
    await page.waitForTimeout(420);
    expect((await readTelemetry(page)).lastShot?.sequence ?? 0).toBe(releasedSequence);
  });

  test("J reuses the last mouse direction without requiring a joypad", async ({ page }) => {
    const surface = page.getByTestId("rise-game-pointer-surface");
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.mouse.move(box.x + box.width * 0.18, box.y + box.height * 0.38);
    await expect.poll(async () => (await readTelemetry(page)).aim?.x ?? 0).toBeLessThan(-0.2);
    const storedAim = (await readTelemetry(page)).aim;
    const before = (await readTelemetry(page)).lastShot?.sequence ?? 0;

    await page.keyboard.down("KeyJ");
    const fired = await waitForNextShot(page, before);
    await page.keyboard.up("KeyJ");

    expect(fired.lastShot?.velocityX).toBeCloseTo((storedAim?.x ?? 0) * 460, 0);
    expect(fired.lastShot?.velocityY).toBeCloseTo((storedAim?.y ?? 0) * 460, 0);
  });
});
