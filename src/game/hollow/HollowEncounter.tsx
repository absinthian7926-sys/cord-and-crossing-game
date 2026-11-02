import { useBeforePhysicsStep } from '@react-three/rapier'
import { useEffect, useSyncExternalStore } from 'react'
import { Enemies } from '../enemies/Enemies'
import { enemyRuntime, type EnemySpawnLike } from '../enemies/enemyRuntime'
import { emitQuestEvent } from '../quest/questRuntime'
import {
  getHollowRuntimeSnapshot,
  markHollowEnemyDefeated,
  registerHollowClearHandler,
  subscribeHollowRuntime,
} from './hollowRuntime'
import { HOLLOW_LAYOUT } from './hollow'

const FINAL_ENEMY_IDS = [
  'hollow-final-brigand-1',
  'hollow-final-brigand-2',
  'hollow-final-archer',
] as const

const HOLLOW_FINAL_SPAWNS: readonly EnemySpawnLike[] = [
  {
    id: FINAL_ENEMY_IDS[0],
    type: 'roadBrigand',
    x: HOLLOW_LAYOUT.encounterCenter[0] + HOLLOW_LAYOUT.encounterOffsets[0][0],
    z: HOLLOW_LAYOUT.encounterCenter[1] + HOLLOW_LAYOUT.encounterOffsets[0][1],
    respawns: false,
  },
  {
    id: FINAL_ENEMY_IDS[1],
    type: 'roadBrigand',
    x: HOLLOW_LAYOUT.encounterCenter[0] + HOLLOW_LAYOUT.encounterOffsets[1][0],
    z: HOLLOW_LAYOUT.encounterCenter[1] + HOLLOW_LAYOUT.encounterOffsets[1][1],
    respawns: false,
  },
  {
    id: FINAL_ENEMY_IDS[2],
    type: 'brigandArcher',
    x: HOLLOW_LAYOUT.encounterCenter[0] + HOLLOW_LAYOUT.encounterOffsets[2][0],
    z: HOLLOW_LAYOUT.encounterCenter[1] + HOLLOW_LAYOUT.encounterOffsets[2][1],
    respawns: false,
  },
]

function FinalEncounterCompletion() {
  useBeforePhysicsStep(() => {
    for (let index = 0; index < FINAL_ENEMY_IDS.length; index += 1) {
      const id = FINAL_ENEMY_IDS[index]
      for (
        let enemyIndex = 0;
        enemyIndex < enemyRuntime.records.length;
        enemyIndex += 1
      ) {
        const enemy = enemyRuntime.records[enemyIndex]
        if (enemy.id === id && enemy.hp <= 0) {
          markHollowEnemyDefeated(index)
          break
        }
      }
    }
  })
  return null
}

export function HollowEncounter() {
  const snapshot = useSyncExternalStore(
    subscribeHollowRuntime,
    getHollowRuntimeSnapshot,
    getHollowRuntimeSnapshot,
  )

  useEffect(() => {
    registerHollowClearHandler(() => emitQuestEvent('hollowCleared'))
    return () => registerHollowClearHandler(null)
  }, [])

  if (!snapshot.progress.snagPulled || snapshot.progress.encounterDefeated)
    return null

  return (
    <>
      <Enemies spawns={HOLLOW_FINAL_SPAWNS} />
      <FinalEncounterCompletion />
    </>
  )
}
