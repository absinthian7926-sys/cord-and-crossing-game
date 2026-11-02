import { EFFECTS } from '../../data/effects'

export type HeelstonePassMode = 'Idle' | 'Passing' | 'Carried'

export type HeelstonePassState = {
  mode: HeelstonePassMode
  effectId: string | null
  remainingSeconds: number
}

export type HeelstonePassEvent =
  | {
      type: 'start'
      activeEffectId: string | null
      bladeInHand: boolean
      lineAlreadyCarrying: boolean
    }
  | { type: 'tick' }
  | { type: 'hit' }
  | { type: 'dodge' }
  | { type: 'cut' }
  | { type: 'stop' }
  | { type: 'death' }
  | { type: 'effectExpired'; effectId: string }
  | { type: 'effectRemoved'; effectId: string }

export const createHeelstonePassState = (): HeelstonePassState => ({
  mode: 'Idle',
  effectId: null,
  remainingSeconds: 0,
})

const reset = (state: HeelstonePassState): void => {
  state.mode = 'Idle'
  state.effectId = null
  state.remainingSeconds = 0
}

export const stepHeelstonePass = (
  state: HeelstonePassState,
  event: HeelstonePassEvent,
  dtSeconds = 0,
  durationSeconds: number = EFFECTS.heelstonePass.durationSeconds,
): HeelstonePassState => {
  switch (event.type) {
    case 'start':
      if (
        state.mode === 'Idle' &&
        event.activeEffectId !== null &&
        event.bladeInHand &&
        !event.lineAlreadyCarrying
      ) {
        state.mode = 'Passing'
        state.effectId = event.activeEffectId
        state.remainingSeconds = Math.max(0, durationSeconds)
      }
      return state
    case 'tick':
      if (state.mode !== 'Passing') return state
      state.remainingSeconds = Math.max(
        0,
        state.remainingSeconds - Math.max(0, dtSeconds),
      )
      if (
        state.remainingSeconds <=
        Number.EPSILON * Math.max(1, durationSeconds)
      ) {
        state.remainingSeconds = 0
        state.mode = 'Carried'
      }
      return state
    case 'hit':
    case 'dodge':
      if (state.mode === 'Passing') reset(state)
      return state
    case 'cut':
    case 'stop':
    case 'death':
      if (state.mode !== 'Idle') reset(state)
      return state
    case 'effectExpired':
    case 'effectRemoved':
      if (state.effectId === event.effectId) reset(state)
      return state
  }
}
