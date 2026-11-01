import { REACHBLADE } from '../../data/weapons'

export type CordMode = 'InHand' | 'Out' | 'Returning' | 'Cut' | 'Dropped'
export type CastKind = 'straight' | 'arc' | null

export type CordState = {
  mode: CordMode
  castKind: CastKind
  retieRemaining: number
}

export type CordEvent =
  | { type: 'castRelease' }
  | { type: 'arcRelease' }
  | { type: 'hit' }
  | { type: 'maxRange' }
  | { type: 'recallPressed' }
  | { type: 'stopDoubleTap' }
  | { type: 'returned' }
  | { type: 'cut' }
  | { type: 'retieDone' }
  | { type: 'pickup' }
  | { type: 'tick' }

export const initialCordState = (): CordState => ({
  mode: 'InHand',
  castKind: null,
  retieRemaining: 0,
})

const transition = (
  mode: CordMode,
  castKind: CastKind = null,
  retieRemaining = 0,
): CordState => ({ mode, castKind, retieRemaining })

export function step(
  state: CordState,
  event: CordEvent,
  dtSeconds = 0,
): CordState {
  switch (event.type) {
    case 'castRelease':
      return state.mode === 'InHand' ? transition('Out', 'straight') : state
    case 'arcRelease':
      return state.mode === 'InHand' ? transition('Out', 'arc') : state
    case 'hit':
    case 'maxRange':
    case 'recallPressed':
      return state.mode === 'Out'
        ? transition('Returning', state.castKind)
        : state
    case 'stopDoubleTap':
      return state.mode === 'Out' || state.mode === 'Returning'
        ? transition('Dropped')
        : state
    case 'returned':
      return state.mode === 'Returning' ? transition('InHand') : state
    case 'cut':
      return state.mode === 'Out' || state.mode === 'Returning'
        ? transition('Cut', null, REACHBLADE.cut.retieSeconds)
        : state
    case 'retieDone':
      return state.mode === 'Cut' && state.retieRemaining <= 0
        ? transition('InHand')
        : state
    case 'pickup':
      return state.mode === 'Dropped' ? transition('InHand') : state
    case 'tick':
      return state.mode === 'Cut' && state.retieRemaining > 0
        ? transition(
            'Cut',
            null,
            Math.max(0, state.retieRemaining - Math.max(0, dtSeconds)),
          )
        : state
  }
}

export const isUnarmed = (state: CordState): boolean => state.mode !== 'InHand'

export const canCloseStrike = (state: CordState): boolean =>
  state.mode === 'InHand'

export const canCordBeCut = (state: CordState): boolean =>
  state.mode === 'Out' || state.mode === 'Returning'
