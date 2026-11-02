import { EFFECTS } from '../../data/effects'

export type EffectDefinition = {
  readonly id: string
  readonly durationSeconds: number
  readonly closeDamageMultiplier: number
  readonly castPullForceMultiplier: number
  readonly staggerDurationMultiplier: number
  readonly carriedCastDamageMultiplier: number
  readonly carriedCastBreaksGuard: boolean
}

export type ActiveEffectSlot = {
  definition: EffectDefinition | null
  remainingSeconds: number
}

export type EffectSystemState = {
  readonly slots: ActiveEffectSlot[]
  activeCount: number
  carriedEffectId: string | null
}

export type EffectMultipliers = {
  closeDamage: number
  castPullForce: number
  staggerDuration: number
  carriedCastDamage: number
  carriedCastBreaksGuard: boolean
}

export type PlainLineReason = 'cut' | 'stop' | 'death'
export type CrossingEffectConfig = EffectDefinition & {
  readonly returnCrossingGrantsEffect: boolean
}

export const createEffectSystem = (): EffectSystemState => {
  const slots: ActiveEffectSlot[] = []
  for (let index = 0; index < EFFECTS.maximumActive; index += 1) {
    slots.push({ definition: null, remainingSeconds: 0 })
  }
  return { slots, activeCount: 0, carriedEffectId: null }
}

const findEffectIndex = (state: EffectSystemState, id: string): number => {
  for (let index = 0; index < state.slots.length; index += 1) {
    if (state.slots[index].definition?.id === id) return index
  }
  return -1
}

const clearSlot = (state: EffectSystemState, index: number): void => {
  const slot = state.slots[index]
  const removedId = slot.definition!.id
  slot.definition = null
  slot.remainingSeconds = 0
  state.activeCount -= 1
  if (state.carriedEffectId === removedId) state.carriedEffectId = null
}

export const addEffect = (
  state: EffectSystemState,
  definition: EffectDefinition,
): boolean => {
  const existingIndex = findEffectIndex(state, definition.id)
  if (existingIndex >= 0) {
    const slot = state.slots[existingIndex]
    slot.definition = definition
    slot.remainingSeconds = Math.max(0, definition.durationSeconds)
    return true
  }

  if (state.activeCount >= state.slots.length) return false

  for (let index = 0; index < state.slots.length; index += 1) {
    const slot = state.slots[index]
    if (slot.definition === null) {
      slot.definition = definition
      slot.remainingSeconds = Math.max(0, definition.durationSeconds)
      state.activeCount += 1
      return true
    }
  }
  return false
}

export const addEffectFromCrossing = (
  state: EffectSystemState,
  definition: CrossingEffectConfig,
  isReturnCrossing: boolean,
): boolean => {
  if (isReturnCrossing && !definition.returnCrossingGrantsEffect) return false
  return addEffect(state, definition)
}

export const tickEffects = (
  state: EffectSystemState,
  dtSeconds: number,
): number => {
  const elapsed = Math.max(0, dtSeconds)
  let expiredCount = 0
  for (let index = 0; index < state.slots.length; index += 1) {
    const slot = state.slots[index]
    if (slot.definition === null) continue
    slot.remainingSeconds = Math.max(0, slot.remainingSeconds - elapsed)
    if (slot.remainingSeconds === 0) {
      clearSlot(state, index)
      expiredCount += 1
    }
  }
  return expiredCount
}

export const removeEffect = (state: EffectSystemState, id: string): boolean => {
  const index = findEffectIndex(state, id)
  if (index < 0) return false
  clearSlot(state, index)
  return true
}

export const clearEffects = (state: EffectSystemState): void => {
  for (let index = 0; index < state.slots.length; index += 1) {
    const slot = state.slots[index]
    slot.definition = null
    slot.remainingSeconds = 0
  }
  state.activeCount = 0
  state.carriedEffectId = null
}

export const hasEffect = (state: EffectSystemState, id: string): boolean =>
  findEffectIndex(state, id) >= 0

export const getEffectRemainingSeconds = (
  state: EffectSystemState,
  id: string,
): number => {
  const index = findEffectIndex(state, id)
  return index < 0 ? 0 : state.slots[index].remainingSeconds
}

export const carryEffectOnLine = (
  state: EffectSystemState,
  id: string,
): boolean => {
  if (!hasEffect(state, id)) return false
  state.carriedEffectId = id
  return true
}

export const makeLinePlain = (
  state: EffectSystemState,
  reason: PlainLineReason,
): boolean => {
  void reason
  if (state.carriedEffectId === null) return false
  state.carriedEffectId = null
  return true
}

export const isLineCarrying = (state: EffectSystemState): boolean =>
  state.carriedEffectId !== null && hasEffect(state, state.carriedEffectId)

export const queryEffectMultipliers = (
  state: EffectSystemState,
  output: EffectMultipliers,
): EffectMultipliers => {
  output.closeDamage = 1
  output.castPullForce = 1
  output.staggerDuration = 1
  output.carriedCastDamage = 1
  output.carriedCastBreaksGuard = false

  for (let index = 0; index < state.slots.length; index += 1) {
    const definition = state.slots[index].definition
    if (definition === null) continue
    output.closeDamage *= definition.closeDamageMultiplier
    output.castPullForce *= definition.castPullForceMultiplier
    output.staggerDuration *= definition.staggerDurationMultiplier
    if (definition.id === state.carriedEffectId) {
      output.carriedCastDamage *= definition.carriedCastDamageMultiplier
      output.carriedCastBreaksGuard ||= definition.carriedCastBreaksGuard
    }
  }
  return output
}
