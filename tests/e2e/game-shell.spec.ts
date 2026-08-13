import { expect, test } from "@playwright/test";

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

    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    const right = page.getByRole("button", { name: "Destra", exact: true });
    const jump = page.getByRole("button", { name: "Salta", exact: true });

    await right.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", isPrimary: true, buttons: 1 });
    await jump.dispatchEvent("pointerdown", { pointerId: 2, pointerType: "touch", isPrimary: false, buttons: 1 });
    await page.waitForTimeout(150);
    await jump.dispatchEvent("pointerup", { pointerId: 2, pointerType: "touch", isPrimary: false, buttons: 0 });
    await right.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, buttons: 0 });

    await expect(page.getByTestId("rise-game-canvas")).toHaveCount(1);
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
});
