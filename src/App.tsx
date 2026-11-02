import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useEffect } from 'react'
import {
  ENEMY_ARROW,
  ENEMY_TYPES,
  ENEMY_VARIANTS,
  type EnemyType,
} from './data/enemies'
import { PLAYER } from './data/player'
import { SAVE_CONFIG, type QuestEventType } from './data/quests'
import { ZONE } from './data/zone'
import {
  advanceRespawn as advanceEnemyRespawn,
  enemyRuntime,
  ensureCampLeaderSpawned,
  fireEnemyArrow,
  getEnemyRecord,
  getEnemySnapshots,
  killEnemy,
  resetEnemyAtAnchor,
  spawnCampLeaderForDebug,
  spawnEnemy,
  type EnemySnapshot,
} from './game/enemies/enemyRuntime'
import { countActiveArrows } from './game/enemies/projectiles'
import { attachInput, detachInput } from './game/player/input'
import { playerStore } from './game/player/playerStore'
import { applyDamage } from './game/player/vitals'
import {
  emitQuestEvent,
  getQuestRuntimeSnapshot,
  openHollenDialogue,
} from './game/quest/questRuntime'
import { clearSave, deserializeSave, type SaveDataV1 } from './game/save/save'
import {
  installRuntimeAutosave,
  loadRuntimeSave,
  saveRuntimeState,
} from './game/save/saveRuntime'
import { SceneManager } from './game/scenes/SceneManager'
import { heightAt } from './game/world/terrain'
import {
  forceCut,
  holdCordOutForPerf,
  weaponRuntime,
  type DamageLogEntry,
} from './game/weapons/weaponRuntime'
import { PerfOverlay, PerfSampler } from './ui/PerfOverlay'
import { getPerfStats, type PerfStats } from './ui/perfRuntime'
import { QuestOverlay } from './ui/QuestOverlay'
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
      spawnCampLeader: () => string | null
      killEnemy: (id: string) => boolean
      damagePlayer: (damage: number) => void
      advanceRespawn: (seconds: number) => void
      aggroEnemies: (radius: number) => void
      setEnemyAttackCooldown: (id: string, seconds: number) => boolean
      getEnemyAttackPhase: (id: string) => {
        state: string
        windingUp: boolean
        windupElapsedSeconds: number
        cooldownSeconds: number
      } | null
      getActiveArrowCount: () => number
      stageWorstCaseCamp: () => string[]
      getCampFrustumCount: () => number
      setCordOutForPerf: (enabled: boolean) => void
      getQuest: () => ReturnType<typeof getQuestRuntimeSnapshot>
      emitQuestEvent: (event: QuestEventType) => boolean
      getSave: () => SaveDataV1
      clearSave: () => void
      openDialogue: () => boolean
      getPlayerStatus: () => {
        health: number
        stamina: number
        deathPhase: string
        invulnerable: boolean
      }
      setPlayerVitals: (health: number, stamina: number) => void
      saveGame: () => boolean
    }
  }
}
export default function App() {
  useEffect(() => {
    attachInput()
    loadRuntimeSave(window.localStorage, heightAt)
    const stopAutosave = installRuntimeAutosave(window.localStorage, window)
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
        spawnCampLeader: () => {
          const quest = getQuestRuntimeSnapshot()
          return ensureCampLeaderSpawned({
            questStep: Math.max(2, quest.quest.currentStep),
            keyLooted: quest.quest.keyLooted,
            leaderDefeated: quest.campLeaderDefeated,
          })
        },
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
        setEnemyAttackCooldown: (id, seconds) => {
          const enemy = getEnemyRecord(id)
          if (
            !enemy ||
            enemy.type === 'brigandArcher' ||
            enemy.phase !== 'Alive' ||
            enemy.state !== 'Attack'
          )
            return false
          enemy.attackCooldown = Math.max(0, seconds)
          return true
        },
        getEnemyAttackPhase: (id) => {
          const enemy = getEnemyRecord(id)
          if (!enemy) return null
          return {
            state: enemy.state,
            windingUp: enemy.drawRemaining > 0,
            windupElapsedSeconds: enemy.drawRemaining,
            cooldownSeconds: enemy.attackCooldown,
          }
        },
        getActiveArrowCount: () => countActiveArrows(enemyRuntime.arrows),
        stageWorstCaseCamp: () => {
          const centerX = ZONE.locations.D.center[0]
          const centerZ = ZONE.locations.D.center[1]
          const standardCamp = enemyRuntime.records
            .filter(
              (enemy) =>
                enemy.id.startsWith('camp-') &&
                enemy.variant === ENEMY_VARIANTS.standard,
            )
            .slice(0, 9)
          let leader = enemyRuntime.records.find(
            (enemy) =>
              enemy.variant === ENEMY_VARIANTS.campLeader &&
              enemy.phase === 'Alive',
          )
          if (!leader) {
            const leaderId = spawnCampLeaderForDebug()
            leader = getEnemyRecord(leaderId)
          }
          const staged = leader ? [...standardCamp, leader] : standardCamp
          const playerX = centerX
          const playerZ = centerZ + 22
          const player = playerStore.getState()
          player.vitals.health = PLAYER.health.max
          player.death.phase = 'Alive'
          player.death.fadeRemainingSeconds = 0
          player.death.spawnInvulnerabilityRemainingSeconds =
            Number.POSITIVE_INFINITY
          player.teleportTarget = {
            x: playerX,
            y:
              heightAt(playerX, playerZ) +
              PLAYER.collider.halfHeight +
              PLAYER.collider.radius,
            z: playerZ,
          }
          for (let index = 0; index < staged.length; index += 1) {
            const enemy = staged[index]
            resetEnemyAtAnchor(enemy)
            enemy.x = centerX + ((index % 5) - 2) * 3.5
            enemy.z = centerZ - Math.floor(index / 5) * 4
            const bodyHeight =
              enemy.type === 'cliffHound'
                ? ENEMY_TYPES.cliffHound.collider.length
                : ENEMY_TYPES[enemy.type].collider.height
            enemy.y =
              heightAt(enemy.x, enemy.z) + bodyHeight * enemy.scale * 0.5
            enemy.state = enemy.type === 'brigandArcher' ? 'Attack' : 'Chase'
            enemy.drawRemaining =
              enemy.type === 'brigandArcher'
                ? ENEMY_TYPES.brigandArcher.drawSeconds * 0.5
                : 0
            enemy.teleportRequested = true
            enemy.inFrustum = false
            if (enemy.type === 'brigandArcher')
              fireEnemyArrow(
                enemy.x,
                enemy.y + ENEMY_ARROW.releaseHeight,
                enemy.z,
                playerX,
                heightAt(playerX, playerZ) + PLAYER.collider.halfHeight,
                playerZ + ENEMY_ARROW.maximumRange,
              )
          }
          holdCordOutForPerf(true)
          return staged.map((enemy) => enemy.id)
        },
        getCampFrustumCount: () =>
          enemyRuntime.records.filter(
            (enemy) =>
              enemy.phase === 'Alive' &&
              enemy.inFrustum &&
              (enemy.id.startsWith('camp-') ||
                enemy.id.startsWith('debug-camp-leader-')),
          ).length,
        setCordOutForPerf: holdCordOutForPerf,
        getQuest: getQuestRuntimeSnapshot,
        emitQuestEvent,
        getSave: () =>
          deserializeSave(window.localStorage.getItem(SAVE_CONFIG.storageKey))
            .data,
        clearSave: () => {
          clearSave(window.localStorage)
          window.location.reload()
        },
        openDialogue: openHollenDialogue,
        getPlayerStatus: () => {
          const state = playerStore.getState()
          return {
            health: state.vitals.health,
            stamina: state.vitals.stamina,
            deathPhase: state.death.phase,
            invulnerable: state.invulnerable,
          }
        },
        setPlayerVitals: (health, stamina) => {
          const vitals = playerStore.getState().vitals
          vitals.health = Math.max(0, Math.min(PLAYER.health.max, health))
          vitals.stamina = Math.max(0, Math.min(PLAYER.stamina.max, stamina))
          vitals.secondsSinceDamage = 0
          vitals.secondsSinceStaminaUse = 0
        },
        saveGame: () => saveRuntimeState(window.localStorage),
      }
    return () => {
      stopAutosave()
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
      <QuestOverlay />
      {import.meta.env.DEV && <PerfOverlay />}
    </main>
  )
}
