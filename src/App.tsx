import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useEffect } from 'react'
import { PLAYER } from './data/player'
import { attachInput, detachInput } from './game/player/input'
import { usePlayerStore } from './game/player/playerStore'
import { SceneManager } from './game/scenes/SceneManager'
import { Hud } from './ui/Hud'
declare global {
  interface Window {
    __CORD_AND_CROSSING_DEBUG__?: {
      getPlayerPosition: () => { x: number; y: number; z: number }
    }
  }
}
export default function App() {
  useEffect(() => {
    attachInput()
    if (import.meta.env.DEV)
      window.__CORD_AND_CROSSING_DEBUG__ = {
        getPlayerPosition: () => ({ ...usePlayerStore.getState().position }),
      }
    return () => {
      detachInput()
      delete window.__CORD_AND_CROSSING_DEBUG__
    }
  }, [])
  return (
    <main className="game-shell">
      <Canvas
        shadows
        camera={{
          position: [PLAYER.camera.shoulderOffset, 2.8, PLAYER.camera.distance],
          fov: 52,
          near: 0.1,
          far: 180,
        }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, -PLAYER.movement.gravity, 0]} timeStep={1 / 60}>
            <SceneManager />
          </Physics>
        </Suspense>
      </Canvas>
      <Hud />
    </main>
  )
}
