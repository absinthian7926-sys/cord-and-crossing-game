import { SETTINGS } from '../../data/settings'
import { ZONE, type QualityLevel } from '../../data/zone'

export type QualityProfile = {
  readonly shadowMapSize: 1_024 | 2_048
  readonly scatterDensity: 0.5 | 1 | 1.5
  readonly drawDistance: 450 | 650 | 850
  readonly dpr: 1 | readonly [number, number]
}

export const QUALITY_PROFILES = {
  Low: {
    shadowMapSize: ZONE.lighting.shadowMapByQuality.Low,
    scatterDensity: ZONE.scatter.densityByQuality.Low,
    drawDistance: ZONE.drawDistanceByQuality.Low,
    dpr: SETTINGS.quality.dprByQuality.Low,
  },
  Medium: {
    shadowMapSize: ZONE.lighting.shadowMapByQuality.Medium,
    scatterDensity: ZONE.scatter.densityByQuality.Medium,
    drawDistance: ZONE.drawDistanceByQuality.Medium,
    dpr: SETTINGS.quality.dprByQuality.Medium,
  },
  High: {
    shadowMapSize: ZONE.lighting.shadowMapByQuality.High,
    scatterDensity: ZONE.scatter.densityByQuality.High,
    drawDistance: ZONE.drawDistanceByQuality.High,
    dpr: SETTINGS.quality.dprByQuality.High,
  },
} as const satisfies Record<QualityLevel, QualityProfile>

export function qualityProfile(quality: QualityLevel): QualityProfile {
  return QUALITY_PROFILES[quality]
}
