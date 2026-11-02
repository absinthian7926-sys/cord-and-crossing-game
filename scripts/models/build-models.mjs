import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
  dedup,
  meshopt,
  prune,
  quantize,
  weld,
} from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { box, capsule, cone, cylinder, extrudedLeaf, torus } from './shapes.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUTPUT = resolve(ROOT, 'public/models')

const PALETTE = {
  cloth: '#6f665a',
  linen: '#b8aa82',
  skin: '#b99071',
  iron: '#45494a',
  wood: '#806b4d',
  stone: '#777873',
  rope: '#a48a5e',
  accent: '#9f493e',
  fire: '#d98245',
  hound: '#625b50',
}

const CHARACTER_CLIPS = {
  hero: [
    ['idle', 2],
    ['run', 0.7],
    ['dodge', 0.45],
    ['strike1', 0.5],
    ['strike2', 0.5],
    ['strike3', 0.64],
    ['cast', 0.5],
    ['recall', 0.55],
    ['heelstonePass', 1.2],
  ],
  roadBrigand: [
    ['idle', 2],
    ['walk', 0.8],
    ['attack', 1.1],
    ['stagger', 0.4],
    ['death', 1],
  ],
  brigandArcher: [
    ['idle', 2],
    ['walk', 0.8],
    ['draw', 0.6],
    ['death', 1],
  ],
  cliffHound: [
    ['idle', 1.6],
    ['run', 0.55],
    ['bite', 0.8],
    ['death', 1],
  ],
  hollen: [
    ['idle', 2],
    ['talk', 1.5],
  ],
}

const MODEL_NAMES = [
  'hero',
  'roadBrigand',
  'brigandArcher',
  'cliffHound',
  'hollen',
  'waystationShelter',
  'waterBarrel',
  'cart',
  'tent',
  'campFire',
  'lookout',
  'ruinFramePost',
  'ruinLintel',
  'porticoPillar',
  'ropeRailPost',
  'frameShelterKey',
  'practiceRail',
  'targetPost',
  'snagPost',
  'hollowGate',
  'tassel',
]

const SHAPES = {
  box: box(),
  capsule: capsule(),
  cone: cone(),
  cylinder: cylinder(),
  leaf: extrudedLeaf(),
  torus: torus(),
}

function hexToFactor(hex) {
  const value = Number.parseInt(hex.slice(1), 16)
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
    1,
  ]
}

function quaternionFromEuler(x = 0, y = 0, z = 0) {
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ]
}

function createBuilder(name) {
  const document = new Document()
  const buffer = document.createBuffer(`${name}-buffer`)
  const scene = document.createScene(name)
  const root = document.createNode(`${name}-root`)
  scene.addChild(root)
  const materialCache = new Map()
  const meshCache = new Map()

  function material(id) {
    if (materialCache.has(id)) return materialCache.get(id)
    const value = document
      .createMaterial(id)
      .setBaseColorFactor(hexToFactor(PALETTE[id]))
      .setRoughnessFactor(id === 'iron' ? 0.62 : 0.92)
      .setMetallicFactor(id === 'iron' ? 0.7 : 0)
    materialCache.set(id, value)
    return value
  }

  function mesh(shapeId, materialId) {
    const key = `${shapeId}:${materialId}`
    if (meshCache.has(key)) return meshCache.get(key)
    const geometry = SHAPES[shapeId]
    const position = document
      .createAccessor(`${key}-position`, buffer)
      .setType('VEC3')
      .setArray(geometry.positions)
    const normal = document
      .createAccessor(`${key}-normal`, buffer)
      .setType('VEC3')
      .setArray(geometry.normals)
    const indices = document
      .createAccessor(`${key}-indices`, buffer)
      .setType('SCALAR')
      .setArray(geometry.indices)
    const primitive = document
      .createPrimitive()
      .setAttribute('POSITION', position)
      .setAttribute('NORMAL', normal)
      .setIndices(indices)
      .setMaterial(material(materialId))
    const value = document.createMesh(key).addPrimitive(primitive)
    meshCache.set(key, value)
    return value
  }

  function part(
    parent,
    partName,
    shapeId,
    materialId,
    translation,
    scale,
    rotation = [0, 0, 0],
  ) {
    const node = document
      .createNode(partName)
      .setMesh(mesh(shapeId, materialId))
      .setTranslation(translation)
      .setScale(scale)
      .setRotation(quaternionFromEuler(...rotation))
    parent.addChild(node)
    return node
  }

  return { document, buffer, root, part }
}

