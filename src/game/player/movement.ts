import { PLAYER } from '../../data/player'
import { canRun, type Vitals } from './vitals'

export function resolveGroundSpeed(
  runInputHeld: boolean,
  hasMovementInput: boolean,
  vitals: Vitals,
): number {
  return runInputHeld && hasMovementInput && canRun(vitals)
    ? PLAYER.movement.runSpeed
    : PLAYER.movement.walkSpeed
}
