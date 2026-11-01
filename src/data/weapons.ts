export const REACHBLADE = {
  maxCordLength: 6.5,
  close: {
    damage: [14, 14, 22],
    windupSeconds: [0.18, 0.18, 0.32],
    activeSeconds: [0.08, 0.08, 0.08],
    comboWindowSeconds: 0.5,
    arcDegrees: 100,
    reach: 1.6,
    staminaCost: [0, 0, 10],
  },
  cast: {
    windupSeconds: 0.25,
    travelSpeed: 22,
    damage: 26,
    staminaCost: 15,
    staggerSeconds: 0.4,
  },
  flatArc: {
    windupSeconds: 0.4,
    damage: 18,
    staminaCost: 20,
    arcDegrees: 140,
    minimumRadius: 3.5,
    maximumRadius: 5.5,
    maximumTargets: 3,
  },
  recall: {
    fullLengthSeconds: 0.55,
  },
  unarmedDamageMultiplier: 1.25,
  cut: {
    retieSeconds: 2,
    shoveDamage: 5,
  },
  stop: {
    doubleTapWindowSeconds: 0.3,
    pickupRadius: 0.8,
  },
  rope: {
    pointCount: 16,
    constraintIterations: 12,
    gravity: 9.81,
    damping: 0.985,
    groundHeight: 0.04,
    cutVisiblePoints: 5,
    collisionRadius: 0.12,
  },
  bladeHitRadius: 0.6,
  cutterVolumeRadius: 0.38,
} as const

export const TRAINING_DUMMIES = [
  { id: 'close', position: [0, 0.9, -3], cordCutter: false },
  { id: 'cast', position: [-1.25, 0.9, -5], cordCutter: false },
  { id: 'cutter', position: [2, 0.9, -8], cordCutter: true },
] as const
