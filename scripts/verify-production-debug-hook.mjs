import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const distDirectory = resolve(process.cwd(), 'dist')
const debugHook = Buffer.from('__CORD_AND_CROSSING_DEBUG__')
const pendingDirectories = [distDirectory]
const matches = []

while (pendingDirectories.length > 0) {
  const directory = pendingDirectories.pop()
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      pendingDirectories.push(path)
    } else if ((await readFile(path)).includes(debugHook)) {
      matches.push(path)
    }
  }
}

if (matches.length > 0) {
  console.error(
    `Production debug hook found in built files: ${matches.join(', ')}`,
  )
  process.exitCode = 1
} else {
  console.log('Production build contains no debug hook.')
}
