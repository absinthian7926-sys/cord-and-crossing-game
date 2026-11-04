import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { Frustum, InstancedMesh, Matrix4, Object3D, Vector3 } from 'three'
import { ENEMY_ARROW, ENEMY_PRESENTATION } from '../../data/enemies'
import { PLAYER } from '../../data/player'
import { audioBus, emitAudioEvent } from '../audio/audioBus'
import { applyCombatDamage } from '../combat/combat'
import { triggerPlayerHitFeedback } from '../feel/feelRuntime'
import { getPausableDelta } from '../pause/pauseRuntime'
import { playerStore } from '../player/playerStore'
import { isUnarmed } from '../weapons/cordState'
import { weaponRuntime } from '../weapons/weaponRuntime'
import { getWorldConfiguration } from '../scenes/sceneRuntime'
import { Enemy } from './Enemy'
import {
  advanceCampEnemyBreakoff,
  enemyRuntime,
  initializeEnemyRoster,
  isEnemySceneInitialized,
  setEnemyHeightSampler,
  subscribeEnemyRoster,
  type EnemySpawnLike,
} from './enemyRuntime'
import { createArrowStepResult, stepArrowsWithResult } from './projectiles'
import { createSpawnPlan } from './spawns'

function initializeDefaultRoster(): void {
  const spawnPlan = createSpawnPlan()
  initializeEnemyRoster(
    spawnPlan.map((spawn) => ({
      id: spawn.id,
      type: spawn.enemyType,
      variant: spawn.variant,
      x: spawn.x,
      z: spawn.z,
      anchorX: spawn.anchorX,
      anchorZ: spawn.anchorZ,
      patrolStartX: spawn.patrolStartX,
      patrolStartZ: spawn.patrolStartZ,
      patrolEndX: spawn.patrolEndX,
      patrolEndZ: spawn.patrolEndZ,
    })),
  )
}

function EnemyProjectiles() {
  const mesh = useRef<InstancedMesh>(null)
  const transform = useMemo(() => new Object3D(), [])
  const stepResult = useMemo(() => createArrowStepResult(), [])

  useFrame((_, rawDelta) => {
    const arrows = enemyRuntime.arrows
    const player = playerStore.getState()
    const delta = getPausableDelta(rawDelta)
    if (delta > 0) {
      advanceCampEnemyBreakoff(delta)
      stepArrowsWithResult(
        arrows,
        delta,
        player.position.x,
        player.position.y,
        player.position.z,
        PLAYER.collider.radius,
        player.invulnerable,
        getWorldConfiguration().sampleHeight,
        stepResult,
      )
    } else {
      stepResult.damage = 0
      stepResult.terrainHitCount = 0
    }
    for (let index = 0; index < stepResult.terrainHitCount; index += 1)
      emitAudioEvent(audioBus, 'arrow-terrain')
    if (stepResult.damage > 0) {
      const appliedDamage = applyCombatDamage(
        player.vitals,
        stepResult.damage,
        isUnarmed(weaponRuntime.cord),
        player.invulnerable,
      )
      if (appliedDamage > 0) {
        emitAudioEvent(audioBus, 'player-hurt')
        triggerPlayerHitFeedback()
      }
    }

    const arrowsMesh = mesh.current
    if (!arrowsMesh) return
    for (let index = 0; index < arrows.active.length; index += 1) {
      if (arrows.active[index] === 0) {
        transform.position.set(0, -1000, 0)
        transform.scale.setScalar(0)
      } else {
        transform.position.set(
          arrows.x[index],
          arrows.y[index],
          arrows.z[index],
        )
        transform.scale.setScalar(1)
        const horizontalSpeed = Math.hypot(
          arrows.velocityX[index],
          arrows.velocityZ[index],
        )
        transform.rotation.set(
          -Math.atan2(arrows.velocityY[index], horizontalSpeed),
          Math.atan2(arrows.velocityX[index], arrows.velocityZ[index]),
          0,
        )
      }
      transform.updateMatrix()
      arrowsMesh.setMatrixAt(index, transform.matrix)
    }
    arrowsMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, ENEMY_ARROW.poolSize]}
      frustumCulled={false}
    >
      <boxGeometry
        args={[
          ENEMY_PRESENTATION.arrow.width,
          ENEMY_PRESENTATION.arrow.height,
          ENEMY_PRESENTATION.arrow.length,
        ]}
      />
      <meshStandardMaterial
        color={ENEMY_PRESENTATION.arrow.color}
        roughness={ENEMY_PRESENTATION.arrow.roughness}
      />
    </instancedMesh>
  )
}

function EnemyVisibilitySampler() {
  const { camera } = useThree()
  const frustum = useMemo(() => new Frustum(), [])
  const projection = useMemo(() => new Matrix4(), [])
  const point = useMemo(() => new Vector3(), [])

  useFrame(() => {
    projection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    )
    frustum.setFromProjectionMatrix(projection)
    for (const enemy of enemyRuntime.records) {
      point.set(enemy.x, enemy.y, enemy.z)
      enemy.inFrustum = enemy.phase === 'Alive' && frustum.containsPoint(point)
    }
  })

  return null
}

export type EnemiesProps = {
  readonly spawns?: readonly EnemySpawnLike[]
}

export function Enemies({ spawns }: EnemiesProps = {}) {
  const [, rerender] = useReducer((value: number) => value + 1, 0)
  const scene = getWorldConfiguration().scene

  useEffect(() => {
    const unsubscribe = subscribeEnemyRoster(rerender)
    setEnemyHeightSampler(getWorldConfiguration().sampleHeight)
    if (!isEnemySceneInitialized(scene)) {
      if (spawns) initializeEnemyRoster(spawns)
      else initializeDefaultRoster()
    }
    return unsubscribe
  }, [scene, spawns])

  return (
    <>
      {enemyRuntime.records.map((enemy) => (
        <Enemy key={enemy.id} enemy={enemy} />
      ))}
      <EnemyProjectiles />
      {import.meta.env.DEV && <EnemyVisibilitySampler />}
    </>
  )
}
