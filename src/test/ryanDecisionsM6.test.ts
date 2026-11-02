import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { EFFECTS } from '../data/effects'
import { CAMP_LEADER, ENEMY_SPAWNS } from '../data/enemies'
import { FRAME_SHELTER_KEY } from '../data/quests'
import { ZONE } from '../data/zone'
import {
  getActiveEffectCount,
  grantStrengthFromCrossing,
  lineCarriesEffect,
  resetEffectRuntime,
  startHeelstonePass,
  tickEffectRuntime,
} from '../game/effects/effectRuntime'
import {
  createHeelstonePassState,
  stepHeelstonePass,
} from '../game/effects/heelstonePass'
import {
  beginSnagPull,
  createSnagState,
  MARKED_SNAG_POST_ID,
  stepSnag,
} from '../game/hollow/snag'
import {
  getPorticoRuntimeSnapshot,
  resetPorticoRuntime,
  setKeyUseNearbyTransient,
} from '../game/portico/porticoRuntime'
import { tryUsePorticoKey } from '../game/portico/porticoGameplay'
import {
  getQuestRuntimeSnapshot,
  hydrateQuestRuntime,
  resetQuestRuntime,
} from '../game/quest/questRuntime'
import {
  createNewSaveData,
  deserializeSave,
  migrateSaveData,
  serializeSave,
} from '../game/save/save'
import {
  applyRuntimeSaveData,
  configureSaveWorldRuntimeAdapter,
  createRuntimeSaveData,
} from '../game/save/saveRuntime'
import { resetWeaponRuntime } from '../game/weapons/weaponRuntime'
import { heightAt } from '../game/world/terrain'

function productionSourceFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'test') files.push(...productionSourceFiles(fullPath))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

describe('Ryan M6 decisions for Slice 1', () => {
  beforeEach(() => {
    configureSaveWorldRuntimeAdapter(null)
    resetEffectRuntime()
    resetWeaponRuntime()
    resetQuestRuntime()
    resetPorticoRuntime()
  })

  it('records the final Strength duration and return-crossing decision', () => {
    expect(EFFECTS.strength.durationSeconds).toBe(180)
    expect(EFFECTS.strength.returnCrossingGrantsEffect).toBe(false)

    const effectsSource = readFileSync(resolve('src/data/effects.ts'), 'utf8')
    expect(
      effectsSource.match(
        /\/\/ GAME, decided by Ryan on 2026-11-02 \(GDD 18 Q2\)/g,
      ),
    ).toHaveLength(2)
    for (const file of productionSourceFiles(resolve('src'))) {
      expect(readFileSync(file, 'utf8')).not.toContain(
        'PLACEHOLDER pending Ryan',
      )
    }
  })

  it('loads with no active effect and a plain line', () => {
    expect(grantStrengthFromCrossing(false)).toBe(true)
    expect(startHeelstonePass()).toBe(true)
    tickEffectRuntime(EFFECTS.heelstonePass.durationSeconds)
    expect(getActiveEffectCount()).toBe(1)
    expect(lineCarriesEffect()).toBe(true)

    applyRuntimeSaveData(
      createNewSaveData(),
      () => ZONE.heightmap.waystationHeight,
    )
    expect(getActiveEffectCount()).toBe(0)
    expect(lineCarriesEffect()).toBe(false)
  })

  it('keeps the frame shelter key after unlock and save round-trip', () => {
    hydrateQuestRuntime(
      {
        currentStep: 4,
        completedSteps: [1, 2, 3],
        keyLooted: true,
        complete: false,
      },
      true,
    )
    setKeyUseNearbyTransient(true)
    expect(tryUsePorticoKey()).toBe(true)
    expect(getPorticoRuntimeSnapshot().phase).toBe('active')
    expect(getQuestRuntimeSnapshot().quest.keyLooted).toBe(true)

    const loaded = deserializeSave(serializeSave(createRuntimeSaveData()))
    expect(loaded.usedFallback).toBe(false)
    expect(loaded.data.quest.keyLooted).toBe(true)
  })

  it('keeps snag distance at 2 m and halves pull time with Strength', () => {
    const plain = createSnagState(0, -30)
    const strength = createSnagState(0, -30)
    expect(
      beginSnagPull(
        plain,
        MARKED_SNAG_POST_ID,
        0,
        0,
        ZONE.hollow.snagBasePullSpeed,
        1,
      ),
    ).toBe(true)
    expect(
      beginSnagPull(
        strength,
        MARKED_SNAG_POST_ID,
        0,
        0,
        ZONE.hollow.snagBasePullSpeed,
        EFFECTS.strength.castPullForceMultiplier,
      ),
    ).toBe(true)

    let plainSeconds = 0
    let strengthSeconds = 0
    while (!plain.pulled) {
      stepSnag(plain, 0.01)
      plainSeconds += 0.01
    }
    while (!strength.pulled) {
      stepSnag(strength, 0.01)
      strengthSeconds += 0.01
    }

    expect(Math.hypot(plain.postX, plain.postZ + 30)).toBeCloseTo(2, 2)
    expect(Math.hypot(strength.postX, strength.postZ + 30)).toBeCloseTo(2, 2)
    expect(strengthSeconds).toBeCloseTo(plainSeconds * 0.5, 2)
  })

  it('keeps the 1.2 s pass and makes dodge cancel it', () => {
    const state = createHeelstonePassState()
    stepHeelstonePass(state, {
      type: 'start',
      activeEffectId: EFFECTS.strength.id,
      bladeInHand: true,
      lineAlreadyCarrying: false,
    })
    expect(state.remainingSeconds).toBe(1.2)
    stepHeelstonePass(state, { type: 'dodge' })
    expect(state).toEqual({
      mode: 'Idle',
      effectId: null,
      remainingSeconds: 0,
    })
  })

  it('migrates v1 pending keys to the approved camp-leader fallback', () => {
    const migrated = migrateSaveData({
      schemaVersion: 1,
      player: {
        name: 'Runner',
        health: 100,
        stamina: 100,
        position: { x: 0, y: 8, z: 0 },
        cordState: 'InHand',
      },
      quest: {
        currentStep: 2,
        completedSteps: [1],
        keyLooted: false,
        complete: false,
        campLeaderDefeated: true,
      },
    })
    const x = ENEMY_SPAWNS.camp.anchor[0] + CAMP_LEADER.campOffset[0]
    const z = ENEMY_SPAWNS.camp.anchor[1] + CAMP_LEADER.campOffset[1]
    expect(migrated?.quest.keyDrop).toEqual({
      x,
      y: heightAt(x, z) + FRAME_SHELTER_KEY.presentation.ringRadius,
      z,
    })
  })
})
