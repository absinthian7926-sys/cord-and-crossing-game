import { expect, test } from '@playwright/test'
test('loads the game canvas and moves the player forward', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__ !== undefined,
  )
  const start = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition(),
  )
  await page.keyboard.down('KeyW')
  await page.waitForFunction(
    (origin) => {
      const current = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(current.x - origin.x, current.z - origin.z) > 0.5
    },
    start,
    { timeout: 5_000 },
  )
  await page.keyboard.up('KeyW')
  const end = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition(),
  )
  expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(0.5)

  await page.keyboard.down('KeyC')
  await page.waitForFunction(
    (origin) =>
      window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition().z - origin.z > 3,
    end,
    { timeout: 5_000 },
  )
  await page.keyboard.up('KeyC')
  const afterBackwardDodge = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition(),
  )
  expect(afterBackwardDodge.z - end.z).toBeGreaterThan(3)

  await page.keyboard.down('KeyW')
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition().z < -1.45,
    undefined,
    { timeout: 8_000 },
  )
  await page.keyboard.up('KeyW')

  const canvas = page.locator('canvas')
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Canvas bounds unavailable')
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  )
  await page.mouse.down({ button: 'left' })
  await page.waitForTimeout(60)
  await page.mouse.up({ button: 'left' })
  await page.waitForFunction(
    () =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getDummyDamageLog()
        .some((entry) => entry.damage === 14),
    undefined,
    { timeout: 5_000 },
  )

  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mousedown', { button: 2, bubbles: true }),
    ),
  )
  await page.waitForTimeout(120)
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mouseup', { button: 2, bubbles: true }),
    ),
  )
  await page.waitForFunction(
    () =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getDummyDamageLog()
        .some((entry) => entry.damage === 26),
    undefined,
    { timeout: 5_000 },
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'InHand',
    undefined,
    { timeout: 5_000 },
  )
})
