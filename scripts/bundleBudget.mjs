export const BUNDLE_BUDGETS = {
  mainEntryGzipBytes: 1_300_000,
  audioEngineGzipBytes: 40_000,
  perfReadoutGzipBytes: 10_000,
  postProcessingGzipBytes: 60_000,
  hollowChunkGzipBytes: 5_000_000,
  allModelsBytes: 1_500_000,
  singleModelBytes: 400_000,
  initialDownloadGzipBytes: 4_000_000,
}

const METRIC_BUDGETS = [
  {
    kind: 'main-entry',
    label: 'Main entry JS',
    measurement: 'mainEntryGzipBytes',
    budget: 'mainEntryGzipBytes',
  },
  {
    kind: 'audio-engine',
    label: 'Audio engine chunk',
    measurement: 'audioEngineGzipBytes',
    budget: 'audioEngineGzipBytes',
  },
  {
    kind: 'perf-readout',
    label: 'Perf readout chunk',
    measurement: 'perfReadoutGzipBytes',
    budget: 'perfReadoutGzipBytes',
  },
  {
    kind: 'post-processing',
    label: 'Post-processing chunk',
    measurement: 'postProcessingGzipBytes',
    budget: 'postProcessingGzipBytes',
  },
  {
    kind: 'hollow-chunk',
    label: 'Hollow chunk',
    measurement: 'hollowChunkGzipBytes',
    budget: 'hollowChunkGzipBytes',
  },
  {
    kind: 'initial-download',
    label: 'Initial download',
    measurement: 'initialDownloadGzipBytes',
    budget: 'initialDownloadGzipBytes',
  },
]

export function checkBundleBudget(measurements, budgets = BUNDLE_BUDGETS) {
  const failures = []

  for (const metric of METRIC_BUDGETS) {
    const actualBytes = measurements[metric.measurement]
    const limitBytes = budgets[metric.budget]
    if (actualBytes !== null && actualBytes > limitBytes) {
      failures.push({
        kind: metric.kind,
        label: metric.label,
        actualBytes,
        limitBytes,
      })
    }
  }

  let allModelsBytes = 0
  for (const model of measurements.models) {
    allModelsBytes += model.bytes
    if (model.bytes > budgets.singleModelBytes) {
      failures.push({
        kind: 'single-model',
        label: `Model ${model.path}`,
        asset: model.path,
        actualBytes: model.bytes,
        limitBytes: budgets.singleModelBytes,
      })
    }
  }
  if (allModelsBytes > budgets.allModelsBytes) {
    failures.push({
      kind: 'all-models',
      label: 'All GLB models',
      actualBytes: allModelsBytes,
      limitBytes: budgets.allModelsBytes,
    })
  }

  return { passed: failures.length === 0, failures }
}
