import { describe, expect, it } from 'vitest'
import {
  BUNDLE_BUDGETS,
  checkBundleBudget,
  type BundleMeasurements,
} from '../../scripts/bundleBudget.mjs'

const passingMeasurements = (): BundleMeasurements => ({
  mainEntryGzipBytes: 1_200_000,
  audioEngineGzipBytes: 39_000,
  perfReadoutGzipBytes: 9_000,
  postProcessingGzipBytes: 59_000,
  hollowChunkGzipBytes: 4_900_000,
  initialDownloadGzipBytes: 3_900_000,
  models: [
    { path: 'public/models/hero.glb', bytes: 390_000 },
    { path: 'public/models/hollen.glb', bytes: 200_000 },
  ],
})

describe('bundle budget', () => {
  it('passes values at or below every limit and allows absent future chunks', () => {
    const exact = passingMeasurements()
    exact.mainEntryGzipBytes = BUNDLE_BUDGETS.mainEntryGzipBytes
    exact.audioEngineGzipBytes = BUNDLE_BUDGETS.audioEngineGzipBytes
    exact.perfReadoutGzipBytes = BUNDLE_BUDGETS.perfReadoutGzipBytes
    exact.postProcessingGzipBytes = BUNDLE_BUDGETS.postProcessingGzipBytes
    exact.hollowChunkGzipBytes = BUNDLE_BUDGETS.hollowChunkGzipBytes
    exact.initialDownloadGzipBytes = BUNDLE_BUDGETS.initialDownloadGzipBytes
    exact.models = [
      {
        path: 'public/models/hero.glb',
        bytes: BUNDLE_BUDGETS.singleModelBytes,
      },
    ]
    expect(checkBundleBudget(exact)).toEqual({ passed: true, failures: [] })

    const absent = passingMeasurements()
    absent.audioEngineGzipBytes = null
    absent.perfReadoutGzipBytes = null
    absent.postProcessingGzipBytes = null
    absent.hollowChunkGzipBytes = null
    absent.models = []
    expect(checkBundleBudget(absent)).toEqual({ passed: true, failures: [] })
  })

  it.each([
    ['main-entry', 'mainEntryGzipBytes', 'mainEntryGzipBytes'],
    ['audio-engine', 'audioEngineGzipBytes', 'audioEngineGzipBytes'],
    ['perf-readout', 'perfReadoutGzipBytes', 'perfReadoutGzipBytes'],
    ['post-processing', 'postProcessingGzipBytes', 'postProcessingGzipBytes'],
    ['hollow-chunk', 'hollowChunkGzipBytes', 'hollowChunkGzipBytes'],
    [
      'initial-download',
      'initialDownloadGzipBytes',
      'initialDownloadGzipBytes',
    ],
  ] as const)('reports a %s failure', (kind, measurementKey, budgetKey) => {
    const measurements = passingMeasurements()
    measurements[measurementKey] = BUNDLE_BUDGETS[budgetKey] + 1
    const result = checkBundleBudget(measurements)
    expect(result.passed).toBe(false)
    expect(result.failures).toEqual([
      expect.objectContaining({
        kind,
        actualBytes: BUNDLE_BUDGETS[budgetKey] + 1,
        limitBytes: BUNDLE_BUDGETS[budgetKey],
      }),
    ])
  })

  it('reports an oversized individual GLB', () => {
    const measurements = passingMeasurements()
    measurements.models = [
      {
        path: 'public/models/hero.glb',
        bytes: BUNDLE_BUDGETS.singleModelBytes + 1,
      },
    ]
    expect(checkBundleBudget(measurements)).toEqual({
      passed: false,
      failures: [
        expect.objectContaining({
          kind: 'single-model',
          asset: 'public/models/hero.glb',
        }),
      ],
    })
  })

  it('reports the total GLB budget independently', () => {
    const measurements = passingMeasurements()
    measurements.models = [
      { path: 'a.glb', bytes: 390_000 },
      { path: 'b.glb', bytes: 390_000 },
      { path: 'c.glb', bytes: 390_000 },
      { path: 'd.glb', bytes: 390_000 },
    ]
    const result = checkBundleBudget(measurements)
    expect(result.passed).toBe(false)
    expect(result.failures).toEqual([
      expect.objectContaining({
        kind: 'all-models',
        actualBytes: 1_560_000,
        limitBytes: BUNDLE_BUDGETS.allModelsBytes,
      }),
    ])
  })
})
