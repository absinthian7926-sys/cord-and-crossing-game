export type BundleBudgetKey =
  | 'mainEntryGzipBytes'
  | 'audioEngineGzipBytes'
  | 'perfReadoutGzipBytes'
  | 'postProcessingGzipBytes'
  | 'hollowChunkGzipBytes'
  | 'allModelsBytes'
  | 'singleModelBytes'
  | 'initialDownloadGzipBytes'

export type BundleMeasurements = {
  mainEntryGzipBytes: number
  audioEngineGzipBytes: number | null
  perfReadoutGzipBytes: number | null
  postProcessingGzipBytes: number | null
  hollowChunkGzipBytes: number | null
  initialDownloadGzipBytes: number
  models: Array<{ path: string; bytes: number }>
}

export type BundleBudgetFailure = {
  kind: string
  label: string
  asset?: string
  actualBytes: number
  limitBytes: number
}

export const BUNDLE_BUDGETS: Readonly<Record<BundleBudgetKey, number>>

export function checkBundleBudget(
  measurements: BundleMeasurements,
  budgets?: Readonly<Record<BundleBudgetKey, number>>,
): { passed: boolean; failures: BundleBudgetFailure[] }
