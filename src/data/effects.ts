export const EFFECTS = {
  maximumActive: 2,
  strength: {
    id: 'Strength',
    durationSeconds: 180, // PLACEHOLDER pending Ryan (GDD 18 Q2)
    returnCrossingGrantsEffect: false, // PLACEHOLDER pending Ryan (GDD 18 Q2)
    closeDamageMultiplier: 1.35,
    castPullForceMultiplier: 2,
    staggerDurationMultiplier: 1.5,
    carriedCastDamageMultiplier: 1.35,
    carriedCastBreaksGuard: true,
  },
  heelstonePass: {
    durationSeconds: 1.2,
  },
} as const

export type StrengthConfig = typeof EFFECTS.strength
