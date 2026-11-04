import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import type { PerspectiveCamera } from 'three'
import type { VolumeBus } from './data/settings'
import {
  ENEMY_ARROW,
  ENEMY_TYPES,
  ENEMY_VARIANTS,
  type EnemyType,
} from './data/enemies'
import { PLAYER } from './data/player'
import { SAVE_CONFIG, type QuestEventType } from './data/quests'
import { QUALITY_LEVELS, ZONE, type QualityLevel } from './data/zone'
import {
  disposeLazyAudioEngine,
  getLazyAudioSnapshot,
  loadAndStartAudioEngine,
} from './game/audio/AudioEngineGate'
import { setAudioCreditsOpen } from './game/audio/audioPresentationRuntime'
import { audioBus, emitAudioEvent } from './game/audio/audioBus'
import { getAnimationRuntimeSnapshot } from './game/animation/animationRuntime'
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
import { PostEffectsGate } from './game/feel/PostEffectsGate'
import {
  getFeelDebugSnapshot,
  recordBlockFlash,
  type FeelDebugSnapshot,
} from './game/feel/feelRuntime'
import { setPostEnabledOverride } from './game/feel/postOverrideRuntime'
import { getLoadedModelIds } from './game/models/modelAvailability'
import {
  attachInput,
  detachInput,
  isGameplayInputLocked,
} from './game/player/input'
import type { PauseContext } from './game/pause/pause'
import {
  advancePausableClock,
  getPauseRuntimeRevision,
  getPauseRuntimeSnapshot,
  requestPause,
  resetPauseRuntime,
  setPauseOpen,
  setTitleScreenOpen,
  subscribePauseRuntime,
} from './game/pause/pauseRuntime'
import { playerStore } from './game/player/playerStore'
import { applyDamage } from './game/player/vitals'
import {
  closeHollenDialogue,
  emitQuestEvent,
  getQuestRuntimeSnapshot,
  openHollenDialogue,
  setQuestLogOpen,
} from './game/quest/questRuntime'
import {
  clearSave,
  deserializeSave,
  type SaveDataV2,
  type ScenePositionRules,
} from './game/save/save'
import {
  configureSaveWorldRuntimeAdapter,
  clearRuntimeSave,
  installRuntimeAutosave,
  loadRuntimeSave,
  saveRuntimeState,
} from './game/save/saveRuntime'
import { SceneManager } from './game/scenes/SceneManager'
import { qualityProfile } from './game/settings/quality'
import { QualityFallbackDriver } from './game/settings/QualityFallbackDriver'
import { setForcedQualityFps } from './game/settings/qualityFallbackRuntime'
import type { SettingsData } from './game/settings/settings'
import {
  disposeSettingsRuntime,
  getSettingsRuntimeSnapshot,
  initializeSettingsRuntime,
  subscribeSettingsRuntime,
} from './game/settings/settingsRuntime'
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
import { PerfOverlayGate, PerfSamplerGate } from './ui/PerfReadoutGate'
import { Compass } from './ui/CompassStrip'
import { getCompassSnapshot } from './ui/compassRuntime'
import { Credits } from './ui/Credits'
import { PauseMenu } from './ui/PauseMenu'
import { PlayerHitVignette } from './ui/PlayerHitVignette'
import {
  getPerfStats,
  requestPerfStatsReset,
  setPerfQualityTier,
  type PerfStats,
} from './ui/perfRuntime'
import { QuestOverlay } from './ui/QuestOverlay'
import { SceneTransitionOverlay } from './ui/SceneTransitionOverlay'
import { TitleScreen } from './ui/TitleScreen'
import { Toast } from './ui/Toast'

const pauseContext: PauseContext = {
  titleOpen: false,
  dialogueOpen: false,
  questLogOpen: false,
  crossingFlash: false,
  loading: false,
  deathFade: false,
}