function addAnimation(document, buffer, target, name, duration, index) {
  const times = document
    .createAccessor(`${name}-times`, buffer)
    .setType('SCALAR')
    .setArray(new Float32Array([0, duration * 0.5, duration]))
  const amount = 0.08 + (index % 4) * 0.035
  const values = document
    .createAccessor(`${name}-rotation`, buffer)
    .setType('VEC4')
    .setArray(
      new Float32Array([
        ...quaternionFromEuler(0, 0, 0),
        ...quaternionFromEuler(0, amount, index % 2 === 0 ? amount : -amount),
        ...quaternionFromEuler(0, 0, 0),
      ]),
    )
  const sampler = document
    .createAnimationSampler(`${name}-sampler`)
    .setInput(times)
    .setOutput(values)
    .setInterpolation('LINEAR')
  const channel = document
    .createAnimationChannel(`${name}-channel`)
    .setTargetNode(target)
    .setTargetPath('rotation')
    .setSampler(sampler)
  document.createAnimation(name).addSampler(sampler).addChannel(channel)
}

function buildHuman(name, role) {
  const builder = createBuilder(name)
  const { root, part } = builder
  const coat = role === 'hollen' ? 'linen' : 'cloth'
  const pelvis = part(
    root,
    'pelvis',
    'box',
    coat,
    [0, 0.92, 0],
    [0.42, 0.28, 0.26],
  )
  part(pelvis, 'torso', 'box', coat, [0, 0.54, 0], [0.64, 0.8, 0.34])
  part(pelvis, 'head', 'capsule', 'skin', [0, 1.18, 0], [0.8, 0.8, 0.8])
  for (const side of [-1, 1]) {
    const upperArm = part(
      pelvis,
      side < 0 ? 'arm.L' : 'arm.R',
      'capsule',
      coat,
      [side * 0.47, 0.58, 0],
      [0.55, 0.78, 0.55],
      [0, 0, side * 0.08],
    )
    part(
      upperArm,
      side < 0 ? 'hand.L' : 'hand.R',
      'capsule',
      'skin',
      [0, -0.5, 0],
      [0.45, 0.48, 0.45],
    )
    const leg = part(
      pelvis,
      side < 0 ? 'leg.L' : 'leg.R',
      'capsule',
      'cloth',
      [side * 0.19, -0.52, 0],
      [0.62, 1.12, 0.62],
    )
    part(
      leg,
      side < 0 ? 'foot.L' : 'foot.R',
      'box',
      'iron',
      [0, -0.54, 0.11],
      [0.24, 0.18, 0.42],
    )
  }
  if (role === 'brigand') {
    part(
      pelvis,
      'sword',
      'leaf',
      'iron',
      [0.67, 0.47, 0],
      [0.62, 1.05, 0.45],
      [0, 0, -0.25],
    )
    part(
      pelvis,
      'buckler',
      'cylinder',
      'iron',
      [-0.68, 0.45, 0],
      [0.62, 0.1, 0.62],
      [Math.PI / 2, 0, 0],
    )
    part(
      pelvis,
      'leaderSash',
      'box',
      'accent',
      [0, 0.64, 0.19],
      [0.72, 0.12, 0.04],
      [0, 0, -0.3],
    )
  } else if (role === 'archer') {
    part(
      pelvis,
      'shortBow',
      'torus',
      'wood',
      [0.62, 0.5, 0],
      [0.45, 0.62, 0.2],
      [0, 0, Math.PI / 2],
    )
  } else if (role === 'hero') {
    part(
      pelvis,
      'lineCoil',
      'torus',
      'rope',
      [-0.38, 0.82, -0.14],
      [0.4, 0.4, 0.2],
      [Math.PI / 2, 0, 0],
    )
    part(
      pelvis,
      'reachblade',
      'leaf',
      'iron',
      [0.52, 0.28, 0.1],
      [0.38, 0.66, 0.3],
      [0, 0, -0.5],
    )
  }
  for (const [index, [clip, duration]] of CHARACTER_CLIPS[name].entries())
    addAnimation(
      builder.document,
      builder.buffer,
      pelvis,
      clip,
      duration,
      index,
    )
  return builder.document
}

