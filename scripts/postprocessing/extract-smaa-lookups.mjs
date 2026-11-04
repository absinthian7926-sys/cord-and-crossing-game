import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sourcePath = resolve(
  root,
  'node_modules',
  'postprocessing',
  'build',
  'index.js',
)
const outputDirectory = resolve(root, 'public', 'postprocessing')
const source = await readFile(sourcePath, 'utf8')

await mkdir(outputDirectory, { recursive: true })
for (const name of ['search', 'area']) {
  const pattern = new RegExp(
    `var ${name}ImageDataURL_default = "data:image/png;base64,([^"]+)"`,
  )
  const match = source.match(pattern)
  if (!match) throw new Error(`Could not find the SMAA ${name} lookup image.`)
  const image = Buffer.from(match[1], 'base64')
  if (image.subarray(1, 4).toString('ascii') !== 'PNG')
    throw new Error(`The SMAA ${name} lookup is not a PNG image.`)
  await writeFile(resolve(outputDirectory, `smaa-${name}.png`), image)
}

console.log(
  'Extracted SMAA lookup images from the installed postprocessing package.',
)
