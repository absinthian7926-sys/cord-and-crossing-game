import { initialCordState, type CordState } from './cordState'

export type DamageLogEntry = {
  dummyId: string
  damage: number
  staggerSeconds: number
  atSeconds: number
}

type DamageListener = (entry: DamageLogEntry) => void

const damageListeners = new Set<DamageListener>()
let forceCutHandler: (() => void) | null = null

export const weaponRuntime = {
  cord: initialCordState(),
  damageLog: [] as DamageLogEntry[],
  minimumCameraDistanceWhileOut: null as number | null,
}

export function setCordState(state: CordState): void {
  if (state.mode === 'Out' && weaponRuntime.cord.mode !== 'Out')
    weaponRuntime.minimumCameraDistanceWhileOut = null
  weaponRuntime.cord = state
}

export function recordCameraDistanceWhileOut(distance: number): void {
  if (weaponRuntime.cord.mode !== 'Out') return
  weaponRuntime.minimumCameraDistanceWhileOut =
    weaponRuntime.minimumCameraDistanceWhileOut === null
      ? distance
      : Math.min(weaponRuntime.minimumCameraDistanceWhileOut, distance)
}

export function recordDummyDamage(entry: DamageLogEntry): void {
  weaponRuntime.damageLog.push(entry)
  if (weaponRuntime.damageLog.length > 100) weaponRuntime.damageLog.shift()
  for (const listener of damageListeners) listener(entry)
}

export function subscribeDummyDamage(listener: DamageListener): () => void {
  damageListeners.add(listener)
  return () => damageListeners.delete(listener)
}

export function registerForceCut(handler: (() => void) | null): void {
  forceCutHandler = handler
}

export function forceCut(): void {
  forceCutHandler?.()
}

export function resetWeaponRuntime(): void {
  weaponRuntime.cord = initialCordState()
  weaponRuntime.damageLog.length = 0
  weaponRuntime.minimumCameraDistanceWhileOut = null
}
