import { expect, test, type Page } from "@playwright/test";

async function readTelemetry(page: Page) {
  return page.evaluate(() => {
    const telemetry = window.__CANTICA_ZERO_TEST__?.readTelemetry?.();
    if (!telemetry) throw new Error("Cantica Zero telemetry is unavailable.");
    return telemetry;
  });
}

test.describe("Cantica Zero game shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gioco");
  });

  test("mounts exactly one game canvas and exposes the arcade controls", async ({ page }) => {
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();

    await expect(page.getByTestId("rise-game-stage")).toBeVisible();
    await expect(page.getByTestId("rise-game-canvas")).toHaveCount(1);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await page.keyboard.press("KeyJ");
    await expect(page.getByTestId("rise-game-canvas")).toHaveCount(1);
  });

  test("responds to held movement, variable jump and an airborne diagonal Verse", async ({ page }) => {
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    await page.getByTestId("rise-game-stage").focus();

    const start = await readTelemetry(page);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(140);
    const running = await readTelemetry(page);
    expect(running.player.x).toBeGreaterThan(start.player.x + 12);
    expect(running.player.velocityX).toBeGreaterThan(100);
    expect(running.player.facing).toBe(1);

    await page.keyboard.down("Space");
    await page.waitForTimeout(75);
    const rising = await readTelemetry(page);
    expect(rising.player.y).toBeLessThan(running.player.y);
    expect(rising.player.velocityY).toBeLessThan(-150);

    await page.keyboard.press("KeyX");
    await page.waitForTimeout(25);
    const firing = await readTelemetry(page);
    expect(firing.projectile.count).toBeGreaterThan(0);
    expect(firing.projectile.velocityX).toBeGreaterThan(100);
    expect(firing.projectile.velocityY).toBeLessThan(-100);
    expect(firing.breath).toBeLessThanOrEqual(90);

    await page.keyboard.up("Space");
    await page.waitForTimeout(20);
    const cutJump = await readTelemetry(page);
    expect(Math.abs(cutJump.player.velocityY)).toBeLessThan(
      Math.abs(rising.player.velocityY),
    );
    await page.keyboard.up("KeyD");
  });

  test("changes direction and facing before the first threat", async ({ page }) => {
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    await page.getByTestId("rise-game-stage").focus();

    await page.keyboard.down("KeyD");
    await expect.poll(async () => (await readTelemetry(page)).player.velocityX).toBeGreaterThan(100);
    await page.keyboard.up("KeyD");
    await page.keyboard.down("ArrowLeft");
    await expect.poll(async () => (await readTelemetry(page)).player.velocityX).toBeLessThan(-100);
    await expect.poll(async () => (await readTelemetry(page)).player.facing).toBe(-1);
    await page.keyboard.up("ArrowLeft");
  });

  test("fires a vertical Verse while standing still", async ({ page }) => {
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    await page.getByTestId("rise-game-stage").focus();
    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(35);

    const firing = await readTelemetry(page);
    expect(firing.projectile.count).toBeGreaterThan(0);
    expect(Math.abs(firing.projectile.velocityX ?? Infinity)).toBeLessThan(2);
    expect(firing.projectile.velocityY).toBeLessThan(-400);
    expect(firing.breath).toBeLessThanOrEqual(90);
  });

  test("keeps one canvas after leaving and re-entering the route", async ({ page }) => {
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    await expect(page.getByTestId("rise-game-canvas")).toHaveCount(1);

    await page.goto("/");
    await page.goto("/gioco");
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    await expect(page.getByTestId("rise-game-canvas")).toHaveCount(1);
  });

  test("accepts simultaneous touch controls without losing the canvas", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "Multi-touch is a mobile interaction check.");
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    await expect.poll(async () => (await readTelemetry(page)).player.grounded).toBe(true);
    const start = await readTelemetry(page);
    const right = page.getByRole("button", { name: "Destra", exact: true });
    const jump = page.getByRole("button", { name: "Salta", exact: true });

    await right.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", isPrimary: true, buttons: 1 });
    await jump.dispatchEvent("pointerdown", { pointerId: 2, pointerType: "touch", isPrimary: false, buttons: 1 });
    await expect.poll(async () => (await readTelemetry(page)).player.x).toBeGreaterThan(start.player.x + 10);
    await expect.poll(async () => (await readTelemetry(page)).player.velocityY).toBeLessThan(-100);
    await jump.dispatchEvent("pointerup", { pointerId: 2, pointerType: "touch", isPrimary: false, buttons: 0 });
    await right.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, buttons: 0 });

    await expect(page.getByTestId("rise-game-canvas")).toHaveCount(1);
    expect(pageErrors).toEqual([]);
  });

  test("completes the deterministic IX to I campaign through all three bosses", async ({ page }) => {
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    const result = await page.evaluate(() => window.__CANTICA_ZERO_TEST__?.verifyCampaign?.());

    expect(result).toMatchObject({
      phase: "complete",
      circleId: "I",
      actIndex: 2,
      checkpointActIndex: 2,
      boss: null,
      recordEligible: true,
    });
    await expect(page.getByRole("dialog", { name: "Cantica completa" })).toBeVisible();
  });

  test("survives damage, defeat animation and checkpoint respawn", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();

    const snapshot = await page.evaluate(() =>
      window.__CANTICA_ZERO_TEST__?.verifyDamageRespawn?.(),
    );

    expect(snapshot).toMatchObject({ phase: "playing", lives: 2 });
    expect(pageErrors).toEqual([]);
    await expect(page.getByTestId("rise-game-canvas")).toHaveCount(1);
  });

  test("keeps the same gameplay under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.getByRole("button", { name: "Inizia la Cantica" }).click();

    const snapshot = await page.evaluate(() =>
      window.__CANTICA_ZERO_TEST__?.verifyDamageRespawn?.(),
    );

    expect(snapshot).toMatchObject({ phase: "playing", lives: 2 });
    await expect(page.getByTestId("rise-game-canvas")).toHaveCount(1);
  });
});
