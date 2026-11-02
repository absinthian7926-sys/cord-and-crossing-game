// PLACEHOLDER Slice 1 game-feel settings. All values are GAME (NEW).
export const FEEL = {
  reduceMotion: {
    crossingFlashPeakOpacity: 0.35,
    transitionFadeSeconds: 0.3,
    shimmerSpeedMultiplier: 0.5,
  },
  animation: {
    crossfadeSeconds: 0.12,
    walkTimeScale: 0.4,
    movementEpsilon: 0.05,
    heelstonePassDurationSeconds: 1.2,
  },
  shake: {
    seed: 17,
    noiseFrequencyHz: 11,
    decayPerSecond: 1.6,
    maxOffsetMeters: 0.12,
    maxRollDegrees: 1.2,
    trauma: {
      playerHit: 0.35,
      closeStrikeThree: 0.15,
      carriedGuardBreak: 0.3,
      cordCut: 0.2,
      snagPull: 0.25,
      validCrossing: 0.2,
    },
  },
  hitFlash: {
    enemy: {
      color: '#f4ead7',
      mix: 0.6,
      holdSeconds: 0.08,
      returnSeconds: 0.06,
    },
    player: {
      color: '#9f493e',
      durationSeconds: 0.18,
      peakOpacity: 0.35,
      reducedMotionMultiplier: 0.5,
    },
    block: {
      color: '#c9a46a',
      durationSeconds: 0.08,
    },
  },
  footsteps: {
    walkIntervalSeconds: 0.5,
    runIntervalSeconds: 0.32,
    minimumMovementSpeed: 0.05,
    pitchVariation: 0.04,
    seed: 37,
    ruinShelfRadiusMeters: 42,
  },
  post: {
    mediumMaximumCostMilliseconds: 2,
    vignette: {
      offset: 0.3,
      darkness: 0.35,
    },
    colorGrade: {
      brightness: 0.02,
      contrast: 0.05,
      saturation: 0.04,
    },
    bloom: {
      intensity: 0.35,
      luminanceThreshold: 0.85,
      mipmapBlur: true,
    },
  },
} as const
