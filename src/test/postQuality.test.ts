import { describe, expect, it } from 'vitest'
import {
  postQualityForTier,
  shouldMountPostProcessing,
} from '../game/feel/postQuality'

describe('post-processing quality', () => {
  it('mounts nothing at Low', () => {
    expect(shouldMountPostProcessing('Low')).toBe(false)
    expect(postQualityForTier('Low')).toEqual({
      enabled: false,
      effects: [],
      bloom: null,
    })
  })

  it('uses SMAA only at Medium after the measured cost fallback', () => {
    expect(shouldMountPostProcessing('Medium')).toBe(true)
    expect(postQualityForTier('Medium')).toMatchObject({
      enabled: true,
      effects: ['SMAA'],
      bloom: null,
    })
  })

  it('adds light bloom at High and live fallback removes the composer', () => {
    expect(postQualityForTier('High')).toMatchObject({
      enabled: true,
      effects: ['SMAA', 'Vignette', 'ColorGrade', 'Bloom'],
      bloom: { intensity: 0.35, luminanceThreshold: 0.85, mipmapBlur: true },
    })
    expect(shouldMountPostProcessing('High')).toBe(true)
    expect(shouldMountPostProcessing('Low')).toBe(false)
  })
})
