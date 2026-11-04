import { useEffect, useSyncExternalStore } from 'react'
import { Hollen } from '../npc/Hollen'
import {
  ensureCampEnemyBreakoff,
  ensureCampLeaderSpawned,
  releaseCampEnemyRespawns,
  registerCampLeaderDefeatedHandler,
  setCampLeaderDefeated,
} from '../enemies/enemyRuntime'
import { FrameShelterKey } from './FrameShelterKey'
import {
  defaultCampKeyDropPosition,
  resolveCampKeyDropPosition,
} from './keyDrop'
import {
  getQuestRuntimeSnapshot,
  markCampLeaderDefeated,
  restorePendingKeyDrop,
  setHollenNearby,
  setHollenNearbyTransient,
  subscribeQuestRuntime,
} from './questRuntime'

const fallbackKeyDrop = defaultCampKeyDropPosition()

export function QuestWorld() {
  const snapshot = useSyncExternalStore(
    subscribeQuestRuntime,
    getQuestRuntimeSnapshot,
    getQuestRuntimeSnapshot,
  )

  useEffect(() => {
    registerCampLeaderDefeatedHandler((_id, x, _y, z) => {
      markCampLeaderDefeated(resolveCampKeyDropPosition({ x, y: 0, z }))
    })
    return () => registerCampLeaderDefeatedHandler(null)
  }, [])

  useEffect(() => {
    setCampLeaderDefeated(snapshot.campLeaderDefeated)
    ensureCampLeaderSpawned({
      questStep: snapshot.quest.currentStep,
      keyLooted: snapshot.quest.keyLooted,
      leaderDefeated: snapshot.campLeaderDefeated,
    })
    if (
      snapshot.campLeaderDefeated &&
      !snapshot.quest.keyLooted &&
      snapshot.keyDrop === null
    )
      restorePendingKeyDrop(fallbackKeyDrop)
    if (
      snapshot.campLeaderDefeated &&
      !snapshot.quest.keyLooted &&
      snapshot.keyDrop !== null
    )
      ensureCampEnemyBreakoff()
  }, [
    snapshot.campLeaderDefeated,
    snapshot.keyDrop,
    snapshot.quest.currentStep,
    snapshot.quest.keyLooted,
  ])

  useEffect(() => {
    if (snapshot.quest.keyLooted) releaseCampEnemyRespawns()
  }, [snapshot.quest.keyLooted])

  return (
    <>
      <Hollen
        dialogueOpen={snapshot.dialogue.currentNodeId !== null}
        onProximityChange={setHollenNearby}
        onTransientProximityChange={setHollenNearbyTransient}
      />
      <FrameShelterKey />
    </>
  )
}
