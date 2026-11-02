import { initialCordState, type CordState } from './cordState'

export type WeaponScene = 'zone' | 'hollow'

export type DamageLogEntry = {
  dummyId: string
  damage: number
  staggerSeconds: number
  atSeconds: number
}

type DamageListener = (entry: DamageLogEntry) => void

const damageListeners = new Set<DamageListener>()
let forceCutHandler: (() => void) | null = null
let resetWeaponHandler: (() => void) | null = null
let holdCordOutHandler: ((enabled: boolean) => void) | null = null
let debugDropBladeHandler: (() => boolean) | null = null

export const weaponRuntime = {
  cord: initialCordState(),
  droppedScene: null as WeaponScene | null,
  damageLog: [] as DamageLogEntry[],
  minimumCameraDistanceWhileOut: null as number | null,
  tasselVisible: false,
}

export function setDroppedBladeScene(scene: WeaponScene | null): void {
  weaponRuntime.droppedScene = scene
}

export function isWeaponPresentInScene(
  mode: CordState['mode'],
  currentScene: WeaponScene,
  droppedScene: WeaponScene | null,
): boolean {
  return mode !== 'Dropped' || currentScene === droppedScene
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

export function registerWeaponReset(handler: (() => void) | null): void {
  resetWeaponHandler = handler
}

export function resetWeaponToInHand(): void {
  resetWeaponHandler?.()
}

export function registerHoldCordOutForPerf(
  handler: ((enabled: boolean) => void) | null,
): void {
  holdCordOutHandler = handler
}

export function holdCordOutForPerf(enabled: boolean): void {
  holdCordOutHandler?.(enabled)
}

export function registerDebugDropBlade(handler: (() => boolean) | null): void {
  debugDropBladeHandler = handler
}

export function dropBladeForDebug(): boolean {
  return debugDropBladeHandler?.() ?? false
}

export function resetWeaponRuntime(): void {
  weaponRuntime.cord = initialCordState()
  weaponRuntime.droppedScene = null
  weaponRuntime.damageLog.length = 0
  weaponRuntime.minimumCameraDistanceWhileOut = null
  weaponRuntime.tasselVisible = false
}
