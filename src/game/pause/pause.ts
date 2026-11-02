export type PauseState = {
  open: boolean
  pending: boolean
}

export type PauseContext = {
  titleOpen: boolean
  dialogueOpen: boolean
  questLogOpen: boolean
  crossingFlash: boolean
  loading: boolean
  deathFade: boolean
}

export type PauseEvent =
  | { readonly type: 'escape' }
  | { readonly type: 'pointerLockLost' }
  | { readonly type: 'open' }
  | { readonly type: 'resume' }
  | { readonly type: 'blockersCleared' }

export type PauseAction =
  'none' | 'opened' | 'closed' | 'deferred' | 'closeDialogue' | 'closeQuestLog'

export type PauseResult = {
  readonly state: PauseState
  readonly action: PauseAction
}

export function createPauseState(): PauseState {
  return { open: false, pending: false }
}

function transitionBlocked(context: PauseContext): boolean {
  return context.crossingFlash || context.loading || context.deathFade
}

function openOrDefer(state: PauseState, context: PauseContext): PauseAction {
  if (transitionBlocked(context)) {
    state.pending = true
    return 'deferred'
  }
  state.open = true
  state.pending = false
  return 'opened'
}

export function reducePause(
  state: PauseState,
  event: PauseEvent,
  context: PauseContext,
): PauseResult {
  let action: PauseAction = 'none'
  if (event.type === 'resume') {
    state.pending = false
    if (state.open) {
      state.open = false
      action = 'closed'
    }
    return { state, action }
  }
  if (event.type === 'blockersCleared') {
    if (state.pending && !context.titleOpen && !transitionBlocked(context))
      action = openOrDefer(state, context)
    return { state, action }
  }
  if (event.type === 'escape') {
    if (context.dialogueOpen) return { state, action: 'closeDialogue' }
    if (context.questLogOpen) return { state, action: 'closeQuestLog' }
    if (state.open) {
      state.open = false
      state.pending = false
      return { state, action: 'closed' }
    }
    if (!context.titleOpen) action = openOrDefer(state, context)
    return { state, action }
  }
  if (event.type === 'pointerLockLost') {
    if (
      state.open ||
      context.titleOpen ||
      context.dialogueOpen ||
      context.questLogOpen
    )
      return { state, action }
    action = openOrDefer(state, context)
    return { state, action }
  }
  if (!state.open && !context.titleOpen) action = openOrDefer(state, context)
  return { state, action }
}

export function gameplayDelta(
  rawDeltaSeconds: number,
  paused: boolean,
  titleOpen: boolean,
): number {
  if (paused || titleOpen || rawDeltaSeconds <= 0) return 0
  return rawDeltaSeconds
}
