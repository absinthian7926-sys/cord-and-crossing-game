import { describe, expect, it } from 'vitest'
import { ZONE } from '../data/zone'

describe('Ruin Shelf layout contract', () => {
  it('keeps the frame and portico collider layout unchanged', () => {
    expect(ZONE.placeholders.ruin.frameOffsets).toEqual([
      [-6, 0],
      [6, 0],
      [0, 5],
    ])
    expect(ZONE.placeholders.ruin.frameSize).toEqual([1.4, 4, 1.4])
    expect(ZONE.placeholders.ruin.lintelSize).toEqual([13, 0.8, 1.4])
    expect(ZONE.placeholders.ruin.porticoCenter).toEqual([600, -80])
    expect(ZONE.placeholders.ruin.pillarSize).toEqual([0.7, 3.2, 0.7])
    expect(ZONE.portico.center).toEqual([600, -80])
    expect(ZONE.portico.pillarSpacing).toBe(2.4)
  })
})
