import { PLAYER } from '../../data/player'
export type Vitals = {
  health: number
  stamina: number
  secondsSinceDamage: number
  secondsSinceStaminaUse: number
  runLocked: boolean
}
export const initialVitals = (): Vitals => ({
  health: PLAYER.health.max,
  stamina: PLAYER.stamina.max,
  secondsSinceDamage: Infinity,
  secondsSinceStaminaUse: Infinity,
  runLocked: false,
})
export function updateVitals(
  current: Vitals,
  deltaSeconds: number,
  running: boolean,
): void {
  const delta = Math.max(0, deltaSeconds)
  let stamina = current.stamina
  let secondsSinceStaminaUse = current.secondsSinceStaminaUse + delta
  if (running && stamina > 0) {
    stamina = Math.max(0, stamina - PLAYER.stamina.runCostPerSecond * delta)
    secondsSinceStaminaUse = 0
    if (stamina === 0) current.runLocked = true
  } else if (
    secondsSinceStaminaUse >= PLAYER.stamina.regenerationDelaySeconds
  ) {
    stamina = Math.min(
      PLAYER.stamina.max,
      stamina + PLAYER.stamina.regenerationPerSecond * delta,
    )
  }
  const secondsSinceDamage = current.secondsSinceDamage + delta
  const health =
    secondsSinceDamage >= PLAYER.health.regenerationDelaySeconds
      ? Math.min(
          PLAYER.health.max,
          current.health + PLAYER.health.regenerationPerSecond * delta,
        )
      : current.health
  current.health = health
  current.stamina = stamina
  current.secondsSinceDamage = secondsSinceDamage
  current.secondsSinceStaminaUse = secondsSinceStaminaUse
  if (
    current.runLocked &&
    current.stamina + Number.EPSILON >= PLAYER.stamina.runReengageThreshold
  ) {
    current.runLocked = false
  }
}
export function canRun(current: Vitals): boolean {
  return !current.runLocked && current.stamina > 0
}
export function spendDodgeStamina(current: Vitals): boolean {
  if (current.stamina < PLAYER.stamina.dodgeCost) return false
  current.stamina -= PLAYER.stamina.dodgeCost
  current.secondsSinceStaminaUse = 0
  return true
}
export function applyDamage(current: Vitals, damage: number): void {
  current.health = Math.max(0, current.health - Math.max(0, damage))
  current.secondsSinceDamage = 0
}
