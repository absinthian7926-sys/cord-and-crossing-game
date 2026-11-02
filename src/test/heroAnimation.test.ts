import { describe, expect, it } from 'vitest'
import {
  createHeroAnimationSelection,
  selectHeroAnimation,
  type HeroAnimationInput,
} from '../game/animation/heroAnimation'

const input = (
  overrides: Partial<HeroAnimationInput> = {},
): HeroAnimationInput => ({
  dead: false,
  dodging: false,
  heelstonePassMode: 'Idle',
  heelstonePassRemainingSeconds: 0,
  strikePhase: 'idle',
  comboHitIndex: 1,
  casting: false,
  aiming: false,
  recalling: false,
  grounded: true,
  speedMetersPerSecond: 0,
  running: false,
  ...overrides,
})

describe('hero animation selection', () => {
  it('selects idle, walk and run with the requested time scales', () => {
    const output = createHeroAnimationSelection()
    expect(selectHeroAnimation(input(), output)).toBe(output)
    expect(output).toMatchObject({ clipId: 'idle', timeScale: 1 })
    selectHeroAnimation(input({ speedMetersPerSecond: 2 }), output)
    expect(output).toMatchObject({ clipId: 'run', timeScale: 0.4 })
    selectHeroAnimation(
      input({ speedMetersPerSecond: 5, running: true }),
      output,
    )
    expect(output).toMatchObject({ clipId: 'run', timeScale: 1 })
    expect(output.crossfadeSeconds).toBe(0.12)
  })

  it('applies the full priority order', () => {
    const output = createHeroAnimationSelection()
    const busy = input({
      dead: true,
      dodging: true,
      heelstonePassMode: 'Passing',
      heelstonePassRemainingSeconds: 0.6,
      strikePhase: 'active',
      comboHitIndex: 3,
      casting: true,
      aiming: true,
      recalling: true,
      speedMetersPerSecond: 5,
      running: true,
    })
    selectHeroAnimation(busy, output)
    expect(output).toMatchObject({ clipId: null, holdLastPose: true })

    busy.dead = false
    selectHeroAnimation(busy, output)
    expect(output.clipId).toBe('dodge')
    busy.dodging = false
    selectHeroAnimation(busy, output)
    expect(output.clipId).toBe('heelstonePass')
    busy.heelstonePassMode = 'Idle'
    selectHeroAnimation(busy, output)
    expect(output.clipId).toBe('strike3')
    busy.strikePhase = 'idle'
    selectHeroAnimation(busy, output)
    expect(output.clipId).toBe('cast')
    busy.casting = false
    busy.aiming = false
    selectHeroAnimation(busy, output)
    expect(output.clipId).toBe('recall')
  })

  it('selects every strike clip and ignores motion while airborne', () => {
    const output = createHeroAnimationSelection()
    for (const comboHitIndex of [1, 2, 3] as const) {
      selectHeroAnimation(
        input({ strikePhase: 'windup', comboHitIndex }),
        output,
      )
      expect(output.clipId).toBe(`strike${comboHitIndex}`)
    }
    selectHeroAnimation(
      input({ grounded: false, speedMetersPerSecond: 5 }),
      output,
    )
    expect(output.clipId).toBe('idle')
  })

  it('drives the 1.2 second pass clip from the pass timer', () => {
    const output = createHeroAnimationSelection()
    selectHeroAnimation(
      input({
        heelstonePassMode: 'Passing',
        heelstonePassRemainingSeconds: 0.9,
      }),
      output,
    )
    expect(output.clipId).toBe('heelstonePass')
    expect(output.normalizedTime).toBeCloseTo(0.25)

    selectHeroAnimation(
      input({
        dodging: true,
        heelstonePassMode: 'Idle',
        heelstonePassRemainingSeconds: 0,
      }),
      output,
    )
    expect(output.clipId).toBe('dodge')
    expect(output.normalizedTime).toBeNull()
  })
})
