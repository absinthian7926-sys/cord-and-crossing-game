import { expect, test } from '@playwright/test'
import { PLAYER } from '../src/data/player'
import { ZONE } from '../src/data/zone'

test('loads the game canvas and moves the player forward', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
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

  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.teleport(0, -1.7),
  )
  await page.waitForFunction(
    () => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.abs(position.x) < 0.05 && Math.abs(position.z + 1.7) < 0.05
    },
    undefined,
    { timeout: 5_000 },
  )

  const canvas = page.locator('canvas')
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Canvas bounds unavailable')
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  )
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mousedown', { button: 0, bubbles: true }),
    ),
  )
  await page.waitForTimeout(500)
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mouseup', { button: 0, bubbles: true }),
    ),
  )
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
  await page.waitForTimeout(500)
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mouseup', { button: 2, bubbles: true }),
    ),
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'Out',
    undefined,
    { timeout: 2_000 },
  )
  const cameraDistanceWhileOut = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getCameraDistance(),
  )
  expect(cameraDistanceWhileOut).toBeGreaterThanOrEqual(
    PLAYER.camera.minimumDistance,
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

  await page.waitForFunction(
    ({ halfHeight, radius }) => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      const position = debug.getPlayerPosition()
      const ground = debug.getTerrainHeight(position.x, position.z)
      return Math.abs(position.y - ground - halfHeight - radius) < 0.35
    },
    PLAYER.collider,
    { timeout: 5_000 },
  )

  await page.evaluate(
    ([x, z]) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    ZONE.locations.D.center,
  )
  await page.waitForFunction(
    ([x, z]) => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(position.x - x, position.z - z) < 1
    },
    ZONE.locations.D.center,
    { timeout: 5_000 },
  )
  await page.waitForFunction(
    ({ halfHeight, radius }) => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      const position = debug.getPlayerPosition()
      const ground = debug.getTerrainHeight(position.x, position.z)
      return Math.abs(position.y - ground - halfHeight - radius) < 0.35
    },
    PLAYER.collider,
    { timeout: 5_000 },
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats().drawCalls > 0,
    undefined,
    { timeout: 5_000 },
  )
  const campPerf = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats(),
  )
  expect(campPerf.drawCalls).toBeLessThan(250)
  expect(campPerf.triangles).toBeLessThan(500_000)

  await page.evaluate(
    ([x, , z]) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    ZONE.spawn,
  )
  await page.waitForFunction(
    ([x, , z]) => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(position.x - x, position.z - z) < 1
    },
    ZONE.spawn,
    { timeout: 5_000 },
  )
  expect(browserErrors).toEqual([])
})
