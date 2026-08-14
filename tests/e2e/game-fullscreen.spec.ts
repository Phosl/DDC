import { expect, test, type Page } from "@playwright/test";

type FullscreenBehavior = "native" | "reject";

async function installFullscreenStub(page: Page, behavior: FullscreenBehavior) {
  await page.addInitScript(({ fullscreenBehavior }) => {
    let activeElement: Element | null = null;
    const testWindow = window as Window & { __DDC_FULLSCREEN_REQUESTS__?: number };
    testWindow.__DDC_FULLSCREEN_REQUESTS__ = 0;

    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => activeElement,
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value() {
        testWindow.__DDC_FULLSCREEN_REQUESTS__ =
          (testWindow.__DDC_FULLSCREEN_REQUESTS__ ?? 0) + 1;

        if (fullscreenBehavior === "reject") {
          return Promise.reject(new DOMException("Fullscreen unavailable", "NotAllowedError"));
        }

        activeElement = document.getElementById("cantica-game-shell");
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      },
    });
    Object.defineProperty(Document.prototype, "exitFullscreen", {
      configurable: true,
      value() {
        activeElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      },
    });
  }, { fullscreenBehavior: behavior });
}

test.describe("Cantica Zero desktop fullscreen", () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "Desktop-only fullscreen behavior.");
  });

  test("starts native fullscreen with a viewport stage and readable overlays", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installFullscreenStub(page, "native");
    await page.goto("/gioco");

    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    const shell = page.getByTestId("rise-game-shell");

    await expect(shell).toHaveAttribute("data-display-mode", "native-fullscreen");
    await expect(page.getByTestId("rise-game-canvas")).toHaveCount(1);
    await expect(page.getByLabel("Comandi touch")).toBeHidden();
    await expect(page.getByTestId("rise-game-stage")).toBeFocused();
    await expect(page.locator("#cantica-controls")).toContainText(
      "P pausa · Esc esce e mette in pausa",
    );

    const layout = await page.evaluate(() => {
      const getRect = (selector: string) => {
        const rect = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
        if (!rect) throw new Error(`Missing ${selector}`);
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };

      return {
        shell: getRect("[data-testid='rise-game-shell']"),
        hud: getRect("[aria-label='Stato della partita']"),
        stage: getRect("[data-testid='rise-game-stage']"),
        canvas: getRect("[data-testid='rise-game-canvas']"),
        toolbar: getRect("[data-testid='rise-game-fullscreen-toggle']"),
        requests: (window as Window & { __DDC_FULLSCREEN_REQUESTS__?: number })
          .__DDC_FULLSCREEN_REQUESTS__,
      };
    });

    expect(layout.requests).toBe(1);
    expect(layout.shell.width).toBeCloseTo(1440, 0);
    expect(layout.shell.height).toBeCloseTo(900, 0);
    expect(layout.stage.x).toBeCloseTo(0, 0);
    expect(layout.stage.y).toBeCloseTo(0, 0);
    expect(layout.stage.width).toBeCloseTo(1440, 0);
    expect(layout.stage.height).toBeCloseTo(900, 0);
    expect(layout.canvas.width / layout.canvas.height).toBeCloseTo(4 / 7, 2);
    expect(layout.canvas.x + layout.canvas.width / 2).toBeCloseTo(720, 0);
    expect(layout.hud.x + layout.hud.width).toBeLessThanOrEqual(layout.canvas.x);
    expect(layout.toolbar.x).toBeGreaterThanOrEqual(
      layout.canvas.x + layout.canvas.width,
    );

    await page.getByRole("button", { name: "Esci dallo schermo intero" }).click();
    await expect(shell).toHaveAttribute("data-display-mode", "inline");
    await expect(page.getByRole("dialog", { name: "Partita in pausa" })).toBeVisible();
    await expect(page.locator("[aria-live='polite']")).toContainText("partita resta in pausa");

    await page.getByRole("button", { name: "Attiva schermo intero" }).click();
    await expect(shell).toHaveAttribute("data-display-mode", "native-fullscreen");
    await page.getByRole("button", { name: "Riprendi" }).click();
    await expect(page.getByTestId("rise-game-stage")).toBeFocused();
  });

  test("falls back to viewport fullscreen and keeps P separate from Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installFullscreenStub(page, "reject");
    await page.goto("/gioco");

    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    const shell = page.getByTestId("rise-game-shell");
    await expect(shell).toHaveAttribute("data-display-mode", "viewport-fullscreen");

    await page.keyboard.press("KeyP");
    await expect(page.getByRole("dialog", { name: "Partita in pausa" })).toBeVisible();
    await expect(shell).toHaveAttribute("data-display-mode", "viewport-fullscreen");

    await page.keyboard.press("KeyP");
    await expect(page.getByRole("dialog", { name: "Partita in pausa" })).toBeHidden();
    await expect(shell).toHaveAttribute("data-display-mode", "viewport-fullscreen");

    await page.keyboard.press("Escape");
    await expect(shell).toHaveAttribute("data-display-mode", "inline");
    await expect(page.getByRole("dialog", { name: "Partita in pausa" })).toBeVisible();
  });

  for (const viewport of [
    { width: 1366, height: 650 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`fills ${viewport.width}x${viewport.height} while preserving canvas pixels`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await installFullscreenStub(page, "reject");
      await page.goto("/gioco");
      await page.getByRole("button", { name: "Inizia la Cantica" }).click();

      const shell = page.getByTestId("rise-game-shell");
      const stage = page.getByTestId("rise-game-stage");
      const canvas = page.getByTestId("rise-game-canvas");
      await expect(shell).toHaveAttribute("data-display-mode", "viewport-fullscreen");
      await expect(page.getByLabel("Stato della partita")).toBeVisible();
      await expect(page.getByTestId("rise-game-fullscreen-toggle")).toBeVisible();
      await expect(page.locator("#cantica-controls")).toBeVisible();

      const [shellBox, stageBox, canvasBox] = await Promise.all([
        shell.boundingBox(),
        stage.boundingBox(),
        canvas.boundingBox(),
      ]);
      expect(shellBox).not.toBeNull();
      expect(stageBox).not.toBeNull();
      expect(canvasBox).not.toBeNull();
      expect(shellBox?.width).toBeCloseTo(viewport.width, 0);
      expect(shellBox?.height).toBeCloseTo(viewport.height, 0);
      expect(stageBox?.width).toBeCloseTo(viewport.width, 0);
      expect(stageBox?.height).toBeCloseTo(viewport.height, 0);
      expect(canvasBox?.width ?? Infinity).toBeLessThanOrEqual(viewport.width);
      expect(canvasBox?.height ?? Infinity).toBeLessThanOrEqual(viewport.height);
      expect((canvasBox?.width ?? 0) / (canvasBox?.height ?? 1)).toBeCloseTo(4 / 7, 2);
      expect((canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) / 2).toBeCloseTo(
        viewport.width / 2,
        0,
      );
    });
  }
});

test.describe("Cantica Zero mobile display", () => {
  test("stays inline and preserves touch controls", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only display behavior.");
    await installFullscreenStub(page, "native");
    await page.goto("/gioco");

    await page.getByRole("button", { name: "Inizia la Cantica" }).click();
    await expect(page.getByTestId("rise-game-shell")).toHaveAttribute(
      "data-display-mode",
      "inline",
    );
    await expect(page.getByLabel("Comandi touch")).toBeVisible();
    await expect(page.getByTestId("rise-game-fullscreen-toggle")).toHaveCount(0);

    const requests = await page.evaluate(() =>
      (window as Window & { __DDC_FULLSCREEN_REQUESTS__?: number })
        .__DDC_FULLSCREEN_REQUESTS__,
    );
    expect(requests).toBe(0);
  });
});
