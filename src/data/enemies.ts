export const ENEMY_TYPES = {
  roadBrigand: {
    displayName: 'Road brigand',
    maxHealth: 60,
    damage: 12,
    attackCadenceSeconds: 1.1,
    attackWindupSeconds: 0.5,
    moveSpeed: 4.2,
    attackRange: 1.8,
    collider: { radius: 0.4, height: 1.8 },
    color: '#655c50',
    cordCutter: false,
    light: false,
    buckler: {
      blockChance: 0.5,
      frontalConeDegrees: 90,
    },
  },
  brigandArcher: {
    displayName: 'Brigand archer',
    maxHealth: 40,
    damage: 10,
    attackCadenceSeconds: 2.2,
    moveSpeed: 3.5,
    attackRange: 30,
    collider: { radius: 0.4, height: 1.8 },
    color: '#8b8170',
    cordCutter: false,
    light: true,
    keepAway: { minimumDistance: 12, maximumDistance: 25 },
    drawSeconds: 0.6,
    fleeHealthFraction: 0.15,
  },
  cliffHound: {
    displayName: 'Cliff hound',
    maxHealth: 35,
    damage: 8,
    attackCadenceSeconds: 0.8,
    attackWindupSeconds: 0.35,
    moveSpeed: 7,
    attackRange: 1.4,
    collider: { radius: 0.3, length: 0.9 },
    color: '#665e4d',
    cordCutter: true,
    light: true,
    cutterVolumeRadius: 0.38,
  },
} as const

export type EnemyType = keyof typeof ENEMY_TYPES

export const CAMP_LEADER = {
  // PLACEHOLDER: player-visible generic label for the quest variant.
  displayName: 'Camp leader',
  baseType: 'roadBrigand',
  maxHealth: 120,
  scale: 1.15,
  campOffset: [0, 4],
  minimumQuestStep: 2,
  respawns: false,
  // PLACEHOLDER: dyed cloth sash is the only bright accent.
  sashColor: '#9f493e',
} as const

export const ENEMY_VARIANTS = {
  standard: 'standard',
  campLeader: 'campLeader',
} as const

export type EnemyVariant = (typeof ENEMY_VARIANTS)[keyof typeof ENEMY_VARIANTS]

export const ENEMY_AI = {
  aggroRadius: 18,
  leashRadius: 40,
  safeZoneRadius: 25,
  alertSeconds: 0.6,
  returnAnchorDistance: 1,
  playerDeathResetRadius: 40,
  patrolSpeedMultiplier: 0.5,
  patrolPointCount: [3, 4],
  patrolRadius: 15,
} as const

export const ENEMY_ARROW = {
  speed: 35,
  gravity: 9.81,
  hitRadius: 0.15,
  poolSize: 16,
  lifetimeSeconds: 2,
  maximumRange: 30,
  releaseHeight: 0.45,
} as const

export const ENEMY_PRESENTATION = {
  stagger: { angularFrequency: 80, maximumRotationRadians: 0.09 },
  meleeWindup: {
    tintColor: '#c9a46a',
    brigandSwordRaiseRadians: Math.PI * 0.5,
    houndCrouchScaleY: 0.65,
  },
  arrow: {
    width: 0.025,
    height: 0.025,
    length: 0.65,
    color: '#5e4b35',
    roughness: 0.9,
  },
  hound: {
    bodyCapSegments: 6,
    bodyRadialSegments: 10,
    bodyRoughness: 0.95,
    headPosition: [0, 0.08, -0.48],
    headRadius: 0.22,
    headLength: 0.42,
    headSegments: 6,
  },
  humanoid: {
    bodyCapSegments: 8,
    bodyRadialSegments: 12,
    bodyRoughness: 0.9,
  },
  roadBrigand: {
    swordPosition: [0.5, 0, 0],
    swordSize: [0.08, 1.05, 0.12],
    swordColor: '#6a6b68',
    swordMetalness: 0.45,
    shieldPosition: [-0.5, 0.1, 0],
    shieldRadius: 0.34,
    shieldDepth: 0.1,
    shieldSegments: 10,
    shieldColor: '#5d5a50',
    shieldMetalness: 0.35,
  },
  brigandArcher: {
    bowPosition: [0.46, 0.1, 0],
    bowRadius: 0.38,
    bowTubeRadius: 0.035,
    bowRadialSegments: 6,
    bowTubularSegments: 16,
    bowColor: '#7a6044',
    bowRoughness: 0.9,
    drawBarPositionY: 0.88,
    drawBarWidth: 0.7,
    drawBarHeight: 0.06,
    drawBarDepth: 0.06,
    drawBarColor: '#d2b984',
    drawBarMinimumScale: 0.02,
  },
  healthBar: {
    verticalOffset: 0.8,
    backgroundDepth: 0.01,
    backgroundWidth: 0.9,
    backgroundHeight: 0.1,
    backgroundColor: '#28251f',
    fillDepth: 0.02,
    fillWidth: 0.84,
    fillHeight: 0.065,
    fillColor: '#9f493e',
  },
} as const

export const ENEMY_SPAWNS = {
  camp: {
    anchor: [380, -240],
    spreadRadius: 30,
    roadBrigands: 6,
    brigandArchers: 3,
  },
  houndPacks: [
    { anchor: [25, -160], size: 3 },
    { anchor: [-20, -225], size: 2 },
  ],
  roadPatrol: {
    roadBrigands: 2,
    brigandArchers: 1,
    routeDistances: [150, 350],
  },
} as const

export const ENEMY_DEATH = {
  fallSeconds: 1,
  respawnSeconds: 300,
  respawnPlayerDistance: 40,
  healthBarSeconds: 4,
} as const

export const PLAYER_DEATH = {
  fadeSeconds: 1.5,
  spawn: [0, 8, 0],
  spawnInvulnerabilitySeconds: 2,
  respawnCordMode: 'InHand',
} as const

export const ENEMY_ATTACK = {
  castStaggerSeconds: 0.4,
  brigandComboStaggerHitIndex: 2,
  breaksGuardByDefault: false,
} as const
