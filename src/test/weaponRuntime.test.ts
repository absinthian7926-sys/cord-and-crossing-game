import { beforeEach, describe, expect, it } from 'vitest'
import {
  isWeaponPresentInScene,
  resetWeaponRuntime,
  setDroppedBladeScene,
  weaponRuntime,
} from '../game/weapons/weaponRuntime'

describe('weapon scene ownership', () => {
  beforeEach(() => resetWeaponRuntime())

  it('leaves a dropped blade in its origin scene', () => {
    setDroppedBladeScene('zone')
    expect(isWeaponPresentInScene('Dropped', 'zone', 'zone')).toBe(true)
    expect(isWeaponPresentInScene('Dropped', 'hollow', 'zone')).toBe(false)
    expect(weaponRuntime.droppedScene).toBe('zone')
  })

  it('keeps a held blade with the player and clears scene ownership on reset', () => {
    setDroppedBladeScene('hollow')
    expect(isWeaponPresentInScene('InHand', 'zone', 'hollow')).toBe(true)
    resetWeaponRuntime()
    expect(weaponRuntime.droppedScene).toBeNull()
  })
})