function buildHound() {
  const builder = createBuilder('cliffHound')
  const { root, part } = builder
  const body = part(
    root,
    'body',
    'capsule',
    'hound',
    [0, 0.48, 0],
    [1.45, 0.84, 0.72],
    [0, 0, Math.PI / 2],
  )
  part(
    body,
    'head',
    'capsule',
    'hound',
    [0.62, 0.12, 0],
    [0.82, 0.68, 0.68],
    [0, 0, -Math.PI / 2],
  )
  part(
    body,
    'muzzle',
    'cone',
    'hound',
    [0.93, 0.06, 0],
    [0.25, 0.4, 0.25],
    [0, 0, -Math.PI / 2],
  )
  for (const side of [-1, 1]) {
    part(
      body,
      `frontLeg.${side}`,
      'capsule',
      'hound',
      [0.38, -0.42, side * 0.23],
      [0.35, 0.75, 0.35],
    )
    part(
      body,
      `backLeg.${side}`,
      'capsule',
      'hound',
      [-0.4, -0.42, side * 0.23],
      [0.35, 0.75, 0.35],
    )
  }
  for (const [index, [clip, duration]] of CHARACTER_CLIPS.cliffHound.entries())
    addAnimation(builder.document, builder.buffer, body, clip, duration, index)
  return builder.document
}

