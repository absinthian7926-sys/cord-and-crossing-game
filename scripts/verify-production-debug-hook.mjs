import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const distDirectory = resolve(process.cwd(), 'dist')
const forbiddenMarkers = [
  '__CORD_AND_CROSSING_DEBUG__',
  'CORD_DEBUG_ONLY_INVULNERABLE',
  'CORD_DEBUG_ONLY_GRANT_EFFECT',
  'CORD_DEBUG_ONLY_FORCE_CROSSING',
  'CORD_DEBUG_ONLY_SCENE_LOAD',
  'CORD_DEBUG_ONLY_PORTICO_VIEW',
  'CORD_DEBUG_ONLY_DROP_BLADE',
  'CORD_DEBUG_ONLY_GET_SETTINGS',
  'CORD_DEBUG_ONLY_SET_SETTING',
  'CORD_DEBUG_ONLY_PAUSE',
  'CORD_DEBUG_ONLY_GET_PAUSE',
  'CORD_DEBUG_ONLY_GET_QUALITY',
  'CORD_DEBUG_ONLY_GET_AUDIO',
  'CORD_DEBUG_ONLY_GET_COMPASS',
  'CORD_DEBUG_ONLY_GET_ANIMATION',
  'CORD_DEBUG_ONLY_GET_FEEL',
  'CORD_DEBUG_ONLY_FORCE_FPS',
  'CORD_DEBUG_ONLY_GET_LOADED_MODELS',
  'CORD_DEBUG_ONLY_FORCE_BLOCK_FEEDBACK',
  'CORD_DEBUG_ONLY_RESET_PERF',
  'CORD_DEBUG_ONLY_SET_POST',
  'CORD_DEBUG_ONLY_PREPARE_HOLLOW',
].map((marker) => Buffer.from(marker))
const pendingDirectories = [distDirectory]
const matches = []

while (pendingDirectories.length > 0) {
  const directory = pendingDirectories.pop()
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      pendingDirectories.push(path)
    } else {
      const content = await readFile(path)
      for (const marker of forbiddenMarkers) {
        if (content.includes(marker)) matches.push(`${path} (${marker})`)
      }
    }
  }
}

if (matches.length > 0) {
  console.error(
    `Production debug-only marker found in built files: ${matches.join(', ')}`,
  )
  process.exitCode = 1
} else {
  console.log('Production build contains no debug-only markers.')
}
