export type ModelClip = {
  readonly name: string
  readonly durationSeconds: number
}

type ModelAsset = {
  readonly id: string
  readonly path: `/models/${string}.glb`
  readonly triangleBudget: number
  readonly scale: number
  readonly offset: readonly [number, number, number]
  readonly clips: readonly ModelClip[]
}

const asset = <const T extends ModelAsset>(definition: T): T => definition

export const MODEL_ASSETS = {
  hero: asset({
    id: 'hero',
    path: '/models/hero.glb',
    triangleBudget: 3_000,
    scale: 1,
    offset: [0, -0.9, 0],
    clips: [
      { name: 'idle', durationSeconds: 2 },
      { name: 'run', durationSeconds: 0.7 },
      { name: 'dodge', durationSeconds: 0.45 },
      { name: 'strike1', durationSeconds: 0.5 },
      { name: 'strike2', durationSeconds: 0.5 },
      { name: 'strike3', durationSeconds: 0.64 },
      { name: 'cast', durationSeconds: 0.5 },
      { name: 'recall', durationSeconds: 0.55 },
      { name: 'heelstonePass', durationSeconds: 1.2 },
    ],
  }),
  roadBrigand: asset({
    id: 'roadBrigand',
    path: '/models/roadBrigand.glb',
    triangleBudget: 2_500,
    scale: 1,
    offset: [0, -0.9, 0],
    clips: [
      { name: 'idle', durationSeconds: 2 },
      { name: 'walk', durationSeconds: 0.8 },
      { name: 'attack', durationSeconds: 1.1 },
      { name: 'stagger', durationSeconds: 0.4 },
      { name: 'death', durationSeconds: 1 },
    ],
  }),
  brigandArcher: asset({
    id: 'brigandArcher',
    path: '/models/brigandArcher.glb',
    triangleBudget: 2_500,
    scale: 1,
    offset: [0, -0.9, 0],
    clips: [
      { name: 'idle', durationSeconds: 2 },
      { name: 'walk', durationSeconds: 0.8 },
      { name: 'draw', durationSeconds: 0.6 },
      { name: 'death', durationSeconds: 1 },
    ],
  }),
  cliffHound: asset({
    id: 'cliffHound',
    path: '/models/cliffHound.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, -0.35, 0],
    clips: [
      { name: 'idle', durationSeconds: 1.6 },
      { name: 'run', durationSeconds: 0.55 },
      { name: 'bite', durationSeconds: 0.8 },
      { name: 'death', durationSeconds: 1 },
    ],
  }),
  hollen: asset({
    id: 'hollen',
    path: '/models/hollen.glb',
    triangleBudget: 2_500,
    scale: 1,
    offset: [0, -0.9, 0],
    clips: [
      { name: 'idle', durationSeconds: 2 },
      { name: 'talk', durationSeconds: 1.5 },
    ],
  }),
  waystationShelter: asset({
    id: 'waystationShelter',
    path: '/models/waystationShelter.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  waterBarrel: asset({
    id: 'waterBarrel',
    path: '/models/waterBarrel.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  cart: asset({
    id: 'cart',
    path: '/models/cart.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  tent: asset({
    id: 'tent',
    path: '/models/tent.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  campFire: asset({
    id: 'campFire',
    path: '/models/campFire.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  lookout: asset({
    id: 'lookout',
    path: '/models/lookout.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  ruinFramePost: asset({
    id: 'ruinFramePost',
    path: '/models/ruinFramePost.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  ruinLintel: asset({
    id: 'ruinLintel',
    path: '/models/ruinLintel.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  porticoPillar: asset({
    id: 'porticoPillar',
    path: '/models/porticoPillar.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  ropeRailPost: asset({
    id: 'ropeRailPost',
    path: '/models/ropeRailPost.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  frameShelterKey: asset({
    id: 'frameShelterKey',
    path: '/models/frameShelterKey.glb',
    triangleBudget: 1_500,
    scale: 0.25,
    offset: [0, 0, 0],
    clips: [],
  }),
  practiceRail: asset({
    id: 'practiceRail',
    path: '/models/practiceRail.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  targetPost: asset({
    id: 'targetPost',
    path: '/models/targetPost.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  snagPost: asset({
    id: 'snagPost',
    path: '/models/snagPost.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  hollowGate: asset({
    id: 'hollowGate',
    path: '/models/hollowGate.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
  tassel: asset({
    id: 'tassel',
    path: '/models/tassel.glb',
    triangleBudget: 1_500,
    scale: 1,
    offset: [0, 0, 0],
    clips: [],
  }),
} as const satisfies Record<string, ModelAsset>

export type ModelId = keyof typeof MODEL_ASSETS
