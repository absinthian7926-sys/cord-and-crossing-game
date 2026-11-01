import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useEffect } from 'react'
import { ENEMY_TYPES, type EnemyType } from './data/enemies'
import { PLAYER } from './data/player'
import { ZONE } from './data/zone'
import {
  advanceRespawn as advanceEnemyRespawn,
  enemyRuntime,
  getEnemyRecord,
  getEnemySnapshots,
  killEnemy,
  requestHoundCordBite,
  spawnEnemy,
  type EnemySnapshot,
} from './game/enemies/enemyRuntime'
import { countActiveArrows } from './game/enemies/projectiles'
import { attachInput, detachInput } from './game/player/input'
import { playerStore } from './game/player/playerStore'
import { applyDamage } from './game/player/vitals'
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
      getMinimumCameraDistanceWhileOut: () => number | null
      teleport: (x: number, z: number) => void
      getEnemies: () => EnemySnapshot[]
      spawnEnemy: (type: EnemyType, x: number, z: number) => string
      killEnemy: (id: string) => boolean
      damagePlayer: (damage: number) => void
      advanceRespawn: (seconds: number) => void
      aggroEnemies: (radius: number) => void
      forceHoundBite: (id: string, x: number, z: number) => boolean
      getActiveArrowCount: () => number
      getPlayerStatus: () => {
        health: number
        stamina: number
        deathPhase: string
        invulnerable: boolean
      }
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
        getMinimumCameraDistanceWhileOut: () =>
          weaponRuntime.minimumCameraDistanceWhileOut,
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
        getEnemies: getEnemySnapshots,
        spawnEnemy,
        killEnemy,
        damagePlayer: (damage) => {
          applyDamage(playerStore.getState().vitals, damage)
        },
        advanceRespawn: advanceEnemyRespawn,
        aggroEnemies: (radius) => {
          const position = playerStore.getState().position
          const maximumDistance = Math.max(0, radius)
          for (const enemy of enemyRuntime.records) {
            if (
              enemy.phase === 'Alive' &&
              Math.hypot(enemy.x - position.x, enemy.z - position.z) <=
                maximumDistance
            ) {
              enemy.state = 'Chase'
              enemy.stateElapsed = 0
            }
          }
        },
        forceHoundBite: (id, x, z) => {
          const enemy = getEnemyRecord(id)
          if (
            !enemy ||
            enemy.type !== 'cliffHound' ||
            enemy.phase !== 'Alive' ||
            enemy.state !== 'Attack'
          )
            return false
          enemy.x = x
          enemy.z = z
          enemy.y =
            heightAt(x, z) + ENEMY_TYPES.cliffHound.collider.length * 0.5
          return requestHoundCordBite(
            enemy.x,
            enemy.y + ENEMY_TYPES.cliffHound.collider.length * 0.5,
            enemy.z,
          )
        },
        getActiveArrowCount: () => countActiveArrows(enemyRuntime.arrows),
        getPlayerStatus: () => {
          const state = playerStore.getState()
          return {
            health: state.vitals.health,
            stamina: state.vitals.stamina,
            deathPhase: state.death.phase,
            invulnerable: state.invulnerable,
          }
        },
      }
    return () => {
      detachInput()
      if (import.meta.env.DEV) delete window.__CORD_AND_CROSSING_DEBUG__
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
