import { expect, test } from '@playwright/test'
import { ENEMY_DEATH, ENEMY_TYPES } from '../src/data/enemies'
import { PLAYER } from '../src/data/player'
import { HOLLEN, QUEST } from '../src/data/quests'
import { REACHBLADE } from '../src/data/weapons'
import { ZONE } from '../src/data/zone'
import { resumeGameAfterReload, startGame } from './helpers'

test.setTimeout(180_000)

test('loads the game canvas and moves the player forward', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await startGame(page)
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

  const hollenApproach = {
    x: HOLLEN.position[0],
    z:
      HOLLEN.position[1] +
      HOLLEN.interactionRadius +
      PLAYER.collider.radius +
      0.5,
  }
  await page.evaluate(
    ({ x, z }) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    hollenApproach,
  )
  await page.waitForFunction(
    ({ x, z }) => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(position.x - x, position.z - z) < 0.1
    },
    hollenApproach,
    { timeout: 5_000 },
  )
  await page.keyboard.down('KeyW')
  await expect(page.getByText(HOLLEN.prompt, { exact: true })).toBeVisible({
    timeout: 5_000,
  })
  await page.keyboard.up('KeyW')
  const hollenDistance = await page.evaluate(([x, z]) => {
    const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
    return Math.hypot(position.x - x, position.z - z)
  }, HOLLEN.position)
  expect(hollenDistance).toBeLessThanOrEqual(HOLLEN.interactionRadius)

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
  const brigandId = await page.evaluate((spawnOffset) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const position = debug.getPlayerPosition()
    return debug.spawnEnemy('roadBrigand', position.x + spawnOffset, position.z)
  }, ENEMY_TYPES.roadBrigand.attackRange * 2)
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
  await page.evaluate(
    (x) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, 0),
    -ENEMY_DEATH.respawnPlayerDistance,
  )
  await page.waitForFunction(
    (x) => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(position.x - x, position.z) < 1
    },
    -ENEMY_DEATH.respawnPlayerDistance,
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
  const houndId = await page.evaluate(() => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const position = debug.getPlayerPosition()
    return debug.spawnEnemy('cliffHound', position.x + 0.28, position.z)
  })
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
  await page.waitForTimeout(200)
  const healthBeforeCut = await page.evaluate(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().health,
  )
  expect(
    await page.evaluate(
      ({ id, cooldown }) => {
        const synchronized =
          window.__CORD_AND_CROSSING_DEBUG__!.setEnemyAttackCooldown(
            id,
            cooldown,
          )
        window.dispatchEvent(
          new MouseEvent('mouseup', { button: 2, bubbles: true }),
        )
        return synchronized
      },
      { id: houndId, cooldown: REACHBLADE.cast.windupSeconds },
    ),
  ).toBe(true)
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'Cut',
    undefined,
    { timeout: 10_000 },
  )
  const healthAfterCut = await page.evaluate(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().health,
  )
  expect(healthBeforeCut - healthAfterCut).toBe(
    ENEMY_TYPES.cliffHound.damage * REACHBLADE.unarmedDamageMultiplier,
  )
  expect(
    await page.evaluate((id) => {
      const hound = window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .find((enemy) => enemy.id === id)
      return hound?.attackCooldown ?? 0
    }, houndId),
  ).toBeGreaterThan(ENEMY_TYPES.cliffHound.attackCadenceSeconds * 0.75)
  await page.evaluate(
    (id) => window.__CORD_AND_CROSSING_DEBUG__!.killEnemy(id),
    houndId,
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'InHand',
    undefined,
    { timeout: 30_000 },
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
    { timeout: 30_000 },
  )

  await page.evaluate(
    ([x, z]) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z + 2.4),
    HOLLEN.position,
  )
  await page.waitForFunction(
    ([x, z]) => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(position.x - x, position.z - (z + 2.4)) < 0.5
    },
    HOLLEN.position,
    { timeout: 5_000 },
  )
  await page.keyboard.press('KeyW')
  await expect(page.getByText(HOLLEN.prompt, { exact: true })).toBeVisible({
    timeout: 5_000,
  })
  await page.keyboard.press('KeyE')
  await expect(page.getByRole('dialog', { name: HOLLEN.name })).toBeVisible()
  await page.keyboard.press('Digit1')
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getQuest().quest.currentStep === 2,
  )
  await expect(page.locator('.quest-tracker')).toHaveText(
    QUEST.steps[1].trackerText,
  )

  await page.keyboard.press('Tab')
  await expect(page.getByRole('dialog', { name: QUEST.name })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('dialog', { name: QUEST.name })).toBeHidden()

  const leaderId = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.spawnCampLeader(),
  )
  expect(leaderId).not.toBeNull()
  const leaderPosition = await page.evaluate((id) => {
    const leader = window
      .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
      .find((enemy) => enemy.id === id)
    if (!leader) throw new Error('Camp leader did not spawn')
    return leader.position
  }, leaderId)
  await page.evaluate(
    ({ x, z }) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    leaderPosition,
  )
  await page.waitForFunction(
    ({ x, z }) => {
      const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
      return Math.hypot(position.x - x, position.z - z) < 0.5
    },
    leaderPosition,
    { timeout: 5_000 },
  )
  expect(
    await page.evaluate(
      (id) => window.__CORD_AND_CROSSING_DEBUG__!.killEnemy(id!),
      leaderId,
    ),
  ).toBe(true)
  await expect(page.getByText('E Take key', { exact: true })).toBeVisible({
    timeout: 5_000,
  })
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => {
    const quest = window.__CORD_AND_CROSSING_DEBUG__!.getQuest().quest
    return quest.currentStep === 3 && quest.keyLooted
  })

  await page.evaluate(
    ([x, z]) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z + 2),
    HOLLEN.position,
  )
  await expect(page.getByText(HOLLEN.prompt, { exact: true })).toBeVisible({
    timeout: 5_000,
  })
  await page.keyboard.press('KeyE')
  await expect(page.getByRole('dialog', { name: HOLLEN.name })).toBeVisible()
  await page.keyboard.press('Digit1')
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getQuest().quest.currentStep === 4,
  )
  await expect(page.locator('.quest-tracker')).toHaveText(
    QUEST.steps[3].trackerText,
  )

  await page.evaluate(() => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    debug.setPlayerVitals(73, 41)
    if (!debug.saveGame()) throw new Error('Manual save failed')
  })
  const savedPosition = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition(),
  )
  await resumeGameAfterReload(page)
  await page.waitForFunction(
    ({ x, z }) => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      const position = debug.getPlayerPosition()
      const quest = debug.getQuest().quest
      return (
        quest.currentStep === 4 &&
        quest.keyLooted &&
        Math.hypot(position.x - x, position.z - z) < 0.5
      )
    },
    savedPosition,
    { timeout: 10_000 },
  )
  const restoredVitals = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus(),
  )
  expect(restoredVitals.health).toBeCloseTo(73, 0)
  expect(restoredVitals.stamina).toBeCloseTo(41, 0)

  await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.openDialogue())
  await expect(page.getByRole('dialog', { name: HOLLEN.name })).toBeVisible()
  await page.waitForTimeout(350)
  const dialoguePerf = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats(),
  )
  await page.keyboard.press('Escape')

  await page.evaluate(
    ([x, , z]) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    ZONE.spawn,
  )
  await page.waitForTimeout(350)
  const spawnPerf = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats(),
  )

  await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.teleport(30, 0))
  await page.waitForFunction(() => {
    const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
    return Math.hypot(position.x - 30, position.z) < 1
  })
  const windupBrigand = await page.evaluate((attackRange) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const position = debug.getPlayerPosition()
    return debug.spawnEnemy(
      'roadBrigand',
      position.x + attackRange - 0.1,
      position.z,
    )
  }, ENEMY_TYPES.roadBrigand.attackRange)
  await page.waitForFunction(
    (id) =>
      window.__CORD_AND_CROSSING_DEBUG__!.getEnemyAttackPhase(id)?.windingUp ===
      true,
    windupBrigand,
    { timeout: 10_000 },
  )
  expect(
    await page.evaluate(
      (id) =>
        window
          .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
          .find((enemy) => enemy.id === id)?.inFrustum,
      windupBrigand,
    ),
  ).toBe(true)
  const healthBeforeDodge = await page.evaluate(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().health,
  )
  await page.keyboard.press('KeyC')
  await page.waitForTimeout(
    (ENEMY_TYPES.roadBrigand.attackWindupSeconds + 0.2) * 1_000,
  )
  expect(
    await page.evaluate(
      () => window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().health,
    ),
  ).toBe(healthBeforeDodge)
  await page.evaluate(
    (id) => window.__CORD_AND_CROSSING_DEBUG__!.killEnemy(id),
    windupBrigand,
  )

  await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.teleport(100, 0),
  )
  await page.waitForFunction(() => {
    const position = window.__CORD_AND_CROSSING_DEBUG__!.getPlayerPosition()
    return Math.hypot(position.x - 100, position.z) < 1
  })
  const resetIds = await page.evaluate(() => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const position = debug.getPlayerPosition()
    return {
      near: debug.spawnEnemy('roadBrigand', position.x + 39, position.z),
      far: debug.spawnEnemy('roadBrigand', position.x + 41, position.z),
    }
  })
  await page.evaluate(() => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    debug.aggroEnemies(50)
    debug.damagePlayer(1_000)
  })
  await page.waitForFunction(
    ({ near, far }) => {
      const enemies = window.__CORD_AND_CROSSING_DEBUG__!.getEnemies()
      return (
        enemies.find((enemy) => enemy.id === near)?.state === 'Return' &&
        enemies.find((enemy) => enemy.id === far)?.state !== 'Return'
      )
    },
    resetIds,
    { timeout: 5_000 },
  )
  await page.evaluate(({ near, far }) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    debug.killEnemy(near)
    debug.killEnemy(far)
  }, resetIds)
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().deathPhase ===
      'Alive',
    undefined,
    { timeout: 30_000 },
  )
  expect(
    await page.evaluate(() => {
      const quest = window.__CORD_AND_CROSSING_DEBUG__!.getQuest().quest
      return { currentStep: quest.currentStep, keyLooted: quest.keyLooted }
    }),
  ).toEqual({ currentStep: 4, keyLooted: true })

  const stagedCampIds = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.stageWorstCaseCamp(),
  )
  expect(stagedCampIds).toHaveLength(10)
  await page.waitForFunction(
    (ids) => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      const enemies = debug
        .getEnemies()
        .filter((enemy) => ids.includes(enemy.id))
      return (
        enemies.length === 10 &&
        enemies.every(
          (enemy) =>
            enemy.alive &&
            enemy.inFrustum &&
            (enemy.state === 'Chase' || enemy.state === 'Attack'),
        ) &&
        debug.getCampFrustumCount() === 10 &&
        debug.getActiveArrowCount() > 0 &&
        debug.getCordState() === 'Out'
      )
    },
    stagedCampIds,
    { timeout: 30_000 },
  )
  await page.waitForTimeout(350)
  const busyCampFrame = await page.evaluate((ids) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const enemies = debug.getEnemies().filter((enemy) => ids.includes(enemy.id))
    return {
      alive: enemies.filter((enemy) => enemy.alive).length,
      inFrustum: enemies.filter((enemy) => enemy.alive && enemy.inFrustum)
        .length,
      activeArrows: debug.getActiveArrowCount(),
      cordState: debug.getCordState(),
      perf: debug.getPerfStats(),
    }
  }, stagedCampIds)
  expect(busyCampFrame).toMatchObject({
    alive: 10,
    inFrustum: 10,
    cordState: 'Out',
  })
  expect(busyCampFrame.activeArrows).toBeGreaterThan(0)
  const busyCampPerf = busyCampFrame.perf
  expect(busyCampPerf.drawCalls).toBeLessThan(250)
  expect(busyCampPerf.triangles).toBeLessThan(500_000)
  console.log(
    `perf spawn=${JSON.stringify(spawnPerf)} dialogue=${JSON.stringify(dialoguePerf)} camp=${JSON.stringify(busyCampPerf)}`,
  )
  expect(browserErrors).toEqual([])
})

