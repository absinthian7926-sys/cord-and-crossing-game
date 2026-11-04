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

  it('keeps the hero segmented and gives gameplay clips distinct poses', async () => {
    const document = await loadModel(MODEL_ASSETS.hero.path)
    const rootDefinition = document.getRoot()
    const nodeNames = new Set(
      rootDefinition.listNodes().map((node) => node.getName()),
    )
    for (const name of [
      'upperArm.L',
      'lowerArm.L',
      'hand.L',
      'upperArm.R',
      'lowerArm.R',
      'hand.R',
      'upperLeg.L',
      'lowerLeg.L',
      'foot.L',
      'upperLeg.R',
      'lowerLeg.R',
      'foot.R',
    ])
      expect(nodeNames.has(name), name).toBe(true)

    const signatures = new Set<string>()
    const clips = new Map(
      rootDefinition
        .listAnimations()
        .map((animation) => [animation.getName(), animation] as const),
    )
    for (const expected of MODEL_ASSETS.hero.clips) {
      const clip = clips.get(expected.name)!
      signatures.add(
        clip
          .listChannels()
          .map((channel) => {
            const values = channel.getSampler()?.getOutput()?.getArray()
            return `${channel.getTargetNode()?.getName()}:${channel.getTargetPath()}:${values ? [...values].join(',') : ''}`
          })
          .join('|'),
      )
    }
    expect(signatures.size).toBe(MODEL_ASSETS.hero.clips.length)

    const cast = clips.get('cast')!
    const castArm = cast
      .listChannels()
      .find((channel) => channel.getTargetNode()?.getName() === 'upperArm.R')!
    const castTimes = castArm.getSampler()?.getInput()?.getArray()
    const castValues = castArm.getSampler()?.getOutput()?.getArray()
    expect(castTimes ? [...castTimes] : []).toEqual([0, 0.25, 0.5])
    expect(castValues ? [...castValues.slice(-8, -4)] : []).toEqual(
      castValues ? [...castValues.slice(-4)] : [],
    )
    expect(
      clips
        .get('heelstonePass')!
        .listChannels()
        .some((channel) => channel.getTargetNode()?.getName() === 'lowerArm.L'),
    ).toBe(true)
  })

  it('merges static model parts by material to protect draw calls', async () => {
    for (const model of Object.values(MODEL_ASSETS).filter(
      (candidate) => candidate.clips.length === 0,
    )) {
      const document = await loadModel(model.path)
      const rootDefinition = document.getRoot()
      const primitiveCount = rootDefinition
        .listMeshes()
        .reduce((total, mesh) => total + mesh.listPrimitives().length, 0)
      expect(primitiveCount, model.id).toBeLessThanOrEqual(
        rootDefinition.listMaterials().length,
      )
    }
  })
})
