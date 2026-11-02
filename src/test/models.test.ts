import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { describe, expect, it } from 'vitest'
import { MODEL_ASSETS } from '../data/models'

const root = resolve(import.meta.dirname, '../..')

async function loadModel(path: string) {
  await MeshoptDecoder.ready
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    .read(resolve(root, `public${path}`))
}

describe('Slice 1 model assets', () => {
  it('keeps every model and the complete set under its byte budget', () => {
    let totalBytes = 0
    for (const model of Object.values(MODEL_ASSETS)) {
      const bytes = statSync(resolve(root, `public${model.path}`)).size
      expect(bytes, model.id).toBeLessThanOrEqual(400_000)
      totalBytes += bytes
    }
    expect(totalBytes).toBeLessThanOrEqual(1_500_000)
  })

  it.each(Object.values(MODEL_ASSETS))(
    '$id parses and stays within its visual limits',
    async (model) => {
      const document = await loadModel(model.path)
      const rootDefinition = document.getRoot()
      let triangles = 0
      for (const mesh of rootDefinition.listMeshes()) {
        for (const primitive of mesh.listPrimitives()) {
          const indices = primitive.getIndices()
          const positions = primitive.getAttribute('POSITION')
          triangles += indices
            ? indices.getCount() / 3
            : (positions?.getCount() ?? 0) / 3
        }
      }
      expect(triangles).toBeLessThanOrEqual(model.triangleBudget)
      expect(rootDefinition.listMaterials().length).toBeLessThanOrEqual(4)
      expect(rootDefinition.listTextures()).toHaveLength(0)

      const clips = new Map(
        rootDefinition
          .listAnimations()
          .map((animation) => [animation.getName(), animation] as const),
      )
      expect([...clips.keys()].sort()).toEqual(
        model.clips.map((clip) => clip.name).sort(),
      )
      for (const expected of model.clips) {
        const clip = clips.get(expected.name)
        expect(clip, expected.name).toBeDefined()
        let duration = 0
        for (const sampler of clip?.listSamplers() ?? []) {
          const input = sampler.getInput()?.getArray()
          if (input && input.length > 0)
            duration = Math.max(duration, input[input.length - 1])
        }
        expect(duration, expected.name).toBeCloseTo(expected.durationSeconds, 3)
      }
    },
  )

  it('keeps the heelstone pass clip locked to the gameplay timer', () => {
    const clip = MODEL_ASSETS.hero.clips.find(
      (candidate) => candidate.name === 'heelstonePass',
    )
    expect(clip?.durationSeconds).toBeCloseTo(1.2, 3)
  })
})
