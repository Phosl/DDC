import {expect, test, type Page} from '@playwright/test'

async function start(page: Page) {
  await page.getByRole('button', {name: 'Inizia la Cantica'}).click()
  await expect.poll(() => page.evaluate(() => window.__CANTICA_ZERO_TEST__?.readTelemetry?.().player.grounded)).toBe(true)
  await page.getByTestId('rise-game-stage').focus()
}

async function tapJumpHeight(page: Page, touch: boolean) {
  const startY = await page.evaluate(() => window.__CANTICA_ZERO_TEST__!.readTelemetry!().player.y)
  // Native taps can finish after the ascent starts; observe before dispatching input.
  await page.evaluate(() => {
    const target = window as Window & {__jumpSample?: Promise<number>}
    target.__jumpSample = new Promise<number>((resolve) => {
      const start = performance.now()
      let minimum = Infinity
      function frame() {
        minimum = Math.min(minimum, window.__CANTICA_ZERO_TEST__!.readTelemetry!().player.y)
        if (performance.now() - start < 1_600) requestAnimationFrame(frame)
        else resolve(minimum)
      }
      frame()
    })
  })
  if (touch) await page.getByRole('button', {name: 'Salta', exact: true}).tap()
  else await page.keyboard.press('Space')
  const minimumY = await page.evaluate(() => {
    const sample = (window as Window & {__jumpSample?: Promise<number>}).__jumpSample
    if (!sample) throw new Error('Jump observation was not started')
    return sample
  })
  return startY - minimumY
}

test('starts in easy mode and a brief tap clears a 64px step with margin', async ({page}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/gioco#partita')
  await expect(page.getByRole('button', {name: 'Facile on', exact: true})).toHaveAttribute('aria-pressed', 'true')
  await start(page)
  const height = await tapJumpHeight(page, testInfo.project.name.startsWith('mobile'))
  expect(height).toBeGreaterThan(100)
  expect(height).toBeLessThan(125)
  await expect(page.getByLabel('3 vite', {exact: true})).toBeVisible()
  expect(await page.evaluate(() => window.__CANTICA_ZERO_TEST__!.readTelemetry!().phase)).toBe('playing')
  expect(errors).toEqual([])
})

test('Standard remains selectable with a shorter tap jump', async ({page}) => {
  await page.goto('/gioco#partita')
  await page.getByRole('button', {name: 'Facile on', exact: true}).click()
  await expect(page.getByRole('button', {name: 'Facile off', exact: true})).toHaveAttribute('aria-pressed', 'false')
  await start(page)
  const height = await tapJumpHeight(page, false)
  expect(height).toBeGreaterThan(45)
  expect(height).toBeLessThan(70)
})

test('phone keeps the jump on the right and both thumb controls within the screen', async ({page}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Touch layout')
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/gioco#partita')
  await start(page)
  const move = page.getByTestId('move-joystick')
  const jump = page.getByRole('button', {name: 'Salta', exact: true})
  const moveBox = (await move.boundingBox())!
  const jumpBox = (await jump.boundingBox())!
  expect(moveBox.x + moveBox.width).toBeLessThan(jumpBox.x)
  for (const box of [moveBox, jumpBox, (await page.getByTestId('rise-game-stage').boundingBox())!]) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    expect(box.y + box.height).toBeLessThanOrEqual(844)
  }
  const before = await page.evaluate(() => window.__CANTICA_ZERO_TEST__!.readTelemetry!().player)
  await move.dispatchEvent('pointerdown', {pointerId: 101, pointerType: 'touch', buttons: 1,
    clientX: moveBox.x + moveBox.width * 0.9, clientY: moveBox.y + moveBox.height / 2})
  await jump.dispatchEvent('pointerdown', {pointerId: 102, pointerType: 'touch', buttons: 1})
  await jump.dispatchEvent('pointerup', {pointerId: 102, pointerType: 'touch', buttons: 0})
  await expect.poll(() => page.evaluate(() => window.__CANTICA_ZERO_TEST__!.readTelemetry!().player.x)).toBeGreaterThan(before.x + 12)
  const after = await page.evaluate(() => window.__CANTICA_ZERO_TEST__!.readTelemetry!().player)
  expect(after.y).toBeLessThan(before.y - 12)
  await move.dispatchEvent('pointerup', {pointerId: 101, pointerType: 'touch', buttons: 0})
  await expect(move).toHaveAttribute('data-active', 'false')
})
