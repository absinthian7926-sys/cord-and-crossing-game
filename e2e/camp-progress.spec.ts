import { expect, test } from '@playwright/test'
import {
  CAMP_LEADER,
  CAMP_PROGRESS,
  ENEMY_SPAWNS,
  ENEMY_TYPES,
  PLAYER_DEATH,
} from '../src/data/enemies'
import { PLAYER } from '../src/data/player'
import { SAVE_CONFIG } from '../src/data/quests'
import { REACHBLADE } from '../src/data/weapons'
import { createNewSaveData, serializeSave } from '../src/game/save/save'
import { heightAt } from '../src/game/world/terrain'
import { resumeGameAfterReload, startGame } from './helpers'

test('keeps camp progress after a normal player death without debug mutations', async ({
  page,
}) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })

  const startX = ENEMY_SPAWNS.camp.anchor[0]
  const startZ = ENEMY_SPAWNS.camp.anchor[1] + 46
  const save = createNewSaveData()
  save.player.position = {
    x: startX,
    y: heightAt(startX, startZ),
    z: startZ,
  }
  save.quest.currentStep = 2
  save.quest.completedSteps = [1]

  const leaderApproach = {
    x: ENEMY_SPAWNS.camp.anchor[0],
    z:
      ENEMY_SPAWNS.camp.anchor[1] +
      CAMP_LEADER.campOffset[1] +
      ENEMY_TYPES.roadBrigand.attackRange -
      0.25,
  }
  const combatSave = createNewSaveData()
  combatSave.player.health = ENEMY_TYPES.roadBrigand.damage * 2
  combatSave.player.position = {
    x: leaderApproach.x,
    y: heightAt(leaderApproach.x, leaderApproach.z),
    z: leaderApproach.z,
  }
  combatSave.quest.currentStep = 2
  combatSave.quest.completedSteps = [1]
  combatSave.quest.campCheckpointActive = true

  await page.addInitScript(
    ({ combatValue, initialValue, key, stageKey }) => {
      if (window.sessionStorage.getItem(stageKey) === null) {
        window.localStorage.setItem(key, initialValue)
        window.sessionStorage.setItem(stageKey, 'checkpoint-crossed')
        return
      }
      window.localStorage.setItem(key, combatValue)
    },
    {
      combatValue: serializeSave(combatSave),
      initialValue: serializeSave(save),
      key: SAVE_CONFIG.storageKey,
      stageKey: 'camp-progress-e2e-stage',
    },
  )

  await startGame(page)
  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getQuest().quest.currentStep === 2 &&
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .some((enemy) => enemy.id === 'camp-leader'),
  )
  expect(
    await page.evaluate(
      () => window.__CORD_AND_CROSSING_DEBUG__!.getQuest().campCheckpointActive,
    ),
  ).toBe(false)

  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForFunction(
    () => window.__CORD_AND_CROSSING_DEBUG__!.getQuest().campCheckpointActive,
  )
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')

  await resumeGameAfterReload(page)
  await page.waitForFunction(({ x, z }) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const player = debug.getPlayerPosition()
    return (
      debug.getQuest().campCheckpointActive &&
      debug.getEnemies().some((enemy) => enemy.id === 'camp-leader') &&
      Math.hypot(player.x - x, player.z - z) < 0.5
    )
  }, leaderApproach)
  expect(
    await page.evaluate(
      () => window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().invulnerable,
    ),
  ).toBe(false)

  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mousedown', { button: 0, bubbles: true }),
    ),
  )
  await page.waitForTimeout(300)
  await page.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent('mouseup', { button: 0, bubbles: true }),
    ),
  )
  await page.waitForFunction(
    (maximumHealth) =>
      (window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .find((enemy) => enemy.id === 'camp-leader')?.hp ?? maximumHealth) <
      maximumHealth,
    CAMP_LEADER.maxHealth,
  )
  const leaderHealth = await page.evaluate(
    () =>
      window
        .__CORD_AND_CROSSING_DEBUG__!.getEnemies()
        .find((enemy) => enemy.id === 'camp-leader')!.hp,
  )
  expect(leaderHealth).toBe(CAMP_LEADER.maxHealth - REACHBLADE.close.damage[0])

  await page.waitForFunction(
    () =>
      window.__CORD_AND_CROSSING_DEBUG__!.getPlayerStatus().deathPhase !==
      'Alive',
  )
  await page.waitForFunction((checkpoint) => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    const status = debug.getPlayerStatus()
    const position = debug.getPlayerPosition()
    return (
      status.deathPhase === 'Alive' &&
      Math.hypot(position.x - checkpoint[0], position.z - checkpoint[1]) < 1
    )
  }, CAMP_PROGRESS.respawn)

  const afterRespawn = await page.evaluate(() => {
    const debug = window.__CORD_AND_CROSSING_DEBUG__!
    return {
      player: debug.getPlayerStatus(),
      leaderHealth:
        debug.getEnemies().find((enemy) => enemy.id === 'camp-leader')?.hp ??
        null,
      checkpoint: debug.getQuest().campCheckpointActive,
    }
  })
  expect(afterRespawn.player.health).toBe(PLAYER.health.max)
  expect(afterRespawn.player.stamina).toBe(PLAYER.stamina.max)
  expect(afterRespawn.player.invulnerable).toBe(true)
  expect(
    Number.isFinite(afterRespawn.player.spawnInvulnerabilityRemainingSeconds),
  ).toBe(true)
  expect(
    afterRespawn.player.spawnInvulnerabilityRemainingSeconds,
  ).toBeGreaterThan(0)
  expect(
    afterRespawn.player.spawnInvulnerabilityRemainingSeconds,
  ).toBeLessThanOrEqual(PLAYER_DEATH.spawnInvulnerabilitySeconds)
  expect(afterRespawn.leaderHealth).toBe(leaderHealth)
  expect(afterRespawn.checkpoint).toBe(true)
  expect(browserErrors).toEqual([])
})
