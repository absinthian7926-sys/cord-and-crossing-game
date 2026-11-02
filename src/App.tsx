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
import {
  effectRuntime,
  getEffectRuntimeSnapshot,
  grantStrengthFromCrossing,
} from './game/effects/effectRuntime'
import {
  getHollowRuntimeSnapshot,
  hydrateHollowRuntime,
  markHollowEnemyDefeated,
  subscribeHollowRuntime,
} from './game/hollow/hollowRuntime'
import {
  attachInput,
  detachInput,
  isGameplayInputLocked,
} from './game/player/input'
import { playerStore } from './game/player/playerStore'
import { applyDamage } from './game/player/vitals'
import {
  emitQuestEvent,
  getQuestRuntimeSnapshot,
  openHollenDialogue,
} from './game/quest/questRuntime'
import {
  clearSave,
  deserializeSave,
  type SaveDataV2,
  type ScenePositionRules,
} from './game/save/save'
import {
  configureSaveWorldRuntimeAdapter,
  installRuntimeAutosave,
  loadRuntimeSave,
  saveRuntimeState,
} from './game/save/saveRuntime'
import { SceneManager } from './game/scenes/SceneManager'
import {
  getSceneRuntimeSnapshot,
  getWorldConfiguration,
  hollowHeightAt,
  loadSceneImmediately,
  subscribeSceneRuntime,
  type GameScene,
} from './game/scenes/sceneRuntime'
import {
  forcePorticoCrossing,
  tryUsePorticoKey,
} from './game/portico/porticoGameplay'
import {
  getPorticoRuntimeSnapshot,
  hydratePorticoRuntime,
  isPorticoScreenInView,
  subscribePorticoRuntime,
  unlockAndActivatePortico,
  type PorticoDirection,
} from './game/portico/porticoRuntime'
import { heightAt } from './game/world/terrain'
import {
  dropBladeForDebug,
  forceCut,
  holdCordOutForPerf,
  isWeaponPresentInScene,
  weaponRuntime,
  type DamageLogEntry,
} from './game/weapons/weaponRuntime'
import { PerfOverlay, PerfSampler } from './ui/PerfOverlay'
import { getPerfStats, type PerfStats } from './ui/perfRuntime'
import { QuestOverlay } from './ui/QuestOverlay'
import { SceneTransitionOverlay } from './ui/SceneTransitionOverlay'

const SCENE_POSITION_RULES: ScenePositionRules = {
  zone: {
    bounds: ZONE.bounds,
    respawn: { x: ZONE.spawn[0], y: ZONE.spawn[1], z: ZONE.spawn[2] },
    heightAt,
  },
  hollow: {
    bounds: ZONE.hollow.bounds,
    respawn: {
      x: ZONE.hollow.arrival[0],
      y: ZONE.hollow.arrival[1],
      z: ZONE.hollow.arrival[2],
    },
    heightAt: hollowHeightAt,
  },
}

