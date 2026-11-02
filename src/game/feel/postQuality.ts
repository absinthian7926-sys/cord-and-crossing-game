import { FEEL } from '../../data/feel'
import type { QualityLevel } from '../../data/zone'

export type PostEffectId = 'SMAA' | 'Vignette' | 'ColorGrade' | 'Bloom'

export type PostQuality = {
  readonly enabled: boolean
  readonly effects: readonly PostEffectId[]
  readonly bloom: typeof FEEL.post.bloom | null
}

const LOW: PostQuality = {
  enabled: false,
  effects: [],
  bloom: null,
}

const MEDIUM: PostQuality = {
  enabled: true,
  effects: ['SMAA', 'Vignette', 'ColorGrade'],
  bloom: null,
}

const HIGH: PostQuality = {
  enabled: true,
  effects: ['SMAA', 'Vignette', 'ColorGrade', 'Bloom'],
  bloom: FEEL.post.bloom,
}

export function postQualityForTier(quality: QualityLevel): PostQuality {
  if (quality === 'Low') return LOW
  return quality === 'Medium' ? MEDIUM : HIGH
}

export function shouldMountPostProcessing(quality: QualityLevel): boolean {
  return postQualityForTier(quality).enabled
}
