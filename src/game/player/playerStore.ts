import { createStore } from 'zustand/vanilla'
import type { RapierCollider } from '@react-three/rapier'
import { initialVitals, type Vitals } from './vitals'
type Position = { x: number; y: number; z: number }
export type PlayerState = {
  position: Position
  vitals: Vitals
  invulnerable: boolean
  collider: RapierCollider | null
}
export const playerStore = createStore<PlayerState>(() => ({
  position: { x: 0, y: 1.3, z: 0 },
  vitals: initialVitals(),
  invulnerable: false,
  collider: null,
}))
