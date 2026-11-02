import { lazy, Suspense } from 'react'

const LazyPerfSampler = lazy(() =>
  import('./PerfOverlay').then((module) => ({ default: module.PerfSampler })),
)
const LazyPerfOverlay = lazy(() =>
  import('./PerfOverlay').then((module) => ({ default: module.PerfOverlay })),
)

function perfReadoutEnabled(): boolean {
  return (
    import.meta.env.DEV ||
    new URLSearchParams(window.location.search).get('perf') === '1'
  )
}

export function PerfSamplerGate() {
  if (!perfReadoutEnabled()) return null
  return (
    <Suspense fallback={null}>
      <LazyPerfSampler />
    </Suspense>
  )
}

export function PerfOverlayGate() {
  if (!perfReadoutEnabled()) return null
  return (
    <Suspense fallback={null}>
      <LazyPerfOverlay />
    </Suspense>
  )
}
