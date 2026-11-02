import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EFFECTS } from '../data/effects'
import { FEEL } from '../data/feel'
import {
  audioBus,
  createAudioEvent,
  readAudioEvent,
  resetAudioBus,
} from '../game/audio/audioBus'
import {
  cancelHeelstonePassByDodge,
  grantStrengthFromCrossing,
  interruptHeelstonePassByHit,
  resetEffectRuntime,
  startHeelstonePass,
  tickEffectRuntime,
} from '../game/effects/effectRuntime'
import { getFeelRuntimeSnapshot, stepFeelShake } from '../game/feel/feelRuntime'
import { setGameplayInputLock } from '../game/player/input'
import { handlePorticoCrossing } from '../game/portico/porticoGameplay'
import {
  hydratePorticoRuntime,
  resetPorticoRuntime,
} from '../game/portico/porticoRuntime'
import {
  beginPendingSceneLoad,
  loadSceneImmediately,
} from '../game/scenes/sceneRuntime'
import { resetWeaponRuntime } from '../game/weapons/weaponRuntime'

const event = createAudioEvent()

function readCueIds(): string[] {
  const ids: string[] = []
  while (readAudioEvent(audioBus, event) !== null) ids.push(event.id)
  return ids
}

function releaseTransitionLocks(): void {
  setGameplayInputLock('portico-transition-request', false)
  setGameplayInputLock('scene-transition', false)
}

describe('gameplay audio event wiring', () => {
  beforeEach(() => {
    releaseTransitionLocks()
    loadSceneImmediately('zone')
    resetPorticoRuntime()
    resetEffectRuntime()
    resetWeaponRuntime()
    stepFeelShake(1, false, true, 0)
    resetAudioBus(audioBus)
  })

  afterEach(() => {
    releaseTransitionLocks()
    loadSceneImmediately('zone')
    resetPorticoRuntime()
    resetEffectRuntime()
    resetAudioBus(audioBus)
  })

  it('queues a bell and crossing trauma only after a transition is accepted', () => {
    hydratePorticoRuntime(false)
    expect(handlePorticoCrossing('zoneToHollow')).toBe(false)
    expect(handlePorticoCrossing('hollowToZone')).toBe(false)
    expect(readCueIds()).toEqual([])
    expect(getFeelRuntimeSnapshot().trauma).toBe(0)

    hydratePorticoRuntime(true)
    expect(handlePorticoCrossing('zoneToHollow')).toBe(true)
    expect(readCueIds()).toEqual(['portico-bell'])
    expect(getFeelRuntimeSnapshot().trauma).toBeCloseTo(
      FEEL.shake.trauma.validCrossing,
    )

    expect(handlePorticoCrossing('zoneToHollow')).toBe(false)
    expect(readCueIds()).toEqual([])
  })

  it('queues scene-change only when the active scene changes', () => {
    hydratePorticoRuntime(true)
    expect(handlePorticoCrossing('zoneToHollow')).toBe(true)
    expect(readCueIds()).toEqual(['portico-bell'])
    expect(beginPendingSceneLoad()).toBe(true)
    expect(readCueIds()).toEqual(['scene-change'])
    expect(beginPendingSceneLoad()).toBe(false)
    expect(readCueIds()).toEqual([])

    loadSceneImmediately('hollow')
    expect(readCueIds()).toEqual([])
    loadSceneImmediately('zone')
    expect(readCueIds()).toEqual(['scene-change'])
  })

  it('starts and stops the heelstone hiss on interruption and dodge cancel', () => {
    expect(grantStrengthFromCrossing(false)).toBe(true)
    expect(startHeelstonePass()).toBe(true)
    expect(interruptHeelstonePassByHit()).toBe(true)
    expect(interruptHeelstonePassByHit()).toBe(false)
    expect(readCueIds()).toEqual([
      'heelstone-hiss-start',
      'heelstone-hiss-stop',
    ])

    expect(startHeelstonePass()).toBe(true)
    expect(cancelHeelstonePassByDodge()).toBe(true)
    expect(readCueIds()).toEqual([
      'heelstone-hiss-start',
      'heelstone-hiss-stop',
    ])
  })

  it('chimes on heelstone completion without queuing an interruption cue', () => {
    expect(grantStrengthFromCrossing(false)).toBe(true)
    expect(startHeelstonePass()).toBe(true)
    tickEffectRuntime(EFFECTS.heelstonePass.durationSeconds)
    expect(readCueIds()).toEqual(['heelstone-hiss-start', 'heelstone-chime'])
  })
})