function buildProp(name) {
  const b = createBuilder(name)
  const p = b.part
  const r = b.root
  switch (name) {
    case 'waystationShelter':
      p(r, 'roof', 'box', 'wood', [0, 2.8, 0], [8, 0.25, 5])
      for (const x of [-3.6, 3.6])
        for (const z of [-2.1, 2.1])
          p(
            r,
            `post-${x}-${z}`,
            'cylinder',
            'wood',
            [x, 1.4, z],
            [0.28, 2.8, 0.28],
          )
      break
    case 'waterBarrel':
      p(r, 'barrel', 'cylinder', 'wood', [0, 0.6, 0], [1, 1.2, 1])
      p(
        r,
        'ringTop',
        'torus',
        'iron',
        [0, 1.02, 0],
        [0.62, 0.62, 0.62],
        [Math.PI / 2, 0, 0],
      )
      p(
        r,
        'ringBottom',
        'torus',
        'iron',
        [0, 0.18, 0],
        [0.62, 0.62, 0.62],
        [Math.PI / 2, 0, 0],
      )
      break
    case 'cart':
      p(r, 'bed', 'box', 'wood', [0, 0.7, 0], [3.2, 0.7, 1.6])
      for (const x of [-1.1, 1.1])
        for (const z of [-0.92, 0.92])
          p(
            r,
            `wheel-${x}-${z}`,
            'cylinder',
            'wood',
            [x, 0.48, z],
            [0.96, 0.22, 0.96],
            [Math.PI / 2, 0, 0],
          )
      break
    case 'tent':
      p(r, 'canvas', 'cone', 'cloth', [0, 1.6, 0], [3, 3.2, 2])
      p(
        r,
        'ridge',
        'cylinder',
        'wood',
        [0, 2.8, 0],
        [0.18, 4, 0.18],
        [0, 0, Math.PI / 2],
      )
      break
    case 'campFire':
      for (const z of [-0.22, 0.22])
        p(
          r,
          `log-${z}`,
          'cylinder',
          'wood',
          [0, 0.18, z],
          [0.24, 1.2, 0.24],
          [0, 0, Math.PI / 2],
        )
      p(r, 'flame', 'cone', 'fire', [0, 0.65, 0], [0.65, 1.2, 0.65])
      break
    case 'lookout':
      p(r, 'platform', 'box', 'wood', [0, 4.8, 0], [3, 0.25, 3])
      for (const x of [-1.2, 1.2])
        for (const z of [-1.2, 1.2])
          p(
            r,
            `leg-${x}-${z}`,
            'cylinder',
            'wood',
            [x, 2.4, z],
            [0.22, 4.8, 0.22],
          )
      break
    case 'ruinFramePost':
      p(r, 'stonePost', 'box', 'stone', [0, 2, 0], [1.4, 4, 1.4])
      break
    case 'ruinLintel':
      p(r, 'stoneLintel', 'box', 'stone', [0, 0, 0], [13, 0.8, 1.4])
      break
    case 'porticoPillar':
      p(r, 'pillar', 'box', 'stone', [0, 1.6, 0], [0.7, 3.2, 0.7])
      p(
        r,
        'ironHolder',
        'torus',
        'iron',
        [0, 2.35, 0.37],
        [0.25, 0.25, 0.1],
        [Math.PI / 2, 0, 0],
      )
      break
    case 'ropeRailPost':
      p(r, 'post', 'cylinder', 'wood', [0, 0.55, 0], [0.2, 1.1, 0.2])
      p(
        r,
        'ring',
        'torus',
        'iron',
        [0, 0.9, 0],
        [0.2, 0.2, 0.08],
        [Math.PI / 2, 0, 0],
      )
      break
    case 'frameShelterKey':
      p(
        r,
        'ring',
        'torus',
        'iron',
        [0, 0, 0],
        [0.6, 0.6, 0.18],
        [Math.PI / 2, 0, 0],
      )
      p(r, 'shaft', 'box', 'iron', [0.52, 0, 0], [0.7, 0.1, 0.1])
      p(r, 'tooth', 'box', 'iron', [0.82, -0.12, 0], [0.1, 0.28, 0.1])
      break
    case 'practiceRail':
      for (const x of [-1.5, 1.5])
        p(r, `post-${x}`, 'cylinder', 'wood', [x, 0.75, 0], [0.22, 1.5, 0.22])
      p(
        r,
        'rope',
        'cylinder',
        'rope',
        [0, 1.25, 0],
        [0.09, 3, 0.09],
        [0, 0, Math.PI / 2],
      )
      break
    case 'targetPost':
      p(r, 'post', 'cylinder', 'wood', [0, 1, 0], [0.28, 2, 0.28])
      p(
        r,
        'target',
        'cylinder',
        'cloth',
        [0, 1.7, 0],
        [0.9, 0.12, 0.9],
        [Math.PI / 2, 0, 0],
      )
      break
    case 'snagPost':
      p(r, 'post', 'cylinder', 'wood', [0, 0.8, 0], [0.5, 1.6, 0.5])
      p(
        r,
        'ring',
        'torus',
        'iron',
        [0, 1.35, 0],
        [0.55, 0.55, 0.18],
        [Math.PI / 2, 0, 0],
      )
      break
    case 'hollowGate':
      for (const x of [-1.2, 0, 1.2])
        p(r, `bar-${x}`, 'box', 'stone', [x, 1.5, 0], [0.35, 3, 0.6])
      p(r, 'crossbar', 'box', 'stone', [0, 2.5, 0], [3, 0.3, 0.6])
      break
    case 'tassel':
      p(r, 'clothTassel', 'box', 'accent', [0, -0.125, 0], [0.06, 0.25, 0.025])
      break
    default:
      throw new Error(`Unknown model ${name}`)
  }
  return b.document
}

function buildModel(name) {
  if (name === 'hero') return buildHuman(name, 'hero')
  if (name === 'roadBrigand') return buildHuman(name, 'brigand')
  if (name === 'brigandArcher') return buildHuman(name, 'archer')
  if (name === 'hollen') return buildHuman(name, 'hollen')
  if (name === 'cliffHound') return buildHound()
  return buildProp(name)
}

await mkdir(OUTPUT, { recursive: true })
await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

for (const name of MODEL_NAMES) {
  const document = buildModel(name)
  await document.transform(
    weld(),
    dedup(),
    prune(),
    quantize({ quantizePosition: 14, quantizeNormal: 10 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )
  await io.write(resolve(OUTPUT, `${name}.glb`), document)
  console.log(`built public/models/${name}.glb`)
}