function readPauseContext(): PauseContext {
  const pause = getPauseRuntimeSnapshot()
  const quest = getQuestRuntimeSnapshot()
  const scene = getSceneRuntimeSnapshot()
  pauseContext.titleOpen = pause.titleOpen
  pauseContext.dialogueOpen = quest.dialogue.currentNodeId !== null
  pauseContext.questLogOpen = quest.questLogOpen
  pauseContext.crossingFlash = scene.phase === 'flashing'
  pauseContext.loading = scene.phase === 'loading'
  pauseContext.deathFade = playerStore.getState().death.phase !== 'Alive'
  return pauseContext
}

function PausableClockDriver() {
  useFrame((_, deltaSeconds) => {
    advancePausableClock(deltaSeconds)
    if (getPauseRuntimeSnapshot().pending)
      requestPause({ type: 'blockersCleared' }, readPauseContext())
  }, -100)
  return null
}

function LiveRendererSettings({
  drawDistance,
}: {
  readonly drawDistance: number
}) {
  const { camera } = useThree()
  useEffect(() => {
    const perspectiveCamera = camera as PerspectiveCamera
    perspectiveCamera.far = drawDistance
    perspectiveCamera.updateProjectionMatrix()
  }, [camera, drawDistance])
  return null
}

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

type DebugSettingKey =
  'quality' | VolumeBus | 'reduceMotion' | 'mouseSensitivity' | 'invertY'

