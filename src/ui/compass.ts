export const COMPASS = {
  spanDegrees: 120,
  widthPixels: 360,
  sampleHertz: 10,
} as const

export type CompassMarker = {
  bearingDegrees: number
  relativeDegrees: number
  offsetPixels: number
  visible: boolean
}

export function wrapDegrees(degrees: number): number {
  const wrapped = degrees % 360
  if (wrapped === 0) return 0
  return wrapped < 0 ? wrapped + 360 : wrapped
}

export function cameraHeadingFromYaw(yawRadians: number): number {
  return wrapDegrees((-yawRadians * 180) / Math.PI)
}

export function markerBearingDegrees(
  playerX: number,
  playerZ: number,
  markerX: number,
  markerZ: number,
): number {
  return wrapDegrees(
    (Math.atan2(markerX - playerX, -(markerZ - playerZ)) * 180) / Math.PI,
  )
}

export function shortestDegreeDelta(
  fromDegrees: number,
  toDegrees: number,
): number {
  return ((toDegrees - fromDegrees + 540) % 360) - 180
}

export function createCompassMarker(): CompassMarker {
  return {
    bearingDegrees: 0,
    relativeDegrees: 0,
    offsetPixels: 0,
    visible: false,
  }
}

export function resolveCompassMarker(
  headingDegrees: number,
  playerX: number,
  playerZ: number,
  markerX: number,
  markerZ: number,
  output: CompassMarker,
): CompassMarker {
  output.bearingDegrees = markerBearingDegrees(
    playerX,
    playerZ,
    markerX,
    markerZ,
  )
  output.relativeDegrees = shortestDegreeDelta(
    headingDegrees,
    output.bearingDegrees,
  )
  const halfSpan = COMPASS.spanDegrees / 2
  output.visible = Math.abs(output.relativeDegrees) <= halfSpan
  output.offsetPixels =
    (output.relativeDegrees / halfSpan) * (COMPASS.widthPixels / 2)
  return output
}
