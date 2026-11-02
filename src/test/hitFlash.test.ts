import { describe, expect, it } from 'vitest'
import { FEEL } from '../data/feel'
import {
  createEnemyFlashState,
  createTimedFlashState,
  stepBlockFlash,
  stepEnemyHitFlash,
  stepPlayerVignette,
  triggerBlockFlash,
  triggerEnemyHitFlash,
  triggerPlayerVignette,
} from '../game/feel/hitFlash'

describe('hit flashes', () => {
  it('holds an enemy flash for 0.08 seconds then returns over 0.06', () => {
    const state = createEnemyFlashState()
    triggerEnemyHitFlash(state, false)
    expect(stepEnemyHitFlash(state, 0, false)).toBe(0.6)
    expect(stepEnemyHitFlash(state, 0.08, false)).toBe(0.6)
    expect(stepEnemyHitFlash(state, 0.03, false)).toBeCloseTo(0.3)
    expect(stepEnemyHitFlash(state, 0.03, false)).toBe(0)
    expect(state.phase).toBe('Idle')
  })

  it('lets the telegraph win and plays a queued hit afterward', () => {
    const state = createEnemyFlashState()
    triggerEnemyHitFlash(state, true)
    expect(stepEnemyHitFlash(state, 1, true)).toBe(0)
    expect(state.queued).toBe(true)
    expect(stepEnemyHitFlash(state, 0, false)).toBe(0.6)
    expect(state.queued).toBe(false)
    triggerEnemyHitFlash(state, false)
    expect(stepEnemyHitFlash(state, 0.01, true)).toBe(0)
    expect(state.queued).toBe(true)
  })

  it('renders the player vignette with reduced-motion opacity halved', () => {
    const state = createTimedFlashState()
    triggerPlayerVignette(state)
    expect(stepPlayerVignette(state, 0, false)).toBe(
      FEEL.hitFlash.player.peakOpacity,
    )
    expect(stepPlayerVignette(state, 0, true)).toBe(
      FEEL.hitFlash.player.peakOpacity / 2,
    )
    expect(stepPlayerVignette(state, 0.18, false)).toBe(0)
  })

  it('flashes the buckler for exactly 0.08 seconds', () => {
    const state = createTimedFlashState()
    expect(stepBlockFlash(state, 0)).toBe(0)
    triggerBlockFlash(state)
    expect(stepBlockFlash(state, 0)).toBe(1)
    expect(stepBlockFlash(state, 0.08)).toBe(0)
  })

  it('treats invalid or negative time as zero', () => {
    const enemy = createEnemyFlashState()
    expect(stepEnemyHitFlash(enemy, 0, false)).toBe(0)
    triggerEnemyHitFlash(enemy, false)
    expect(stepEnemyHitFlash(enemy, Number.NaN, false)).toBe(0.6)
    expect(stepEnemyHitFlash(enemy, -1, false)).toBe(0.6)

    const timed = createTimedFlashState()
    triggerPlayerVignette(timed)
    expect(stepPlayerVignette(timed, Number.NaN, false)).toBe(0.35)
    expect(stepPlayerVignette(timed, -1, false)).toBe(0.35)
    triggerBlockFlash(timed)
    expect(stepBlockFlash(timed, Number.NaN)).toBe(1)
    expect(stepBlockFlash(timed, -1)).toBe(1)
  })
})
