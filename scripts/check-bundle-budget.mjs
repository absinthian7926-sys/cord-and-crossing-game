import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLE_BUDGETS, checkBundleBudget } from './bundleBudget.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const MANIFEST_PATH = join(DIST, '.vite', 'manifest.json')
const PUBLIC_MODELS = join(ROOT, 'public', 'models')
const HOLLOW_ONLY_MODELS = new Set([
  'practiceRail.glb',
  'targetPost.glb',
  'snagPost.glb',
  'hollowGate.glb',
])

function gzipBytes(path) {
  return gzipSync(readFileSync(path)).byteLength
}

function listGlbs(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listGlbs(path)
    return entry.name.endsWith('.glb') ? [path] : []
  })
}

function collectStaticManifestKeys(manifest, key, collected) {
  if (collected.has(key)) return
  collected.add(key)
  const item = manifest[key]
  for (const importedKey of item.imports ?? [])
    collectStaticManifestKeys(manifest, importedKey, collected)
}

function manifestFiles(manifest, keys) {
  const files = new Set()
  for (const key of keys) {
    const item = manifest[key]
    files.add(item.file)
    for (const css of item.css ?? []) files.add(css)
    for (const asset of item.assets ?? []) files.add(asset)
  }
  return files
}

function matchingDynamicGzipBytes(manifest, pattern, excludedKeys) {
  const keys = new Set()
  for (const [key, item] of Object.entries(manifest)) {
    const identity = `${key} ${item.name ?? ''} ${item.file}`
    if (item.isDynamicEntry && pattern.test(identity))
      collectStaticManifestKeys(manifest, key, keys)
    pattern.lastIndex = 0
  }
  for (const key of excludedKeys) keys.delete(key)
  if (keys.size === 0) return null
  const files = manifestFiles(manifest, keys)
  let bytes = 0
  for (const file of files) bytes += gzipBytes(join(DIST, file))
  return bytes
}

function formatBytes(bytes) {
  return bytes === null ? 'not present' : `${(bytes / 1_000).toFixed(2)} kB`
}

if (!existsSync(MANIFEST_PATH)) {
  throw new Error('Vite manifest is missing. Run vite build before this check.')
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
const entryRecord = Object.entries(manifest).find(([, item]) => item.isEntry)
if (!entryRecord) throw new Error('Vite manifest has no entry chunk.')
const [entryKey, entry] = entryRecord

const staticKeys = new Set()
collectStaticManifestKeys(manifest, entryKey, staticKeys)
const initialFiles = manifestFiles(manifest, staticKeys)
initialFiles.add('index.html')

const modelPaths = listGlbs(PUBLIC_MODELS)
const models = modelPaths.map((path) => ({
  path: relative(ROOT, path).replaceAll('\\', '/'),
  bytes: statSync(path).size,
}))
for (const model of models) {
  if (!HOLLOW_ONLY_MODELS.has(basename(model.path))) {
    const builtPath = join(DIST, model.path.replace(/^public\//, ''))
    if (existsSync(builtPath)) initialFiles.add(relative(DIST, builtPath))
  }
}

let initialDownloadGzipBytes = 0
for (const file of initialFiles) {
  const path = join(DIST, file)
  if (existsSync(path)) initialDownloadGzipBytes += gzipBytes(path)
}

const measurements = {
  mainEntryGzipBytes: gzipBytes(join(DIST, entry.file)),
  audioEngineGzipBytes: matchingDynamicGzipBytes(
    manifest,
    /(?:game[/\\]audio[/\\]audio\.ts|audio(?:Engine)?[-.])/i,
    staticKeys,
  ),
  perfReadoutGzipBytes: matchingDynamicGzipBytes(
    manifest,
    /(?:Perf(?:Overlay|Readout|Sampler)|perf(?:Readout|Overlay|Sampler))/i,
    staticKeys,
  ),
  postProcessingGzipBytes: matchingDynamicGzipBytes(
    manifest,
    /(?:PostEffects|post-processing|postprocessing)/i,
    staticKeys,
  ),
  hollowChunkGzipBytes: matchingDynamicGzipBytes(
    manifest,
    /Hollow/i,
    staticKeys,
  ),
  initialDownloadGzipBytes,
  models,
}

const modelTotal = models.reduce((total, model) => total + model.bytes, 0)
const largestModel = models.reduce(
  (largest, model) => (model.bytes > largest.bytes ? model : largest),
  { path: 'none', bytes: 0 },
)
const rows = [
  [
    'Main entry JS',
    measurements.mainEntryGzipBytes,
    BUNDLE_BUDGETS.mainEntryGzipBytes,
  ],
  [
    'Audio engine chunk',
    measurements.audioEngineGzipBytes,
    BUNDLE_BUDGETS.audioEngineGzipBytes,
  ],
  [
    'Perf readout chunk',
    measurements.perfReadoutGzipBytes,
    BUNDLE_BUDGETS.perfReadoutGzipBytes,
  ],
  [
    'Post-processing chunk',
    measurements.postProcessingGzipBytes,
    BUNDLE_BUDGETS.postProcessingGzipBytes,
  ],
  [
    'Hollow chunk',
    measurements.hollowChunkGzipBytes,
    BUNDLE_BUDGETS.hollowChunkGzipBytes,
  ],
  ['All GLB models', modelTotal, BUNDLE_BUDGETS.allModelsBytes],
  ['Largest GLB model', largestModel.bytes, BUNDLE_BUDGETS.singleModelBytes],
  [
    'Initial download',
    measurements.initialDownloadGzipBytes,
    BUNDLE_BUDGETS.initialDownloadGzipBytes,
  ],
]

console.log('\nBundle budget')
console.log(
  'Asset                         Actual          Limit          Result',
)
for (const [label, actual, limit] of rows) {
  const requiredChunk =
    label === 'Audio engine chunk' ||
    label === 'Perf readout chunk' ||
    label === 'Post-processing chunk'
  const result =
    (actual !== null && actual <= limit) || (actual === null && !requiredChunk)
      ? 'PASS'
      : 'FAIL'
  console.log(
    `${label.padEnd(29)} ${formatBytes(actual).padStart(13)} ${formatBytes(limit).padStart(13)} ${result}`,
  )
}
if (models.length > 0)
  console.log(
    `Largest model: ${largestModel.path} (${formatBytes(largestModel.bytes)})`,
  )

const result = checkBundleBudget(measurements)
if (!result.passed) {
  for (const failure of result.failures) {
    console.error(
      `Budget exceeded: ${failure.label} is ${formatBytes(failure.actualBytes)}, limit ${formatBytes(failure.limitBytes)}.`,
    )
  }
  process.exitCode = 1
}
