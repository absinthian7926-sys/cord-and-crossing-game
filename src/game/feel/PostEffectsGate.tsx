import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react'
import type { QualityLevel } from '../../data/zone'
import { setPostProcessingState } from './feelRuntime'
import { getPostOverride, subscribePostOverride } from './postOverrideRuntime'
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
  const override = useSyncExternalStore(
    subscribePostOverride,
    getPostOverride,
    getPostOverride,
  )
  const enabled = override ?? profile.enabled
  useEffect(() => {
    setPostProcessingState(quality, enabled ? profile.effects : [])
  }, [enabled, profile.effects, quality])

  if (!enabled || quality === 'Low') return null
  return (
    <Suspense fallback={null}>
      <LazyPostEffects quality={quality} />
    </Suspense>
  )
}