test('completes the portico and heelstone milestone flow', async ({ page }) => {
  const browserErrors: string[] = []
  const hollowChunkRequests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('request', (request) => {
    if (request.url().includes('/src/game/scenes/Hollow.tsx'))
      hollowChunkRequests.push(request.url())
  })

  await startGame(page)

  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.emitQuestEvent('talkedToHollen'),
    ),
  ).toBe(true)
  const leaderId = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.spawnCampLeader(),
  )
  expect(leaderId).not.toBeNull()
  const leaderStart = await page.evaluate((id) => {
    const leader = window
      .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
      .find((enemy) => enemy.id === id)
    if (!leader) throw new Error('Camp leader did not spawn for M6 save test')
    window.__CORD_AND_CROSSING_DEBUG__!.teleport(
      leader.position.x + 6,
      leader.position.z,
    )
    return leader.position
  }, leaderId)
  await page.waitForFunction(
    ({ id, start }) => {
      const leader = window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .find((enemy) => enemy.id === id)
      return (
        leader !== undefined &&
        Math.hypot(leader.position.x - start.x, leader.position.z - start.z) >
          0.05
      )
    },
    { id: leaderId, start: leaderStart },
    { timeout: 10_000 },
  )
  expect(
    await page.evaluate(
      (id) => window.__CORD_AND_CROSSING_DEBUG__!.killEnemy(id!),
      leaderId,
    ),
  ).toBe(true)
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getQuest().keyDrop !== null,
  )
  const pendingKeyDrop = await page.evaluate(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getQuest().keyDrop,
  )
  expect(pendingKeyDrop).not.toBeNull()
  expect(
    Math.hypot(
      pendingKeyDrop!.x - leaderStart.x,
      pendingKeyDrop!.z - leaderStart.z,
    ),
  ).toBeGreaterThan(0.01)
  expect(
    await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.saveGame()),
  ).toBe(true)

  await resumeGameAfterReload(page)
  await page.waitForFunction((expected) => {
    const drop = window.__CORD_AND_CROSSING_DEBUG__!.getQuest().keyDrop
    return (
      drop !== null &&
      Math.hypot(
        drop.x - expected.x,
        drop.y - expected.y,
        drop.z - expected.z,
      ) < 0.01
    )
  }, pendingKeyDrop)
  await page.evaluate(
    ({ x, z }) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    pendingKeyDrop!,
  )
  await expect(page.getByText('E Take key', { exact: true })).toBeVisible({
    timeout: 5_000,
  })
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => {
    const quest = window.__CORD_AND_CROSSING_DEBUG__!.getQuest()
    return quest.quest.currentStep === 3 && quest.keyDrop === null
  })
  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.emitQuestEvent('returnedToHollen'),
    ),
  ).toBe(true)

  const porticoApproach = {
    x: ZONE.portico.center[0] - 2,
    z: ZONE.portico.center[1],
  }
  await page.evaluate(
    ({ x, z }) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    porticoApproach,
  )
  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.getInputLocked(),
    ),
  ).toBe(false)
  await expect(
    page.getByText(ZONE.portico.useKeyPrompt, { exact: true }),
  ).toBeVisible({ timeout: 5_000 })
  await page.keyboard.press('KeyE')
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getPortico().phase === 'active',
  )
  await page.keyboard.press('Tab')
  await expect(page.getByRole('dialog', { name: QUEST.name })).toBeVisible()
  await expect(page.locator('.quest-key-slot')).toContainText('Used')
  await page.keyboard.press('Tab')
  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.setSetting('reduceMotion', true),
    ),
  ).toBe(true)
  await page.locator('canvas').dispatchEvent('pointerdown', { button: 1 })
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        movementX: 390,
        movementY: 0,
        bubbles: true,
      }),
    ),
  )
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent('pointerup', { button: 1, bubbles: true }),
    ),
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getPorticoScreenInView(),
    undefined,
    { timeout: 5_000 },
  )
  await page.waitForTimeout(350)
  const porticoPerf = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats(),
  )
  expect(porticoPerf.drawCalls).toBeLessThan(250)
  expect(porticoPerf.triangles).toBeLessThan(500_000)

  const audioBeforePartial = await page.evaluate(() => {
    const audio = window.__CORD_AND_CROSSING_DEBUG__!.getAudioState()
    return {
      bells: audio.lastCueIds.filter((cue) => cue === 'portico-bell').length,
      musicGain: audio.musicGain,
    }
  })

  await page.evaluate(
    ({ x, z }) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    { x: ZONE.portico.center[0], z: ZONE.portico.center[1] },
  )
  await page.waitForTimeout(150)
  await page.evaluate(
    ({ x, z }) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    porticoApproach,
  )
  await page.waitForTimeout(150)
  expect(
    await page.evaluate(() => ({
      effects: window.__CORD_AND_CROSSING_DEBUG__!.getEffects().length,
      step: window.__CORD_AND_CROSSING_DEBUG__!.getQuest().quest.currentStep,
    })),
  ).toEqual({ effects: 0, step: 4 })
  expect(
    await page.evaluate(
      () =>
        window
          .__CORD_AND_CROSSING_DEBUG__!.getAudioState()
          .lastCueIds.filter((cue) => cue === 'portico-bell').length,
    ),
  ).toBe(audioBeforePartial.bells)

  await page.evaluate(
    ({ x, z }) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    { x: ZONE.portico.center[0], z: ZONE.portico.center[1] },
  )
  await page.waitForTimeout(100)
  await page.evaluate(
    ({ x, z }) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    { x: ZONE.portico.center[0] + 1, z: ZONE.portico.center[1] },
  )
  const reducedFlash = page.locator('.crossing-flash')
  await expect(reducedFlash).toBeVisible()
  expect(
    await reducedFlash.evaluate((element) =>
      Number.parseFloat(
        getComputedStyle(element).getPropertyValue('--crossing-flash-peak'),
      ),
    ),
  ).toBeCloseTo(0.35, 4)
  await page.waitForFunction(({ bells, musicGain }) => {
    const audio = window.__CORD_AND_CROSSING_DEBUG__!.getAudioState()
    return (
      audio.lastCueIds.filter((cue) => cue === 'portico-bell').length > bells &&
      audio.musicGain < musicGain
    )
  }, audioBeforePartial)
  await page.waitForFunction(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getInputLocked(),
  )
  await page.keyboard.press('KeyF')
  await page.waitForTimeout(100)
  expect(
    await page.evaluate(
      () => window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().passMode,
    ),
  ).toBe('Idle')
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getScene() === 'hollow',
    undefined,
    { timeout: 2_000 },
  )
  expect(
    await page
      .locator('.scene-loading')
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toContain('0.3s')
  expect(hollowChunkRequests.length).toBeGreaterThan(0)
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getLastSceneLoadMilliseconds() !==
      null,
  )
  const sceneLoadMilliseconds = await page.evaluate(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getLastSceneLoadMilliseconds() ??
      Number.POSITIVE_INFINITY,
  )
  expect(sceneLoadMilliseconds).toBeLessThan(2_000)
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getQuest().quest.currentStep === 5 &&
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEffects()
        .some((effect) => effect.id === 'Strength'),
  )
  await expect(
    page.locator('.effect-slot').filter({ hasText: 'Strength' }),
  ).toBeVisible()
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats().drawCalls > 0,
    undefined,
    { timeout: 5_000 },
  )
  await page.waitForTimeout(350)
  const hollowArrivalPerf = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats(),
  )
  expect(hollowArrivalPerf.drawCalls).toBeLessThan(250)
  expect(hollowArrivalPerf.triangles).toBeLessThan(500_000)

  const hollowStepSequence = await page.evaluate(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getAudioState().lastFootstepSequence,
  )
  await page.keyboard.down('KeyW')
  await page.waitForFunction((before) => {
    const audio = window.__CORD_AND_CROSSING_DEBUG__!.getAudioState()
    return (
      audio.lastFootstepSequence > before &&
      audio.lastFootstepSurface === 'stone'
    )
  }, hollowStepSequence)
  await page.keyboard.up('KeyW')

  const chimesBeforePass = await page.evaluate(
    () =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getAudioState()
        .lastCueIds.filter((cue) => cue === 'heelstone-chime').length,
  )
  await page.keyboard.down('KeyF')
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().passMode ===
      'Passing',
  )
  await page.keyboard.up('KeyF')
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().passMode ===
        'Carried' &&
      window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().lineCarrying,
    undefined,
    { timeout: 5_000 },
  )
  expect(
    await page.evaluate(
      () =>
        window.__CORD_AND_CROSSING_DEBUG__!.getHollow().progress
          .heelstonePassDone,
    ),
  ).toBe(true)
  await page.waitForFunction(
    (before) =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getAudioState()
        .lastCueIds.filter((cue) => cue === 'heelstone-chime').length > before,
    chimesBeforePass,
  )

  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mousedown', { button: 2, bubbles: true }),
    ),
  )
  await page.waitForTimeout(300)
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mouseup', { button: 2, bubbles: true }),
    ),
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'InHand',
    undefined,
    { timeout: 5_000 },
  )
  expect(
    await page.evaluate(
      () => window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().lineCarrying,
    ),
  ).toBe(true)

  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mousedown', { button: 2, bubbles: true }),
    ),
  )
  await page.waitForTimeout(300)
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mouseup', { button: 2, bubbles: true }),
    ),
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'Out',
  )
  await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.forceCut())
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'InHand',
    undefined,
    { timeout: 5_000 },
  )
  expect(
    await page.evaluate(
      () => window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().lineCarrying,
    ),
  ).toBe(false)

  expect(
    await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.saveGame()),
  ).toBe(true)
  await resumeGameAfterReload(page)
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getScene() === 'hollow' &&
      window.__CORD_AND_CROSSING_DEBUG__!.getHollow().progress
        .heelstonePassDone,
  )
  expect(
    await page.evaluate(() => ({
      effects: window.__CORD_AND_CROSSING_DEBUG__!.getEffects().length,
      carrying:
        window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().lineCarrying,
    })),
  ).toEqual({ effects: 0, carrying: false })

  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.grantEffect('Strength'),
    ),
  ).toBe(true)
  await expect(
    page.locator('.effect-slot').filter({ hasText: 'Strength' }),
  ).toBeVisible({
    timeout: 5_000,
  })
  await page.waitForTimeout(500)
  const chimesBeforeInterrupt = await page.evaluate(
    () =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getAudioState()
        .lastCueIds.filter((cue) => cue === 'heelstone-chime').length,
  )
  await page.keyboard.down('KeyF')
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().passMode ===
      'Passing',
    undefined,
    { timeout: 3_000 },
  )
  await page.keyboard.up('KeyF')
  await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.damagePlayer(1))
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().passMode ===
        'Idle' &&
      !window.__CORD_AND_CROSSING_DEBUG__!.getHeelstonePass().lineCarrying,
  )
  await page.waitForTimeout(250)
  expect(
    await page.evaluate(
      () =>
        window
          .__CORD_AND_CROSSING_DEBUG__!.getAudioState()
          .lastCueIds.filter((cue) => cue === 'heelstone-chime').length,
    ),
  ).toBe(chimesBeforeInterrupt)

  await page.evaluate(
    ([x, z]) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z + 6),
    ZONE.hollow.snagPost,
  )
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mousedown', { button: 2, bubbles: true }),
    ),
  )
  await page.waitForTimeout(300)
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mouseup', { button: 2, bubbles: true }),
    ),
  )
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getHollow().progress.snagPulled,
    undefined,
    { timeout: 10_000 },
  )
  await page.waitForFunction(
    () =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .filter((enemy) => enemy.id.startsWith('hollow-final-')).length === 3,
  )

  expect(
    await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.saveGame()),
  ).toBe(true)
  await resumeGameAfterReload(page)
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__ !== undefined &&
      window.__CORD_AND_CROSSING_DEBUG__.getScene() === 'hollow' &&
      window.__CORD_AND_CROSSING_DEBUG__.getHollow().progress.snagPulled &&
      window.__CORD_AND_CROSSING_DEBUG__
        .getEnemies()
        .filter((enemy) => enemy.id.startsWith('hollow-final-')).length === 3,
    undefined,
    { timeout: 10_000 },
  )

  const hollowEnemyIds = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.stageWorstCaseHollow(),
  )
  expect(hollowEnemyIds).toHaveLength(3)
  await page.waitForFunction(
    (ids) => {
      const debug = window.__CORD_AND_CROSSING_DEBUG__!
      const enemies = debug
        .getEnemies()
        .filter((enemy) => ids.includes(enemy.id))
      return (
        enemies.length === 3 &&
        enemies.every((enemy) => enemy.alive && enemy.inFrustum) &&
        debug.getHollowFrustumCount() === 3 &&
        debug.getActiveArrowCount() > 0 &&
        debug.getCordState() === 'Out'
      )
    },
    hollowEnemyIds,
    { timeout: 10_000 },
  )
  await page.waitForTimeout(350)
  const hollowEncounterPerf = await page.evaluate(() =>
    window.__CORD_AND_CROSSING_DEBUG__!.getPerfStats(),
  )
  expect(hollowEncounterPerf.drawCalls).toBeLessThan(250)
  expect(hollowEncounterPerf.triangles).toBeLessThan(500_000)
  await page.evaluate((ids) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    debug.setCordOutForPerf(false)
    for (const id of ids) debug.killEnemy(id)
  }, hollowEnemyIds)
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getQuest().quest.currentStep === 6,
  )

  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.grantEffect('Strength'),
    ),
  ).toBe(true)
  const strengthBeforeReturn = await page.evaluate(
    () =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEffects()
        .find((effect) => effect.id === 'Strength')?.remainingSeconds ?? 0,
  )
  for (const z of [-1, 0, 1]) {
    await page.evaluate(
      (nextZ) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(0, nextZ),
      z,
    )
    await page.waitForTimeout(100)
  }
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getScene() === 'zone',
    undefined,
    { timeout: 2_000 },
  )
  const strengthAfterReturn = await page.evaluate(
    () =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEffects()
        .find((effect) => effect.id === 'Strength')?.remainingSeconds ?? 0,
  )
  expect(strengthAfterReturn).toBeGreaterThan(0)
  expect(strengthAfterReturn).toBeLessThan(strengthBeforeReturn)

  await page.evaluate(
    ([x, z]) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z + 2),
    HOLLEN.position,
  )
  await expect(page.getByText(HOLLEN.prompt, { exact: true })).toBeVisible({
    timeout: 5_000,
  })
  await page.keyboard.press('KeyE')
  await page.keyboard.press('Digit1')
  await page.waitForFunction(() => {
    const quest = window.__CORD_AND_CROSSING_DEBUG__!.getQuest()
    return quest.quest.complete && quest.tasselEarned
  })
  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.emitQuestEvent('reportedToHollen'),
    ),
  ).toBe(false)
  expect(
    await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.saveGame()),
  ).toBe(true)
  await resumeGameAfterReload(page)
  await page.waitForFunction(() => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    return (
      debug.getScene() === 'zone' &&
      debug.getQuest().quest.complete &&
      debug.getTasselEarned() &&
      debug.getTasselVisible() &&
      debug.getPortico().phase === 'active'
    )
  })

  await page.evaluate(
    ({ x, z }) => window.__CORD_AND_CROSSING_DEBUG__!.teleport(x, z),
    porticoApproach,
  )
  expect(
    await page.evaluate(() => window.__CORD_AND_CROSSING_DEBUG__!.dropBlade()),
  ).toBe(true)
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getCordState() === 'Dropped',
  )
  expect(
    await page.evaluate(() => ({
      droppedScene: window.__CORD_AND_CROSSING_DEBUG__!.getDroppedBladeScene(),
      present: window.__CORD_AND_CROSSING_DEBUG__!.isWeaponPresent(),
    })),
  ).toEqual({ droppedScene: 'zone', present: true })
  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.forceCrossing('zoneToHollow'),
    ),
  ).toBe(true)
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getScene() === 'hollow',
    undefined,
    { timeout: 3_000 },
  )
  expect(
    await page.evaluate(() => ({
      cord: window.__CORD_AND_CROSSING_DEBUG__!.getCordState(),
      droppedScene: window.__CORD_AND_CROSSING_DEBUG__!.getDroppedBladeScene(),
      present: window.__CORD_AND_CROSSING_DEBUG__!.isWeaponPresent(),
    })),
  ).toEqual({ cord: 'Dropped', droppedScene: 'zone', present: false })
  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.forceCrossing('hollowToZone'),
    ),
  ).toBe(true)
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getScene() === 'zone',
    undefined,
    { timeout: 3_000 },
  )
  expect(
    await page.evaluate(() =>
      window.__CORD_AND_CROSSING_DEBUG__!.isWeaponPresent(),
    ),
  ).toBe(true)

  console.log(
    `m6 perf portico=${JSON.stringify(porticoPerf)} hollowArrival=${JSON.stringify(hollowArrivalPerf)} hollowEncounter=${JSON.stringify(hollowEncounterPerf)} loadMs=${sceneLoadMilliseconds}`,
  )
  expect(browserErrors).toEqual([])
})
