import { lazy, Suspense, useEffect } from 'react'
import type { QualityLevel } from '../../data/zone'
import { setPostProcessingState } from './feelRuntime'
import { postQualityForTier } from './postQuality'

const LazyPostEffects = lazy(async () => {
  const module = await import('./PostEffects')
  return { default: module.PostEffects }
})

export function PostEffectsGate({
  quality,
}: {
  readonly quality: QualityLevel
}) {
  const profile = postQualityForTier(quality)
  useEffect(() => {
    setPostProcessingState(quality, profile.effects)
  }, [profile.effects, quality])

  if (!profile.enabled) return null
  return (
    <Suspense fallback={null}>
      <LazyPostEffects quality={quality} />
    </Suspense>
  )
}
