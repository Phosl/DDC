import { expect, test, type Page } from "@playwright/test";

async function readTelemetry(page: Page) {
  return page.evaluate(() => {
    const telemetry = window.__CANTICA_ZERO_TEST__?.readTelemetry?.();
    if (!telemetry) throw new Error("Cantica Zero telemetry is unavailable.");
    return telemetry;
  });
}

test("moves, jumps and aims with three simultaneous touch pointers", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Three-pointer aim is a mobile check.");
  await page.goto("/gioco");
  await page.getByRole("button", { name: "Inizia la Cantica" }).click();
  await expect.poll(async () => (await readTelemetry(page)).player.grounded).toBe(true);

  const start = await readTelemetry(page);
  const right = page.getByRole("button", { name: "Destra", exact: true });
  const jump = page.getByRole("button", { name: "Salta", exact: true });
  const aim = page.getByTestId("aim-joystick");
  const aimBox = await aim.boundingBox();
  expect(aimBox).not.toBeNull();
  if (!aimBox) return;

  await right.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    buttons: 1,
  });
  await jump.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    isPrimary: false,
    buttons: 1,
  });
  await aim.dispatchEvent("pointerdown", {
    pointerId: 3,
    pointerType: "touch",
    isPrimary: false,
    buttons: 1,
    clientX: aimBox.x + aimBox.width * 0.9,
    clientY: aimBox.y + aimBox.height * 0.5,
  });

  await expect.poll(async () => (await readTelemetry(page)).player.x).toBeGreaterThan(start.player.x + 10);
  await expect.poll(async () => (await readTelemetry(page)).player.velocityY).toBeLessThan(-100);
  await expect.poll(async () => (await readTelemetry(page)).lastShot?.velocityX ?? 0).toBeGreaterThan(450);
  const firing = await readTelemetry(page);
  expect(Math.abs(firing.lastShot?.velocityY ?? Infinity)).toBeLessThan(2);

  await aim.dispatchEvent("pointerup", {
    pointerId: 3,
    pointerType: "touch",
    isPrimary: false,
    buttons: 0,
  });
  await jump.dispatchEvent("pointerup", {
    pointerId: 2,
    pointerType: "touch",
    isPrimary: false,
    buttons: 0,
  });
  await right.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    buttons: 0,
  });

  await expect.poll(async () => (await readTelemetry(page)).aim).toBeNull();
  await page.waitForTimeout(220);
  const releasedSequence = (await readTelemetry(page)).lastShot?.sequence ?? 0;
  await page.waitForTimeout(300);
  expect((await readTelemetry(page)).lastShot?.sequence ?? 0).toBe(releasedSequence);
});
