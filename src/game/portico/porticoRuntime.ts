import type { CrossingDirection } from './crossing'

export type PorticoPhase = 'locked' | 'unlocked' | 'active'

export type PorticoDirection = 'zoneToHollow' | 'hollowToZone'

export type PorticoRuntimeSnapshot = {
  readonly phase: PorticoPhase
  readonly keyUseNearby: boolean
  readonly revision: number
}

export type UseKeyPromptInput = {
  readonly nearby: boolean
  readonly questStep: number
  readonly keyLooted: boolean
  readonly phase: PorticoPhase
}

export type HeelstonePromptInput = {
  readonly hasActiveEffect: boolean
  readonly cordInHand: boolean
  readonly passIdle: boolean
  readonly lineCarrying: boolean
}

type PorticoRuntimeListener = () => void
type CrossingHandler = (direction: PorticoDirection) => void

const listeners = new Set<PorticoRuntimeListener>()
let crossingHandler: CrossingHandler | null = null
let transientKeyUseNearby = false
let transientScreenInView = false

function initialSnapshot(): PorticoRuntimeSnapshot {
  return {
    phase: 'locked',
    keyUseNearby: false,
    revision: 0,
  }
}

let snapshot = initialSnapshot()

function publish(next: PorticoRuntimeSnapshot): void {
  if (next === snapshot) return
  snapshot = next
  for (const listener of listeners) listener()
}

export function getPorticoRuntimeSnapshot(): PorticoRuntimeSnapshot {
  return snapshot
}

export function subscribePorticoRuntime(
  listener: PorticoRuntimeListener,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetPorticoRuntime(): void {
  transientKeyUseNearby = false
  transientScreenInView = false
  publish(initialSnapshot())
}

export function hydratePorticoRuntime(unlocked: boolean): void {
  transientKeyUseNearby = false
  transientScreenInView = false
  publish({
    phase: unlocked ? 'active' : 'locked',
    keyUseNearby: false,
    revision: 0,
  })
}

export function unlockPortico(): boolean {
  if (snapshot.phase !== 'locked') return false
  publish({
    ...snapshot,
    phase: 'unlocked',
    revision: snapshot.revision + 1,
  })
  return true
}

export function activatePortico(): boolean {
  if (snapshot.phase === 'active' || snapshot.phase === 'locked') return false
  publish({
    ...snapshot,
    phase: 'active',
    revision: snapshot.revision + 1,
  })
  return true
}

export function unlockAndActivatePortico(): boolean {
  if (snapshot.phase !== 'locked') return false
  publish({
    ...snapshot,
    phase: 'active',
    revision: snapshot.revision + 1,
  })
  return true
}

export function setKeyUseNearby(nearby: boolean): void {
  transientKeyUseNearby = nearby
  if (snapshot.keyUseNearby === nearby) return
  publish({ ...snapshot, keyUseNearby: nearby })
}

export function setKeyUseNearbyTransient(nearby: boolean): void {
  transientKeyUseNearby = nearby
}

export function isKeyUseNearby(): boolean {
  return transientKeyUseNearby
}

export function setPorticoScreenInView(inView: boolean): void {
  transientScreenInView = inView
}

export function isPorticoScreenInView(): boolean {
  return transientScreenInView
}

export function shouldShowUseKeyPrompt(input: UseKeyPromptInput): boolean {
  return (
    input.nearby &&
    input.questStep === 4 &&
    input.keyLooted &&
    input.phase === 'locked'
  )
}

export function isKeyUsePositionNearby(
  playerX: number,
  playerZ: number,
  centerX: number,
  centerZ: number,
  normalX: number,
  normalZ: number,
  radius: number,
): boolean {
  const normalLength = Math.hypot(normalX, normalZ)
  if (normalLength <= Number.EPSILON || radius < 0) return false
  const offsetX = playerX - centerX
  const offsetZ = playerZ - centerZ
  const onFrontSide =
    (offsetX * normalX + offsetZ * normalZ) / normalLength >= 0
  return onFrontSide && offsetX * offsetX + offsetZ * offsetZ <= radius * radius
}

export function toRippleUvPerSecond(
  metersPerSecond: number,
  screenHeight: number,
): number {
  return screenHeight > 0 ? metersPerSecond / screenHeight : 0
}

export function shouldShowHeelstonePrompt(
  input: HeelstonePromptInput,
): boolean {
  return (
    input.hasActiveEffect &&
    input.cordInHand &&
    input.passIdle &&
    !input.lineCarrying
  )
}

export function mapPorticoCrossingDirection(
  kind: 'zone' | 'hollow',
  direction: CrossingDirection,
): PorticoDirection {
  if (kind === 'zone')
    return direction === 'backToFront' ? 'zoneToHollow' : 'hollowToZone'
  return direction === 'frontToBack' ? 'hollowToZone' : 'zoneToHollow'
}

export function canCrossPorticoDirection(
  direction: PorticoDirection,
  phase: PorticoPhase,
): boolean {
  return direction === 'hollowToZone' || phase === 'active'
}

export function registerPorticoCrossingHandler(
  handler: CrossingHandler | null,
): void {
  crossingHandler = handler
}

export function dispatchPorticoCrossing(direction: PorticoDirection): boolean {
  if (crossingHandler === null) return false
  if (!canCrossPorticoDirection(direction, snapshot.phase)) return false
  crossingHandler(direction)
  return true
}