function hasValidStoredSave(storage: Storage): boolean {
  try {
    const current = storage.getItem(SAVE_CONFIG.storageKey)
    if (current !== null) return !deserializeSave(current).usedFallback
    const legacy = storage.getItem(SAVE_CONFIG.legacyStorageKey)
    return legacy !== null && !deserializeSave(legacy).usedFallback
  } catch {
    return false
  }
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
        spawnInvulnerabilityRemainingSeconds: number
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
      getSettings: () => SettingsData & {
        qualityProfile: ReturnType<typeof qualityProfile>
      }
      setSetting: (key: DebugSettingKey, value: unknown) => boolean
      pause: (open: boolean) => void
      getPause: () => ReturnType<typeof getPauseRuntimeSnapshot>
      getQualityTier: () => QualityLevel
      getAudioState: () => ReturnType<typeof getLazyAudioSnapshot>
      getCompass: () => ReturnType<typeof getCompassSnapshot>
      getAnimationState: () => ReturnType<typeof getAnimationRuntimeSnapshot>
      getFeelState: () => FeelDebugSnapshot
      forceFps: (value: number) => void
      getLoadedModels: () => string[]
      forceBucklerBlockFeedback: () => void
      resetPerfStats: () => void
      setPostEnabled: (enabled: boolean | null) => void
      prepareHollowEncounter: () => void
    }
  }
}
export default function App() {
  const [titleOpen, setTitleOpen] = useState(true)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [creditsReturn, setCreditsReturn] = useState<'title' | 'pause'>('title')
  const [hasValidSave, setHasValidSave] = useState(() =>
    hasValidStoredSave(window.localStorage),
  )
  const settingsRuntime = initializeSettingsRuntime(
    window.localStorage,
    window,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const settings = useSyncExternalStore(
    subscribeSettingsRuntime,
    getSettingsRuntimeSnapshot,
    getSettingsRuntimeSnapshot,
  )
  const quality = qualityProfile(settings.quality)
  useSyncExternalStore(
    subscribePauseRuntime,
    getPauseRuntimeRevision,
    getPauseRuntimeRevision,
  )
  const pause = getPauseRuntimeSnapshot()
  useLayoutEffect(() => setTitleScreenOpen(titleOpen), [titleOpen])
  useEffect(() => setAudioCreditsOpen(creditsOpen), [creditsOpen])
  useEffect(() => setPerfQualityTier(settings.quality), [settings.quality])
  const beginAudio = useCallback(() => {
    void loadAndStartAudioEngine().catch(() => {
      console.warn('Audio could not be started. The game will stay silent.')
    })
  }, [])
  const continueGame = useCallback(() => {
    setCreditsOpen(false)
    setTitleOpen(false)
    setTitleScreenOpen(false)
  }, [])
  const startNewGame = useCallback(() => {
    clearRuntimeSave(window.localStorage, SCENE_POSITION_RULES)
    setPauseOpen(false)
    setCreditsOpen(false)
    setTitleOpen(false)
    setTitleScreenOpen(false)
    setHasValidSave(false)
  }, [])
  const resumeGame = useCallback(() => {
    requestPause({ type: 'resume' }, readPauseContext())
  }, [])
  const openTitleCredits = useCallback(() => {
    setCreditsReturn('title')
    setCreditsOpen(true)
  }, [])
  const openPauseCredits = useCallback(() => {
    setCreditsReturn('pause')
    setCreditsOpen(true)
  }, [])
  const closeCredits = useCallback(() => {
    setCreditsOpen(false)
    if (creditsReturn === 'title') setTitleOpen(true)
    else setPauseOpen(true)
  }, [creditsReturn])
  const changeQuality = useCallback(
    (value: QualityLevel) =>
      settingsRuntime.store.getState().setQuality(value, true),
    [settingsRuntime],
  )
  const changeVolume = useCallback(
    (bus: VolumeBus, value: number) =>
      settingsRuntime.store.getState().setVolume(bus, value),
    [settingsRuntime],
  )
  const changeReduceMotion = useCallback(
    (value: boolean) =>
      settingsRuntime.store.getState().setReduceMotion(value, true),
    [settingsRuntime],
  )
  const changeMouseSensitivity = useCallback(
    (value: number) =>
      settingsRuntime.store.getState().setMouseSensitivity(value),
    [settingsRuntime],
  )
  const changeInvertY = useCallback(
    (value: boolean) => settingsRuntime.store.getState().setInvertY(value),
    [settingsRuntime],
  )
  useEffect(() => {
    configureSaveWorldRuntimeAdapter(saveWorldRuntimeAdapter)
    attachInput()
    loadRuntimeSave(window.localStorage, SCENE_POSITION_RULES)
    const stopAutosave = installRuntimeAutosave(window.localStorage, window)
    const flushSettings = () => settingsRuntime.flush()
    const reduceMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )
    const onReduceMotionPreference = (event: MediaQueryListEvent) => {
      const runtimeSettings = settingsRuntime.store.getState()
      if (!runtimeSettings.reduceMotionSetByHand) {
        runtimeSettings.setReduceMotion(event.matches)
      }
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || event.repeat) return
      const action = requestPause({ type: 'escape' }, readPauseContext())
      if (action === 'closeDialogue') closeHollenDialogue()
      else if (action === 'closeQuestLog') setQuestLogOpen(false)
      else if (action === 'none') return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const onPointerLockChange = () => {
      if (document.pointerLockElement === null)
        requestPause({ type: 'pointerLockLost' }, readPauseContext())
    }
    window.addEventListener('keydown', onEscape, true)
    window.addEventListener('pagehide', flushSettings)
    reduceMotionQuery.addEventListener('change', onReduceMotionPreference)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    if (import.meta.env.DEV) {
      const DEBUG_ONLY_INVULNERABLE = 'CORD_DEBUG_ONLY_INVULNERABLE'
      const DEBUG_ONLY_GRANT_EFFECT = 'CORD_DEBUG_ONLY_GRANT_EFFECT'
      const DEBUG_ONLY_FORCE_CROSSING = 'CORD_DEBUG_ONLY_FORCE_CROSSING'
      const DEBUG_ONLY_SCENE_LOAD = 'CORD_DEBUG_ONLY_SCENE_LOAD'
      const DEBUG_ONLY_PORTICO_VIEW = 'CORD_DEBUG_ONLY_PORTICO_VIEW'
      const DEBUG_ONLY_DROP_BLADE = 'CORD_DEBUG_ONLY_DROP_BLADE'
      const DEBUG_ONLY_GET_SETTINGS = 'CORD_DEBUG_ONLY_GET_SETTINGS'
      const DEBUG_ONLY_SET_SETTING = 'CORD_DEBUG_ONLY_SET_SETTING'
      const DEBUG_ONLY_PAUSE = 'CORD_DEBUG_ONLY_PAUSE'
      const DEBUG_ONLY_GET_PAUSE = 'CORD_DEBUG_ONLY_GET_PAUSE'
      const DEBUG_ONLY_GET_QUALITY = 'CORD_DEBUG_ONLY_GET_QUALITY'
      const DEBUG_ONLY_GET_AUDIO = 'CORD_DEBUG_ONLY_GET_AUDIO'
      const DEBUG_ONLY_GET_COMPASS = 'CORD_DEBUG_ONLY_GET_COMPASS'
      const DEBUG_ONLY_GET_ANIMATION = 'CORD_DEBUG_ONLY_GET_ANIMATION'
      const DEBUG_ONLY_GET_FEEL = 'CORD_DEBUG_ONLY_GET_FEEL'
      const DEBUG_ONLY_FORCE_FPS = 'CORD_DEBUG_ONLY_FORCE_FPS'
      const DEBUG_ONLY_GET_LOADED_MODELS = 'CORD_DEBUG_ONLY_GET_LOADED_MODELS'
      const DEBUG_ONLY_FORCE_BLOCK_FEEDBACK =
        'CORD_DEBUG_ONLY_FORCE_BLOCK_FEEDBACK'
      const DEBUG_ONLY_RESET_PERF = 'CORD_DEBUG_ONLY_RESET_PERF'
      const DEBUG_ONLY_SET_POST = 'CORD_DEBUG_ONLY_SET_POST'
      const DEBUG_ONLY_PREPARE_HOLLOW = 'CORD_DEBUG_ONLY_PREPARE_HOLLOW'
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
            spawnInvulnerabilityRemainingSeconds:
              state.death.spawnInvulnerabilityRemainingSeconds,
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
        getSettings: () => {
          void DEBUG_ONLY_GET_SETTINGS
          const current = settingsRuntime.store.getState()
          return {
            settingsVersion: current.settingsVersion,
            volumes: { ...current.volumes },
            quality: current.quality,
            qualityChosenByHand: current.qualityChosenByHand,
            reduceMotion: current.reduceMotion,
            reduceMotionSetByHand: current.reduceMotionSetByHand,
            mouseSensitivity: current.mouseSensitivity,
            invertY: current.invertY,
            qualityProfile: qualityProfile(current.quality),
          }
        },
        setSetting: (key, value) => {
          void DEBUG_ONLY_SET_SETTING
          const current = settingsRuntime.store.getState()
          if (
            key === 'quality' &&
            typeof value === 'string' &&
            QUALITY_LEVELS.includes(value as QualityLevel)
          ) {
            current.setQuality(value as QualityLevel, true)
            return true
          }
          if (
            (key === 'master' ||
              key === 'music' ||
              key === 'sfx' ||
              key === 'ambient') &&
            typeof value === 'number' &&
            Number.isFinite(value)
          ) {
            current.setVolume(key, value)
            return true
          }
          if (key === 'reduceMotion' && typeof value === 'boolean') {
            current.setReduceMotion(value, true)
            return true
          }
          if (
            key === 'mouseSensitivity' &&
            typeof value === 'number' &&
            Number.isFinite(value)
          ) {
            current.setMouseSensitivity(value)
            return true
          }
          if (key === 'invertY' && typeof value === 'boolean') {
            current.setInvertY(value)
            return true
          }
          return false
        },
        pause: (open) => {
          void DEBUG_ONLY_PAUSE
          setPauseOpen(open)
        },
        getPause: () => {
          void DEBUG_ONLY_GET_PAUSE
          return { ...getPauseRuntimeSnapshot() }
        },
        getQualityTier: () => {
          void DEBUG_ONLY_GET_QUALITY
          return settingsRuntime.store.getState().quality
        },
        getAudioState: () => {
          void DEBUG_ONLY_GET_AUDIO
          return getLazyAudioSnapshot()
        },
        getCompass: () => {
          void DEBUG_ONLY_GET_COMPASS
          return getCompassSnapshot()
        },
        getAnimationState: () => {
          void DEBUG_ONLY_GET_ANIMATION
          return getAnimationRuntimeSnapshot()
        },
        getFeelState: () => {
          void DEBUG_ONLY_GET_FEEL
          return getFeelDebugSnapshot()
        },
        forceFps: (value) => {
          void DEBUG_ONLY_FORCE_FPS
          setForcedQualityFps(value)
        },
        getLoadedModels: () => {
          void DEBUG_ONLY_GET_LOADED_MODELS
          return getLoadedModelIds()
        },
        forceBucklerBlockFeedback: () => {
          void DEBUG_ONLY_FORCE_BLOCK_FEEDBACK
          emitAudioEvent(audioBus, 'hit-block')
          recordBlockFlash()
        },
        resetPerfStats: () => {
          void DEBUG_ONLY_RESET_PERF
          requestPerfStatsReset()
        },
        setPostEnabled: (enabled) => {
          void DEBUG_ONLY_SET_POST
          setPostEnabledOverride(enabled)
        },
        prepareHollowEncounter: () => {
          void DEBUG_ONLY_PREPARE_HOLLOW
          hydrateHollowRuntime(true, true, false)
        },
      }
    }
    return () => {
      window.removeEventListener('keydown', onEscape, true)
      window.removeEventListener('pagehide', flushSettings)
      reduceMotionQuery.removeEventListener('change', onReduceMotionPreference)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      stopAutosave()
      detachInput()
      resetPauseRuntime()
      setPostEnabledOverride(null)
      disposeSettingsRuntime()
      void disposeLazyAudioEngine()
      configureSaveWorldRuntimeAdapter(null)
      if (import.meta.env.DEV) delete window.__CORD_AND_CROSSING_DEBUG__
    }
  }, [settingsRuntime])
  return (
    <main className="game-shell">
      <Canvas
        shadows
        camera={{
          position: [PLAYER.camera.shoulderOffset, 2.8, PLAYER.camera.distance],
          fov: 52,
          near: 0.1,
          far: quality.drawDistance,
        }}
        dpr={quality.dpr as number | [number, number]}
      >
        <LiveRendererSettings drawDistance={quality.drawDistance} />
        <PerfSamplerGate />
        <QualityFallbackDriver />
        <PausableClockDriver />
        <PostEffectsGate quality={settings.quality} />
        <Suspense fallback={null}>
          <Physics
            gravity={[0, -PLAYER.movement.gravity, 0]}
            timeStep={1 / 60}
            paused={pause.open || pause.titleOpen}
          >
            <SceneManager />
          </Physics>
        </Suspense>
      </Canvas>
      <PlayerHitVignette />
      <QuestOverlay />
      <Compass />
      <SceneTransitionOverlay />
      <TitleScreen
        open={titleOpen && !creditsOpen}
        hasValidSave={hasValidSave}
        onContinue={continueGame}
        onNewGame={startNewGame}
        onCredits={openTitleCredits}
        onUserGesture={beginAudio}
      />
      <PauseMenu
        open={pause.open && !titleOpen && !creditsOpen}
        settings={settings}
        onResume={resumeGame}
        onRestart={startNewGame}
        onCredits={openPauseCredits}
        onQualityChange={changeQuality}
        onVolumeChange={changeVolume}
        onReduceMotionChange={changeReduceMotion}
        onMouseSensitivityChange={changeMouseSensitivity}
        onInvertYChange={changeInvertY}
      />
      <Credits open={creditsOpen} onClose={closeCredits} />
      <Toast />
      <PerfOverlayGate />
    </main>
  )
}
