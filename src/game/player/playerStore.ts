import { createStore } from 'zustand/vanilla'
import { initialVitals, type Vitals } from './vitals'
type Position = { x: number; y: number; z: number }
export type PlayerState = {
  position: Position
  vitals: Vitals
  invulnerable: boolean
}
export const playerStore = createStore<PlayerState>(() => ({
  position: { x: 0, y: 1.3, z: 0 },
  vitals: initialVitals(),
  invulnerable: false,
}))
