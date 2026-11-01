import { REACHBLADE } from '../../data/weapons'
import { applyDamage, type Vitals } from '../player/vitals'

export type ComboState = {
  nextHitIndex: number
  lastHitAt: number
}

export type CloseAttack = {
  index: number
  damage: number
  windupSeconds: number
  activeSeconds: number
  staminaCost: number
}

export type ComboResult = {
  combo: ComboState
  attack: CloseAttack | null
}

export const initialComboState = (): ComboState => ({
  nextHitIndex: 0,
  lastHitAt: Number.NEGATIVE_INFINITY,
})

export function tryStartCloseAttack(
  combo: ComboState,
  nowSeconds: number,
  stamina: number,
): ComboResult {
  const withinWindow =
    nowSeconds - combo.lastHitAt <= REACHBLADE.close.comboWindowSeconds
  const index = withinWindow ? combo.nextHitIndex : 0
  const staminaCost = REACHBLADE.close.staminaCost[index]
  if (stamina < staminaCost) {
    return { combo: initialComboState(), attack: null }
  }
  return {
    combo: {
      nextHitIndex: (index + 1) % REACHBLADE.close.damage.length,
      lastHitAt: nowSeconds + REACHBLADE.close.windupSeconds[index],
    },
    attack: {
      index,
      damage: REACHBLADE.close.damage[index],
      windupSeconds: REACHBLADE.close.windupSeconds[index],
      activeSeconds: REACHBLADE.close.activeSeconds[index],
      staminaCost,
    },
  }
}

export type ArcTarget = { id: string; x: number; z: number }

export function isTargetInArc(
  originX: number,
  originZ: number,
  forwardX: number,
  forwardZ: number,
  targetX: number,
  targetZ: number,
  maximumRadius: number,
  arcDegrees: number,
  minimumRadius = 0,
): boolean {
  const dx = targetX - originX
  const dz = targetZ - originZ
  const distanceSquared = dx * dx + dz * dz
  if (
    distanceSquared > maximumRadius * maximumRadius ||
    distanceSquared < minimumRadius * minimumRadius
  ) {
    return false
  }
  if (distanceSquared === 0) return minimumRadius === 0
  const forwardLength = Math.hypot(forwardX, forwardZ)
  if (forwardLength === 0) return false
  const inverseDistance = 1 / Math.sqrt(distanceSquared)
  const dot =
    (dx * inverseDistance * forwardX + dz * inverseDistance * forwardZ) /
    forwardLength
  return dot >= Math.cos((arcDegrees * Math.PI) / 360)
}

export function selectFlatArcTargets(
  targets: readonly ArcTarget[],
  originX: number,
  originZ: number,
  forwardX: number,
  forwardZ: number,
): ArcTarget[] {
  const selected: ArcTarget[] = []
  for (const target of targets) {
    if (
      isTargetInArc(
        originX,
        originZ,
        forwardX,
        forwardZ,
        target.x,
        target.z,
        REACHBLADE.flatArc.maximumRadius,
        REACHBLADE.flatArc.arcDegrees,
        REACHBLADE.flatArc.minimumRadius,
      )
    ) {
      selected.push(target)
      if (selected.length === REACHBLADE.flatArc.maximumTargets) break
    }
  }
  return selected
}

export function incomingDamage(
  baseDamage: number,
  unarmed: boolean,
  invulnerable: boolean,
): number {
  if (invulnerable) return 0
  return (
    Math.max(0, baseDamage) * (unarmed ? REACHBLADE.unarmedDamageMultiplier : 1)
  )
}

export function applyCombatDamage(
  vitals: Vitals,
  baseDamage: number,
  unarmed: boolean,
  invulnerable: boolean,
): number {
  const damage = incomingDamage(baseDamage, unarmed, invulnerable)
  if (damage > 0) applyDamage(vitals, damage)
  return damage
}

export function recallDuration(distance: number): number {
  return (
    REACHBLADE.recall.fullLengthSeconds *
    (Math.max(0, Math.min(REACHBLADE.maxCordLength, distance)) /
      REACHBLADE.maxCordLength)
  )
}

export const shoveDamage = (): number => REACHBLADE.cut.shoveDamage