const saveWorldRuntimeAdapter = {
  getState: () => {
    const hollow = getHollowRuntimeSnapshot().progress
    return {
      porticoUnlocked: getPorticoRuntimeSnapshot().phase !== 'locked',
      currentScene: getSceneRuntimeSnapshot().currentScene,
      hollow: {
        heelstonePassDone: hollow.heelstonePassDone,
        snagPulled: hollow.snagPulled,
        encounterDefeated: hollow.encounterDefeated,
      },
    }
  },
  hydrate: (state: {
    porticoUnlocked: boolean
    currentScene: GameScene
    hollow: {
      heelstonePassDone: boolean
      snagPulled: boolean
      encounterDefeated: boolean
    }
  }) => {
    hydratePorticoRuntime(state.porticoUnlocked)
    hydrateHollowRuntime(
      state.hollow.heelstonePassDone,
      state.hollow.snagPulled,
      state.hollow.encounterDefeated,
    )
    loadSceneImmediately(state.currentScene)
  },
  subscribe: (listener: () => void) => {
    const unsubscribePortico = subscribePorticoRuntime(listener)
    const unsubscribeScene = subscribeSceneRuntime(listener)
    const unsubscribeHollow = subscribeHollowRuntime(listener)
    return () => {
      unsubscribePortico()
      unsubscribeScene()
      unsubscribeHollow()
    }
  },
}

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
      stageWorstCaseHollow: () => string[]
      getHollowFrustumCount: () => number
      setCordOutForPerf: (enabled: boolean) => void
      getQuest: () => ReturnType<typeof getQuestRuntimeSnapshot>
      emitQuestEvent: (event: QuestEventType) => boolean
      getSave: () => SaveDataV2
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
      getEffects: () => {
        id: string
        remainingSeconds: number
        carried: boolean
      }[]
      grantEffect: (id: string) => boolean
      getPortico: () => ReturnType<typeof getPorticoRuntimeSnapshot>
      unlockPortico: () => boolean
      usePorticoKey: () => boolean
      forceCrossing: (direction: PorticoDirection) => boolean
      getHeelstonePass: () => ReturnType<typeof getEffectRuntimeSnapshot> & {
        remainingSeconds: number
      }
      getHollow: () => ReturnType<typeof getHollowRuntimeSnapshot>
      loadScene: (scene: GameScene) => void
      getScene: () => GameScene
      getLastSceneLoadMilliseconds: () => number | null
      completeHollowEncounter: () => void
      getTasselEarned: () => boolean
      getTasselVisible: () => boolean
      getDroppedBladeScene: () => GameScene | null
      isWeaponPresent: () => boolean
      getPorticoScreenInView: () => boolean
      getInputLocked: () => boolean
      dropBlade: () => boolean
    }
  }
}
export default function App() {
  useEffect(() => {
    configureSaveWorldRuntimeAdapter(saveWorldRuntimeAdapter)
    attachInput()
    loadRuntimeSave(window.localStorage, SCENE_POSITION_RULES)
    const stopAutosave = installRuntimeAutosave(window.localStorage, window)
    if (import.meta.env.DEV) {
      const DEBUG_ONLY_INVULNERABLE = 'CORD_DEBUG_ONLY_INVULNERABLE'
      const DEBUG_ONLY_GRANT_EFFECT = 'CORD_DEBUG_ONLY_GRANT_EFFECT'
      const DEBUG_ONLY_FORCE_CROSSING = 'CORD_DEBUG_ONLY_FORCE_CROSSING'
      const DEBUG_ONLY_SCENE_LOAD = 'CORD_DEBUG_ONLY_SCENE_LOAD'
      const DEBUG_ONLY_PORTICO_VIEW = 'CORD_DEBUG_ONLY_PORTICO_VIEW'
      const DEBUG_ONLY_DROP_BLADE = 'CORD_DEBUG_ONLY_DROP_BLADE'
      window.__CORD_AND_CROSSING_DEBUG__ = {
        getPlayerPosition: () => ({ ...playerStore.getState().position }),
        getCordState: () => weaponRuntime.cord.mode,
        getDummyDamageLog: () => [...weaponRuntime.damageLog],
        forceCut,
        getPerfStats,
        getTerrainHeight: (x, z) => getWorldConfiguration().sampleHeight(x, z),
        getCameraDistance: () => playerStore.getState().cameraDistance,
        getMinimumCameraDistanceWhileOut: () =>
          weaponRuntime.minimumCameraDistanceWhileOut,
        teleport: (x, z) => {
          const sampleHeight = getWorldConfiguration().sampleHeight
          playerStore.getState().teleportTarget = {
            x,
            y:
              sampleHeight(x, z) +
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
          void DEBUG_ONLY_INVULNERABLE
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
        stageWorstCaseHollow: () => {
          const staged = enemyRuntime.records.filter((enemy) =>
            enemy.id.startsWith('hollow-final-'),
          )
          const playerX = 0
          const playerZ = -42
          const sampleHeight = getWorldConfiguration().sampleHeight
          const player = playerStore.getState()
          player.vitals.health = PLAYER.health.max
          player.death.phase = 'Alive'
          player.death.fadeRemainingSeconds = 0
          void DEBUG_ONLY_INVULNERABLE
          player.death.spawnInvulnerabilityRemainingSeconds =
            Number.POSITIVE_INFINITY
          player.teleportTarget = {
            x: playerX,
            y:
              sampleHeight(playerX, playerZ) +
              PLAYER.collider.halfHeight +
              PLAYER.collider.radius,
            z: playerZ,
          }
          for (let index = 0; index < staged.length; index += 1) {
            const enemy = staged[index]
            resetEnemyAtAnchor(enemy)
            enemy.x = (index - 1) * 4
            enemy.z = -54 - Math.abs(index - 1) * 2
            const bodyHeight =
              enemy.type === 'cliffHound'
                ? ENEMY_TYPES.cliffHound.collider.length
                : ENEMY_TYPES[enemy.type].collider.height
            enemy.y =
              sampleHeight(enemy.x, enemy.z) + bodyHeight * enemy.scale * 0.5
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
                playerX + 30,
                sampleHeight(playerX, playerZ) + PLAYER.collider.halfHeight,
                playerZ + 30,
              )
          }
          holdCordOutForPerf(true)
          return staged.map((enemy) => enemy.id)
        },
        getHollowFrustumCount: () =>
          enemyRuntime.records.filter(
            (enemy) =>
              enemy.phase === 'Alive' &&
              enemy.inFrustum &&
              enemy.id.startsWith('hollow-final-'),
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
        getEffects: () => {
          const effects = []
          for (const slot of effectRuntime.effects.slots) {
            if (slot.definition === null) continue
            effects.push({
              id: slot.definition.id,
              remainingSeconds: slot.remainingSeconds,
              carried:
                effectRuntime.effects.carriedEffectId === slot.definition.id,
            })
          }
          return effects
        },
        grantEffect: (id) => {
          void DEBUG_ONLY_GRANT_EFFECT
          return id === 'Strength' && grantStrengthFromCrossing(false)
        },
        getPortico: getPorticoRuntimeSnapshot,
        unlockPortico: unlockAndActivatePortico,
        usePorticoKey: tryUsePorticoKey,
        forceCrossing: (direction) => {
          void DEBUG_ONLY_FORCE_CROSSING
          return forcePorticoCrossing(direction)
        },
        getHeelstonePass: () => ({
          ...getEffectRuntimeSnapshot(),
          remainingSeconds: effectRuntime.pass.remainingSeconds,
        }),
        getHollow: getHollowRuntimeSnapshot,
        loadScene: (scene) => {
          void DEBUG_ONLY_SCENE_LOAD
          loadSceneImmediately(scene)
        },
        getScene: () => getSceneRuntimeSnapshot().currentScene,
        getLastSceneLoadMilliseconds: () =>
          getSceneRuntimeSnapshot().lastLoadMilliseconds,
        completeHollowEncounter: () => {
          for (
            let index = 0;
            index < ZONE.hollow.encounterOffsets.length;
            index += 1
          )
            markHollowEnemyDefeated(index)
        },
        getTasselEarned: () => getQuestRuntimeSnapshot().tasselEarned,
        getTasselVisible: () => weaponRuntime.tasselVisible,
        getDroppedBladeScene: () => weaponRuntime.droppedScene,
        isWeaponPresent: () =>
          isWeaponPresentInScene(
            weaponRuntime.cord.mode,
            getSceneRuntimeSnapshot().currentScene,
            weaponRuntime.droppedScene,
          ),
        getPorticoScreenInView: () => {
          void DEBUG_ONLY_PORTICO_VIEW
          return isPorticoScreenInView()
        },
        getInputLocked: isGameplayInputLocked,
        dropBlade: () => {
          void DEBUG_ONLY_DROP_BLADE
          return dropBladeForDebug()
        },
      }
    }
    return () => {
      stopAutosave()
      detachInput()
      configureSaveWorldRuntimeAdapter(null)
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
      <SceneTransitionOverlay />
      {import.meta.env.DEV && <PerfOverlay />}
    </main>
  )
}
