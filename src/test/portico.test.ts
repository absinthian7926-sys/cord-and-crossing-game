import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activatePortico,
  canCrossPorticoDirection,
  dispatchPorticoCrossing,
  getPorticoRuntimeSnapshot,
  hydratePorticoRuntime,
  isKeyUsePositionNearby,
  isKeyUseNearby,
  mapPorticoCrossingDirection,
  registerPorticoCrossingHandler,
  resetPorticoRuntime,
  setKeyUseNearby,
  setKeyUseNearbyTransient,
  shouldShowHeelstonePrompt,
  shouldShowUseKeyPrompt,
  toRippleUvPerSecond,
  unlockAndActivatePortico,
  unlockPortico,
} from '../game/portico/porticoRuntime'

describe('portico runtime and prompt rules', () => {
  beforeEach(() => {
    registerPorticoCrossingHandler(null)
    resetPorticoRuntime()
  })

  it('moves from locked through unlocked to active', () => {
    expect(getPorticoRuntimeSnapshot().phase).toBe('locked')
    expect(activatePortico()).toBe(false)
    expect(unlockPortico()).toBe(true)
    expect(unlockPortico()).toBe(false)
    expect(getPorticoRuntimeSnapshot().phase).toBe('unlocked')
    expect(activatePortico()).toBe(true)
    expect(activatePortico()).toBe(false)
    expect(getPorticoRuntimeSnapshot().phase).toBe('active')
  })

  it('hydrates, unlocks atomically, and tracks transient proximity', () => {
    hydratePorticoRuntime(false)
    setKeyUseNearbyTransient(true)
    expect(isKeyUseNearby()).toBe(true)
    setKeyUseNearby(false)
    expect(isKeyUseNearby()).toBe(false)
    expect(unlockAndActivatePortico()).toBe(true)
    expect(unlockAndActivatePortico()).toBe(false)
    hydratePorticoRuntime(true)
    expect(getPorticoRuntimeSnapshot().phase).toBe('active')
  })

  it('shows E Use key only for the exact valid state', () => {
    const valid = {
      nearby: true,
      questStep: 4,
      keyLooted: true,
      phase: 'locked' as const,
    }
    expect(shouldShowUseKeyPrompt(valid)).toBe(true)
    expect(shouldShowUseKeyPrompt({ ...valid, nearby: false })).toBe(false)
    expect(shouldShowUseKeyPrompt({ ...valid, questStep: 3 })).toBe(false)
    expect(shouldShowUseKeyPrompt({ ...valid, questStep: 5 })).toBe(false)
    expect(shouldShowUseKeyPrompt({ ...valid, keyLooted: false })).toBe(false)
    expect(shouldShowUseKeyPrompt({ ...valid, phase: 'active' })).toBe(false)
  })

  it('shows F Clear the line only for the exact valid state', () => {
    const valid = {
      hasActiveEffect: true,
      cordInHand: true,
      passIdle: true,
      lineCarrying: false,
    }
    expect(shouldShowHeelstonePrompt(valid)).toBe(true)
    expect(
      shouldShowHeelstonePrompt({ ...valid, hasActiveEffect: false }),
    ).toBe(false)
    expect(shouldShowHeelstonePrompt({ ...valid, cordInHand: false })).toBe(
      false,
    )
    expect(shouldShowHeelstonePrompt({ ...valid, passIdle: false })).toBe(false)
    expect(shouldShowHeelstonePrompt({ ...valid, lineCarrying: true })).toBe(
      false,
    )
  })

  it('dispatches crossings only while active with a handler', () => {
    const handler = vi.fn()
    registerPorticoCrossingHandler(handler)
    expect(dispatchPorticoCrossing('zoneToHollow')).toBe(false)
    expect(dispatchPorticoCrossing('hollowToZone')).toBe(true)
    expect(handler).toHaveBeenLastCalledWith('hollowToZone')
    unlockAndActivatePortico()
    expect(dispatchPorticoCrossing('zoneToHollow')).toBe(true)
    expect(handler).toHaveBeenLastCalledWith('zoneToHollow')
    registerPorticoCrossingHandler(null)
    expect(dispatchPorticoCrossing('hollowToZone')).toBe(false)
  })

  it('allows key use only within range on the road-facing side', () => {
    expect(isKeyUsePositionNearby(598, -80, 600, -80, -1, 0, 2.5)).toBe(true)
    expect(isKeyUsePositionNearby(600, -80, 600, -80, -1, 0, 2.5)).toBe(true)
    expect(isKeyUsePositionNearby(602, -80, 600, -80, -1, 0, 2.5)).toBe(false)
    expect(isKeyUsePositionNearby(597, -80, 600, -80, -1, 0, 2.5)).toBe(false)
    expect(isKeyUsePositionNearby(598, -80, 600, -80, 0, 0, 2.5)).toBe(false)
    expect(isKeyUsePositionNearby(598, -80, 600, -80, -1, 0, -1)).toBe(false)
  })

  it('keeps the Hollow return active independently and converts ripple units', () => {
    expect(canCrossPorticoDirection('zoneToHollow', 'locked')).toBe(false)
    expect(canCrossPorticoDirection('zoneToHollow', 'active')).toBe(true)
    expect(canCrossPorticoDirection('hollowToZone', 'locked')).toBe(true)
    expect(toRippleUvPerSecond(0.3, 3.2)).toBeCloseTo(0.09375)
    expect(toRippleUvPerSecond(0.3, 0)).toBe(0)
  })

  it('maps the west-facing zone and Hollow directions', () => {
    expect(mapPorticoCrossingDirection('zone', 'backToFront')).toBe(
      'zoneToHollow',
    )
    expect(mapPorticoCrossingDirection('zone', 'frontToBack')).toBe(
      'hollowToZone',
    )
    expect(mapPorticoCrossingDirection('hollow', 'frontToBack')).toBe(
      'hollowToZone',
    )
    expect(mapPorticoCrossingDirection('hollow', 'backToFront')).toBe(
      'zoneToHollow',
    )
  })
})
