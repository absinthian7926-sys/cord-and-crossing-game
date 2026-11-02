import { setGameplayInputLock } from '../player/input'
import {
  createPauseState,
  gameplayDelta,
  reducePause,
  type PauseAction,
  type PauseContext,
  type PauseEvent,
} from './pause'

export type PauseRuntimeSnapshot = {
  open: boolean
  pending: boolean
  titleOpen: boolean
  elapsedSeconds: number
  deltaSeconds: number
  rawDeltaSeconds: number
  revision: number
}

const pauseState = createPauseState()
const runtime: PauseRuntimeSnapshot = {
  open: false,
  pending: false,
  titleOpen: false,
  elapsedSeconds: 0,
  deltaSeconds: 0,
  rawDeltaSeconds: 0,
  revision: 0,
}
const listeners = new Set<() => void>()
const clockListeners = new Set<(deltaSeconds: number) => void>()

function publishIfChanged(
  previousOpen: boolean,
  previousPending: boolean,
): void {
  runtime.open = pauseState.open
  runtime.pending = pauseState.pending
  setGameplayInputLock('pause', runtime.open)
  setGameplayInputLock('title', runtime.titleOpen)
  if (previousOpen === runtime.open && previousPending === runtime.pending)
    return
  runtime.revision += 1
  for (const listener of listeners) listener()
}

export function getPauseRuntimeSnapshot(): Readonly<PauseRuntimeSnapshot> {
  return runtime
}

export function getPauseRuntimeRevision(): number {
  return runtime.revision
}

export function subscribePauseRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function subscribePausableClock(
  listener: (deltaSeconds: number) => void,
): () => void {
  clockListeners.add(listener)
  return () => clockListeners.delete(listener)
}

export function requestPause(
  event: PauseEvent,
  context: PauseContext,
): PauseAction {
  const previousOpen = pauseState.open
  const previousPending = pauseState.pending
  const result = reducePause(pauseState, event, context)
  publishIfChanged(previousOpen, previousPending)
  return result.action
}

export function setPauseOpen(open: boolean): void {
  const previousOpen = pauseState.open
  const previousPending = pauseState.pending
  pauseState.open = open
  pauseState.pending = false
  publishIfChanged(previousOpen, previousPending)
}

export function setTitleScreenOpen(open: boolean): void {
  if (runtime.titleOpen === open) return
  runtime.titleOpen = open
  runtime.revision += 1
  setGameplayInputLock('title', open)
  for (const listener of listeners) listener()
}

export function isGameplayTimePaused(): boolean {
  return runtime.open || runtime.titleOpen
}

export function getPausableRawDelta(rawDeltaSeconds: number): number {
  return gameplayDelta(rawDeltaSeconds, runtime.open, runtime.titleOpen)
}

export function getPausableDelta(rawDeltaSeconds: number): number {
  return Math.min(getPausableRawDelta(rawDeltaSeconds), 1 / 30)
}

export function advancePausableClock(rawDeltaSeconds: number): number {
  const rawDelta = getPausableRawDelta(rawDeltaSeconds)
  runtime.rawDeltaSeconds = rawDelta
  runtime.deltaSeconds = Math.min(rawDelta, 1 / 30)
  runtime.elapsedSeconds += rawDelta
  if (rawDelta > 0) for (const listener of clockListeners) listener(rawDelta)
  return runtime.deltaSeconds
}

export function resetPauseRuntime(): void {
  const previousOpen = pauseState.open
  const previousPending = pauseState.pending
  pauseState.open = false
  pauseState.pending = false
  runtime.titleOpen = false
  runtime.elapsedSeconds = 0
  runtime.deltaSeconds = 0
  runtime.rawDeltaSeconds = 0
  publishIfChanged(previousOpen, previousPending)
  setGameplayInputLock('title', false)
}
