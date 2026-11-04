import { expect, test } from '@playwright/test'
import { CAMP_LEADER, ENEMY_SPAWNS } from '../src/data/enemies'
import { FRAME_SHELTER_KEY, SAVE_CONFIG } from '../src/data/quests'
import { PLAYER } from '../src/data/player'
import { SETTINGS } from '../src/data/settings'
import { createNewSaveData, serializeSave } from '../src/game/save/save'
import {
  createDefaultSettings,
  serializeSettings,
} from '../src/game/settings/settings'
import { heightAt } from '../src/game/world/terrain'
import { startGame } from './helpers'

test('collects the visible camp key with normal keyboard input', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 240 })

  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })

  const keyX = ENEMY_SPAWNS.camp.anchor[0] + CAMP_LEADER.campOffset[0]
  const keyZ = ENEMY_SPAWNS.camp.anchor[1] + CAMP_LEADER.campOffset[1]
  const startX = keyX
  const startZ =
    keyZ -
    FRAME_SHELTER_KEY.presentation.beamHeight -
    FRAME_SHELTER_KEY.pickupRadius
  const save = createNewSaveData()
  save.player.position = {
    x: startX,
    y: heightAt(startX, startZ),
    z: startZ,
  }
  save.quest.currentStep = 2
  save.quest.completedSteps = [1]
  save.quest.campLeaderDefeated = true
  save.quest.keyDrop = {
    x: keyX,
    y: heightAt(keyX, keyZ) + FRAME_SHELTER_KEY.presentation.ringRadius,
    z: keyZ,
  }

  const settings = createDefaultSettings(false)
  settings.quality = 'Low'
  settings.qualityChosenByHand = true

  await page.addInitScript(
    ({ saveKey, saveValue, settingsKey, settingsValue }) => {
      window.localStorage.setItem(saveKey, saveValue)
      window.localStorage.setItem(settingsKey, settingsValue)
    },
    {
      saveKey: SAVE_CONFIG.storageKey,
      saveValue: serializeSave(save),
      settingsKey: SETTINGS.storageKey,
      settingsValue: serializeSettings(settings),
    },
  )

  await startGame(page, { waitForDebugHook: false })
  await expect(page.getByText(/^Take the key \(\d+ m\)\.$/)).toBeVisible()
  await expect(
    page.getByText(FRAME_SHELTER_KEY.prompt, { exact: true }),
  ).toBeHidden()

  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyS')
  await expect(
    page.getByText(FRAME_SHELTER_KEY.prompt, { exact: true }),
  ).toBeVisible()
  await page.keyboard.up('KeyS')
  await page.keyboard.up('ShiftLeft')
  await page.keyboard.press('KeyE')

  await expect(
    page.getByText('Return to Hollen.', { exact: true }),
  ).toBeVisible()
  await page.waitForFunction(
    ({ storageKey, maximumHealth }) => {
      const serialized = window.localStorage.getItem(storageKey)
      if (serialized === null) return false
      const stored = JSON.parse(serialized) as {
        player?: { health?: number }
        quest?: { currentStep?: number; keyLooted?: boolean; keyDrop?: unknown }
      }
      return (
        stored.player?.health === maximumHealth &&
        stored.quest?.currentStep === 3 &&
        stored.quest.keyLooted === true &&
        stored.quest.keyDrop === null
      )
    },
    {
      storageKey: SAVE_CONFIG.storageKey,
      maximumHealth: PLAYER.health.max,
    },
  )

  expect(browserErrors).toEqual([])
})
