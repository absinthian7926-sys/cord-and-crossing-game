export function distanceSquaredPointToSegment(
  pointX: number,
  pointY: number,
  pointZ: number,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
): number {
  const segmentX = endX - startX
  const segmentY = endY - startY
  const segmentZ = endZ - startZ
  const lengthSquared =
    segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ
  const projection =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((pointX - startX) * segmentX +
              (pointY - startY) * segmentY +
              (pointZ - startZ) * segmentZ) /
              lengthSquared,
          ),
        )
  const closestX = startX + segmentX * projection
  const closestY = startY + segmentY * projection
  const closestZ = startZ + segmentZ * projection
  const dx = pointX - closestX
  const dy = pointY - closestY
  const dz = pointZ - closestZ
  return dx * dx + dy * dy + dz * dz
}

export function capsuleOverlapsPoint(
  pointX: number,
  pointY: number,
  pointZ: number,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  combinedRadius: number,
): boolean {
  return (
    distanceSquaredPointToSegment(
      pointX,
      pointY,
      pointZ,
      startX,
      startY,
      startZ,
      endX,
      endY,
      endZ,
    ) <=
    combinedRadius * combinedRadius
  )
}
