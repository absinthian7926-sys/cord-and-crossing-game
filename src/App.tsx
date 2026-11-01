import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useEffect } from 'react'
import { PLAYER } from './data/player'
import { ZONE } from './data/zone'
import { attachInput, detachInput } from './game/player/input'
import { playerStore } from './game/player/playerStore'
import { SceneManager } from './game/scenes/SceneManager'
import { heightAt } from './game/world/terrain'
import {
  forceCut,
  weaponRuntime,
  type DamageLogEntry,
} from './game/weapons/weaponRuntime'
import { Hud } from './ui/Hud'
import { PerfOverlay, PerfSampler } from './ui/PerfOverlay'
import { getPerfStats, type PerfStats } from './ui/perfRuntime'
declare global {
  interface Window {
    __CORD_AND_CROSSING_DEBUG__?: {
      getPlayerPosition: () => { x: number; y: number; z: number }
      getCordState: () => string
      getDummyDamageLog: () => DamageLogEntry[]
      forceCut: () => void
      getPerfStats: () => PerfStats
      getTerrainHeight: (x: number, z: number) => number
      getCameraDistance: () => number
      teleport: (x: number, z: number) => void
    }
  }
}
export default function App() {
  useEffect(() => {
    attachInput()
    if (import.meta.env.DEV)
      window.__CORD_AND_CROSSING_DEBUG__ = {
        getPlayerPosition: () => ({ ...playerStore.getState().position }),
        getCordState: () => weaponRuntime.cord.mode,
        getDummyDamageLog: () => [...weaponRuntime.damageLog],
        forceCut,
        getPerfStats,
        getTerrainHeight: heightAt,
        getCameraDistance: () => playerStore.getState().cameraDistance,
        teleport: (x, z) => {
          playerStore.getState().teleportTarget = {
            x,
            y:
              heightAt(x, z) +
              PLAYER.collider.halfHeight +
              PLAYER.collider.radius,
            z,
          }
        },
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
          far: ZONE.drawDistanceByQuality[ZONE.quality.default],
        }}
        dpr={[1, 1.5]}
      >
        {import.meta.env.DEV && <PerfSampler />}
        <Suspense fallback={null}>
          <Physics gravity={[0, -PLAYER.movement.gravity, 0]} timeStep={1 / 60}>
            <SceneManager />
          </Physics>
        </Suspense>
      </Canvas>
      <Hud />
      {import.meta.env.DEV && <PerfOverlay />}
    </main>
  )
}
