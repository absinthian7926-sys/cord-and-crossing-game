import { afterEach, describe, expect, it } from 'vitest'
import {
  isGameplayInputLocked,
  setGameplayInputLock,
  setGameplayInputLocked,
} from '../game/player/input'

afterEach(() => {
  setGameplayInputLock('dialogue', false)
  setGameplayInputLock('scene-transition', false)
  setGameplayInputLock('portico-transition-request', false)
  setGameplayInputLocked(false)
})

describe('gameplay input locks', () => {
  it('keeps input locked until every independent source releases it', () => {
    expect(isGameplayInputLocked()).toBe(false)
    setGameplayInputLock('dialogue', true)
    setGameplayInputLock('scene-transition', true)
    expect(isGameplayInputLocked()).toBe(true)
    setGameplayInputLock('dialogue', false)
    expect(isGameplayInputLocked()).toBe(true)
    setGameplayInputLock('scene-transition', false)
    expect(isGameplayInputLocked()).toBe(false)
  })

  it('keeps the legacy setter compatible with keyed locks', () => {
    setGameplayInputLocked(true)
    setGameplayInputLock('scene-transition', true)
    setGameplayInputLocked(false)
    expect(isGameplayInputLocked()).toBe(true)
    setGameplayInputLock('scene-transition', false)
    expect(isGameplayInputLocked()).toBe(false)
  })
})
