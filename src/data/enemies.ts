export const ENEMY_TYPES = {
  roadBrigand: {
    displayName: 'Road brigand',
    maxHealth: 60,
    damage: 12,
    attackCadenceSeconds: 1.1,
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

export const ENEMY_AI = {
  aggroRadius: 18,
  leashRadius: 40,
  safeZoneRadius: 25,
  alertSeconds: 0.6,
  returnAnchorDistance: 1,
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
