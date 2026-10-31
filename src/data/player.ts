export const PLAYER = {
  health: { max: 100, regenerationPerSecond: 4, regenerationDelaySeconds: 6 },
  stamina: {
    max: 100,
    runCostPerSecond: 8,
    dodgeCost: 25,
    regenerationPerSecond: 20,
    regenerationDelaySeconds: 1,
  },
  movement: {
    walkSpeed: 2.2,
    runSpeed: 5.5,
    jumpHeight: 1.1,
    gravity: 9.81,
    dodgeDistance: 4,
    dodgeDurationSeconds: 0.45,
    dodgeInvulnerabilitySeconds: 0.3,
    dodgeCooldownSeconds: 0.8,
  },
  collider: { radius: 0.36, halfHeight: 0.54 },
  camera: {
    shoulderOffset: 0.6,
    distance: 4.5,
    minimumDistance: 2.5,
    maximumDistance: 7,
  },
} as const
