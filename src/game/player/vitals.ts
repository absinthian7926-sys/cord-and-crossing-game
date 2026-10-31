import { PLAYER } from '../../data/player'
export type Vitals = {
  health: number
  stamina: number
  secondsSinceDamage: number
  secondsSinceStaminaUse: number
}
export const initialVitals = (): Vitals => ({
  health: PLAYER.health.max,
  stamina: PLAYER.stamina.max,
  secondsSinceDamage: Infinity,
  secondsSinceStaminaUse: Infinity,
})
export function updateVitals(
  current: Vitals,
  deltaSeconds: number,
  running: boolean,
): Vitals {
  const delta = Math.max(0, deltaSeconds)
  let stamina = current.stamina
  let secondsSinceStaminaUse = current.secondsSinceStaminaUse + delta
  if (running && stamina > 0) {
    stamina = Math.max(0, stamina - PLAYER.stamina.runCostPerSecond * delta)
    secondsSinceStaminaUse = 0
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
  return { health, stamina, secondsSinceDamage, secondsSinceStaminaUse }
}
export function spendDodgeStamina(current: Vitals): Vitals | null {
  return current.stamina < PLAYER.stamina.dodgeCost
    ? null
    : {
        ...current,
        stamina: current.stamina - PLAYER.stamina.dodgeCost,
        secondsSinceStaminaUse: 0,
      }
}
export function applyDamage(current: Vitals, damage: number): Vitals {
  return {
    ...current,
    health: Math.max(0, current.health - Math.max(0, damage)),
    secondsSinceDamage: 0,
  }
}
