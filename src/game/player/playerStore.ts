import { create } from 'zustand'
import { initialVitals, type Vitals } from './vitals'
type Position = { x: number; y: number; z: number }
type State = {
  position: Position
  vitals: Vitals
  invulnerable: boolean
  setPosition: (position: Position) => void
  setVitals: (vitals: Vitals) => void
  setInvulnerable: (value: boolean) => void
}
export const usePlayerStore = create<State>((set) => ({
  position: { x: 0, y: 1.3, z: 0 },
  vitals: initialVitals(),
  invulnerable: false,
  setPosition: (position) => set({ position }),
  setVitals: (vitals) => set({ vitals }),
  setInvulnerable: (invulnerable) => set({ invulnerable }),
}))
