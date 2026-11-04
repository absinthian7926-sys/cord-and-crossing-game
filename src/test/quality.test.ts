import { describe, expect, it } from 'vitest'
import { QUALITY_PROFILES, qualityProfile } from '../game/settings/quality'

describe('quality profiles', () => {
  it('maps Low to the lightest live settings', () => {
    expect(qualityProfile('Low')).toBe(QUALITY_PROFILES.Low)
    expect(QUALITY_PROFILES.Low).toEqual({
      shadowMapSize: 1_024,
      scatterDensity: 0.5,
      drawDistance: 450,
      dpr: 1,
    })
  })

  it('maps Medium to the default live settings', () => {
    expect(qualityProfile('Medium')).toBe(QUALITY_PROFILES.Medium)
    expect(QUALITY_PROFILES.Medium).toEqual({
      shadowMapSize: 1_024,
      scatterDensity: 1,
      drawDistance: 650,
      dpr: [1, 1.5],
    })
  })

  it('maps High to the fullest live settings', () => {
    expect(qualityProfile('High')).toBe(QUALITY_PROFILES.High)
    expect(QUALITY_PROFILES.High).toEqual({
      shadowMapSize: 2_048,
      scatterDensity: 1.5,
      drawDistance: 850,
      dpr: [1, 2],
    })
  })
})
