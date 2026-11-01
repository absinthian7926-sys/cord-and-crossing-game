import { expect, test } from '@playwright/test'
import { ENEMY_TYPES } from '../src/data/enemies'
import { PLAYER } from '../src/data/player'
import { ZONE } from '../src/data/zone'

test.setTimeout(120_000)

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
    { timeout: 10_000 },
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
    { timeout: 10_000 },
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
    { timeout: 10_000 },
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
    () =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getDummyDamageLog()
        .some((entry) => entry.damage === 26),
    undefined,
    { timeout: 10_000 },
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'InHand',
    undefined,
    { timeout: 10_000 },
  )
  const cameraDistanceWhileOut = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getMinimumCameraDistanceWhileOut(),
  )
  expect(cameraDistanceWhileOut).not.toBeNull()
  expect(cameraDistanceWhileOut!).toBeGreaterThanOrEqual(
    PLAYER.camera.minimumDistance,
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

  await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.teleport(30, 0))
  await page.waitForFunction(
    () => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(position.x - 30, position.z) < 1
    },
    undefined,
    { timeout: 5_000 },
  )
  const healthBeforeBrigand = await page.evaluate(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().health,
  )
  const brigandId = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.spawnEnemy('roadBrigand', 45, 0),
  )
  await page.waitForFunction(
    (id) =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .some((enemy) => enemy.id === id && enemy.state === 'Chase'),
    brigandId,
    { timeout: 10_000 },
  )
  await page.waitForFunction(
    (startingHealth) =>
      window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().health <
      startingHealth,
    healthBeforeBrigand,
    { timeout: 15_000 },
  )
  expect(
    await page.evaluate(
      (id) => window.__CORD_AND_CROSSING_DEBUG__!.killEnemy(id),
      brigandId,
    ),
  ).toBe(true)
  await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.teleport(0, 0))
  await page.waitForFunction(
    () => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(position.x, position.z) < 1
    },
    undefined,
    { timeout: 5_000 },
  )
  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.advanceRespawn(300),
  )
  await page.waitForFunction(
    ({ id, health }) =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .some((enemy) => enemy.id === id && enemy.alive && enemy.hp === health),
    { id: brigandId, health: ENEMY_TYPES.roadBrigand.maxHealth },
    { timeout: 5_000 },
  )
  await page.evaluate(
    (id) => window.__CORD_AND_CROSSING_DEBUG__!.killEnemy(id),
    brigandId,
  )

  await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.teleport(30, 0))
  await page.waitForFunction(
    () => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(position.x - 30, position.z) < 1
    },
    undefined,
    { timeout: 5_000 },
  )
  const houndId = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.spawnEnemy('cliffHound', 30, 1.4),
  )
  await page.waitForFunction(
    (id) =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .some((enemy) => enemy.id === id && enemy.state === 'Attack'),
    houndId,
    { timeout: 10_000 },
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
    { timeout: 10_000 },
  )
  expect(
    await page.evaluate((id) => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      const position = debug.getPlayerPosition()
      return debug.forceHoundBite(id, position.x + 0.28, position.z - 0.15)
    }, houndId),
  ).toBe(true)
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'Cut',
    undefined,
    { timeout: 10_000 },
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'InHand',
    undefined,
    { timeout: 10_000 },
  )
  await page.evaluate(
    (id) => window.__CORD_AND_CROSSING_DEBUG__!.killEnemy(id),
    houndId,
  )

  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.damagePlayer(1_000),
  )
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().deathPhase ===
      'Fading',
    undefined,
    { timeout: 5_000 },
  )
  await page.waitForFunction(
    ({ maximumHealth, maximumStamina }) => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      const status = debug.getPlayerStatus()
      const position = debug.getPlayerPosition()
      return (
        status.deathPhase === 'Alive' &&
        status.health === maximumHealth &&
        status.stamina === maximumStamina &&
        Math.hypot(position.x, position.z) < 1 &&
        debug.getCordState() === 'InHand'
      )
    },
    {
      maximumHealth: PLAYER.health.max,
      maximumStamina: PLAYER.stamina.max,
    },
    { timeout: 10_000 },
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
  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.aggroEnemies(40),
  )
  await page.waitForFunction(
    () => {
      const camp = window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .filter((enemy) => enemy.id.startsWith('camp-'))
      return (
        camp.length === 9 &&
        camp.every(
          (enemy) => enemy.state === 'Chase' || enemy.state === 'Attack',
        )
      )
    },
    undefined,
    { timeout: 10_000 },
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getActiveArrowCount() > 0,
    undefined,
    { timeout: 10_000 },
  )
  const busyCampPerf = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats(),
  )
  expect(busyCampPerf.drawCalls).toBeLessThan(250)
  expect(busyCampPerf.triangles).toBeLessThan(500_000)
  expect(browserErrors).toEqual([])
})
