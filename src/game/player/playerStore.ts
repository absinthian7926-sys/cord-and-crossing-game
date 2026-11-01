import { createStore } from 'zustand/vanilla'
import type { RapierCollider } from '@react-three/rapier'
import { PLAYER } from '../../data/player'
import { ZONE } from '../../data/zone'
import { createPlayerDeathState, type PlayerDeathState } from './death'
import { initialVitals, type Vitals } from './vitals'
type Position = { x: number; y: number; z: number }
export type PlayerState = {
  position: Position
  vitals: Vitals
  invulnerable: boolean
  collider: RapierCollider | null
  cameraDistance: number
  teleportTarget: Position | null
  death: PlayerDeathState
}
export const playerStore = createStore<PlayerState>(() => ({
  position: {
    x: ZONE.spawn[0],
    y: ZONE.spawn[1] + PLAYER.collider.halfHeight + PLAYER.collider.radius,
    z: ZONE.spawn[2],
  },
  vitals: initialVitals(),
  invulnerable: false,
  collider: null,
  cameraDistance: PLAYER.camera.distance,
  teleportTarget: null,
  death: createPlayerDeathState(),
}))
